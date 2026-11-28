-- Contas novas: "Membro Beta" só enquanto o cadastro exige convite; bio sem emoji.
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  requested_username text;
  final_username text;
  user_full_name text;
  invite text;
  bypass boolean := coalesce(new.raw_app_meta_data->>'invite_bypass', 'false') = 'true';
  bday date := public.birthday_from_signup(new.raw_user_meta_data);
  closed boolean := public.signup_invite_required();
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
    new.id, new.id, final_username, user_full_name, user_full_name,
    case when closed then 'Membro Beta' else null end, '#3B82F6',
    '/assets/net/default-perfil', 'Novo membro do Insight', '[]'::jsonb, '{}'::jsonb,
    0, 0, 'user', 'active', false
  );

  if bday is not null then
    perform public.save_profile_birthday(new.id, bday);
  end if;

  if closed and not bypass then
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
