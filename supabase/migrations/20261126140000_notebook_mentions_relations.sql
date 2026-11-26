-- Notebook · Menções: categoria e imagem de cada menção, e relações entre
-- menções (alimentam o grafo de conexões e a genealogia).

alter table public.notebook_entries
  add column if not exists category text
    check (category is null or category in ('personagem', 'lugar', 'organizacao', 'objeto', 'evento', 'conceito')),
  add column if not exists image_url text
    check (image_url is null or (image_url ~ '^https://' and char_length(image_url) <= 600));

create table if not exists public.notebook_entry_links (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  from_id uuid not null references public.notebook_entries(id) on delete cascade,
  to_id uuid not null references public.notebook_entries(id) on delete cascade,
  rel text not null check (rel in ('pai', 'conjuge', 'irmao', 'aliado', 'inimigo', 'conhece', 'mentor', 'membro', 'mora', 'outro')),
  label text not null default '' check (char_length(label) <= 80),
  created_at timestamptz not null default now(),
  check (from_id <> to_id),
  unique (from_id, to_id, rel)
);
create index if not exists notebook_entry_links_profile_idx on public.notebook_entry_links (profile_id);

create or replace function public.notebook_entry_links_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    new.profile_id := old.profile_id;
  end if;
  if not exists (select 1 from public.notebook_entries e where e.id = new.from_id and e.profile_id = new.profile_id)
     or not exists (select 1 from public.notebook_entries e where e.id = new.to_id and e.profile_id = new.profile_id) then
    raise exception 'notebook_invalid_link' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists notebook_entry_links_guard on public.notebook_entry_links;
create trigger notebook_entry_links_guard
  before insert or update on public.notebook_entry_links
  for each row execute function public.notebook_entry_links_guard();

alter table public.notebook_entry_links enable row level security;
drop policy if exists notebook_entry_links_select on public.notebook_entry_links;
drop policy if exists notebook_entry_links_insert on public.notebook_entry_links;
drop policy if exists notebook_entry_links_update on public.notebook_entry_links;
drop policy if exists notebook_entry_links_delete on public.notebook_entry_links;
create policy notebook_entry_links_select on public.notebook_entry_links for select
  using (profile_id = public.current_profile_id() and public.notebook_has_access());
create policy notebook_entry_links_insert on public.notebook_entry_links for insert
  with check (profile_id = public.current_profile_id() and public.notebook_has_access());
create policy notebook_entry_links_update on public.notebook_entry_links for update
  using (profile_id = public.current_profile_id() and public.notebook_has_access())
  with check (profile_id = public.current_profile_id());
create policy notebook_entry_links_delete on public.notebook_entry_links for delete
  using (profile_id = public.current_profile_id() and public.notebook_has_access());

revoke all on public.notebook_entry_links from anon;
grant select, insert, update, delete on public.notebook_entry_links to authenticated;
