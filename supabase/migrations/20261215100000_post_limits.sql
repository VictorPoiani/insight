-- 1) Anexos por post, por nível (bytes): 50/100/150/200/250/300 MB.
create or replace function public.contributor_upload_limit(p_level integer, p_role text default null)
returns bigint
language sql
immutable
set search_path to 'public'
as $$
  select (case
    when p_role = 'admin' then 300
    else 50 * (least(greatest(coalesce(p_level, 0), 0), 5) + 1)
  end)::bigint * 1048576
$$;

-- 2) Frequência de posts: 3 por hora (janela móvel) e 10 por dia.
--    O "dia" vira às 03:00 de Brasília (America/Sao_Paulo).
--    Registro próprio: apagar o post não devolve a vaga.
create table if not exists public.post_rate_log (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists post_rate_log_profile_idx on public.post_rate_log (profile_id, created_at desc);
alter table public.post_rate_log enable row level security;
revoke all on public.post_rate_log from anon, authenticated;

-- índice composto pedido (o dono do post fica em profile_id)
create index if not exists posts_profile_created_idx on public.posts (profile_id, created_at desc);

-- início do "dia" atual: a última 03:00 em America/Sao_Paulo
create or replace function public.post_day_start(p_at timestamptz default now())
returns timestamptz
language sql
stable
set search_path to 'public'
as $$
  select (date_trunc('day', (p_at at time zone 'America/Sao_Paulo') - interval '3 hours') + interval '3 hours')
         at time zone 'America/Sao_Paulo'
$$;

-- situação de quem está logado (o compositor usa para avisar e travar)
create or replace function public.post_quota_status()
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  with me as (select public.current_profile_id() id),
  d as (select public.post_day_start() start_at),
  h as (
    select l.created_at from public.post_rate_log l, me
    where l.profile_id = me.id and l.created_at > now() - interval '60 minutes'
    order by l.created_at asc
  ),
  dc as (
    select count(*) n from public.post_rate_log l, me, d
    where l.profile_id = me.id and l.created_at >= d.start_at
  )
  select jsonb_build_object(
    'exempt', public.is_insight_staff(),
    'hour_count', (select count(*) from h),
    'hour_limit', 3,
    'day_count', (select n from dc),
    'day_limit', 10,
    -- quando a vaga mais antiga da última hora libera
    'hour_free_at', (select min(created_at) + interval '60 minutes' from h),
    'day_reset_at', (select start_at + interval '1 day' from d)
  )
$$;
revoke all on function public.post_quota_status() from public, anon;
grant execute on function public.post_quota_status() to authenticated;

-- trava no banco (vale para qualquer caminho de criação de post)
create or replace function public.enforce_post_rate_limit()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  owner uuid := coalesce(new.profile_id, new.author_id);
  hour_n int;
  day_n int;
begin
  if owner is null or coalesce(new.is_draft, false) then
    return new;
  end if;
  -- equipe sem limite (anúncios oficiais)
  if exists (select 1 from public.profiles p where p.id = owner and p.role in ('admin', 'moderator')) then
    return new;
  end if;
  -- uma criação por vez por pessoa (sem corrida entre abas)
  perform pg_advisory_xact_lock(hashtextextended(owner::text, 0));
  select count(*) into hour_n from public.post_rate_log
   where profile_id = owner and created_at > now() - interval '60 minutes';
  if hour_n >= 3 then
    raise exception 'post_rate_hour' using errcode = '42501',
      hint = 'Limite de 3 posts por hora.';
  end if;
  select count(*) into day_n from public.post_rate_log
   where profile_id = owner and created_at >= public.post_day_start();
  if day_n >= 10 then
    raise exception 'post_rate_day' using errcode = '42501',
      hint = 'Limite de 10 posts por dia (renova às 03:00).';
  end if;
  insert into public.post_rate_log (profile_id) values (owner);
  return new;
end;
$$;
revoke all on function public.enforce_post_rate_limit() from public, anon, authenticated;

drop trigger if exists posts_rate_limit on public.posts;
create trigger posts_rate_limit
  before insert on public.posts
  for each row execute function public.enforce_post_rate_limit();

-- limpeza diária também apaga o registro antigo
create or replace function public.insight_housekeeping()
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  delete from public.notifications where is_read and created_at < now() - interval '60 days';
  delete from public.notifications where created_at < now() - interval '120 days';
  delete from public.news_items where published_at < now() - interval '45 days';
  delete from public.api_rate_limits where window_start < now() - interval '1 day';
  delete from public.post_rate_log where created_at < now() - interval '3 days';
end;
$$;
