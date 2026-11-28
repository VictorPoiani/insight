-- Interruptor do cadastro aberto (liga no lançamento, sem novo deploy).
create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);
alter table public.site_settings enable row level security;
drop policy if exists site_settings_read on public.site_settings;
create policy site_settings_read on public.site_settings for select using (true);
revoke all on public.site_settings from anon, authenticated;
grant select on public.site_settings to anon, authenticated;

insert into public.site_settings (key, value) values ('signup_open', 'false'::jsonb)
on conflict (key) do nothing;

-- antes era fixo em "true"; agora segue o interruptor
create or replace function public.signup_invite_required()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select not coalesce((select value = 'true'::jsonb from public.site_settings where key = 'signup_open'), false)
$$;
grant execute on function public.signup_invite_required() to anon, authenticated;

-- só a equipe liga/desliga
create or replace function public.set_signup_open(p_open boolean)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.is_insight_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  insert into public.site_settings (key, value, updated_at, updated_by)
  values ('signup_open', to_jsonb(coalesce(p_open, false)), now(), public.current_profile_id())
  on conflict (key) do update set value = excluded.value, updated_at = now(), updated_by = excluded.updated_by;
end;
$$;
revoke all on function public.set_signup_open(boolean) from public, anon;
grant execute on function public.set_signup_open(boolean) to authenticated;
