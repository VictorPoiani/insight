-- ============================================================================
-- Notebook · Canvas profissional (Preview), Fases 2 e 3.
-- Cartões vivos de verbetes do Codex (entry_id) e arquivos (PDF, áudio, vídeo).
-- ============================================================================

alter table public.notebook_canvas_nodes drop constraint if exists notebook_canvas_nodes_type_check;
alter table public.notebook_canvas_nodes add constraint notebook_canvas_nodes_type_check
  check (type in ('text', 'note', 'image', 'link', 'group', 'file', 'entry'));
alter table public.notebook_canvas_nodes add column if not exists entry_id uuid references public.notebook_entries(id) on delete set null;
create index if not exists notebook_canvas_nodes_entry on public.notebook_canvas_nodes (entry_id) where entry_id is not null;

create or replace function public.notebook_canvas_guard()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    new.profile_id := old.profile_id;
    new.canvas_id := old.canvas_id;
  end if;
  if not exists (
    select 1 from public.notebook_items i
    where i.id = new.canvas_id and i.profile_id = new.profile_id and i.template = 'canvas'
  ) then
    raise exception 'notebook_invalid_canvas' using errcode = '42501';
  end if;
  if tg_table_name = 'notebook_canvas_nodes' then
    if new.item_id is not null and not exists (
      select 1 from public.notebook_items i where i.id = new.item_id and i.profile_id = new.profile_id
    ) then
      raise exception 'notebook_invalid_item' using errcode = '42501';
    end if;
    if new.asset_id is not null and not exists (
      select 1 from public.notebook_assets a where a.id = new.asset_id and a.profile_id = new.profile_id
    ) then
      raise exception 'notebook_invalid_asset' using errcode = '42501';
    end if;
    if new.entry_id is not null and not exists (
      select 1 from public.notebook_entries e where e.id = new.entry_id and e.profile_id = new.profile_id
    ) then
      raise exception 'notebook_invalid_entry' using errcode = '42501';
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
