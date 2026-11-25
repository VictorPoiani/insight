-- Data de nascimento obrigatória no cadastro (ECA / ECA Digital).
--  * a conta só é criada com data válida e idade mínima de 13 anos;
--  * depois de informada, só a equipe altera (evita trocar a idade para ver +18).

create or replace function public.birthday_from_signup(meta jsonb)
returns date
language plpgsql
immutable
as $$
declare
  raw text := trim(coalesce(meta->>'birthday', ''));
  d date;
begin
  if raw !~ '^\d{4}-\d{2}-\d{2}$' then
    return null;
  end if;
  begin
    d := raw::date;
  exception when others then
    return null;
  end;
  return d;
end;
$$;

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

  -- data de nascimento: obrigatória, real e com 13 anos ou mais
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
    onboarding_completed, birthday
  ) values (
    new.id, new.id, final_username, user_full_name, user_full_name, 'Membro Beta', '#3B82F6',
    '/assets/net/default-perfil', 'Novo membro do Insight ✨', '[]'::jsonb, '{}'::jsonb,
    0, 0, 'user', 'active', false, bday
  );

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

-- Trava da data de nascimento: quem ainda não tem pode informar uma vez
-- (contas antigas); depois disso, só a equipe ou o servidor alteram.
create or replace function public.profiles_protect_birthday()
returns trigger
language plpgsql
security invoker
set search_path to 'public'
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if new.birthday is not distinct from old.birthday then
    return new;
  end if;
  if public.is_insight_staff() then
    return new;
  end if;
  if old.birthday is not null then
    raise exception 'birthday_locked' using errcode = '42501',
      hint = 'A data de nascimento só pode ser corrigida pelo suporte.';
  end if;
  if new.birthday > current_date or new.birthday < current_date - interval '120 years' then
    raise exception 'birthday_invalid' using errcode = '22007';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_birthday on public.profiles;
create trigger profiles_protect_birthday
  before update of birthday on public.profiles
  for each row execute function public.profiles_protect_birthday();
