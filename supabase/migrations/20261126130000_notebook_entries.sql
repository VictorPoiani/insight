-- Notebook · Linkagem de informação crucial e Sumário (Preview).
-- Cada entrada do Sumário é um elemento da história, uma nota do autor ou um
-- aviso; trechos do texto apontam para ela pelo id. Privado como o resto do Notebook.

create table if not exists public.notebook_entries (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid references public.notebook_items(id) on delete set null,
  kind text not null default 'elemento' check (kind in ('elemento', 'nota_autor', 'aviso')),
  title text not null check (char_length(title) between 1 and 160),
  summary text not null default '' check (char_length(summary) <= 1200),
  target_id uuid references public.notebook_items(id) on delete set null,
  aliases text[] not null default '{}' check (cardinality(aliases) <= 20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notebook_entries_profile_idx on public.notebook_entries (profile_id, project_id);

create or replace function public.notebook_entries_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    new.profile_id := old.profile_id;
    new.created_at := old.created_at;
  end if;
  -- projeto e destino precisam ser do mesmo dono
  if new.project_id is not null and not exists (
    select 1 from public.notebook_items p where p.id = new.project_id and p.profile_id = new.profile_id
  ) then
    raise exception 'notebook_invalid_project' using errcode = '42501';
  end if;
  if new.target_id is not null and not exists (
    select 1 from public.notebook_items p where p.id = new.target_id and p.profile_id = new.profile_id
  ) then
    raise exception 'notebook_invalid_target' using errcode = '42501';
  end if;
  new.title := btrim(new.title);
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists notebook_entries_guard on public.notebook_entries;
create trigger notebook_entries_guard
  before insert or update on public.notebook_entries
  for each row execute function public.notebook_entries_guard();

alter table public.notebook_entries enable row level security;
drop policy if exists notebook_entries_select on public.notebook_entries;
drop policy if exists notebook_entries_insert on public.notebook_entries;
drop policy if exists notebook_entries_update on public.notebook_entries;
drop policy if exists notebook_entries_delete on public.notebook_entries;
create policy notebook_entries_select on public.notebook_entries for select
  using (profile_id = public.current_profile_id() and public.notebook_has_access());
create policy notebook_entries_insert on public.notebook_entries for insert
  with check (profile_id = public.current_profile_id() and public.notebook_has_access());
create policy notebook_entries_update on public.notebook_entries for update
  using (profile_id = public.current_profile_id() and public.notebook_has_access())
  with check (profile_id = public.current_profile_id());
create policy notebook_entries_delete on public.notebook_entries for delete
  using (profile_id = public.current_profile_id() and public.notebook_has_access());

revoke all on public.notebook_entries from anon;
grant select, insert, update, delete on public.notebook_entries to authenticated;

-- onde cada entrada aparece (derivado do texto ao salvar, como os [[links]])
alter table public.notebook_items add column if not exists entry_refs uuid[] not null default '{}';
create index if not exists notebook_items_entry_refs_idx on public.notebook_items using gin (entry_refs);
