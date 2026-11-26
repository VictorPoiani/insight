-- Depois que o site passou a usar profile_birthdays: some a data completa da tabela pública.
-- (cópia final de qualquer data gravada no meio da troca)
insert into public.profile_birthdays (profile_id, birthday)
select id, birthday from public.profiles where birthday is not null
on conflict (profile_id) do nothing;
update public.profiles set birthday_md = to_char(birthday, 'MM-DD') where birthday is not null and birthday_md is null;

drop trigger if exists profiles_protect_birthday on public.profiles;
drop function if exists public.profiles_protect_birthday();
alter table public.profiles drop column if exists birthday;

-- dia/mês: só pelas funções de data (ninguém edita direto)
create or replace function public.profiles_protect_birthday_md()
returns trigger
language plpgsql
security invoker
set search_path to 'public'
as $$
begin
  if current_user in ('authenticated', 'anon') and new.birthday_md is distinct from old.birthday_md then
    new.birthday_md := old.birthday_md;
  end if;
  return new;
end;
$$;
drop trigger if exists profiles_protect_birthday_md on public.profiles;
create trigger profiles_protect_birthday_md
  before update of birthday_md on public.profiles
  for each row execute function public.profiles_protect_birthday_md();
