-- ============================================================================
-- Feed de notícias (Para você + aba Notícias)
--
--  news_items          notícias coletadas pelo servidor (service role grava)
--  news_sources        saúde de cada fonte (última coleta, erro)
--  news_topic_follows  temas que cada pessoa segue
--  news_events         sinais de interesse (abrir, curtir, ocultar) — privados
--  get_news_feed()     ranking personalizado
-- ============================================================================

create table if not exists public.news_items (
  id uuid primary key default gen_random_uuid(),
  url text not null unique check (url ~ '^https?://'),
  title text not null check (char_length(title) between 3 and 300),
  title_key text not null default '',
  summary text not null default '' check (char_length(summary) <= 500),
  image_url text check (image_url is null or image_url ~ '^https?://'),
  source_id text not null,
  source_name text not null,
  source_home text,
  topics text[] not null default '{}',
  lang text not null default 'pt',
  weight real not null default 1,
  published_at timestamptz not null default now(),
  fetched_at timestamptz not null default now(),
  open_count integer not null default 0,
  like_count integer not null default 0
);
create index if not exists news_items_published on public.news_items (published_at desc);
create index if not exists news_items_topics on public.news_items using gin (topics);
create index if not exists news_items_title_key on public.news_items (title_key, published_at desc);

create table if not exists public.news_sources (
  id text primary key,
  name text not null,
  last_run_at timestamptz,
  last_ok_at timestamptz,
  last_count integer not null default 0,
  last_error text
);

create table if not exists public.news_topic_follows (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  topic text not null check (topic ~ '^[a-z-]{2,24}$'),
  created_at timestamptz not null default now(),
  primary key (profile_id, topic)
);

create table if not exists public.news_events (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  news_id uuid not null references public.news_items(id) on delete cascade,
  kind text not null check (kind in ('open', 'like', 'hide')),
  created_at timestamptz not null default now(),
  primary key (profile_id, news_id, kind)
);
create index if not exists news_events_profile on public.news_events (profile_id, created_at desc);

alter table public.news_items enable row level security;
alter table public.news_sources enable row level security;
alter table public.news_topic_follows enable row level security;
alter table public.news_events enable row level security;

drop policy if exists news_items_read on public.news_items;
create policy news_items_read on public.news_items for select using (true);
drop policy if exists news_sources_read on public.news_sources;
create policy news_sources_read on public.news_sources for select using (public.is_insight_admin());

drop policy if exists news_follows_own on public.news_topic_follows;
create policy news_follows_own on public.news_topic_follows for all
  using (profile_id = public.current_profile_id())
  with check (profile_id = public.current_profile_id());

drop policy if exists news_events_read_own on public.news_events;
create policy news_events_read_own on public.news_events for select using (profile_id = public.current_profile_id());

revoke all on public.news_items, public.news_sources, public.news_topic_follows, public.news_events from anon, authenticated;
grant select on public.news_items to anon, authenticated;
grant select on public.news_sources to authenticated;
grant select, insert, delete on public.news_topic_follows to authenticated;
grant select on public.news_events to authenticated;

-- Registrar sinal (abrir/curtir/ocultar) e manter os contadores públicos
create or replace function public.news_track(p_news_id uuid, p_kind text, p_on boolean default true)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  me uuid := public.current_profile_id();
  inserted boolean := false;
  removed boolean := false;
  n integer;
begin
  if p_kind not in ('open', 'like', 'hide') then raise exception 'invalid_kind'; end if;
  if me is null then
    -- visitante: só conta a abertura
    if p_kind = 'open' then update public.news_items set open_count = open_count + 1 where id = p_news_id; end if;
    return;
  end if;
  if p_on then
    insert into public.news_events (profile_id, news_id, kind) values (me, p_news_id, p_kind)
    on conflict do nothing;
    get diagnostics n = row_count;
    inserted := n > 0;
  else
    delete from public.news_events where profile_id = me and news_id = p_news_id and kind = p_kind;
    get diagnostics n = row_count;
    removed := n > 0;
  end if;
  if p_kind = 'open' and inserted then
    update public.news_items set open_count = open_count + 1 where id = p_news_id;
  elsif p_kind = 'like' and inserted then
    update public.news_items set like_count = like_count + 1 where id = p_news_id;
  elsif p_kind = 'like' and removed then
    update public.news_items set like_count = greatest(0, like_count - 1) where id = p_news_id;
  end if;
end;
$$;
grant execute on function public.news_track(uuid, text, boolean) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- Ranking
--
--  score = frescor × (1 + temas seguidos + afinidade aprendida + fonte
--          + popularidade) × penalidades (já aberta, mesma fonte repetida)
--
--  * frescor: decaimento exponencial (meia-vida ~12h em Notícias, ~20h no
--    Para você, que tem menos itens)
--  * temas seguidos: +1,2 por tema em comum (até 2)
--  * afinidade aprendida: últimos 30 dias de abrir (+1), curtir (+3) e
--    ocultar (−4) por tema e por fonte, com decaimento de 10 dias
--  * popularidade: log de aberturas e curtidas de toda a comunidade
--  * diversidade: cada repetição da mesma fonte vale 25% menos
--  * mesma história em vários portais: só a melhor versão (title_key)
--  * ocultadas somem; já abertas descem
--
--  p_mode = 'for_you' → só temas seguidos; 'all' → todos (os do gosto da
--  pessoa sobem); p_topic filtra um tema.
-- ----------------------------------------------------------------------------
drop function if exists public.get_news_feed(text, integer, integer, text);
create or replace function public.get_news_feed(
  p_mode text default 'all',
  p_limit integer default 20,
  p_offset integer default 0,
  p_topic text default null
)
returns jsonb
language sql stable security definer set search_path = public
as $$
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
  cand as (
    select i.*,
      (select count(*) from unnest(i.topics) x where x in (select topic from followed)) as follow_hits,
      coalesce((select sum(a.w) from unnest(i.topics) x join topic_aff a on a.topic = x), 0) as t_aff,
      coalesce((select s.w from source_aff s where s.source_id = i.source_id), 0) as s_aff,
      exists (select 1 from ev where ev.news_id = i.id and ev.kind = 'open') as seen,
      exists (select 1 from ev where ev.news_id = i.id and ev.kind = 'like') as liked,
      extract(epoch from now() - i.published_at) / 3600.0 as age_h
    from public.news_items i
    where i.published_at > now() - interval '4 days'
      and i.published_at <= now() + interval '1 hour'
      and not exists (select 1 from ev where ev.news_id = i.id and ev.kind = 'hide')
      and (p_topic is null or p_topic = any(i.topics))
      and (p_mode <> 'for_you' or i.topics && array(select topic from followed))
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
$$;
grant execute on function public.get_news_feed(text, integer, integer, text) to anon, authenticated;
