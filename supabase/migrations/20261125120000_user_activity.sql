-- ============================================================================
-- Painel de atividade: tempo de tela, posts vistos e vídeos assistidos por dia
-- (gravados pelo próprio usuário) + curtidas/respostas/reposts/posts das tabelas.
-- ============================================================================
create table if not exists public.user_activity_daily (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  day date not null,
  screen_seconds int not null default 0,
  post_views int not null default 0,
  video_plays int not null default 0,
  primary key (profile_id, day)
);
alter table public.user_activity_daily enable row level security;
drop policy if exists user_activity_daily_select on public.user_activity_daily;
create policy user_activity_daily_select on public.user_activity_daily for select
  using (profile_id = public.current_profile_id());
revoke all on public.user_activity_daily from anon;
grant select on public.user_activity_daily to authenticated;

-- Soma ao dia de hoje (horário de Brasília). Limites por chamada evitam números absurdos.
create or replace function public.track_activity(p_seconds int default 0, p_views int default 0, p_videos int default 0)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := public.current_profile_id();
  today date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if me is null then return; end if;
  insert into public.user_activity_daily as a (profile_id, day, screen_seconds, post_views, video_plays)
  values (me, today, greatest(0, least(coalesce(p_seconds, 0), 300)),
          greatest(0, least(coalesce(p_views, 0), 200)), greatest(0, least(coalesce(p_videos, 0), 50)))
  on conflict (profile_id, day) do update set
    screen_seconds = least(86400, a.screen_seconds + excluded.screen_seconds),
    post_views = a.post_views + excluded.post_views,
    video_plays = a.video_plays + excluded.video_plays;
end;
$$;
revoke all on function public.track_activity(int, int, int) from public, anon;
grant execute on function public.track_activity(int, int, int) to authenticated;

-- Resumo dos últimos N dias (7–90), um item por dia
create or replace function public.my_activity(p_days int default 7)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with me as (select public.current_profile_id() as id),
  days as (
    select d::date as day
    from generate_series(
      (now() at time zone 'America/Sao_Paulo')::date - (greatest(7, least(coalesce(p_days, 7), 90)) - 1),
      (now() at time zone 'America/Sao_Paulo')::date, interval '1 day') d
  ),
  loc as (select 'America/Sao_Paulo'::text as tz)
  select case when (select id from me) is null then null else jsonb_build_object(
    'days', (
      select jsonb_agg(jsonb_build_object(
        'day', d.day,
        'screen_seconds', coalesce(a.screen_seconds, 0),
        'post_views', coalesce(a.post_views, 0),
        'video_plays', coalesce(a.video_plays, 0),
        'likes', (select count(*) from public.post_likes l, loc where l.profile_id = (select id from me) and (l.created_at at time zone loc.tz)::date = d.day),
        'replies', (select count(*) from public.replies r, loc where r.profile_id = (select id from me) and (r.created_at at time zone loc.tz)::date = d.day),
        'reposts', (select count(*) from public.post_reposts x, loc where x.profile_id = (select id from me) and (x.created_at at time zone loc.tz)::date = d.day),
        'posts', (select count(*) from public.posts p, loc where (p.profile_id = (select id from me) or p.author_id = (select id from me)) and coalesce(p.is_draft, false) = false and (p.created_at at time zone loc.tz)::date = d.day)
      ) order by d.day)
      from days d left join public.user_activity_daily a on a.profile_id = (select id from me) and a.day = d.day
    ),
    'likes_received', (
      select count(*) from public.post_likes l join public.posts p on p.id = l.post_id, loc
      where (p.profile_id = (select id from me) or p.author_id = (select id from me))
        and l.profile_id <> (select id from me)
        and (l.created_at at time zone loc.tz)::date >= (select min(day) from days)
    )
  ) end
$$;
revoke all on function public.my_activity(int) from public, anon;
grant execute on function public.my_activity(int) to authenticated;
