-- ============================================================================
-- Conta, segurança, rascunhos em nuvem e respostas em blocos
-- ============================================================================

-- ---------------------------------------------------------------- verificação
-- O envio da Supabase só entrega para a equipe do projeto (por isso as contas
-- são autoconfirmadas). A verificação real é nossa: link enviado pelo mailer do
-- app (/api/account/verify-email) e gravado aqui pela service role.
alter table public.profiles add column if not exists email_verified_at timestamptz;

-- quem confirmou de verdade pelo e-mail da Supabase já conta como verificado
update public.profiles p
set email_verified_at = u.email_confirmed_at
from auth.users u
where (p.user_id = u.id or p.id = u.id)
  and p.email_verified_at is null
  and u.confirmation_sent_at is not null
  and u.email_confirmed_at > u.confirmation_sent_at;

create table if not exists public.email_verifications (
  user_id uuid primary key references auth.users (id) on delete cascade,
  token_hash text not null,
  email text not null,
  expires_at timestamptz not null,
  sent_count integer not null default 1,
  last_sent_at timestamptz not null default now(),
  window_started_at timestamptz not null default now()
);
alter table public.email_verifications enable row level security;
revoke all on public.email_verifications from anon, authenticated;

-- limite de envio de e-mails de conta (recuperação de senha), por e-mail
create table if not exists public.account_email_log (
  id bigserial primary key,
  email_hash text not null,
  kind text not null,
  sent_at timestamptz not null default now()
);
create index if not exists account_email_log_idx on public.account_email_log (email_hash, kind, sent_at desc);
alter table public.account_email_log enable row level security;
revoke all on public.account_email_log from anon, authenticated;

-- ---------------------------------------------------------------- colunas protegidas
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

  new.email_verified_at := old.email_verified_at;
  new.created_at := old.created_at;

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

-- ---------------------------------------------------------------- username
-- Formato e nomes reservados ao criar ou TROCAR o @ (os antigos ficam como estão).
create or replace function public.validate_profile_username()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if tg_op = 'UPDATE' and new.username is not distinct from old.username then
    return new;
  end if;

  new.username := lower(trim(new.username));

  if new.username !~ '^[a-z0-9_]{3,30}$' then
    raise exception 'invalid_username' using errcode = '22023',
      detail = 'Use 3 a 30 caracteres: letras minúsculas, números ou _.';
  end if;

  if current_user in ('authenticated', 'anon')
     and new.username ~ '^(admin|administrador|insight|insighter|suporte|support|moderador|moderator|staff|oficial|official|root|sistema|system|nitro)(_|[0-9]|$)'
     and not public.is_insight_staff() then
    raise exception 'reserved_username' using errcode = '22023';
  end if;

  return new;
end;
$function$;

drop trigger if exists profiles_validate_username on public.profiles;
create trigger profiles_validate_username
  before insert or update of username on public.profiles
  for each row execute function public.validate_profile_username();

-- ---------------------------------------------------------------- policies de perfil
drop policy if exists "Enable read access for all users" on public.profiles;
drop policy if exists "Leitura pública de perfis" on public.profiles;
-- fica: "Perfis visíveis para todos"

drop policy if exists "Dono ou Staff pode excluir perfil" on public.profiles;
create policy profiles_delete_owner_or_admin on public.profiles
  for delete to authenticated
  using (user_id = auth.uid() or id = auth.uid() or public.is_insight_admin());

-- moderador só edita perfis comuns; admin edita qualquer um
drop policy if exists profiles_update_owner_or_staff on public.profiles;
create policy profiles_update_owner_or_staff on public.profiles
  for update to authenticated
  using (
    user_id = auth.uid() or id = auth.uid() or public.is_insight_admin()
    or (public.is_insight_staff() and coalesce(role, 'user') = 'user')
  )
  with check (
    user_id = auth.uid() or id = auth.uid() or public.is_insight_admin()
    or (public.is_insight_staff() and coalesce(role, 'user') = 'user')
  );

-- ---------------------------------------------------------------- cadastro
-- Beta fechada: o convite é validado e consumido NO BANCO, junto com a criação
-- do usuário. Chamar a API de cadastro direto, sem convite, falha.
-- Contas criadas pelo painel/admin API: app_metadata.invite_bypass = true.
create or replace function public.signup_invite_required()
returns boolean
language sql
immutable
as $$ select true $$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  requested_username text;
  final_username text;
  user_full_name text;
  invite text;
begin
  if exists (select 1 from public.profiles where user_id = new.id) then
    return new;
  end if;

  requested_username := lower(regexp_replace(
    coalesce(nullif(trim(new.raw_user_meta_data->>'username'), ''), split_part(new.email, '@', 1)),
    '[^a-zA-Z0-9_]', '', 'g'
  ));
  requested_username := left(requested_username, 30);

  if length(requested_username) < 3 then
    requested_username := 'user_' || substr(new.id::text, 1, 6);
  end if;

  if exists (select 1 from public.profiles where lower(trim(username)) = requested_username) then
    final_username := left(requested_username, 25) || '_' || substr(new.id::text, 1, 4);
  else
    final_username := requested_username;
  end if;

  user_full_name := left(coalesce(
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    nullif(trim(new.raw_user_meta_data->>'name'), ''),
    split_part(new.email, '@', 1)
  ), 60);

  insert into public.profiles (
    id, user_id, username, full_name, display_name, nickname, nickname_color,
    avatar_url, bio, tags, social_links, followers_count, posts_count, role, status,
    onboarding_completed
  ) values (
    new.id, new.id, final_username, user_full_name, user_full_name, 'Membro Beta', '#3B82F6',
    '/assets/net/default-perfil', 'Novo membro do Insight ✨', '[]'::jsonb, '{}'::jsonb,
    0, 0, 'user', 'active', false
  );

  if public.signup_invite_required()
     and coalesce(new.raw_app_meta_data->>'invite_bypass', 'false') <> 'true' then
    invite := upper(trim(coalesce(new.raw_user_meta_data->>'invite_code', '')));
    update public.invite_codes
    set uses_count = coalesce(uses_count, 0) + 1,
        used_by = coalesce(used_by, new.id)
    where code = invite
      and coalesce(uses_count, 0) < coalesce(max_uses, 1)
      and (expires_at is null or expires_at > now());
    if not found then
      raise exception 'invite_required' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$function$;

-- o convite agora é consumido no cadastro; a RPC antiga não faz mais nada
create or replace function public.redeem_invite_code(p_code text)
returns boolean
language sql
stable
as $$ select true $$;

-- ---------------------------------------------------------------- rascunhos
create table if not exists public.drafts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  scope text not null check (scope ~ '^[a-z]+(:[A-Za-z0-9_-]{1,64}){0,3}$'),
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  unique (profile_id, scope),
  constraint drafts_payload_size check (octet_length(payload::text) <= 524288)
);
create index if not exists drafts_profile_idx on public.drafts (profile_id, updated_at desc);

alter table public.drafts enable row level security;
drop policy if exists drafts_own on public.drafts;
create policy drafts_own on public.drafts
  for all to authenticated
  using (profile_id = public.current_profile_id())
  with check (profile_id = public.current_profile_id());

create or replace function public.limit_drafts()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  new.updated_at := now();
  if tg_op = 'INSERT' and (select count(*) from public.drafts where profile_id = new.profile_id) >= 60 then
    -- descarta o mais antigo para abrir espaço
    delete from public.drafts
    where id = (select id from public.drafts where profile_id = new.profile_id order by updated_at asc limit 1);
  end if;
  return new;
end;
$$;

drop trigger if exists drafts_limit on public.drafts;
create trigger drafts_limit
  before insert or update on public.drafts
  for each row execute function public.limit_drafts();

-- ---------------------------------------------------------------- respostas em blocos
alter table public.replies add column if not exists blocks jsonb;

create or replace function public.validate_reply_blocks()
returns trigger
language plpgsql
set search_path to 'public'
as $$
declare
  b jsonb;
  total int := 0;
begin
  if char_length(coalesce(new.content, '')) > 4000 then
    raise exception 'reply_too_long' using errcode = '22023';
  end if;
  if new.blocks is null then
    return new;
  end if;
  if jsonb_typeof(new.blocks) <> 'array' or jsonb_array_length(new.blocks) > 12 then
    raise exception 'invalid_reply_blocks' using errcode = '22023';
  end if;
  for b in select * from jsonb_array_elements(new.blocks) loop
    if jsonb_typeof(b) <> 'object'
       or coalesce(b->>'type', '') not in ('paragraph', 'quote', 'code', 'bullet', 'image', 'spotify') then
      raise exception 'invalid_reply_blocks' using errcode = '22023';
    end if;
    total := total + char_length(coalesce(b->>'text', ''));
    if b ? 'url' and (b->>'url') !~ '^https://' then
      raise exception 'invalid_reply_media' using errcode = '22023';
    end if;
    if b->>'type' = 'spotify' and coalesce(b->>'trackId', '') !~ '^[A-Za-z0-9]{10,40}$' then
      raise exception 'invalid_reply_media' using errcode = '22023';
    end if;
  end loop;
  if total > 4000 then
    raise exception 'reply_too_long' using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists replies_validate_blocks on public.replies;
create trigger replies_validate_blocks
  before insert or update on public.replies
  for each row execute function public.validate_reply_blocks();

revoke all on function public.limit_drafts() from public, anon, authenticated;

-- search_path fixo nas funções auxiliares (aviso do linter)
alter function public.redeem_invite_code(text) set search_path = public;
alter function public.nitro_is_public() set search_path = public;
alter function public.contributor_upload_limit(integer, text) set search_path = public;
alter function public.signup_invite_required() set search_path = public;
