-- ============================================================================
-- Notebook (Preview) · Fase B — Produtividade.
--  1. Busca em português (com radicais: "castelos" acha "castelo") em notas,
--     capítulos e verbetes, com trecho destacado.
--  2. Pendências derivadas do texto (Central de Pendências).
-- ============================================================================

alter table public.notebook_items add column if not exists todos jsonb not null default '[]'::jsonb;
create index if not exists notebook_items_todos_idx on public.notebook_items ((jsonb_array_length(todos))) where jsonb_array_length(todos) > 0;

alter table public.notebook_items add column if not exists search_tsv tsvector
  generated always as (
    setweight(to_tsvector('portuguese'::regconfig, coalesce(title, '')), 'A')
    || setweight(to_tsvector('portuguese'::regconfig, left(coalesce(content, ''), 200000)), 'B')
    || setweight(to_tsvector('portuguese'::regconfig, left(regexp_replace(coalesce(data->>'html', ''), '<[^>]+>', ' ', 'g'), 200000)), 'B')
    || setweight(to_tsvector('portuguese'::regconfig, coalesce(data->>'synopsis', '')), 'C')
  ) stored;
create index if not exists notebook_items_search_idx on public.notebook_items using gin (search_tsv);

-- array_to_string é STABLE; a coluna gerada precisa de uma versão IMMUTABLE
create or replace function public.notebook_join_words(p text[])
returns text language sql immutable parallel safe set search_path = public
as $$ select coalesce(array_to_string(p, ' '), '') $$;

alter table public.notebook_entries add column if not exists search_tsv tsvector
  generated always as (
    setweight(to_tsvector('portuguese'::regconfig, coalesce(title, '')), 'A')
    || setweight(to_tsvector('portuguese'::regconfig, public.notebook_join_words(aliases)), 'A')
    || setweight(to_tsvector('portuguese'::regconfig, coalesce(summary, '')), 'B')
  ) stored;
create index if not exists notebook_entries_search_idx on public.notebook_entries using gin (search_tsv);

-- Busca do Notebook (só do próprio usuário, pela RLS: security invoker)
create or replace function public.notebook_search(p_q text, p_limit integer default 60)
returns table (kind text, id uuid, title text, snippet text, rank real)
language sql stable security invoker set search_path = public
as $$
  with q as (select websearch_to_tsquery('portuguese', left(coalesce(p_q, ''), 200)) as tsq)
  (
    select 'item'::text, i.id, i.title,
      ts_headline('portuguese',
        left(coalesce(nullif(i.content, ''), regexp_replace(coalesce(i.data->>'html', i.data->>'synopsis', ''), '<[^>]+>', ' ', 'g')), 20000),
        q.tsq, 'StartSel=<<,StopSel=>>,MaxWords=24,MinWords=10,MaxFragments=1'),
      ts_rank(i.search_tsv, q.tsq)
    from public.notebook_items i, q
    where i.profile_id = public.current_profile_id() and i.archived_at is null and i.search_tsv @@ q.tsq
    order by 5 desc
    limit greatest(1, least(p_limit, 200))
  )
  union all
  (
    select 'entry'::text, e.id, e.title,
      ts_headline('portuguese', coalesce(e.summary, ''), q.tsq, 'StartSel=<<,StopSel=>>,MaxWords=24,MinWords=8,MaxFragments=1'),
      ts_rank(e.search_tsv, q.tsq)
    from public.notebook_entries e, q
    where e.profile_id = public.current_profile_id() and e.deleted_at is null and e.search_tsv @@ q.tsq
    order by 5 desc
    limit 40
  );
$$;
revoke all on function public.notebook_search(text, integer) from public, anon;
grant execute on function public.notebook_search(text, integer) to authenticated;
