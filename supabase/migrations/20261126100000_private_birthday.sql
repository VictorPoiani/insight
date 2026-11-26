-- Data de nascimento privada.
-- A data completa sai de "profiles" (leitura pública) e vai para uma tabela que
-- só o dono e a equipe leem. No perfil público fica só dia/mês (birthday_md).

create table if not exists public.profile_birthdays (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  birthday date not null,
  updated_at timestamptz not null default now()
);

alter table public.profile_birthdays enable row level security;

drop policy if exists profile_birthdays_select_own on public.profile_birthdays;
create policy profile_birthdays_select_own on public.profile_birthdays
  for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = profile_birthdays.profile_id
        and (p.user_id = auth.uid() or p.id = auth.uid())
    )
    or public.is_insight_staff()
  );
-- sem políticas de escrita: só pelas funções abaixo
revoke all on public.profile_birthdays from anon;
revoke insert, update, delete on public.profile_birthdays from authenticated;
grant select on public.profile_birthdays to authenticated;

alter table public.profiles add column if not exists birthday_md text
  check (birthday_md is null or birthday_md ~ '^\d{2}-\d{2}$');

-- cópia dos dados existentes
insert into public.profile_birthdays (profile_id, birthday)
select id, birthday from public.profiles where birthday is not null
on conflict (profile_id) do nothing;
update public.profiles set birthday_md = to_char(birthday, 'MM-DD') where birthday is not null;

-- grava (ou, para a equipe, corrige) a data e mantém o dia/mês público
create or replace function public.save_profile_birthday(p_profile uuid, p_birthday date)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  insert into public.profile_birthdays (profile_id, birthday)
  values (p_profile, p_birthday)
  on conflict (profile_id) do update set birthday = excluded.birthday, updated_at = now();
  update public.profiles set birthday_md = to_char(p_birthday, 'MM-DD') where id = p_profile;
end;
$$;
revoke all on function public.save_profile_birthday(uuid, date) from public, anon, authenticated;

-- a própria pessoa informa uma única vez (contas antigas sem data)
create or replace function public.set_my_birthday(p_birthday date)
returns date
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  me uuid;
begin
  select id into me from public.profiles where user_id = auth.uid() or id = auth.uid() limit 1;
  if me is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if exists (select 1 from public.profile_birthdays where profile_id = me) then
    raise exception 'birthday_locked' using errcode = '42501';
  end if;
  if p_birthday is null or p_birthday > current_date or p_birthday < current_date - interval '120 years' then
    raise exception 'birthday_invalid' using errcode = '22007';
  end if;
  perform public.save_profile_birthday(me, p_birthday);
  return p_birthday;
end;
$$;
revoke all on function public.set_my_birthday(date) from public, anon;
grant execute on function public.set_my_birthday(date) to authenticated;

-- correção pela equipe
create or replace function public.staff_set_birthday(p_profile uuid, p_birthday date)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.is_insight_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  perform public.save_profile_birthday(p_profile, p_birthday);
end;
$$;
revoke all on function public.staff_set_birthday(uuid, date) from public, anon;
grant execute on function public.staff_set_birthday(uuid, date) to authenticated;

-- cadastro grava na tabela privada
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
  bypass boolean := coalesce(new.raw_app_meta_data->>'invite_bypass', 'false') = 'true';
  bday date := public.birthday_from_signup(new.raw_user_meta_data);
begin
  if exists (select 1 from public.profiles where user_id = new.id) then
    return new;
  end if;

  if not bypass then
    if bday is null
       or bday > current_date
       or bday < current_date - interval '120 years' then
      raise exception 'birthday_required' using errcode = '22007';
    end if;
    if bday > (current_date - interval '13 years')::date then
      raise exception 'birthday_underage' using errcode = '42501';
    end if;
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

  if bday is not null then
    perform public.save_profile_birthday(new.id, bday);
  end if;

  if public.signup_invite_required() and not bypass then
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
