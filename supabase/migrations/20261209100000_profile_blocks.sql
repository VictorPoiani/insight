-- Silenciar e bloquear perfis.
--   mute : esconde os posts da pessoa para quem silenciou (só no app).
--   block: além de esconder, a pessoa bloqueada não segue, não responde e não
--          reage aos posts de quem bloqueou; bloquear desfaz o seguir nos dois sentidos.
create table if not exists public.profile_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('mute', 'block')),
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index if not exists profile_blocks_blocked_idx on public.profile_blocks (blocked_id);

alter table public.profile_blocks enable row level security;

drop policy if exists profile_blocks_select_own on public.profile_blocks;
create policy profile_blocks_select_own on public.profile_blocks
  for select to authenticated using (blocker_id = public.current_profile_id());
drop policy if exists profile_blocks_delete_own on public.profile_blocks;
create policy profile_blocks_delete_own on public.profile_blocks
  for delete to authenticated using (blocker_id = public.current_profile_id());

revoke all on public.profile_blocks from anon;
grant select, delete on public.profile_blocks to authenticated;

-- "o dono deste conteúdo me bloqueou?" (sem expor a lista de bloqueios)
create or replace function public.is_blocked_by(p_owner uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select p_owner is not null and exists (
    select 1 from public.profile_blocks b
    where b.blocker_id = p_owner and b.blocked_id = public.current_profile_id() and b.kind = 'block'
  )
$$;
revoke all on function public.is_blocked_by(uuid) from public, anon;
grant execute on function public.is_blocked_by(uuid) to authenticated;

-- silenciar/bloquear/desfazer (p_kind null = desfazer)
create or replace function public.set_profile_block(p_target uuid, p_kind text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  me uuid := public.current_profile_id();
begin
  if me is null then raise exception 'Não autenticado'; end if;
  if p_target is null or p_target = me then raise exception 'Perfil inválido'; end if;
  if p_kind is null then
    delete from public.profile_blocks where blocker_id = me and blocked_id = p_target;
    return;
  end if;
  if p_kind not in ('mute', 'block') then raise exception 'Tipo inválido'; end if;
  insert into public.profile_blocks (blocker_id, blocked_id, kind)
  values (me, p_target, p_kind)
  on conflict (blocker_id, blocked_id) do update set kind = excluded.kind, created_at = now();
  if p_kind = 'block' then
    delete from public.follows
    where (follower_id = me and following_id = p_target) or (follower_id = p_target and following_id = me);
  end if;
end;
$$;
revoke all on function public.set_profile_block(uuid, text) from public, anon;
grant execute on function public.set_profile_block(uuid, text) to authenticated;

-- regras restritivas (somam-se às existentes): bloqueado não segue, não responde, não reage
drop policy if exists follows_not_blocked on public.follows;
create policy follows_not_blocked on public.follows
  as restrictive for insert to authenticated
  with check (not public.is_blocked_by(following_id));

drop policy if exists replies_not_blocked on public.replies;
create policy replies_not_blocked on public.replies
  as restrictive for insert to authenticated
  with check (not public.is_blocked_by((select coalesce(p.profile_id, p.author_id) from public.posts p where p.id = post_id)));

drop policy if exists post_reactions_not_blocked on public.post_reactions;
create policy post_reactions_not_blocked on public.post_reactions
  as restrictive for insert to authenticated
  with check (not public.is_blocked_by((select coalesce(p.profile_id, p.author_id) from public.posts p where p.id = post_id)));
