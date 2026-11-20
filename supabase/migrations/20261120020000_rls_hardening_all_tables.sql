-- ============================================================================
-- Correção de segurança (RLS) em todas as tabelas expostas
--
-- Resumo do que estava aberto antes desta migração:
--   posts ............ anônimos editavam/apagavam posts do fundador; qualquer
--                      um editava qualquer post; posts privados legíveis por todos
--   replies .......... anônimos criavam respostas com autor falso; qualquer
--                      logado apagava qualquer resposta
--   notifications .... qualquer logado lia/editava notificações de todos e
--                      criava notificações em nome de terceiros
--   follows .......... qualquer logado seguia/deixava de seguir por outra pessoa
--   custom_topics .... qualquer logado criava/editava/apagava tópicos de todos
--   updates .......... anônimos criavam/editavam/apagavam atualizações oficiais
--   subscribers ...... lista de e-mails pública; qualquer um alterava inscrições
--   push_subscriptions endpoints públicos; qualquer um alterava/apagava
--   invite_codes ..... lista de convites pública; qualquer um alterava convites
--   reports .......... denúncia em nome de outra pessoa
--
-- Escritas legítimas que dependiam dessas regras foram movidas para funções
-- SECURITY DEFINER com validação (enquete, repost, newsletter, convite).
-- Idempotente.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. Helpers
-- ---------------------------------------------------------------------------
create or replace function public.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.profiles
  where user_id = auth.uid() or id = auth.uid()
  limit 1
$$;

create or replace function public.is_insight_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where (user_id = auth.uid() or id = auth.uid()) and role = 'admin'
  )
$$;

grant execute on function public.current_profile_id() to anon, authenticated;
grant execute on function public.is_insight_admin() to anon, authenticated;

-- ===========================================================================
-- 1. POSTS
-- ===========================================================================
drop policy if exists "Admin gerencia posts" on public.posts;
drop policy if exists "Admin deleta posts" on public.posts;
drop policy if exists "posts_delete_admin_only" on public.posts;
drop policy if exists "Qualquer um pode inserir posts" on public.posts;
drop policy if exists "Admin cria posts" on public.posts;
drop policy if exists "posts_insert_anon" on public.posts;
drop policy if exists "Atualizar interacoes e edicao de posts" on public.posts;
drop policy if exists "Atualização de interações nos posts" on public.posts;
drop policy if exists "posts_update_admin_only" on public.posts;
drop policy if exists "Posts são públicos para leitura" on public.posts;
drop policy if exists "posts_select_anon" on public.posts;
drop policy if exists "Leitura pública de posts" on public.posts;
drop policy if exists "Usuários criam posts no próprio perfil" on public.posts;
drop policy if exists "Dono ou Staff atualiza posts" on public.posts;
drop policy if exists "Dono ou Staff exclui posts" on public.posts;
drop policy if exists "posts_select_visible" on public.posts;
drop policy if exists "posts_insert_own" on public.posts;
drop policy if exists "posts_update_owner_or_staff" on public.posts;
drop policy if exists "posts_delete_owner_or_staff" on public.posts;

-- Leitura: públicos e publicados para todos; privados/rascunhos só dono e equipe
create policy "posts_select_visible" on public.posts
  for select using (
    (coalesce(visibility, 'public') <> 'private' and coalesce(is_draft, false) = false)
    or profile_id = public.current_profile_id()
    or author_id = public.current_profile_id()
    or public.is_insight_staff()
  );

create policy "posts_insert_own" on public.posts
  for insert to authenticated
  with check (profile_id = public.current_profile_id() or public.is_insight_staff());

create policy "posts_update_owner_or_staff" on public.posts
  for update to authenticated
  using (
    profile_id = public.current_profile_id()
    or author_id = public.current_profile_id()
    or public.is_insight_staff()
  )
  with check (
    profile_id = public.current_profile_id()
    or author_id = public.current_profile_id()
    or public.is_insight_staff()
  );

create policy "posts_delete_owner_or_staff" on public.posts
  for delete to authenticated
  using (
    profile_id = public.current_profile_id()
    or author_id = public.current_profile_id()
    or public.is_insight_staff()
  );

-- Contadores e dono do post só mudam pelo banco (RPCs/triggers)
create or replace function public.protect_post_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Mantém a coluna visibility coerente com a marcação nos blocos
  if new.blocks is not null
     and jsonb_typeof(new.blocks) = 'array'
     and new.blocks -> 0 ->> 'postVisibility' in ('public', 'private') then
    new.visibility := new.blocks -> 0 ->> 'postVisibility';
  end if;

  if tg_op = 'UPDATE' and current_user in ('authenticated', 'anon') then
    if pg_trigger_depth() <= 1 then
      new.likes_count := old.likes_count;
      new.replies_count := old.replies_count;
      new.reposts_count := old.reposts_count;
      new.views_count := old.views_count;
    end if;
    if not public.is_insight_staff() then
      new.profile_id := old.profile_id;
      new.author_id := old.author_id;
    end if;
  end if;

  if tg_op = 'INSERT' and current_user in ('authenticated', 'anon') then
    new.likes_count := 0;
    new.replies_count := 0;
    new.reposts_count := 0;
    new.views_count := 0;
  end if;

  return new;
end;
$$;

drop trigger if exists posts_protect_columns on public.posts;
create trigger posts_protect_columns
  before insert or update on public.posts
  for each row execute function public.protect_post_columns();

-- O contador de respostas já é recalculado por sync_replies_and_notify
-- (SECURITY DEFINER). Estes triggers gravavam no post alheio com a permissão
-- de quem respondia e não são mais necessários.
drop trigger if exists trg_replies_insert on public.replies;
drop trigger if exists trg_replies_delete on public.replies;

-- ---------- Enquetes: votos registrados por pessoa ----------
create table if not exists public.poll_votes (
  post_id    uuid not null references public.posts(id) on delete cascade,
  block_id   text not null,
  option_id  text not null,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, block_id, option_id, profile_id)
);

alter table public.poll_votes enable row level security;
drop policy if exists "poll_votes_select_own" on public.poll_votes;
create policy "poll_votes_select_own" on public.poll_votes
  for select using (profile_id = public.current_profile_id());

-- Substitui a seleção do usuário numa enquete e ajusta as contagens nos blocos.
-- Aplica delta sobre os votos existentes (preserva votos anteriores à tabela).
create or replace function public.vote_poll(
  target_post_id uuid,
  target_block_id text,
  option_ids text[]
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := public.current_profile_id();
  post_blocks jsonb;
  poll jsonb;
  valid_ids text[];
  chosen text[];
  previous text[];
  new_blocks jsonb;
begin
  if me is null then
    raise exception 'not_authenticated';
  end if;

  select blocks into post_blocks from public.posts where id = target_post_id for update;
  if post_blocks is null or jsonb_typeof(post_blocks) <> 'array' then
    raise exception 'post_not_found';
  end if;

  select b into poll
  from jsonb_array_elements(post_blocks) b
  where b ->> 'id' = target_block_id and b ->> 'type' = 'poll'
  limit 1;
  if poll is null then
    raise exception 'poll_not_found';
  end if;

  select coalesce(array_agg(o ->> 'id'), '{}') into valid_ids
  from jsonb_array_elements(coalesce(poll -> 'pollOptions', '[]'::jsonb)) o;

  select coalesce(array_agg(distinct x), '{}') into chosen
  from unnest(coalesce(option_ids, '{}')) x
  where x = any(valid_ids);

  if coalesce((poll ->> 'pollMultiple')::boolean, false) = false and cardinality(chosen) > 1 then
    chosen := chosen[1:1];
  end if;

  select coalesce(array_agg(option_id), '{}') into previous
  from public.poll_votes
  where post_id = target_post_id and block_id = target_block_id and profile_id = me;

  delete from public.poll_votes
  where post_id = target_post_id and block_id = target_block_id and profile_id = me;

  insert into public.poll_votes (post_id, block_id, option_id, profile_id)
  select target_post_id, target_block_id, x, me from unnest(chosen) x;

  select jsonb_agg(
    case when b ->> 'id' = target_block_id and b ->> 'type' = 'poll' then
      jsonb_set(b, '{pollOptions}', (
        select coalesce(jsonb_agg(
          jsonb_set(o, '{votes}', to_jsonb(greatest(0,
            (case when (o ->> 'votes') ~ '^\d+$' then (o ->> 'votes')::int else 0 end)
            - (case when (o ->> 'id') = any(previous) then 1 else 0 end)
            + (case when (o ->> 'id') = any(chosen) then 1 else 0 end)
          )))
          order by oi), '[]'::jsonb)
        from jsonb_array_elements(b -> 'pollOptions') with ordinality as po(o, oi)
      ))
    else b end
    order by bi)
  into new_blocks
  from jsonb_array_elements(post_blocks) with ordinality as pb(b, bi);

  update public.posts set blocks = new_blocks where id = target_post_id;

  return jsonb_build_object('blocks', new_blocks, 'selected', to_jsonb(chosen));
end;
$$;

revoke all on function public.vote_poll(uuid, text, text[]) from public, anon;
grant execute on function public.vote_poll(uuid, text, text[]) to authenticated;

-- ---------- Reposts registrados por pessoa ----------
create table if not exists public.post_reposts (
  post_id    uuid not null references public.posts(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, profile_id)
);

alter table public.post_reposts enable row level security;
drop policy if exists "post_reposts_select_all" on public.post_reposts;
create policy "post_reposts_select_all" on public.post_reposts
  for select using (true);

create or replace function public.toggle_post_repost(target_post_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := public.current_profile_id();
  reposted boolean;
  total integer;
begin
  if me is null then
    raise exception 'not_authenticated';
  end if;

  if exists (select 1 from public.post_reposts where post_id = target_post_id and profile_id = me) then
    delete from public.post_reposts where post_id = target_post_id and profile_id = me;
    reposted := false;
    update public.posts set reposts_count = greatest(coalesce(reposts_count, 0) - 1, 0)
    where id = target_post_id returning reposts_count into total;
  else
    insert into public.post_reposts (post_id, profile_id) values (target_post_id, me);
    reposted := true;
    update public.posts set reposts_count = coalesce(reposts_count, 0) + 1
    where id = target_post_id returning reposts_count into total;
  end if;

  return jsonb_build_object('reposted', reposted, 'reposts_count', coalesce(total, 0));
end;
$$;

revoke all on function public.toggle_post_repost(uuid) from public, anon;
grant execute on function public.toggle_post_repost(uuid) to authenticated;

-- ===========================================================================
-- 2. REPLIES
-- ===========================================================================
drop policy if exists "Admin deleta respostas" on public.replies;
drop policy if exists "replies_insert_anon" on public.replies;
drop policy if exists "Visitantes criam respostas" on public.replies;
drop policy if exists "replies_insert_own" on public.replies;
drop policy if exists "replies_delete_owner_post_owner_or_staff" on public.replies;

create policy "replies_insert_own" on public.replies
  for insert to authenticated
  with check (profile_id = public.current_profile_id());

create policy "replies_delete_owner_post_owner_or_staff" on public.replies
  for delete to authenticated
  using (
    profile_id = public.current_profile_id()
    or public.is_insight_staff()
    or exists (
      select 1 from public.posts p
      where p.id = replies.post_id
        and (p.profile_id = public.current_profile_id() or p.author_id = public.current_profile_id())
    )
  );

-- Autor da resposta vem sempre do perfil (impede se passar por outra pessoa)
create or replace function public.fill_reply_author()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  prof public.profiles;
begin
  if new.profile_id is not null then
    select * into prof from public.profiles where id = new.profile_id;
    if found then
      new.author_name := coalesce(nullif(prof.display_name, ''), nullif(prof.full_name, ''), prof.username);
      new.author_handle := prof.username;
      new.avatar_url := coalesce(prof.avatar_url, '/assets/net/default-perfil');
    end if;
  end if;

  if new.parent_reply_id is not null and not exists (
    select 1 from public.replies r where r.id = new.parent_reply_id and r.post_id = new.post_id
  ) then
    raise exception 'invalid_parent_reply';
  end if;

  new.likes_count := 0;
  return new;
end;
$$;

drop trigger if exists replies_fill_author on public.replies;
create trigger replies_fill_author
  before insert on public.replies
  for each row execute function public.fill_reply_author();

-- ===========================================================================
-- 3. NOTIFICATIONS
-- ===========================================================================
drop policy if exists "notifications_insert_auth" on public.notifications;
drop policy if exists "Apenas dono vê notificações" on public.notifications;
drop policy if exists "Apenas dono atualiza notificações" on public.notifications;
drop policy if exists "notifications_select_own" on public.notifications;
drop policy if exists "notifications_update_own" on public.notifications;
drop policy if exists "notifications_delete_own" on public.notifications;
drop policy if exists "notifications_insert_as_actor" on public.notifications;

-- Leitura: as próprias; avisos de sistema (atualizações oficiais) são públicos
create policy "notifications_select_own" on public.notifications
  for select using (
    recipient_id = public.current_profile_id()
    or type = 'system'
    or public.is_insight_admin()
  );

-- Criação: sempre em nome de quem está logado; avisos de sistema só admin
create policy "notifications_insert_as_actor" on public.notifications
  for insert to authenticated
  with check (
    (actor_id = public.current_profile_id() and recipient_id is not null and type <> 'system')
    or public.is_insight_admin()
  );

create policy "notifications_update_own" on public.notifications
  for update to authenticated
  using (recipient_id = public.current_profile_id() or public.is_insight_admin())
  with check (recipient_id = public.current_profile_id() or public.is_insight_admin());

create policy "notifications_delete_own" on public.notifications
  for delete to authenticated
  using (recipient_id = public.current_profile_id() or public.is_insight_admin());

-- ===========================================================================
-- 4. FOLLOWS
-- ===========================================================================
drop policy if exists "Utilizadores autenticados podem deixar de seguir" on public.follows;
drop policy if exists "Utilizadores autenticados podem seguir" on public.follows;
drop policy if exists "follows_insert_self" on public.follows;
drop policy if exists "follows_delete_self" on public.follows;

create policy "follows_insert_self" on public.follows
  for insert to authenticated
  with check (follower_id = public.current_profile_id() and follower_id <> following_id);

create policy "follows_delete_self" on public.follows
  for delete to authenticated
  using (follower_id = public.current_profile_id() or public.is_insight_staff());

-- ===========================================================================
-- 5. CUSTOM_TOPICS
-- ===========================================================================
drop policy if exists "Admin gerencia topicos" on public.custom_topics;
drop policy if exists "custom_topics_insert_own" on public.custom_topics;
drop policy if exists "custom_topics_update_own" on public.custom_topics;
drop policy if exists "custom_topics_delete_own" on public.custom_topics;

create policy "custom_topics_insert_own" on public.custom_topics
  for insert to authenticated
  with check (profile_id = public.current_profile_id() or public.is_insight_staff());

create policy "custom_topics_update_own" on public.custom_topics
  for update to authenticated
  using (profile_id = public.current_profile_id() or public.is_insight_staff())
  with check (profile_id = public.current_profile_id() or public.is_insight_staff());

create policy "custom_topics_delete_own" on public.custom_topics
  for delete to authenticated
  using (profile_id = public.current_profile_id() or public.is_insight_staff());

-- ===========================================================================
-- 6. UPDATES (atualizações oficiais) — só admin escreve
-- ===========================================================================
drop policy if exists "Admin gerencia updates" on public.updates;
drop policy if exists "updates_delete_admin_only" on public.updates;
drop policy if exists "updates_insert_admin_only" on public.updates;
drop policy if exists "updates_update_admin_only" on public.updates;
drop policy if exists "updates_write_admin" on public.updates;

create policy "updates_write_admin" on public.updates
  for all to authenticated
  using (public.is_insight_admin())
  with check (public.is_insight_admin());

-- ===========================================================================
-- 7. SUBSCRIBERS (newsletter) — lista privada; escrita via RPC
-- ===========================================================================
drop policy if exists "Visitantes podem se inscrever" on public.subscribers;
drop policy if exists "Admin lê inscritos" on public.subscribers;
drop policy if exists "Apenas admin vê inscritos" on public.subscribers;
drop policy if exists "Leitura pública de inscritos" on public.subscribers;
drop policy if exists "Visitantes atualizam preferências" on public.subscribers;
drop policy if exists "subscribers_admin_all" on public.subscribers;

create policy "subscribers_admin_all" on public.subscribers
  for all to authenticated
  using (public.is_insight_admin())
  with check (public.is_insight_admin());

create or replace function public.subscribe_newsletter(
  p_email text,
  p_notify_mode text default 'all',
  p_interested_tags text[] default '{}'
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  clean text := lower(trim(p_email));
  mode text := case when p_notify_mode in ('all', 'pinned', 'tags', 'official_only') then p_notify_mode else 'all' end;
  tags text[];
begin
  if clean !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(clean) > 254 then
    raise exception 'invalid_email';
  end if;

  select coalesce(array_agg(left(lower(t), 40)), '{}') into tags
  from (select unnest(coalesce(p_interested_tags, '{}')) t limit 30) s;

  insert into public.subscribers (email, notify_official_updates, notify_mode, interested_tags)
  values (clean, true, mode, case when mode = 'tags' then tags else '{}' end)
  on conflict (email) do update
    set notify_official_updates = true,
        notify_mode = excluded.notify_mode,
        interested_tags = excluded.interested_tags;
  return true;
end;
$$;

grant execute on function public.subscribe_newsletter(text, text, text[]) to anon, authenticated;

-- Preferências de um e-mail (para a tela de configurações). Não expõe a lista.
create or replace function public.get_newsletter_prefs(p_email text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('notify_mode', notify_mode, 'interested_tags', interested_tags)
  from public.subscribers
  where email = lower(trim(p_email))
  limit 1
$$;

grant execute on function public.get_newsletter_prefs(text) to anon, authenticated;

-- Contagem pública (página Sobre)
create or replace function public.count_newsletter_subscribers()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int from public.subscribers
$$;

grant execute on function public.count_newsletter_subscribers() to anon, authenticated;

-- ===========================================================================
-- 8. PUSH_SUBSCRIPTIONS — gravadas por /api/push (service role)
--    Mantém inserção pública (registro do navegador); o resto só admin.
-- ===========================================================================
drop policy if exists "Permitir exclusao publica de push_subscriptions" on public.push_subscriptions;
drop policy if exists "Permitir leitura publica de push_subscriptions" on public.push_subscriptions;
drop policy if exists "Permitir atualizacao publica de push_subscriptions" on public.push_subscriptions;
drop policy if exists "push_subscriptions_admin_all" on public.push_subscriptions;

create policy "push_subscriptions_admin_all" on public.push_subscriptions
  for all to authenticated
  using (public.is_insight_admin())
  with check (public.is_insight_admin());

-- ===========================================================================
-- 9. INVITE_CODES — lista privada; validação e uso via RPC
-- ===========================================================================
drop policy if exists "Leitura pública de códigos de convite" on public.invite_codes;
drop policy if exists "Incrementar uso de convite" on public.invite_codes;

create or replace function public.check_invite_code(p_code text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when ic.id is null then 'invalid'
    when ic.expires_at is not null and ic.expires_at < now() then 'expired'
    when coalesce(ic.uses_count, 0) >= coalesce(ic.max_uses, 1) then 'exhausted'
    else 'ok'
  end
  from (select 1) d
  left join public.invite_codes ic on ic.code = upper(trim(p_code))
$$;

grant execute on function public.check_invite_code(text) to anon, authenticated;

create or replace function public.redeem_invite_code(p_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := public.current_profile_id();
begin
  if me is null then
    return false;
  end if;
  update public.invite_codes
  set uses_count = coalesce(uses_count, 0) + 1,
      used_by = coalesce(used_by, me)
  where code = upper(trim(p_code))
    and coalesce(uses_count, 0) < coalesce(max_uses, 1)
    and (expires_at is null or expires_at > now());
  return found;
end;
$$;

revoke all on function public.redeem_invite_code(text) from public, anon;
grant execute on function public.redeem_invite_code(text) to authenticated;

-- ===========================================================================
-- 10. REPORTS — denúncia sempre em nome de quem está logado
-- ===========================================================================
drop policy if exists "Usuários autenticados enviam denúncias" on public.reports;
drop policy if exists "reports_insert_self" on public.reports;

create policy "reports_insert_self" on public.reports
  for insert to authenticated
  with check (reporter_id = public.current_profile_id());
