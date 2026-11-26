-- ============================================================================
-- Notebook · Artigos profissionais (Preview), Fase 1: fontes e referências.
-- Biblioteca de fontes do usuário (livros, artigos, sites…), trechos salvos
-- de cada fonte e o índice de onde cada fonte é citada (source_refs).
-- ============================================================================

create table if not exists public.notebook_sources (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid references public.notebook_items(id) on delete set null,
  type text not null default 'livro' check (type in ('livro', 'capitulo', 'artigo', 'tese', 'site', 'video', 'documento', 'lei', 'evento', 'entrevista', 'outro')),
  authors jsonb not null default '[]'::jsonb check (jsonb_typeof(authors) = 'array' and octet_length(authors::text) <= 20000),
  title text not null check (char_length(title) between 1 and 500),
  subtitle text check (subtitle is null or char_length(subtitle) <= 500),
  container text check (container is null or char_length(container) <= 500),
  edition text check (edition is null or char_length(edition) <= 60),
  place text check (place is null or char_length(place) <= 120),
  publisher text check (publisher is null or char_length(publisher) <= 200),
  year text check (year is null or char_length(year) <= 20),
  month text check (month is null or char_length(month) <= 30),
  volume text check (volume is null or char_length(volume) <= 30),
  issue text check (issue is null or char_length(issue) <= 30),
  pages text check (pages is null or char_length(pages) <= 40),
  doi text check (doi is null or char_length(doi) <= 200),
  isbn text check (isbn is null or char_length(isbn) <= 40),
  url text check (url is null or (char_length(url) <= 2000 and url ~* '^https?://')),
  accessed_on date,
  extra jsonb not null default '{}'::jsonb check (jsonb_typeof(extra) = 'object' and octet_length(extra::text) <= 20000),
  notes text not null default '' check (char_length(notes) <= 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists notebook_sources_profile on public.notebook_sources (profile_id, updated_at desc);
create index if not exists notebook_sources_project on public.notebook_sources (project_id) where project_id is not null;

create table if not exists public.notebook_source_quotes (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  source_id uuid not null references public.notebook_sources(id) on delete cascade,
  text text not null check (char_length(text) between 1 and 10000),
  page text check (page is null or char_length(page) <= 40),
  comment text not null default '' check (char_length(comment) <= 2000),
  created_at timestamptz not null default now()
);
create index if not exists notebook_source_quotes_source on public.notebook_source_quotes (source_id, created_at);
create index if not exists notebook_source_quotes_profile on public.notebook_source_quotes (profile_id);

-- dono, projeto e fonte precisam ser do mesmo usuário
create or replace function public.notebook_sources_guard()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    new.profile_id := old.profile_id;
    new.created_at := old.created_at;
  end if;
  if new.project_id is not null and not exists (
    select 1 from public.notebook_items p where p.id = new.project_id and p.profile_id = new.profile_id
  ) then
    raise exception 'notebook_invalid_project' using errcode = '42501';
  end if;
  new.title := btrim(new.title);
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists notebook_sources_guard on public.notebook_sources;
create trigger notebook_sources_guard before insert or update on public.notebook_sources
  for each row execute function public.notebook_sources_guard();

create or replace function public.notebook_source_quotes_guard()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    new.profile_id := old.profile_id;
    new.source_id := old.source_id;
    new.created_at := old.created_at;
  end if;
  if not exists (
    select 1 from public.notebook_sources s where s.id = new.source_id and s.profile_id = new.profile_id
  ) then
    raise exception 'notebook_invalid_source' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists notebook_source_quotes_guard on public.notebook_source_quotes;
create trigger notebook_source_quotes_guard before insert or update on public.notebook_source_quotes
  for each row execute function public.notebook_source_quotes_guard();

alter table public.notebook_sources enable row level security;
alter table public.notebook_source_quotes enable row level security;
do $$
declare t text;
begin
  foreach t in array array['notebook_sources', 'notebook_source_quotes'] loop
    execute format('drop policy if exists %1$s_select on public.%1$s', t);
    execute format('drop policy if exists %1$s_insert on public.%1$s', t);
    execute format('drop policy if exists %1$s_update on public.%1$s', t);
    execute format('drop policy if exists %1$s_delete on public.%1$s', t);
    execute format('create policy %1$s_select on public.%1$s for select using (profile_id = public.current_profile_id() and public.notebook_has_access())', t);
    execute format('create policy %1$s_insert on public.%1$s for insert with check (profile_id = public.current_profile_id() and public.notebook_has_access())', t);
    execute format('create policy %1$s_update on public.%1$s for update using (profile_id = public.current_profile_id() and public.notebook_has_access()) with check (profile_id = public.current_profile_id())', t);
    execute format('create policy %1$s_delete on public.%1$s for delete using (profile_id = public.current_profile_id() and public.notebook_has_access())', t);
    execute format('revoke all on public.%1$s from anon', t);
    execute format('grant select, insert, update, delete on public.%1$s to authenticated', t);
  end loop;
end $$;

-- onde cada fonte é citada (derivado do texto ao salvar, como as menções)
alter table public.notebook_items add column if not exists source_refs uuid[] not null default '{}';
create index if not exists notebook_items_source_refs_idx on public.notebook_items using gin (source_refs);
