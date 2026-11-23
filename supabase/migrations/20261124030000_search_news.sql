-- Busca de notícias por termo (aparece junto com a busca de posts e membros).
-- Sem extensão unaccent: normaliza acentos com translate().
create or replace function public.news_fold(t text)
returns text
language sql
immutable
set search_path = public
as $$
  select translate(lower(coalesce(t, '')),
    'áàâãäåéèêëíìîïóòôõöúùûüçñ',
    'aaaaaaeeeeiiiiooooouuuucn');
$$;

create or replace function public.search_news(p_q text, p_limit integer default 6)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  terms text[];
  me uuid := public.current_profile_id();
  result jsonb;
begin
  select coalesce(array_agg(w), '{}')
    into terms
    from (
      select distinct w
        from unnest(regexp_split_to_array(public.news_fold(left(coalesce(p_q, ''), 120)), '[^a-z0-9#]+')) w
       where length(w) >= 2
       limit 6
    ) x;
  if array_length(terms, 1) is null then
    return '[]'::jsonb;
  end if;

  with c as (
    select i.*,
           public.news_fold(i.title) as ft,
           public.news_fold(i.summary) as fs
      from public.news_items i
     where i.published_at > now() - interval '7 days'
  ),
  m as (
    select c.*,
      (select count(*) from unnest(terms) t where c.ft like '%' || t || '%') as title_hits,
      (select count(*) from unnest(terms) t where c.ft like '%' || t || '%' or c.fs like '%' || t || '%' or t = any(c.topics)) as any_hits
    from c
  ),
  r as (
    select m.*,
      exists (select 1 from public.news_events e where e.news_id = m.id and e.profile_id = me and e.kind = 'open') as seen,
      exists (select 1 from public.news_events e where e.news_id = m.id and e.profile_id = me and e.kind = 'like') as liked,
      row_number() over (partition by m.title_key order by m.published_at desc) as story_rank,
      m.title_hits * 2.0 + m.any_hits
        - extract(epoch from (now() - m.published_at)) / 86400.0 * 0.6 as score
    from m
    where m.any_hits = array_length(terms, 1)
  )
  select coalesce(jsonb_agg(q.item order by q.score desc), '[]'::jsonb)
    into result
    from (
      select jsonb_build_object(
        'id', r.id, 'url', r.url, 'title', r.title, 'summary', r.summary,
        'image_url', r.image_url, 'source_id', r.source_id, 'source_name', r.source_name,
        'source_home', r.source_home, 'topics', r.topics, 'lang', r.lang,
        'published_at', r.published_at, 'open_count', r.open_count, 'like_count', r.like_count,
        'liked', r.liked, 'seen', r.seen, 'followed_hits', 0
      ) as item, r.score
      from r
      where r.story_rank = 1
      order by r.score desc
      limit least(greatest(coalesce(p_limit, 6), 1), 20)
    ) q;
  return result;
end;
$$;
grant execute on function public.search_news(text, integer) to anon, authenticated;
