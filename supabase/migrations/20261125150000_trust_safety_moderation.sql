-- ============================================================================
-- Trust & Safety — moderação automática de conteúdo
--
-- Fluxo (falha fechada):
--   1. O cliente grava o post/resposta/tópico normalmente (RLS de sempre).
--   2. Gatilho BEFORE marca moderation_status = 'pending' (o cliente não escolhe
--      o próprio status) e coloca o item na moderation_queue.
--   3. Enquanto 'pending', a RLS esconde o item de todo mundo, menos do autor e
--      da equipe. Avisos a seguidores e menções só saem depois da aprovação.
--   4. O servidor (/api/moderation/*, service role) classifica e grava o
--      veredito: approved (com is_nsfw true/false), review, blocked.
--   5. Bloqueado = quarentena: continua salvo, invisível, com log de auditoria,
--      e o autor pode pedir revisão (moderation_appeals).
--
-- Perfil e tópicos já publicados usam pós-moderação nas EDIÇÕES (continuam no
-- ar enquanto a nova versão é checada); perfil bloqueado volta ao valor anterior.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Colunas de moderação
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['posts', 'replies', 'custom_topics'] loop
    execute format('alter table public.%I add column if not exists moderation_status text not null default %L', t, 'approved');
    execute format('alter table public.%I add column if not exists is_nsfw boolean not null default false', t);
    execute format('alter table public.%I add column if not exists moderation_reason text', t);
    execute format('alter table public.%I add column if not exists moderation_categories jsonb', t);
    execute format('alter table public.%I add column if not exists flagged_at timestamptz', t);
    execute format('alter table public.%I add column if not exists moderated_at timestamptz', t);
    execute format('alter table public.%I add column if not exists moderation_hash text', t);
    execute format('alter table public.%I drop constraint if exists %I', t, t || '_moderation_status_check');
    execute format(
      'alter table public.%I add constraint %I check (moderation_status in (''pending'', ''approved'', ''review'', ''blocked'', ''appealed''))',
      t, t || '_moderation_status_check'
    );
  end loop;
end $$;

-- avisos de "novo post" saem uma vez só (na primeira aprovação)
alter table public.posts add column if not exists announced_at timestamptz;
update public.posts set announced_at = coalesce(announced_at, created_at) where announced_at is null;

create index if not exists posts_moderation_idx on public.posts (moderation_status) where moderation_status <> 'approved';
create index if not exists replies_moderation_idx on public.replies (moderation_status) where moderation_status <> 'approved';

-- ---------------------------------------------------------------------------
-- 2. Auditoria, fila e recursos
-- ---------------------------------------------------------------------------
create table if not exists public.moderation_logs (
  id bigint generated always as identity primary key,
  entity_type text not null check (entity_type in ('post', 'reply', 'topic', 'profile')),
  entity_id text not null,
  profile_id uuid references public.profiles(id) on delete set null,
  verdict text not null check (verdict in ('ALLOW', 'NSFW', 'REVIEW', 'BLOCK')),
  action text not null default 'auto', -- auto | fallback | appeal_approved | appeal_rejected | manual_*
  reason text,
  categories jsonb,
  scores jsonb,
  provider text,
  content_hash text,
  excerpt text,
  media_urls text[],
  reviewer_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists moderation_logs_entity_idx on public.moderation_logs (entity_type, entity_id, created_at desc);
create index if not exists moderation_logs_profile_idx on public.moderation_logs (profile_id, created_at desc);

create table if not exists public.moderation_queue (
  entity_type text not null,
  entity_id text not null,
  profile_id uuid references public.profiles(id) on delete cascade,
  content_hash text,
  previous jsonb, -- perfil: últimos valores aprovados (para reverter)
  enqueued_at timestamptz not null default now(),
  attempts int not null default 0,
  last_error text,
  primary key (entity_type, entity_id)
);
create index if not exists moderation_queue_profile_idx on public.moderation_queue (profile_id);

create table if not exists public.moderation_appeals (
  id bigint generated always as identity primary key,
  entity_type text not null check (entity_type in ('post', 'reply', 'topic', 'profile')),
  entity_id text not null,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  message text check (char_length(coalesce(message, '')) <= 1000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  resolution_note text,
  resolved_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create unique index if not exists moderation_appeals_open_idx
  on public.moderation_appeals (entity_type, entity_id) where status = 'pending';

alter table public.moderation_logs enable row level security;
alter table public.moderation_queue enable row level security;
alter table public.moderation_appeals enable row level security;

drop policy if exists moderation_logs_staff on public.moderation_logs;
create policy moderation_logs_staff on public.moderation_logs for select to authenticated
  using (public.is_insight_staff());
drop policy if exists moderation_appeals_read on public.moderation_appeals;
create policy moderation_appeals_read on public.moderation_appeals for select to authenticated
  using (profile_id = public.current_profile_id() or public.is_insight_staff());
-- fila: sem políticas (só o servidor)
revoke all on public.moderation_logs, public.moderation_queue, public.moderation_appeals from anon;
grant select on public.moderation_logs, public.moderation_appeals to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Impressão digital do conteúdo moderável (só textos e URLs: votos,
--    contadores, larguras e checkboxes não disparam nova análise)
-- ---------------------------------------------------------------------------
create or replace function public.moderation_text_hash(p_text text, p_json jsonb)
returns text
language sql
immutable
set search_path = public
as $$
  select md5(coalesce(p_text, '') || '|' || coalesce((
    select string_agg(v #>> '{}', '|')
    from jsonb_path_query(coalesce(p_json, 'null'::jsonb), 'strict $.** ? (@.type() == "string")') v
  ), ''))
$$;

create or replace function public.moderation_enqueue(
  p_type text, p_id text, p_profile uuid, p_hash text, p_previous jsonb default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- chamada pelo app (via gatilho): só para o próprio perfil (ou equipe)
  if current_setting('role', true) = 'authenticated'
     and p_profile is distinct from public.current_profile_id()
     and not public.is_insight_staff() then
    raise exception 'moderation_enqueue_forbidden' using errcode = '42501';
  end if;
  insert into public.moderation_queue (entity_type, entity_id, profile_id, content_hash, previous)
  values (p_type, p_id, p_profile, p_hash, p_previous)
  on conflict (entity_type, entity_id) do update
    set content_hash = excluded.content_hash,
        enqueued_at = now(),
        attempts = 0,
        last_error = null,
        -- perfil: guarda o ÚLTIMO valor aprovado, não o intermediário
        previous = coalesce(public.moderation_queue.previous, excluded.previous);
end;
$$;
revoke all on function public.moderation_enqueue(text, text, uuid, text, jsonb) from public, anon;
-- os gatilhos rodam com o papel de quem grava, então precisam poder chamar
grant execute on function public.moderation_enqueue(text, text, uuid, text, jsonb) to authenticated;

-- Interruptor geral: desligado = tudo aprovado na hora (como antes). Ligar só
-- depois que o servidor de moderação estiver publicado:
--   update public.moderation_settings set enabled = true;
create table if not exists public.moderation_settings (
  id int primary key default 1 check (id = 1),
  enabled boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into public.moderation_settings (id) values (1) on conflict do nothing;
alter table public.moderation_settings enable row level security;
drop policy if exists moderation_settings_read on public.moderation_settings;
create policy moderation_settings_read on public.moderation_settings for select using (true);
revoke insert, update, delete on public.moderation_settings from anon, authenticated;

create or replace function public.moderation_enabled()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select enabled from public.moderation_settings where id = 1), false)
$$;

-- ---------------------------------------------------------------------------
-- 4. Limites contra abuso (antes de gravar)
-- ---------------------------------------------------------------------------
create or replace function public.moderation_rate_guard(p_kind text, p_profile uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  short_n int; day_n int; strikes int;
begin
  if p_profile is null then return; end if;
  -- 3 bloqueios em 24h = pausa de 1h para publicar
  select count(*) into strikes from public.moderation_logs
   where profile_id = p_profile and verdict = 'BLOCK' and action in ('auto', 'fallback')
     and created_at > now() - interval '24 hours';
  if strikes >= 3 and exists (
    select 1 from public.moderation_logs
     where profile_id = p_profile and verdict = 'BLOCK' and created_at > now() - interval '1 hour'
  ) then
    raise exception 'moderation_cooldown' using errcode = '42501',
      hint = 'Muitos conteúdos bloqueados em sequência. Tente de novo em 1 hora.';
  end if;

  if p_kind = 'post' then
    select count(*) filter (where created_at > now() - interval '10 minutes'),
           count(*) filter (where created_at > now() - interval '1 day')
      into short_n, day_n
      from public.posts where (profile_id = p_profile or author_id = p_profile) and created_at > now() - interval '1 day';
    if short_n >= 8 or day_n >= 60 then
      raise exception 'rate_limited' using errcode = '42501', hint = 'Você publicou muitos Insights em pouco tempo. Aguarde alguns minutos.';
    end if;
  elsif p_kind = 'reply' then
    select count(*) filter (where created_at > now() - interval '5 minutes'),
           count(*) filter (where created_at > now() - interval '1 day')
      into short_n, day_n
      from public.replies where profile_id = p_profile and created_at > now() - interval '1 day';
    if short_n >= 15 or day_n >= 300 then
      raise exception 'rate_limited' using errcode = '42501', hint = 'Muitas respostas em pouco tempo. Aguarde alguns minutos.';
    end if;
  end if;
end;
$$;
revoke all on function public.moderation_rate_guard(text, uuid) from public, anon;
grant execute on function public.moderation_rate_guard(text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Gatilhos de guarda (só para gravações vindas do app; o servidor com
--    service role grava os vereditos sem passar por aqui)
-- ---------------------------------------------------------------------------
-- SECURITY INVOKER de propósito: current_user precisa ser o papel de quem grava
create or replace function public.posts_moderation_guard()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  h text := public.moderation_text_hash(new.content, new.blocks);
  who uuid := coalesce(new.author_id, new.profile_id);
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if not public.moderation_enabled() then
    -- moderação desligada: comportamento antigo (aprovado na hora)
    if tg_op = 'INSERT' then
      new.moderation_status := 'approved';
      new.is_nsfw := false;
    else
      new.moderation_status := old.moderation_status;
      new.is_nsfw := old.is_nsfw;
    end if;
    new.moderation_hash := h;
    return new;
  end if;
  if tg_op = 'INSERT' then
    perform public.moderation_rate_guard('post', who);
    new.moderation_status := 'pending';
    new.is_nsfw := false;
    new.moderation_reason := null;
    new.moderation_categories := null;
    new.flagged_at := null;
    new.moderated_at := null;
    new.moderation_hash := h;
    new.announced_at := null;
    perform public.moderation_enqueue('post', new.id::text, who, h);
    return new;
  end if;
  -- UPDATE: o cliente nunca muda os campos de moderação
  new.moderation_status := old.moderation_status;
  new.is_nsfw := old.is_nsfw;
  new.moderation_reason := old.moderation_reason;
  new.moderation_categories := old.moderation_categories;
  new.flagged_at := old.flagged_at;
  new.moderated_at := old.moderated_at;
  new.announced_at := old.announced_at;
  if h is distinct from old.moderation_hash then
    -- conteúdo mudou: volta para análise (um bloqueado editado também é reavaliado)
    new.moderation_status := 'pending';
    new.moderation_hash := h;
    perform public.moderation_enqueue('post', new.id::text, who, h);
  else
    new.moderation_hash := old.moderation_hash;
  end if;
  return new;
end;
$$;

drop trigger if exists posts_moderation_guard on public.posts;
create trigger posts_moderation_guard before insert or update on public.posts
  for each row execute function public.posts_moderation_guard();

-- SECURITY INVOKER de propósito: current_user precisa ser o papel de quem grava
create or replace function public.replies_moderation_guard()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  h text := public.moderation_text_hash(new.content, new.blocks);
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if not public.moderation_enabled() then
    -- moderação desligada: comportamento antigo (aprovado na hora)
    if tg_op = 'INSERT' then
      new.moderation_status := 'approved';
      new.is_nsfw := false;
    else
      new.moderation_status := old.moderation_status;
      new.is_nsfw := old.is_nsfw;
    end if;
    new.moderation_hash := h;
    return new;
  end if;
  if tg_op = 'INSERT' then
    perform public.moderation_rate_guard('reply', new.profile_id);
    new.moderation_status := 'pending';
    new.is_nsfw := false;
    new.moderation_reason := null;
    new.moderation_categories := null;
    new.flagged_at := null;
    new.moderated_at := null;
    new.moderation_hash := h;
    perform public.moderation_enqueue('reply', new.id::text, new.profile_id, h);
    return new;
  end if;
  new.moderation_status := old.moderation_status;
  new.is_nsfw := old.is_nsfw;
  new.moderation_reason := old.moderation_reason;
  new.moderation_categories := old.moderation_categories;
  new.flagged_at := old.flagged_at;
  new.moderated_at := old.moderated_at;
  if h is distinct from old.moderation_hash then
    new.moderation_status := 'pending';
    new.moderation_hash := h;
    perform public.moderation_enqueue('reply', new.id::text, new.profile_id, h);
  else
    new.moderation_hash := old.moderation_hash;
  end if;
  return new;
end;
$$;

drop trigger if exists replies_moderation_guard on public.replies;
create trigger replies_moderation_guard before insert or update on public.replies
  for each row execute function public.replies_moderation_guard();

-- SECURITY INVOKER de propósito: current_user precisa ser o papel de quem grava
create or replace function public.topics_moderation_guard()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  h text := public.moderation_text_hash(coalesce(new.name, '') || ' ' || coalesce(new.tag, '') || ' ' || coalesce(new.banner_url, ''),
                                        jsonb_build_array(new.description_blocks, new.workspace_data));
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if not public.moderation_enabled() then
    -- moderação desligada: comportamento antigo (aprovado na hora)
    if tg_op = 'INSERT' then
      new.moderation_status := 'approved';
      new.is_nsfw := false;
    else
      new.moderation_status := old.moderation_status;
      new.is_nsfw := old.is_nsfw;
    end if;
    new.moderation_hash := h;
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.moderation_status := 'pending';
    new.is_nsfw := false;
    new.moderation_reason := null;
    new.moderation_categories := null;
    new.flagged_at := null;
    new.moderated_at := null;
    new.moderation_hash := h;
    perform public.moderation_enqueue('topic', new.id::text, new.profile_id, h);
    return new;
  end if;
  new.moderation_status := old.moderation_status;
  new.is_nsfw := old.is_nsfw;
  new.moderation_reason := old.moderation_reason;
  new.moderation_categories := old.moderation_categories;
  new.flagged_at := old.flagged_at;
  new.moderated_at := old.moderated_at;
  if h is distinct from old.moderation_hash then
    -- tópico no ar: pós-moderação (continua visível; bloqueado é reavaliado)
    if old.moderation_status = 'blocked' then
      new.moderation_status := 'pending';
    end if;
    new.moderation_hash := h;
    perform public.moderation_enqueue('topic', new.id::text, new.profile_id, h);
  else
    new.moderation_hash := old.moderation_hash;
  end if;
  return new;
end;
$$;

drop trigger if exists topics_moderation_guard on public.custom_topics;
create trigger topics_moderation_guard before insert or update on public.custom_topics
  for each row execute function public.topics_moderation_guard();

-- Perfil: nome, apelido, bio, avatar, capa. Pós-moderação com valor anterior guardado.
-- SECURITY INVOKER de propósito: current_user precisa ser o papel de quem grava
create or replace function public.profiles_moderation_watch()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  h text;
  oh text;
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if not public.moderation_enabled() then
    return new;
  end if;
  h := md5(concat_ws('|', new.display_name, new.full_name, new.nickname, new.bio, new.avatar_url, new.cover_url, new.banner_url));
  oh := md5(concat_ws('|', old.display_name, old.full_name, old.nickname, old.bio, old.avatar_url, old.cover_url, old.banner_url));
  if h is distinct from oh then
    perform public.moderation_enqueue('profile', new.id::text, new.id, h,
      jsonb_build_object('display_name', old.display_name, 'full_name', old.full_name, 'nickname', old.nickname,
                         'bio', old.bio, 'avatar_url', old.avatar_url, 'cover_url', old.cover_url, 'banner_url', old.banner_url));
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_moderation_watch on public.profiles;
create trigger profiles_moderation_watch before update on public.profiles
  for each row execute function public.profiles_moderation_watch();

-- ---------------------------------------------------------------------------
-- 6. Visibilidade: pendente/em revisão/bloqueado só para autor e equipe
-- ---------------------------------------------------------------------------
drop policy if exists posts_select_visible on public.posts;
create policy posts_select_visible on public.posts for select
  using (
    (coalesce(visibility, 'public') <> 'private' and coalesce(is_draft, false) = false and moderation_status = 'approved')
    or profile_id = public.current_profile_id()
    or author_id = public.current_profile_id()
    or public.is_insight_staff()
  );

drop policy if exists "Leitura pública de respostas" on public.replies;
drop policy if exists replies_select_anon on public.replies;
drop policy if exists replies_select_visible on public.replies;
create policy replies_select_visible on public.replies for select
  using (
    moderation_status = 'approved'
    or profile_id = public.current_profile_id()
    or public.is_insight_staff()
  );

drop policy if exists "Leitura publica de topicos" on public.custom_topics;
drop policy if exists custom_topics_select_visible on public.custom_topics;
create policy custom_topics_select_visible on public.custom_topics for select
  using (
    moderation_status = 'approved'
    or profile_id = public.current_profile_id()
    or public.is_insight_staff()
  );

-- curtir/repostar/salvar/votar só em conteúdo aprovado (ou no próprio)
create or replace function public.can_view_post(p_post_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.posts p
    where p.id = p_post_id
      and (
        (coalesce(p.visibility, 'public') <> 'private' and coalesce(p.is_draft, false) = false and p.moderation_status = 'approved')
        or p.profile_id = public.current_profile_id()
        or p.author_id = public.current_profile_id()
        or public.is_insight_staff()
      )
  )
$$;

-- ---------------------------------------------------------------------------
-- 7. Avisos só depois da aprovação
-- ---------------------------------------------------------------------------
create or replace function public.notify_followers_on_new_post()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  author_uuid uuid := coalesce(new.profile_id, new.author_id);
begin
  if new.moderation_status <> 'approved' or new.announced_at is not null then
    return new;
  end if;
  update public.posts set announced_at = now() where id = new.id;
  if author_uuid is null or coalesce(new.visibility, 'public') = 'private' or coalesce(new.is_draft, false) then
    return new;
  end if;
  insert into public.notifications (recipient_id, actor_id, type, post_id, content_preview, message)
  select f.follower_id, author_uuid, 'new_post', new.id,
         case when new.is_nsfw then '[Conteúdo +18]' else left(new.content, 120) end,
         case when new.is_nsfw then '[Conteúdo +18]' else left(new.content, 120) end
  from public.follows f
  where f.following_id = author_uuid and f.follower_id <> author_uuid;
  return new;
end;
$$;

drop trigger if exists trg_notify_followers_post on public.posts;
create trigger trg_notify_followers_post
  after insert or update of moderation_status on public.posts
  for each row execute function public.notify_followers_on_new_post();

create or replace function public.notify_post_mentions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := coalesce(new.author_id, new.profile_id);
  txt text := new.blocks::text || ' ' || coalesce(new.content, '');
  prev text[] := '{}';
  skip uuid[] := '{}';
  preview text;
begin
  if new.moderation_status <> 'approved' or coalesce(new.visibility, 'public') = 'private' or coalesce(new.is_draft, false) then
    return new;
  end if;
  -- só não repete quem já tinha sido avisado numa versão aprovada anterior
  if tg_op = 'UPDATE' and old.moderation_status = 'approved'
     and not (coalesce(old.visibility, 'public') = 'private' or coalesce(old.is_draft, false)) then
    prev := public.extract_mentions(old.blocks::text || ' ' || coalesce(old.content, ''));
    select coalesce(array_agg(id), '{}') into skip from public.profiles where lower(username) = any(prev);
  end if;
  preview := case when new.is_nsfw then '[Conteúdo +18]' else left(regexp_replace(regexp_replace(coalesce((
    select string_agg(b ->> 'html', ' ') from jsonb_array_elements(
      case when jsonb_typeof(new.blocks) = 'array' then new.blocks else '[]'::jsonb end) b
    where b ->> 'html' is not null
  ), new.content, ''), '<[^>]+>', ' ', 'g'), '\s+', ' ', 'g'), 140) end;
  perform public.notify_mentions(actor, new.id, txt, trim(preview), skip);
  return new;
end;
$$;

drop trigger if exists posts_notify_mentions on public.posts;
create trigger posts_notify_mentions
  after insert or update of blocks, content, visibility, is_draft, moderation_status on public.posts
  for each row execute function public.notify_post_mentions();

-- menções em respostas: só quando aprovada
create or replace function public.notify_reply_mentions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  txt text := coalesce(new.content, '') || ' ' || coalesce(new.blocks::text, '');
begin
  if new.moderation_status <> 'approved' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.moderation_status = 'approved' then
    return new;
  end if;
  if not exists (
    select 1 from public.posts p where p.id = new.post_id
      and coalesce(p.visibility, 'public') <> 'private' and coalesce(p.is_draft, false) = false
      and p.moderation_status = 'approved'
  ) then
    return new;
  end if;
  perform public.notify_mentions(new.profile_id, new.post_id, txt, left(coalesce(new.content, ''), 140), '{}');
  return new;
end;
$$;

drop trigger if exists replies_notify_mentions on public.replies;
create trigger replies_notify_mentions
  after insert or update of moderation_status on public.replies
  for each row execute function public.notify_reply_mentions();

-- ---------------------------------------------------------------------------
-- 8. Impressão digital do que já existe (para a 1ª edição não contar como mudança)
-- ---------------------------------------------------------------------------
update public.posts set moderation_hash = public.moderation_text_hash(content, blocks) where moderation_hash is null;
update public.replies set moderation_hash = public.moderation_text_hash(content, blocks) where moderation_hash is null;
update public.custom_topics
   set moderation_hash = public.moderation_text_hash(coalesce(name, '') || ' ' || coalesce(tag, '') || ' ' || coalesce(banner_url, ''),
                                                    jsonb_build_array(description_blocks, workspace_data))
 where moderation_hash is null;
