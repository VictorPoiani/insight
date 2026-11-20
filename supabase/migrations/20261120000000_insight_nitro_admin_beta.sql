-- ============================================================================
-- INSIGHT NITRO — fase beta fechada (somente role = 'admin')
--
-- O catálogo vive no código (src/lib/nitro/catalog.ts). Aqui guardamos apenas
-- o que o usuário equipou + toggles, num snapshot em profiles.cosmetics.
-- Tabelas de catálogo/assinatura (docs/insight-nitro.md §3) entram no lançamento.
-- Migração aditiva e idempotente.
-- ============================================================================

alter table public.profiles
  add column if not exists cosmetics jsonb;

-- ---------------------------------------------------------------------------
-- Proteção: profiles.cosmetics só pode ser alterado pela RPC abaixo.
-- (As policies atuais de UPDATE em profiles são amplas; este trigger garante
--  que ninguém escreva cosmetics diretamente.)
-- ---------------------------------------------------------------------------
create or replace function public.protect_profile_cosmetics()
returns trigger
language plpgsql
as $$
begin
  if new.cosmetics is distinct from old.cosmetics
     and coalesce(current_setting('insight.cosmetics_writer', true), '') <> 'on' then
    new.cosmetics := old.cosmetics;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_cosmetics on public.profiles;
create trigger profiles_protect_cosmetics
  before update on public.profiles
  for each row execute function public.protect_profile_cosmetics();

-- ---------------------------------------------------------------------------
-- RPC: grava os cosméticos do usuário logado (somente admin na beta).
-- Recebe o objeto completo e normaliza/valida cada campo.
-- ---------------------------------------------------------------------------
create or replace function public.set_my_cosmetics(p_cosmetics jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me public.profiles;
  snap jsonb;
  k text;
begin
  select * into me
  from public.profiles
  where user_id = auth.uid() or id = auth.uid()
  limit 1;

  if me.id is null then
    raise exception 'not_authenticated';
  end if;

  if coalesce(me.role, '') <> 'admin' then
    raise exception 'nitro_admin_only';
  end if;

  if p_cosmetics is null or jsonb_typeof(p_cosmetics) <> 'object' then
    raise exception 'invalid_payload';
  end if;

  -- IDs de itens: slug curto ou null
  foreach k in array array['title', 'tag', 'frame', 'intro'] loop
    if p_cosmetics ? k and jsonb_typeof(p_cosmetics -> k) not in ('string', 'null') then
      raise exception 'invalid_field %', k;
    end if;
    if jsonb_typeof(p_cosmetics -> k) = 'string'
       and (p_cosmetics ->> k) !~ '^[a-z0-9-]{1,64}$' then
      raise exception 'invalid_item %', k;
    end if;
  end loop;

  -- Toggles: boolean
  foreach k in array array['frameEnabled', 'frameAnimated', 'introEnabled', 'levelAnimation'] loop
    if p_cosmetics ? k and jsonb_typeof(p_cosmetics -> k) <> 'boolean' then
      raise exception 'invalid_field %', k;
    end if;
  end loop;

  snap := jsonb_build_object(
    'v', 1,
    'title', p_cosmetics -> 'title',
    'tag', p_cosmetics -> 'tag',
    'frame', p_cosmetics -> 'frame',
    'intro', p_cosmetics -> 'intro',
    'frameEnabled', coalesce((p_cosmetics ->> 'frameEnabled')::boolean, true),
    'frameAnimated', coalesce((p_cosmetics ->> 'frameAnimated')::boolean, true),
    'introEnabled', coalesce((p_cosmetics ->> 'introEnabled')::boolean, true),
    'levelAnimation', coalesce((p_cosmetics ->> 'levelAnimation')::boolean, true),
    'updatedAt', now()
  );
  snap := jsonb_strip_nulls(snap);

  perform set_config('insight.cosmetics_writer', 'on', true);
  update public.profiles set cosmetics = snap where id = me.id;
  perform set_config('insight.cosmetics_writer', 'off', true);

  return snap;
end;
$$;

revoke all on function public.set_my_cosmetics(jsonb) from public;
grant execute on function public.set_my_cosmetics(jsonb) to authenticated;
