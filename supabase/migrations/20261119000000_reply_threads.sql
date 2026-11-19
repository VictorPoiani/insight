-- ============================================================================
-- Discussões estilo X/Reddit: respostas aninhadas + curtidas em respostas
-- Rode no SQL Editor do Supabase (idempotente).
-- ============================================================================

-- 1) Respostas aninhadas e contador de curtidas
alter table public.replies
  add column if not exists parent_reply_id uuid references public.replies(id) on delete cascade,
  add column if not exists likes_count integer not null default 0;

create index if not exists replies_post_id_idx on public.replies(post_id);
create index if not exists replies_parent_reply_id_idx on public.replies(parent_reply_id);

-- 2) Curtidas em respostas
create table if not exists public.reply_likes (
  reply_id   uuid not null references public.replies(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (reply_id, profile_id)
);

create index if not exists reply_likes_profile_id_idx on public.reply_likes(profile_id);

alter table public.reply_likes enable row level security;

drop policy if exists "reply_likes_select_all" on public.reply_likes;
create policy "reply_likes_select_all" on public.reply_likes
  for select using (true);

drop policy if exists "reply_likes_insert_own" on public.reply_likes;
create policy "reply_likes_insert_own" on public.reply_likes
  for insert with check (
    profile_id in (select id from public.profiles where user_id = auth.uid() or id = auth.uid())
  );

drop policy if exists "reply_likes_delete_own" on public.reply_likes;
create policy "reply_likes_delete_own" on public.reply_likes
  for delete using (
    profile_id in (select id from public.profiles where user_id = auth.uid() or id = auth.uid())
  );

-- 3) RPC atômica para curtir/descurtir uma resposta
create or replace function public.toggle_reply_like(target_reply_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_liked boolean;
  v_count integer;
begin
  select id into v_profile_id
  from public.profiles
  where user_id = auth.uid() or id = auth.uid()
  limit 1;

  if v_profile_id is null then
    raise exception 'not_authenticated';
  end if;

  if exists (
    select 1 from public.reply_likes
    where reply_id = target_reply_id and profile_id = v_profile_id
  ) then
    delete from public.reply_likes
    where reply_id = target_reply_id and profile_id = v_profile_id;
    v_liked := false;
  else
    insert into public.reply_likes (reply_id, profile_id)
    values (target_reply_id, v_profile_id);
    v_liked := true;
  end if;

  select count(*) into v_count from public.reply_likes where reply_id = target_reply_id;
  update public.replies set likes_count = v_count where id = target_reply_id;

  return json_build_object('liked', v_liked, 'likes_count', v_count);
end;
$$;

grant execute on function public.toggle_reply_like(uuid) to authenticated;

-- 4) Contador de respostas no post (mostrado no feed)
alter table public.posts
  add column if not exists replies_count integer not null default 0;

create or replace function public.sync_post_replies_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_post_id uuid;
begin
  v_post_id := coalesce(new.post_id, old.post_id);
  update public.posts
  set replies_count = (select count(*) from public.replies where post_id = v_post_id)
  where id = v_post_id;
  return null;
end;
$$;

drop trigger if exists replies_count_sync on public.replies;
create trigger replies_count_sync
  after insert or delete on public.replies
  for each row execute function public.sync_post_replies_count();

-- Backfill
update public.posts p
set replies_count = (select count(*) from public.replies r where r.post_id = p.id);
update public.replies r
set likes_count = (select count(*) from public.reply_likes l where l.reply_id = r.id);
