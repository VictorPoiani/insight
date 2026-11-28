-- Notícias: pontua só as 600 candidatas mais recentes (antes eram todas as dos
-- últimos 4 dias, ~4.600 por chamada: ~450 ms → ~28 ms). A pontuação já
-- favorece as recentes, então as primeiras páginas ficam iguais.
CREATE OR REPLACE FUNCTION public.get_news_feed(p_mode text DEFAULT 'all'::text, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0, p_topic text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with me as (select public.current_profile_id() as id),
  followed as (
    select f.topic from public.news_topic_follows f, me where f.profile_id = me.id
  ),
  ev as (
    select e.news_id, e.kind,
           exp(-extract(epoch from now() - e.created_at) / (86400.0 * 10)) as decay
    from public.news_events e, me
    where e.profile_id = me.id and e.created_at > now() - interval '30 days'
  ),
  topic_aff as (
    select t.topic,
           sum(case ev.kind when 'open' then 1.0 when 'like' then 3.0 else -4.0 end * ev.decay) as w
    from ev join public.news_items i on i.id = ev.news_id, unnest(i.topics) as t(topic)
    group by t.topic
  ),
  source_aff as (
    select i.source_id,
           sum(case ev.kind when 'open' then 0.5 when 'like' then 1.5 else -3.0 end * ev.decay) as w
    from ev join public.news_items i on i.id = ev.news_id
    group by i.source_id
  ),
  recent as (
    select i.*
    from public.news_items i
    where i.published_at > now() - interval '4 days'
      and i.published_at <= now() + interval '1 hour'
      and (p_topic is null or p_topic = any(i.topics))
      and (p_mode <> 'for_you' or i.topics && array(select topic from followed))
    order by i.published_at desc
    limit 600
  ),
  cand as (
    select i.*,
      (select count(*) from unnest(i.topics) x where x in (select topic from followed)) as follow_hits,
      coalesce((select sum(a.w) from unnest(i.topics) x join topic_aff a on a.topic = x), 0) as t_aff,
      coalesce((select s.w from source_aff s where s.source_id = i.source_id), 0) as s_aff,
      exists (select 1 from ev where ev.news_id = i.id and ev.kind = 'open') as seen,
      exists (select 1 from ev where ev.news_id = i.id and ev.kind = 'like') as liked,
      extract(epoch from now() - i.published_at) / 3600.0 as age_h
    from recent i
    where not exists (select 1 from ev where ev.news_id = i.id and ev.kind = 'hide')
  ),
  scored as (
    select c.*,
      exp(-greatest(c.age_h, 0) / case when p_mode = 'for_you' then 29.0 else 17.0 end)
      * (1
         + 1.2 * least(c.follow_hits, 2)
         + 0.6 * tanh(c.t_aff / 3.0)
         + 0.4 * tanh(c.s_aff / 3.0)
         + 0.12 * ln(1 + c.open_count + 3 * c.like_count)
         + (c.weight - 1)
        )
      * case when c.seen then 0.35 else 1 end as base
    from cand c
  ),
  dedup as (
    select s.*, row_number() over (partition by s.title_key order by s.base desc) as story_rank
    from scored s
  ),
  diverse as (
    select d.*,
      d.base * power(0.75, row_number() over (partition by d.source_name order by d.base desc) - 1) as score
    from dedup d
    where d.story_rank = 1 or d.title_key = ''
  )
  select coalesce(jsonb_agg(q.item order by q.score desc), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'id', id, 'url', url, 'title', title, 'summary', summary, 'image_url', image_url,
      'source_id', source_id, 'source_name', source_name, 'source_home', source_home,
      'topics', topics, 'lang', lang, 'published_at', published_at,
      'open_count', open_count, 'like_count', like_count,
      'liked', liked, 'seen', seen, 'followed_hits', follow_hits,
      'score', round(score::numeric, 4)
    ) as item, score
    from diverse
    order by score desc
    limit least(greatest(p_limit, 1), 50) offset greatest(p_offset, 0)
  ) q
$function$;
