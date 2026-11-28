-- Preparação para o lançamento público (~2 mil usuários com folga).

-- 1) Índices que faltavam (consultas por quem é seguido, membros ativos, não lidas,
--    e chaves estrangeiras usadas em exclusões em cascata)
create index if not exists follows_following_idx on public.follows (following_id, follower_id);
create index if not exists profiles_last_seen_idx on public.profiles (last_seen_at desc nulls last);
create index if not exists notifications_unread_idx on public.notifications (recipient_id) where is_read = false;
create index if not exists notifications_post_idx on public.notifications (post_id) where post_id is not null;
create index if not exists notifications_actor_idx on public.notifications (actor_id) where actor_id is not null;
create index if not exists post_likes_profile_idx on public.post_likes (profile_id);
create index if not exists post_reposts_profile_idx on public.post_reposts (profile_id);
create index if not exists post_saves_post_idx on public.post_saves (post_id);
create index if not exists post_reactions_profile_idx on public.post_reactions (profile_id);
create index if not exists replies_profile_idx on public.replies (profile_id);
create index if not exists replies_post_created_idx on public.replies (post_id, created_at);
create index if not exists posts_author_idx on public.posts (author_id) where author_id is not null;
create index if not exists news_events_news_idx on public.news_events (news_id);
-- índice idêntico a idx_posts_profile_id
drop index if exists public.posts_profile_id_idx;

-- 2) Aviso de post novo só para seguidores ativos nos últimos 30 dias
--    (quem sumiu não acumula milhares de notificações que nunca vai ler).
--    Sem registro de presença conta como ativo: só sai quem comprovadamente sumiu.
create or replace function public.notify_followers_on_new_post()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  author_uuid uuid := coalesce(new.profile_id, new.author_id);
begin
  if new.moderation_status <> 'approved' or new.announced_at is not null then
    return new;
  end if;
  update public.posts set announced_at = now() where id = new.id;
  if author_uuid is null or coalesce(new.visibility, 'public') = 'private' or coalesce(new.is_draft, false) then
    return new;
  end if;
  insert into public.notifications (recipient_id, actor_id, type, post_id, content_preview, message)
  select f.follower_id, author_uuid, 'new_post', new.id,
         case when new.is_nsfw then '[Conteúdo +18]' else left(new.content, 120) end,
         case when new.is_nsfw then '[Conteúdo +18]' else left(new.content, 120) end
  from public.follows f
  join public.profiles p on p.id = f.follower_id
  where f.following_id = author_uuid
    and f.follower_id <> author_uuid
    and (
      p.last_seen_at is null
      or p.last_seen_at > now() - interval '30 days'
      or exists (
        select 1 from public.user_activity_daily a
        where a.profile_id = f.follower_id and a.day > (now() - interval '30 days')::date
      )
    );
  return new;
end;
$$;

-- 3) Limitador de uso para rotas públicas da API (chamado só pelo servidor)
create table if not exists public.api_rate_limits (
  bucket text not null,
  window_start timestamptz not null,
  hits int not null default 0,
  primary key (bucket, window_start)
);
alter table public.api_rate_limits enable row level security;
revoke all on public.api_rate_limits from anon, authenticated;

-- true = pode seguir; false = passou do limite na janela atual
create or replace function public.api_rate_hit(p_bucket text, p_limit int, p_window_seconds int)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  w timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  n int;
begin
  insert into public.api_rate_limits as r (bucket, window_start, hits)
  values (left(p_bucket, 200), w, 1)
  on conflict (bucket, window_start) do update set hits = r.hits + 1
  returning hits into n;
  return n <= p_limit;
end;
$$;
revoke all on function public.api_rate_hit(text, int, int) from public, anon, authenticated;
grant execute on function public.api_rate_hit(text, int, int) to service_role;

-- 4) Limpeza diária: notificações velhas, notícias antigas e janelas do limitador
create or replace function public.insight_housekeeping()
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  delete from public.notifications where is_read and created_at < now() - interval '60 days';
  delete from public.notifications where created_at < now() - interval '120 days';
  delete from public.news_items where published_at < now() - interval '45 days';
  delete from public.api_rate_limits where window_start < now() - interval '1 day';
end;
$$;
revoke all on function public.insight_housekeeping() from public, anon, authenticated;

create extension if not exists pg_cron;
select cron.unschedule('insight-housekeeping') where exists (select 1 from cron.job where jobname = 'insight-housekeeping');
select cron.schedule('insight-housekeeping', '23 7 * * *', 'select public.insight_housekeeping()');
