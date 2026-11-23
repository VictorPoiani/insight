-- Repostar com comentário: um Insight novo que cita outro (quoted_post_id).
alter table public.posts add column if not exists quoted_post_id uuid references public.posts(id) on delete set null;
create index if not exists posts_quoted_post_id_idx on public.posts (quoted_post_id) where quoted_post_id is not null;

-- conta citações junto com os reposts do Insight original
create or replace function public.bump_quote_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and new.quoted_post_id is not null then
    update public.posts set reposts_count = coalesce(reposts_count, 0) + 1 where id = new.quoted_post_id;
  elsif tg_op = 'DELETE' and old.quoted_post_id is not null then
    update public.posts set reposts_count = greatest(coalesce(reposts_count, 0) - 1, 0) where id = old.quoted_post_id;
  end if;
  return null;
end;
$$;
revoke all on function public.bump_quote_count() from public, anon, authenticated;

drop trigger if exists posts_quote_count on public.posts;
create trigger posts_quote_count
  after insert or delete on public.posts
  for each row execute function public.bump_quote_count();

-- não deixa citar um Insight que a pessoa não consegue ver (RLS do select decide)
create or replace function public.check_quoted_post()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.quoted_post_id is not null and (tg_op = 'INSERT' or new.quoted_post_id is distinct from old.quoted_post_id) then
    if new.quoted_post_id = new.id or not exists (select 1 from public.posts where id = new.quoted_post_id) then
      raise exception 'invalid_quoted_post' using errcode = '22023';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists posts_check_quoted on public.posts;
create trigger posts_check_quoted
  before insert or update of quoted_post_id on public.posts
  for each row execute function public.check_quoted_post();
