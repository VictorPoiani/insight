-- ============================================================================
-- Notebook (Preview) · Fase D — Publicação seletiva.
--  1. Verbetes ganham "público em publicações" (is_public). Os novos nascem
--     privados; os que já existem e não são secretos ficam públicos (era o
--     comportamento de antes).
--  2. notebook_publications: a cópia congelada do que foi publicado, montada no
--     SERVIDOR (segredos do autor removidos lá). O público lê só esta tabela,
--     nunca as tabelas do Notebook. Os balões do Sumário e o "Ler mais" da
--     versão publicada vêm daqui, só com verbetes públicos.
-- ============================================================================

alter table public.notebook_entries add column if not exists is_public boolean not null default false;
update public.notebook_entries set is_public = true where not coalesce(is_secret, false) and not is_public;

create table if not exists public.notebook_publications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  item_id uuid references public.notebook_items(id) on delete set null,
  post_id uuid references public.posts(id) on delete set null,
  title text not null check (char_length(title) between 1 and 300),
  template text not null default 'markdown' check (template ~ '^[a-z_]{2,32}$'),
  html text not null check (octet_length(html) <= 2000000),
  entries jsonb not null default '{}'::jsonb check (jsonb_typeof(entries) = 'object' and octet_length(entries::text) <= 1000000),
  is_public boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists notebook_publications_item on public.notebook_publications (item_id) where item_id is not null;
create index if not exists notebook_publications_profile on public.notebook_publications (profile_id, updated_at desc);

-- trava final: nada marcado como segredo entra numa publicação
create or replace function public.notebook_publications_guard()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    new.profile_id := old.profile_id;
    new.created_at := old.created_at;
  end if;
  if new.item_id is not null and not exists (
    select 1 from public.notebook_items i where i.id = new.item_id and i.profile_id = new.profile_id
  ) then
    raise exception 'notebook_invalid_item' using errcode = '42501';
  end if;
  if new.post_id is not null and not exists (
    select 1 from public.posts p where p.id = new.post_id and (p.author_id = new.profile_id or p.profile_id = new.profile_id)
  ) then
    raise exception 'notebook_invalid_post' using errcode = '42501';
  end if;
  if new.html ~* '(nb-callout--secret|data-secret|\[!segredo\])' then
    raise exception 'notebook_secret_in_publication' using errcode = '22023';
  end if;
  -- verbetes secretos nunca entram no balão público
  if exists (
    select 1 from jsonb_object_keys(new.entries) k
    join public.notebook_entries e on e.id::text = k
    where e.is_secret or not e.is_public or e.profile_id <> new.profile_id
  ) then
    raise exception 'notebook_secret_entry_in_publication' using errcode = '22023';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists notebook_publications_guard on public.notebook_publications;
create trigger notebook_publications_guard before insert or update on public.notebook_publications
  for each row execute function public.notebook_publications_guard();
revoke execute on function public.notebook_publications_guard() from public, anon, authenticated;

alter table public.notebook_publications enable row level security;
drop policy if exists notebook_publications_owner on public.notebook_publications;
drop policy if exists notebook_publications_public on public.notebook_publications;
create policy notebook_publications_owner on public.notebook_publications for all
  using (profile_id = public.current_profile_id())
  with check (profile_id = public.current_profile_id() and public.notebook_has_access());
-- leitura pública: só o que foi publicado
create policy notebook_publications_public on public.notebook_publications for select
  using (is_public);
grant select on public.notebook_publications to anon, authenticated;
grant insert, update, delete on public.notebook_publications to authenticated;
