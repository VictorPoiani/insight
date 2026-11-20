-- ============================================================================
-- Correção de segurança: atualização de public.profiles
--
-- Antes: as policies "Enable update for all users" (USING true, inclusive
-- anônimos) e "Admin atualiza perfil" (qualquer usuário logado) permitiam
-- alterar QUALQUER perfil, inclusive role/status e campos de doação.
--
-- Depois:
--  * UPDATE só pelo dono do perfil ou pela equipe (admin/moderador).
--  * Trigger protege colunas sensíveis:
--      - id, user_id: imutáveis pelo app
--      - followers_count, posts_count: só via triggers do banco
--      - total_donated, contributor_points, contributor_level: só via banco
--      - role, status: só admin (moderador alterna user <-> moderator)
--  * followers_count passa a ser recalculado por triggers (antes era gravado
--    pelo navegador de quem seguia, o que exigia a policy aberta).
-- Idempotente.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Policies de UPDATE
-- ---------------------------------------------------------------------------
drop policy if exists "Enable update for all users" on public.profiles;
drop policy if exists "Admin atualiza perfil" on public.profiles;
drop policy if exists "Utilizadores editam o próprio perfil ou admin" on public.profiles;
drop policy if exists "profiles_update_owner_or_staff" on public.profiles;

create policy "profiles_update_owner_or_staff" on public.profiles
  for update to authenticated
  using (user_id = auth.uid() or id = auth.uid() or public.is_insight_staff())
  with check (user_id = auth.uid() or id = auth.uid() or public.is_insight_staff());

-- ---------------------------------------------------------------------------
-- 2. Proteção de colunas sensíveis
--    Não é SECURITY DEFINER de propósito: current_user precisa refletir quem
--    chamou. Funções do banco que rodam como dono (service_role, triggers
--    SECURITY DEFINER, RPCs) passam direto.
-- ---------------------------------------------------------------------------
create or replace function public.protect_profile_privileged_columns()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  caller public.profiles;
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  -- Identidade
  new.id := old.id;
  new.user_id := old.user_id;

  -- Doações / patente: só o banco (trigger de donations / webhook)
  new.total_donated := old.total_donated;
  new.contributor_points := old.contributor_points;
  new.contributor_level := old.contributor_level;

  -- Contadores: só quando a alteração vem de outro trigger
  -- (ex.: sync_profile_posts_count ao criar/apagar um post)
  if pg_trigger_depth() <= 1 then
    new.followers_count := old.followers_count;
    new.posts_count := old.posts_count;
  end if;

  -- Cargo e status
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
$$;

drop trigger if exists profiles_protect_privileged on public.profiles;
create trigger profiles_protect_privileged
  before update on public.profiles
  for each row execute function public.protect_profile_privileged_columns();

-- ---------------------------------------------------------------------------
-- 3. Contagem de seguidores pelo banco
--    Mesma fórmula do app (ProfileHeader.refreshTotalFollowersCount):
--    follows; no perfil fundador soma também newsletter e push.
-- ---------------------------------------------------------------------------
create or replace function public.recompute_followers_count(p_profile uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  founder constant uuid := '96d271a9-9102-49b1-b593-9279c5dfe3f4';
begin
  if p_profile is null then
    return;
  end if;
  update public.profiles
  set followers_count =
    (select count(*) from public.follows where following_id = p_profile)
    + case when p_profile = founder
        then (select count(*) from public.subscribers)
           + (select count(*) from public.push_subscriptions)
        else 0 end
  where id = p_profile;
end;
$$;

revoke all on function public.recompute_followers_count(uuid) from public, anon, authenticated;

create or replace function public.trg_follows_followers_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.recompute_followers_count(coalesce(new.following_id, old.following_id));
  return null;
end;
$$;

drop trigger if exists trg_follows_followers_count on public.follows;
create trigger trg_follows_followers_count
  after insert or delete on public.follows
  for each row execute function public.trg_follows_followers_count();

-- Antes esta função gravava o total da newsletter em TODOS os perfis.
create or replace function public.sync_followers_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.recompute_followers_count('96d271a9-9102-49b1-b593-9279c5dfe3f4'::uuid);
  return null;
end;
$$;

drop trigger if exists trg_push_subscriptions_followers_count on public.push_subscriptions;
create trigger trg_push_subscriptions_followers_count
  after insert or delete on public.push_subscriptions
  for each row execute function public.sync_followers_count();

-- Corrige os valores atuais
select public.recompute_followers_count(id) from public.profiles;
