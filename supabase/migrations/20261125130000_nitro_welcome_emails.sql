-- E-mail de boas-vindas do Insight Nitro: uma linha por perfil = já enviado (trava contra duplicados)
create table if not exists public.nitro_welcome_emails (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  sent_at timestamptz not null default now(),
  provider text
);
alter table public.nitro_welcome_emails enable row level security; -- sem políticas: só o servidor (service role)
revoke all on public.nitro_welcome_emails from anon, authenticated;
-- quem já é ou foi assinante não recebe boas-vindas atrasadas
insert into public.nitro_welcome_emails (profile_id, provider)
select id, 'backfill' from public.profiles
where nitro_status in ('active', 'past_due', 'canceled') or coalesce(has_lifetime_nitro, false)
on conflict do nothing;
