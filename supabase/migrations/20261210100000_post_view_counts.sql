-- Visualizações dos posts: cada pessoa logada conta uma vez por post.
create table if not exists public.post_view_marks (
  post_id uuid not null references public.posts(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, profile_id)
);
alter table public.post_view_marks enable row level security;
revoke all on public.post_view_marks from anon, authenticated;

create or replace function public.record_post_views(p_ids uuid[])
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  me uuid := public.current_profile_id();
begin
  if me is null or p_ids is null then return; end if;
  with fresh as (
    insert into public.post_view_marks (post_id, profile_id)
    select distinct x, me
    from unnest(p_ids[1:100]) as x
    where exists (select 1 from public.posts p where p.id = x and coalesce(p.profile_id, p.author_id) <> me)
    on conflict do nothing
    returning post_id
  )
  update public.posts p set views_count = coalesce(p.views_count, 0) + 1
  from fresh where p.id = fresh.post_id;
end;
$$;
revoke all on function public.record_post_views(uuid[]) from public, anon;
grant execute on function public.record_post_views(uuid[]) to authenticated;
