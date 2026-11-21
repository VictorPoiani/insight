-- ============================================================================
-- Insight Nitro — reembolso ao chegar no Nível 5 + vitalício do fundador
--
--  * Quem chega ao Nível 5 com assinatura ativa: a assinatura é cancelada e a
--    última mensalidade é reembolsada (processado pelo servidor, que tem o
--    token do Mercado Pago — src/lib/nitro/mercadopago.ts). O Nível 5 já dá
--    has_lifetime_nitro (trigger grant_lifetime_nitro).
--  * Vitalício incondicional: só o fundador (perfil admin principal).
-- ============================================================================

-- fundador: vitalício independente de nível
update public.profiles set has_lifetime_nitro = true
where id = '96d271a9-9102-49b1-b593-9279c5dfe3f4';

create table if not exists public.nitro_level5_refunds (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  subscription_id text not null,
  requested_at timestamptz not null default now(),
  processed_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'refunded', 'canceled_no_payment', 'error')),
  refunded_payment_id text,
  amount numeric(10, 2),
  attempts integer not null default 0,
  last_error text,
  unique (profile_id, subscription_id)
);
alter table public.nitro_level5_refunds enable row level security;
-- sem políticas: só o service role (servidor) lê e escreve
revoke all on public.nitro_level5_refunds from anon, authenticated;

create or replace function public.queue_nitro_level5_refund()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if coalesce(new.contributor_level, 0) >= 5
     and new.nitro_status in ('active', 'past_due')
     and new.nitro_subscription_id is not null
     and (
       coalesce(old.contributor_level, 0) < 5
       or old.nitro_status is distinct from new.nitro_status
       or old.nitro_subscription_id is distinct from new.nitro_subscription_id
     )
  then
    insert into public.nitro_level5_refunds (profile_id, subscription_id)
    values (new.id, new.nitro_subscription_id)
    on conflict (profile_id, subscription_id) do nothing;
  end if;
  return new;
end;
$$;
revoke execute on function public.queue_nitro_level5_refund() from public, anon, authenticated;

drop trigger if exists profiles_queue_nitro_level5_refund on public.profiles;
create trigger profiles_queue_nitro_level5_refund
  after update of contributor_level, nitro_status, nitro_subscription_id on public.profiles
  for each row execute function public.queue_nitro_level5_refund();

-- quem já está no Nível 5 com assinatura ativa entra na fila agora
insert into public.nitro_level5_refunds (profile_id, subscription_id)
select id, nitro_subscription_id from public.profiles
where coalesce(contributor_level, 0) >= 5 and nitro_status in ('active', 'past_due') and nitro_subscription_id is not null
on conflict do nothing;
