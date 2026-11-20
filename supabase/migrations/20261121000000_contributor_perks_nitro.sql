-- ============================================================================
-- Níveis de Contribuinte × Insight Nitro — separação definitiva
--
-- * Níveis (contributor_level, mantido por trg_sync_contributor_level a partir
--   de donations) controlam CAPACIDADE: cota de anexos por post (pós-compressão,
--   medida no R2), criação de tópicos etc.
-- * Nitro (R$ 3,99/mês) controla só cosméticos/VIP: nitro_status,
--   nitro_expires_at, has_lifetime_nitro.
-- * Ponte única: Nível 5 → has_lifetime_nitro = true (vitalício, não revoga).
--
-- Espelho no front: src/lib/contributorLevels.ts e src/lib/nitro/entitlement.ts
-- ============================================================================

-- ---------------------------------------------------------------- perfil
alter table public.profiles
  add column if not exists nitro_status text not null default 'none',
  add column if not exists nitro_expires_at timestamptz,
  add column if not exists has_lifetime_nitro boolean not null default false,
  add column if not exists nitro_subscription_id text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_nitro_status_check') then
    alter table public.profiles
      add constraint profiles_nitro_status_check
      check (nitro_status in ('none', 'active', 'past_due', 'canceled', 'expired'));
  end if;
end $$;

-- colunas de cobrança e patente só mudam por função privilegiada / webhook
create or replace function public.protect_profile_privileged_columns()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  caller public.profiles;
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  new.id := old.id;
  new.user_id := old.user_id;

  new.total_donated := old.total_donated;
  new.contributor_points := old.contributor_points;
  new.contributor_level := old.contributor_level;

  new.nitro_status := old.nitro_status;
  new.nitro_expires_at := old.nitro_expires_at;
  new.has_lifetime_nitro := old.has_lifetime_nitro;
  new.nitro_subscription_id := old.nitro_subscription_id;

  if pg_trigger_depth() <= 1 then
    new.followers_count := old.followers_count;
    new.posts_count := old.posts_count;
  end if;

  if new.role is distinct from old.role or new.status is distinct from old.status then
    select * into caller
    from public.profiles
    where user_id = auth.uid() or id = auth.uid()
    limit 1;

    if caller.role = 'admin' then
      return new;
    end if;

    if caller.role = 'moderator'
       and caller.id <> old.id
       and coalesce(old.role, 'user') in ('user', 'moderator')
       and coalesce(new.role, 'user') in ('user', 'moderator') then
      return new;
    end if;

    raise exception 'Sem permissão para alterar cargo ou status deste perfil.'
      using errcode = '42501';
  end if;

  return new;
end;
$function$;

-- Nível 5 → Nitro vitalício (roda por último: nome "zz")
create or replace function public.grant_lifetime_nitro()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if coalesce(new.contributor_level, 0) >= 5 then
    new.has_lifetime_nitro := true;
  elsif tg_op = 'UPDATE' and old.has_lifetime_nitro then
    -- vitalício é vitalício: estorno/queda de nível não remove
    new.has_lifetime_nitro := true;
  end if;
  return new;
end;
$function$;

drop trigger if exists profiles_zz_lifetime_nitro on public.profiles;
create trigger profiles_zz_lifetime_nitro
  before insert or update on public.profiles
  for each row execute function public.grant_lifetime_nitro();

update public.profiles set has_lifetime_nitro = true
where contributor_level >= 5 and not has_lifetime_nitro;

-- ---------------------------------------------------------------- regras
-- Portão de lançamento do Nitro (beta fechada = false). Trocar no lançamento.
create or replace function public.nitro_is_public()
returns boolean
language sql
immutable
as $$ select false $$;

create or replace function public.has_nitro_access(p public.profiles)
returns boolean
language sql
stable
set search_path to 'public'
as $$
  select case
    when p.id is null then false
    when p.role = 'admin' then true
    when not public.nitro_is_public() then false
    when coalesce(p.contributor_level, 0) >= 5 or p.has_lifetime_nitro then true
    when p.nitro_status in ('active', 'past_due', 'canceled')
         and p.nitro_expires_at > now() then true
    else false
  end
$$;

-- Cota de anexos por post (bytes, pós-compressão). Admin: teto máximo.
create or replace function public.contributor_upload_limit(p_level integer, p_role text default null)
returns bigint
language sql
immutable
as $$
  select case
    when p_role = 'admin' or coalesce(p_level, 0) >= 3 then 2147483648::bigint -- 2 GB
    when p_level = 2 then 838860800::bigint  -- 800 MB
    when p_level = 1 then 419430400::bigint  -- 400 MB
    else 52428800::bigint                    -- 50 MB
  end
$$;

-- ---------------------------------------------------------------- cosméticos
create or replace function public.set_my_cosmetics(p_cosmetics jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  me public.profiles;
  snap jsonb;
  k text;
begin
  select * into me
  from public.profiles
  where user_id = auth.uid() or id = auth.uid()
  limit 1;

  if me.id is null then
    raise exception 'not_authenticated';
  end if;

  if not public.has_nitro_access(me) then
    raise exception 'nitro_required';
  end if;

  if p_cosmetics is null or jsonb_typeof(p_cosmetics) <> 'object' then
    raise exception 'invalid_payload';
  end if;

  foreach k in array array['title', 'tag', 'frame', 'intro'] loop
    if p_cosmetics ? k and jsonb_typeof(p_cosmetics -> k) not in ('string', 'null') then
      raise exception 'invalid_field %', k;
    end if;
    if jsonb_typeof(p_cosmetics -> k) = 'string'
       and (p_cosmetics ->> k) !~ '^[a-z0-9-]{1,64}$' then
      raise exception 'invalid_item %', k;
    end if;
  end loop;

  foreach k in array array['frameEnabled', 'frameAnimated', 'introEnabled', 'levelAnimation', 'rainbow'] loop
    if p_cosmetics ? k and jsonb_typeof(p_cosmetics -> k) <> 'boolean' then
      raise exception 'invalid_field %', k;
    end if;
  end loop;

  snap := jsonb_build_object(
    'v', 1,
    'title', p_cosmetics -> 'title',
    'tag', p_cosmetics -> 'tag',
    'frame', p_cosmetics -> 'frame',
    'intro', p_cosmetics -> 'intro',
    'frameEnabled', coalesce((p_cosmetics ->> 'frameEnabled')::boolean, true),
    'frameAnimated', coalesce((p_cosmetics ->> 'frameAnimated')::boolean, true),
    'introEnabled', coalesce((p_cosmetics ->> 'introEnabled')::boolean, true),
    'levelAnimation', coalesce((p_cosmetics ->> 'levelAnimation')::boolean, true),
    'rainbow', coalesce((p_cosmetics ->> 'rainbow')::boolean, true),
    'updatedAt', now()
  );
  snap := jsonb_strip_nulls(snap);

  perform set_config('insight.cosmetics_writer', 'on', true);
  update public.profiles set cosmetics = snap where id = me.id;
  perform set_config('insight.cosmetics_writer', 'off', true);

  return snap;
end;
$function$;

-- ---------------------------------------------------------------- grupo VIP
-- Configurações privadas (sem policy: ninguém lê direto).
create table if not exists public.nitro_settings (
  key text primary key,
  value text
);
alter table public.nitro_settings enable row level security;
revoke all on public.nitro_settings from anon, authenticated;

create or replace function public.get_nitro_vip_invite()
returns text
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  me public.profiles;
begin
  select * into me from public.profiles where user_id = auth.uid() or id = auth.uid() limit 1;
  if not public.has_nitro_access(me) then
    return null;
  end if;
  return (select value from public.nitro_settings where key = 'vip_whatsapp_invite');
end;
$$;

-- ---------------------------------------------------------------- mídia no R2
-- Cada objeto assinado por /api/upload/r2 é registrado com o tamanho exato
-- assinado (o presign amarra Content-Length, então o R2 recusa outro tamanho).
create table if not exists public.media_uploads (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  r2_key text not null unique,
  size_bytes bigint not null check (size_bytes > 0),
  content_type text,
  original_bytes bigint,
  created_at timestamptz not null default now()
);
create index if not exists media_uploads_profile_idx on public.media_uploads (profile_id, created_at desc);

alter table public.media_uploads enable row level security;
drop policy if exists media_uploads_select_own on public.media_uploads;
create policy media_uploads_select_own on public.media_uploads
  for select to authenticated
  using (profile_id = public.current_profile_id() or public.is_insight_staff());
-- sem policy de insert/update/delete: só via register_media_upload()

create or replace function public.register_media_upload(
  p_r2_key text,
  p_size bigint,
  p_content_type text default null,
  p_original bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  me public.profiles;
  lim bigint;
begin
  select * into me from public.profiles where user_id = auth.uid() or id = auth.uid() limit 1;
  if me.id is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if p_r2_key is null or p_r2_key not like 'users/' || auth.uid()::text || '/%' then
    raise exception 'invalid_key' using errcode = '42501';
  end if;
  lim := public.contributor_upload_limit(me.contributor_level, me.role);
  if p_size is null or p_size <= 0 or p_size > lim then
    raise exception 'post_media_quota_exceeded' using errcode = '22023',
      detail = format('limite do nível: %s bytes', lim);
  end if;
  insert into public.media_uploads (profile_id, r2_key, size_bytes, content_type, original_bytes)
  values (me.id, p_r2_key, p_size, p_content_type, p_original);
  return jsonb_build_object('limit', lim, 'level', coalesce(me.contributor_level, 0));
end;
$$;

-- Soma do peso real (R2) da mídia referenciada nos blocos de um post
create or replace function public.post_media_bytes(p_blocks jsonb, p_profile uuid)
returns bigint
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(sum(m.size_bytes), 0)::bigint
  from public.media_uploads m
  where m.profile_id = p_profile
    and p_blocks is not null
    and strpos(p_blocks::text, m.r2_key) > 0
$$;

create or replace function public.enforce_post_media_quota()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  author public.profiles;
  used bigint;
  lim bigint;
begin
  if new.blocks is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.blocks is not distinct from old.blocks then
    return new;
  end if;

  select * into author from public.profiles
  where id = coalesce(new.profile_id, new.author_id) or user_id = new.author_id
  limit 1;
  if author.id is null then
    return new;
  end if;

  used := public.post_media_bytes(new.blocks, author.id);
  lim := public.contributor_upload_limit(author.contributor_level, author.role);
  if used > lim then
    raise exception 'post_media_quota_exceeded' using errcode = '22023',
      detail = format('%s de %s bytes', used, lim);
  end if;
  return new;
end;
$$;

drop trigger if exists posts_media_quota on public.posts;
create trigger posts_media_quota
  before insert or update of blocks on public.posts
  for each row execute function public.enforce_post_media_quota();

-- ---------------------------------------------------------------- tópicos
-- Criar tópico personalizado: Nível 3+ (staff sempre). Os já criados ficam.
drop policy if exists custom_topics_insert_own on public.custom_topics;
create policy custom_topics_insert_own on public.custom_topics
  for insert to authenticated
  with check (
    public.is_insight_staff()
    or (
      profile_id = public.current_profile_id()
      and exists (
        select 1 from public.profiles
        where id = public.current_profile_id() and coalesce(contributor_level, 0) >= 3
      )
    )
  );

-- ---------------------------------------------------------------- privilégios
revoke all on function public.register_media_upload(text, bigint, text, bigint) from public, anon;
grant execute on function public.register_media_upload(text, bigint, text, bigint) to authenticated;
revoke all on function public.get_nitro_vip_invite() from public, anon;
grant execute on function public.get_nitro_vip_invite() to authenticated;
revoke all on function public.post_media_bytes(jsonb, uuid) from public, anon, authenticated;
revoke all on function public.enforce_post_media_quota() from public, anon, authenticated;
revoke all on function public.grant_lifetime_nitro() from public, anon, authenticated;
