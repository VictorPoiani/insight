-- Reações rápidas nos Insights (além da curtida): uma por pessoa por post.
create table if not exists public.post_reactions (
  post_id uuid not null references public.posts(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  reaction text not null check (reaction in ('idea', 'fire', 'laugh', 'think', 'wow')),
  created_at timestamptz not null default now(),
  primary key (post_id, profile_id)
);

create index if not exists post_reactions_post_idx on public.post_reactions (post_id);

alter table public.post_reactions enable row level security;

drop policy if exists post_reactions_select on public.post_reactions;
create policy post_reactions_select on public.post_reactions
  for select using (true);

drop policy if exists post_reactions_insert_own on public.post_reactions;
create policy post_reactions_insert_own on public.post_reactions
  for insert to authenticated
  with check (profile_id = public.current_profile_id());

drop policy if exists post_reactions_update_own on public.post_reactions;
create policy post_reactions_update_own on public.post_reactions
  for update to authenticated
  using (profile_id = public.current_profile_id())
  with check (profile_id = public.current_profile_id());

drop policy if exists post_reactions_delete_own on public.post_reactions;
create policy post_reactions_delete_own on public.post_reactions
  for delete to authenticated
  using (profile_id = public.current_profile_id());

revoke all on public.post_reactions from anon;
grant select on public.post_reactions to anon;
grant select, insert, update, delete on public.post_reactions to authenticated;
