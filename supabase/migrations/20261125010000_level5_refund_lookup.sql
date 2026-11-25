-- Nível 5 → Nitro vitalício: a fila de reembolso não dependia só do ID da
-- assinatura gravado no perfil. Perfis ativados sem esse ID (ex.: liberados
-- manualmente) ficavam de fora. Agora entram com o marcador 'lookup' e o
-- processador procura a assinatura direto no Mercado Pago.
create or replace function public.queue_nitro_level5_refund()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.contributor_level, 0) >= 5
     and new.nitro_status in ('active', 'past_due')
     and (
       tg_op = 'INSERT'
       or coalesce(old.contributor_level, 0) < 5
       or old.nitro_status is distinct from new.nitro_status
       or old.nitro_subscription_id is distinct from new.nitro_subscription_id
     )
  then
    insert into public.nitro_level5_refunds (profile_id, subscription_id)
    values (new.id, coalesce(new.nitro_subscription_id, 'lookup'))
    on conflict (profile_id, subscription_id) do nothing;
  end if;
  return new;
end;
$$;

-- casos já existentes: Nível 5 com assinatura ainda ativa e nada na fila
insert into public.nitro_level5_refunds (profile_id, subscription_id)
select p.id, coalesce(p.nitro_subscription_id, 'lookup')
from public.profiles p
where coalesce(p.contributor_level, 0) >= 5
  and p.nitro_status in ('active', 'past_due')
  and p.role is distinct from 'admin'
  and not exists (select 1 from public.nitro_level5_refunds r where r.profile_id = p.id and r.status <> 'error')
on conflict (profile_id, subscription_id) do nothing;
