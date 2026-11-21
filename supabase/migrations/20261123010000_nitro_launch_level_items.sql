-- ============================================================================
-- Insight Nitro — lançamento + itens de patente por nível
--
--  * nitro_is_public() passa a ler nitro_settings (is_public = 'true' agora).
--  * nitro_billing_enabled(): liga/desliga a assinatura sem deploy
--      update nitro_settings set value = 'true' where key = 'billing_enabled';
--  * Itens de patente (molduras, tags e aberturas tier-N) são EXCLUSIVOS do
--    nível: quem tem o nível usa; o Nitro não libera. O resto exige Nitro.
--  * set_my_cosmetics valida item a item (qualquer conta logada salva o que
--    pode usar).
-- ============================================================================

insert into public.nitro_settings (key, value) values ('is_public', 'true')
  on conflict (key) do update set value = excluded.value;
insert into public.nitro_settings (key, value) values ('billing_enabled', 'false')
  on conflict (key) do nothing;

create or replace function public.nitro_is_public()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((select value = 'true' from public.nitro_settings where key = 'is_public'), false)
$$;

create or replace function public.nitro_billing_enabled()
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.nitro_is_public()
     and coalesce((select value = 'true' from public.nitro_settings where key = 'billing_enabled'), false)
$$;
grant execute on function public.nitro_is_public() to anon, authenticated;
grant execute on function public.nitro_billing_enabled() to anon, authenticated;

-- nível mínimo de cada item de patente (null = não é item de patente)
create or replace function public.nitro_level_item_min(p_item text)
returns integer
language sql immutable set search_path = public
as $$
  select case p_item
    when 'frame-tier-0' then 0
    when 'frame-tier-1' then 1 when 'tag-tier-1' then 1
    when 'frame-tier-2' then 2 when 'tag-tier-2' then 2
    when 'frame-tier-3' then 3 when 'tag-tier-3' then 3
    when 'frame-tier-4' then 4 when 'tag-tier-4' then 4 when 'intro-tier-4' then 4
    when 'frame-tier-5' then 5 when 'tag-tier-5' then 5 when 'intro-tier-5' then 5
    else null
  end
$$;

-- mesma regra de src/lib/nitro/access.ts
create or replace function public.nitro_can_use_item(p public.profiles, p_item text)
returns boolean
language sql stable set search_path = public
as $$
  select case
    when p.id is null or p_item is null then false
    when p.role = 'admin' then true
    when public.nitro_level_item_min(p_item) is not null
      then coalesce(p.contributor_level, 0) >= public.nitro_level_item_min(p_item)
    when p_item in ('tag-nitro-founder') then false -- itens de evento
    else public.has_nitro_access(p)
  end
$$;

create or replace function public.set_my_cosmetics(p_cosmetics jsonb)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  me public.profiles;
  snap jsonb;
  k text;
begin
  select * into me from public.profiles where user_id = auth.uid() or id = auth.uid() limit 1;
  if me.id is null then raise exception 'not_authenticated'; end if;
  if p_cosmetics is null or jsonb_typeof(p_cosmetics) <> 'object' then raise exception 'invalid_payload'; end if;

  foreach k in array array['title', 'tag', 'frame', 'intro', 'font', 'theme'] loop
    if p_cosmetics ? k and jsonb_typeof(p_cosmetics -> k) not in ('string', 'null') then
      raise exception 'invalid_field %', k;
    end if;
    if jsonb_typeof(p_cosmetics -> k) = 'string' then
      if (p_cosmetics ->> k) !~ '^[a-z0-9-]{1,64}$' then
        raise exception 'invalid_item %', k;
      end if;
      -- patente pelo nível, resto pelo Nitro
      if not public.nitro_can_use_item(me, p_cosmetics ->> k) then
        raise exception 'item_locked %', p_cosmetics ->> k using errcode = '42501';
      end if;
    end if;
  end loop;

  foreach k in array array['frameEnabled', 'frameAnimated', 'introEnabled', 'levelAnimation', 'rainbow'] loop
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
    'font', p_cosmetics -> 'font',
    'theme', p_cosmetics -> 'theme',
    'frameEnabled', coalesce((p_cosmetics ->> 'frameEnabled')::boolean, true),
    'frameAnimated', coalesce((p_cosmetics ->> 'frameAnimated')::boolean, true),
    'introEnabled', coalesce((p_cosmetics ->> 'introEnabled')::boolean, true),
    'levelAnimation', coalesce((p_cosmetics ->> 'levelAnimation')::boolean, true),
    'rainbow', coalesce((p_cosmetics ->> 'rainbow')::boolean, true),
    'updatedAt', now()
  );
  snap := jsonb_strip_nulls(snap);

  perform set_config('insight.cosmetics_writer', 'on', true);
  update public.profiles set cosmetics = snap where id = me.id;
  perform set_config('insight.cosmetics_writer', 'off', true);
  return snap;
end;
$$;

revoke execute on function public.set_my_cosmetics(jsonb) from public, anon;
grant execute on function public.set_my_cosmetics(jsonb) to authenticated;
