-- ============================================================================
-- @menções: quem é marcado num post (público) ou numa resposta é avisado.
-- Respeita notification_prefs (tipo 'mention') pelo filtro já existente.
-- ============================================================================

-- @handles de um texto (sem repetição, no máximo 10)
create or replace function public.extract_mentions(p_text text)
returns text[]
language sql
immutable
set search_path = public
as $$
  select coalesce(array_agg(h), '{}') from (
    select distinct lower(m[1]) as h
    from regexp_matches(coalesce(p_text, ''),
      '(?:^|[^A-Za-z0-9_@/.&])@([A-Za-z0-9_](?:[A-Za-z0-9_.]{0,28}[A-Za-z0-9_])?)', 'g') as m
    limit 10
  ) s
$$;

create or replace function public.notify_mentions(
  p_actor uuid, p_post uuid, p_text text, p_preview text, p_skip uuid[] default '{}'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  handles text[] := public.extract_mentions(p_text);
begin
  if p_actor is null or cardinality(handles) = 0 then return; end if;
  insert into public.notifications (recipient_id, user_id, actor_id, type, post_id, content_preview, message, is_read)
  select pr.id, pr.id, p_actor, 'mention', p_post, left(coalesce(p_preview, ''), 140), 'mencionou você', false
  from public.profiles pr
  where lower(pr.username) = any(handles)
    and pr.id <> p_actor
    and not (pr.id = any(coalesce(p_skip, '{}')))
    -- edição do mesmo post não repete o aviso
    and not exists (
      select 1 from public.notifications n
      where n.type = 'mention' and n.recipient_id = pr.id and n.actor_id = p_actor
        and n.post_id is not distinct from p_post
        and n.content_preview = left(coalesce(p_preview, ''), 140)
    );
end;
$$;
revoke execute on function public.notify_mentions(uuid, uuid, text, text, uuid[]) from public, anon, authenticated;

-- Posts: só públicos e publicados; na edição, avisa só quem foi marcado agora
create or replace function public.notify_post_mentions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := coalesce(new.author_id, new.profile_id);
  txt text := new.blocks::text || ' ' || coalesce(new.content, '');
  prev text[] := '{}';
  skip uuid[] := '{}';
  preview text;
begin
  if coalesce(new.visibility, 'public') = 'private' or coalesce(new.is_draft, false) then
    return new;
  end if;
  if tg_op = 'UPDATE' and not (coalesce(old.visibility, 'public') = 'private' or coalesce(old.is_draft, false)) then
    prev := public.extract_mentions(old.blocks::text || ' ' || coalesce(old.content, ''));
    select coalesce(array_agg(id), '{}') into skip from public.profiles where lower(username) = any(prev);
  end if;
  preview := left(regexp_replace(regexp_replace(coalesce((
    select string_agg(b ->> 'html', ' ') from jsonb_array_elements(
      case when jsonb_typeof(new.blocks) = 'array' then new.blocks else '[]'::jsonb end) b
    where b ->> 'html' is not null
  ), new.content, ''), '<[^>]+>', ' ', 'g'), '\s+', ' ', 'g'), 140);
  perform public.notify_mentions(actor, new.id, txt, trim(preview), skip);
  return new;
end;
$$;
revoke execute on function public.notify_post_mentions() from public, anon, authenticated;

drop trigger if exists posts_notify_mentions on public.posts;
create trigger posts_notify_mentions
  after insert or update of blocks, content, visibility, is_draft on public.posts
  for each row execute function public.notify_post_mentions();

-- Respostas (só em posts visíveis)
create or replace function public.notify_reply_mentions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  txt text := coalesce(new.content, '') || ' ' || coalesce(new.blocks::text, '');
begin
  if not exists (
    select 1 from public.posts p where p.id = new.post_id
      and coalesce(p.visibility, 'public') <> 'private' and coalesce(p.is_draft, false) = false
  ) then
    return new;
  end if;
  perform public.notify_mentions(new.profile_id, new.post_id, txt, left(coalesce(new.content, ''), 140), '{}');
  return new;
end;
$$;
revoke execute on function public.notify_reply_mentions() from public, anon, authenticated;

drop trigger if exists replies_notify_mentions on public.replies;
create trigger replies_notify_mentions
  after insert on public.replies
  for each row execute function public.notify_reply_mentions();
