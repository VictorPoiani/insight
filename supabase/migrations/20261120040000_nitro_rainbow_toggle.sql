-- ============================================================================
-- Insight Nitro: toggle "rainbow" (logo e asteriscos de carregamento)
-- Recria set_my_cosmetics aceitando o campo novo. CREATE OR REPLACE mantém
-- os privilégios definidos em 20261120030000_function_privileges.sql.
-- ============================================================================

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
