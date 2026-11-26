-- ============================================================================
-- Notebook · Worldbuilding (Preview), Fase 1: Codex.
-- Categorias do Codex são por mundo (projeto), com subcategorias e o modelo
-- da Infobox de cada uma. Um verbete é uma menção do Sumário ligada a uma
-- nota (template 'codex') com o texto e os valores da Infobox.
-- ============================================================================

create table if not exists public.notebook_codex_categories (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid not null references public.notebook_items(id) on delete cascade,
  parent_id uuid references public.notebook_codex_categories(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  glyph text not null default 'book' check (glyph ~ '^[a-z0-9_-]{1,32}$'),
  kind text not null default 'conceito' check (kind in ('personagem', 'lugar', 'organizacao', 'objeto', 'evento', 'conceito')),
  fields jsonb not null default '[]'::jsonb check (jsonb_typeof(fields) = 'array' and octet_length(fields::text) <= 20000),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists notebook_codex_categories_project on public.notebook_codex_categories (project_id, position);
create index if not exists notebook_codex_categories_profile on public.notebook_codex_categories (profile_id);

create or replace function public.notebook_codex_categories_guard()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    new.profile_id := old.profile_id;
    new.project_id := old.project_id;
    new.created_at := old.created_at;
  end if;
  if not exists (
    select 1 from public.notebook_items p
    where p.id = new.project_id and p.profile_id = new.profile_id and p.kind = 'folder'
  ) then
    raise exception 'notebook_invalid_project' using errcode = '42501';
  end if;
  if new.parent_id is not null then
    if new.parent_id = new.id or not exists (
      select 1 from public.notebook_codex_categories c
      where c.id = new.parent_id and c.project_id = new.project_id and c.parent_id is null
    ) then
      raise exception 'notebook_invalid_parent' using errcode = '42501';
    end if;
  end if;
  new.name := btrim(new.name);
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists notebook_codex_categories_guard on public.notebook_codex_categories;
create trigger notebook_codex_categories_guard
  before insert or update on public.notebook_codex_categories
  for each row execute function public.notebook_codex_categories_guard();

alter table public.notebook_codex_categories enable row level security;
drop policy if exists notebook_codex_categories_select on public.notebook_codex_categories;
drop policy if exists notebook_codex_categories_insert on public.notebook_codex_categories;
drop policy if exists notebook_codex_categories_update on public.notebook_codex_categories;
drop policy if exists notebook_codex_categories_delete on public.notebook_codex_categories;
create policy notebook_codex_categories_select on public.notebook_codex_categories for select
  using (profile_id = public.current_profile_id() and public.notebook_has_access());
create policy notebook_codex_categories_insert on public.notebook_codex_categories for insert
  with check (profile_id = public.current_profile_id() and public.notebook_has_access());
create policy notebook_codex_categories_update on public.notebook_codex_categories for update
  using (profile_id = public.current_profile_id() and public.notebook_has_access())
  with check (profile_id = public.current_profile_id());
create policy notebook_codex_categories_delete on public.notebook_codex_categories for delete
  using (profile_id = public.current_profile_id() and public.notebook_has_access());
revoke all on public.notebook_codex_categories from anon;
grant select, insert, update, delete on public.notebook_codex_categories to authenticated;

-- verbete: categoria do Codex e segredo do autor (o verbete inteiro)
alter table public.notebook_entries
  add column if not exists codex_category_id uuid references public.notebook_codex_categories(id) on delete set null,
  add column if not exists is_secret boolean not null default false;
create index if not exists notebook_entries_codex_category on public.notebook_entries (codex_category_id) where codex_category_id is not null;

-- a categoria do verbete precisa ser do mesmo dono
create or replace function public.notebook_entries_codex_guard()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.codex_category_id is not null and not exists (
    select 1 from public.notebook_codex_categories c
    where c.id = new.codex_category_id and c.profile_id = new.profile_id
  ) then
    raise exception 'notebook_invalid_category' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists notebook_entries_codex_guard on public.notebook_entries;
create trigger notebook_entries_codex_guard
  before insert or update of codex_category_id on public.notebook_entries
  for each row execute function public.notebook_entries_codex_guard();
