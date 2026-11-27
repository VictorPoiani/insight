-- ============================================================================
-- Notebook (Preview) · Fase C — Biblioteca de Mídias.
-- Calcula media_refs das notas que existiam antes da Fase A (endereços de
-- mídia do Notebook citados no texto ou nos dados), para a Biblioteca saber
-- onde cada arquivo é usado e não marcar como órfão o que está em uso.
-- ============================================================================
update public.notebook_items i
set media_refs = coalesce((
  select array_agg(distinct m[1])
  from regexp_matches(coalesce(i.content, '') || ' ' || coalesce(i.data::text, ''), '(https?://[^\s"''<>)\]\\]+/users/[0-9a-f-]+/notebook/[^\s"''<>)\]\\]+)', 'g') as m
), '{}')
where media_refs = '{}'
  and (coalesce(i.content, '') ~ '/users/[0-9a-f-]+/notebook/' or coalesce(i.data::text, '') ~ '/users/[0-9a-f-]+/notebook/');
