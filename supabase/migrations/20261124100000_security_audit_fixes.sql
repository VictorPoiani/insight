-- ============================================================================
-- Auditoria de segurança (AppSec) — correções no banco
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. IDOR em Insights privados: curtir/repostar/votar por ID funcionava em
--    posts privados e rascunhos, e vote_poll devolvia os blocos do post.
-- ---------------------------------------------------------------------------
create or replace function public.can_view_post(p_post_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.posts p
    where p.id = p_post_id
      and (
        (coalesce(p.visibility, 'public') <> 'private' and coalesce(p.is_draft, false) = false)
        or p.profile_id = public.current_profile_id()
        or p.author_id = public.current_profile_id()
        or public.is_insight_staff()
      )
  )
$$;
revoke all on function public.can_view_post(uuid) from public, anon;
grant execute on function public.can_view_post(uuid) to authenticated, service_role;

create or replace function public.guard_post_interaction()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') or auth.uid() is not null then
    if not public.can_view_post(new.post_id) then
      raise exception 'post_not_found' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists post_likes_guard on public.post_likes;
create trigger post_likes_guard before insert on public.post_likes
  for each row execute function public.guard_post_interaction();
drop trigger if exists post_reposts_guard on public.post_reposts;
create trigger post_reposts_guard before insert on public.post_reposts
  for each row execute function public.guard_post_interaction();
drop trigger if exists poll_votes_guard on public.poll_votes;
create trigger poll_votes_guard before insert on public.poll_votes
  for each row execute function public.guard_post_interaction();

-- vote_poll: checa a visibilidade ANTES de ler/devolver os blocos
-- (com option_ids vazio nenhum voto é inserido, então o trigger não bastaria)
create or replace function public.vote_poll(target_post_id uuid, target_block_id text, option_ids text[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := public.current_profile_id();
  post_blocks jsonb;
  poll jsonb;
  valid_ids text[];
  chosen text[];
  previous text[];
  new_blocks jsonb;
begin
  if me is null then
    raise exception 'not_authenticated';
  end if;
  if not public.can_view_post(target_post_id) then
    raise exception 'post_not_found';
  end if;

  select blocks into post_blocks from public.posts where id = target_post_id for update;
  if post_blocks is null or jsonb_typeof(post_blocks) <> 'array' then
    raise exception 'post_not_found';
  end if;

  select b into poll
  from jsonb_array_elements(post_blocks) b
  where b ->> 'id' = target_block_id and b ->> 'type' = 'poll'
  limit 1;
  if poll is null then
    raise exception 'poll_not_found';
  end if;

  select coalesce(array_agg(o ->> 'id'), '{}') into valid_ids
  from jsonb_array_elements(coalesce(poll -> 'pollOptions', '[]'::jsonb)) o;

  select coalesce(array_agg(distinct x), '{}') into chosen
  from unnest(coalesce(option_ids, '{}')) x
  where x = any(valid_ids);

  if coalesce((poll ->> 'pollMultiple')::boolean, false) = false and cardinality(chosen) > 1 then
    chosen := chosen[1:1];
  end if;

  select coalesce(array_agg(option_id), '{}') into previous
  from public.poll_votes
  where post_id = target_post_id and block_id = target_block_id and profile_id = me;

  delete from public.poll_votes
  where post_id = target_post_id and block_id = target_block_id and profile_id = me;

  insert into public.poll_votes (post_id, block_id, option_id, profile_id)
  select target_post_id, target_block_id, x, me from unnest(chosen) x;

  select jsonb_agg(
    case when b ->> 'id' = target_block_id and b ->> 'type' = 'poll' then
      jsonb_set(b, '{pollOptions}', (
        select coalesce(jsonb_agg(
          jsonb_set(o, '{votes}', to_jsonb(greatest(0,
            (case when (o ->> 'votes') ~ '^\d+$' then (o ->> 'votes')::int else 0 end)
            - (case when (o ->> 'id') = any(previous) then 1 else 0 end)
            + (case when (o ->> 'id') = any(chosen) then 1 else 0 end)
          )))
          order by oi), '[]'::jsonb)
        from jsonb_array_elements(b -> 'pollOptions') with ordinality as po(o, oi)
      ))
    else b end
    order by bi)
  into new_blocks
  from jsonb_array_elements(post_blocks) with ordinality as pb(b, bi);

  update public.posts set blocks = new_blocks where id = target_post_id;

  return jsonb_build_object('blocks', new_blocks, 'selected', to_jsonb(chosen));
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Notificações forjadas: qualquer usuário podia mandar qualquer texto, de
--    qualquer tipo (menos 'system'), para qualquer pessoa (phishing/spam).
--    Agora o cliente só cria 'reply'/'repost' ligados a um post visível, para
--    o autor do post ou de uma resposta nele, com texto curto.
-- ---------------------------------------------------------------------------
drop policy if exists notifications_insert_as_actor on public.notifications;
create policy notifications_insert_as_actor on public.notifications
  for insert to authenticated
  with check (
    public.is_insight_admin()
    or (
      actor_id = public.current_profile_id()
      and recipient_id is not null
      and recipient_id <> actor_id
      and type in ('reply', 'repost')
      and post_id is not null
      and public.can_view_post(post_id)
      and char_length(coalesce(message, '')) <= 300
      and char_length(coalesce(content_preview, '')) <= 300
      and (
        exists (select 1 from public.posts p where p.id = post_id
                and (p.profile_id = recipient_id or p.author_id = recipient_id))
        or exists (select 1 from public.replies r where r.post_id = notifications.post_id
                   and r.profile_id = recipient_id)
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 3. push_subscriptions aceitava INSERT de qualquer visitante (with check true):
--    lixo na tabela, recálculo de seguidores a cada linha e aparelhos falsos.
--    A rota /api/push grava com a service role; o acesso direto fecha.
-- ---------------------------------------------------------------------------
drop policy if exists "Permitir insercao publica de push_subscriptions" on public.push_subscriptions;

-- ---------------------------------------------------------------------------
-- 4. Newsletter: get_newsletter_prefs(email) revelava se QUALQUER e-mail é
--    assinante e suas preferências; subscribe_newsletter sobrescrevia as
--    preferências de outra pessoa. Agora só o dono do e-mail (sessão) lê ou
--    altera uma inscrição existente.
-- ---------------------------------------------------------------------------
create or replace function public.get_newsletter_prefs(p_email text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('notify_mode', notify_mode, 'interested_tags', interested_tags)
  from public.subscribers
  where email = lower(trim(p_email))
    and email = lower(coalesce(auth.jwt() ->> 'email', ''))
  limit 1
$$;
revoke all on function public.get_newsletter_prefs(text) from public, anon;
grant execute on function public.get_newsletter_prefs(text) to authenticated;

create or replace function public.subscribe_newsletter(p_email text, p_notify_mode text default 'all', p_interested_tags text[] default '{}')
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  clean text := lower(trim(p_email));
  mine text := lower(coalesce(auth.jwt() ->> 'email', ''));
  mode text := case when p_notify_mode in ('all', 'pinned', 'tags', 'official_only') then p_notify_mode else 'all' end;
  tags text[];
begin
  if clean !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(clean) > 254 then
    raise exception 'invalid_email';
  end if;

  select coalesce(array_agg(left(lower(t), 40)), '{}') into tags
  from (select unnest(coalesce(p_interested_tags, '{}')) t limit 30) s;

  if exists (select 1 from public.subscribers where email = clean) then
    -- inscrição existente: só o dono do e-mail altera as preferências
    if clean = mine then
      update public.subscribers
         set notify_official_updates = true,
             notify_mode = mode,
             interested_tags = case when mode = 'tags' then tags else '{}' end
       where email = clean;
    end if;
    return true; -- mesma resposta: não revela quem já é assinante
  end if;

  insert into public.subscribers (email, notify_official_updates, notify_mode, interested_tags)
  values (clean, true, mode, case when mode = 'tags' then tags else '{}' end)
  on conflict (email) do nothing;
  return true;
end;
$$;
