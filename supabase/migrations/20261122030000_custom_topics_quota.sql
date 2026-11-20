-- Tópicos personalizados: todo usuário logado cria até 4; Nível 3+ até 8; staff sem limite.
create or replace function public.topic_limit(p_level integer, p_role text default null)
returns integer
language sql
immutable
set search_path = public
as $$
  select case
    when p_role in ('admin', 'moderator') then 2147483647
    when coalesce(p_level, 0) >= 3 then 8
    else 4
  end
$$;

drop policy if exists custom_topics_insert_own on public.custom_topics;
create policy custom_topics_insert_own on public.custom_topics
  for insert to authenticated
  with check (profile_id = public.current_profile_id() or public.is_insight_staff());

create or replace function public.enforce_topic_quota()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner public.profiles;
  used integer;
begin
  select * into owner from public.profiles where id = new.profile_id;
  if owner.id is null then
    raise exception 'invalid_profile' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtext('topics:' || owner.id::text));
  select count(*) into used from public.custom_topics where profile_id = owner.id;
  if used >= public.topic_limit(owner.contributor_level, owner.role) then
    raise exception 'topic_limit_reached' using errcode = '22023',
      detail = format('limite: %s tópicos', public.topic_limit(owner.contributor_level, owner.role));
  end if;
  return new;
end;
$$;

drop trigger if exists custom_topics_quota on public.custom_topics;
create trigger custom_topics_quota
  before insert on public.custom_topics
  for each row execute function public.enforce_topic_quota();

revoke all on function public.enforce_topic_quota() from public, anon, authenticated;
