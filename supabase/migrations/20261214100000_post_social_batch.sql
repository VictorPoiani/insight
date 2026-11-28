-- Contexto social de vários posts numa só chamada, já resumido no banco:
-- 3 curtidas mais recentes, a resposta em destaque (texto curto) e a contagem
-- de reações. Antes o app baixava até 800 curtidas e 500 respostas inteiras.
create or replace function public.post_social_batch(p_ids uuid[])
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  -- só posts que quem chama pode ver (privados e retidos ficam de fora)
  with ids as (select x.id from (select distinct unnest(p_ids[1:100]) id) x where public.can_view_post(x.id)),
  me as (select public.current_profile_id() id),
  likers as (
    select l.post_id, jsonb_agg(jsonb_build_object(
      'id', p.id, 'username', p.username,
      'name', coalesce(nullif(p.display_name, ''), nullif(p.full_name, ''), p.username),
      'avatar_url', p.avatar_url) order by l.created_at desc) j
    from ids
    cross join lateral (
      select pl.post_id, pl.profile_id, pl.created_at from post_likes pl
      where pl.post_id = ids.id order by pl.created_at desc limit 3
    ) l
    join profiles p on p.id = l.profile_id
    group by l.post_id
  ),
  top_reply as (
    select r.post_id, jsonb_build_object(
      'id', r.id, 'likes', coalesce(r.likes_count, 0), 'created_at', r.created_at,
      'text', left(coalesce(nullif(trim(regexp_replace(regexp_replace(
        (select string_agg(b->>'html', ' ') from jsonb_array_elements(case when jsonb_typeof(r.blocks) = 'array' then r.blocks else '[]'::jsonb end) b),
        '<[^>]+>', ' ', 'g'), '\s+', ' ', 'g')), ''), r.content, ''), 200),
      'has_media', exists (select 1 from jsonb_array_elements(case when jsonb_typeof(r.blocks) = 'array' then r.blocks else '[]'::jsonb end) b where b->>'type' in ('image', 'gif', 'video')),
      'author', jsonb_build_object(
        'id', r.profile_id,
        'username', coalesce(p.username, r.author_handle, 'membro'),
        'name', coalesce(nullif(p.display_name, ''), nullif(p.full_name, ''), r.author_name, p.username, 'Membro do Insight'),
        'avatar_url', coalesce(p.avatar_url, r.avatar_url))) j
    from ids
    cross join lateral (
      select * from replies x
      where x.post_id = ids.id and x.parent_reply_id is null and x.moderation_status = 'approved'
      order by coalesce(x.likes_count, 0) desc, x.created_at desc limit 1
    ) r
    left join profiles p on p.id = r.profile_id
  ),
  reactions as (
    select pr.post_id, jsonb_object_agg(pr.reaction, pr.n) j
    from (select post_id, reaction, count(*) n from post_reactions where post_id in (select id from ids) group by 1, 2) pr
    group by pr.post_id
  ),
  mine as (
    select r.post_id, r.reaction from post_reactions r, me
    where r.profile_id = me.id and r.post_id in (select id from ids)
  )
  select coalesce(jsonb_object_agg(ids.id, jsonb_build_object(
    'likers', coalesce(likers.j, '[]'::jsonb),
    'topReply', top_reply.j,
    'reactions', coalesce(reactions.j, '{}'::jsonb),
    'myReaction', mine.reaction)), '{}'::jsonb)
  from ids
  left join likers on likers.post_id = ids.id
  left join top_reply on top_reply.post_id = ids.id
  left join reactions on reactions.post_id = ids.id
  left join mine on mine.post_id = ids.id
$$;
revoke all on function public.post_social_batch(uuid[]) from public;
grant execute on function public.post_social_batch(uuid[]) to anon, authenticated;
