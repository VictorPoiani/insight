-- ============================================================================
-- Notebook (Preview) · Fase A — Fundação.
--  1. Versão por nota (detecção de conflito entre dispositivos e abas).
--  2. Lixeira uniforme: verbetes, categorias do Codex, fontes e trechos vão
--     para a lixeira (deleted_at) em vez de sumir; tudo fica 30 dias.
--  3. Modelo de mídia: projeto de cada anexo, mídias citadas em cada nota
--     (media_refs) e lixeira de anexos (o arquivo no R2 é apagado depois).
-- ============================================================================

-- ---------------------------------------------------------------- 1. versão
alter table public.notebook_items add column if not exists version integer not null default 1;

create or replace function public.notebook_items_version()
returns trigger
language plpgsql set search_path = public
as $$
begin
  if new.content is distinct from old.content
     or new.blocks is distinct from old.blocks
     or new.data is distinct from old.data
     or new.title is distinct from old.title then
    new.version := old.version + 1;
  else
    new.version := old.version;
  end if;
  return new;
end;
$$;
drop trigger if exists notebook_items_version on public.notebook_items;
create trigger notebook_items_version before update on public.notebook_items
  for each row execute function public.notebook_items_version();

-- mídias citadas no texto (endereços do R2), para a Biblioteca saber onde cada uma é usada
alter table public.notebook_items add column if not exists media_refs text[] not null default '{}';
create index if not exists notebook_items_media_refs_idx on public.notebook_items using gin (media_refs);

-- ---------------------------------------------------------------- 2. lixeira
alter table public.notebook_entries add column if not exists deleted_at timestamptz;
alter table public.notebook_codex_categories add column if not exists deleted_at timestamptz;
alter table public.notebook_sources add column if not exists deleted_at timestamptz;
alter table public.notebook_source_quotes add column if not exists deleted_at timestamptz;
create index if not exists notebook_entries_deleted on public.notebook_entries (profile_id, deleted_at) where deleted_at is not null;
create index if not exists notebook_codex_categories_deleted on public.notebook_codex_categories (profile_id, deleted_at) where deleted_at is not null;
create index if not exists notebook_sources_deleted on public.notebook_sources (profile_id, deleted_at) where deleted_at is not null;
create index if not exists notebook_items_archived on public.notebook_items (profile_id, archived_at) where archived_at is not null;

-- ---------------------------------------------------------------- 3. anexos
alter table public.notebook_assets add column if not exists project_id uuid references public.notebook_items(id) on delete set null;
alter table public.notebook_assets add column if not exists deleted_at timestamptz;
create index if not exists notebook_assets_project on public.notebook_assets (project_id) where project_id is not null;
create index if not exists notebook_assets_deleted on public.notebook_assets (deleted_at) where deleted_at is not null;

-- o dono pode mudar projeto, lixeira e miniatura; chave, endereço e tamanho ficam fixos
create or replace function public.notebook_assets_update_guard()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  new.id := old.id;
  new.profile_id := old.profile_id;
  new.r2_key := old.r2_key;
  new.url := old.url;
  new.size_bytes := old.size_bytes;
  new.content_type := old.content_type;
  new.sha256 := old.sha256;
  new.created_at := old.created_at;
  if new.project_id is not null and not exists (
    select 1 from public.notebook_items i where i.id = new.project_id and i.profile_id = new.profile_id
  ) then
    raise exception 'notebook_invalid_project' using errcode = '42501';
  end if;
  if new.item_id is not null and not exists (
    select 1 from public.notebook_items i where i.id = new.item_id and i.profile_id = new.profile_id
  ) then
    raise exception 'notebook_invalid_item' using errcode = '42501';
  end if;
  if new.preview_key is not null and not exists (
    select 1 from public.media_uploads m where m.r2_key = new.preview_key and m.profile_id = new.profile_id
  ) then
    raise exception 'notebook_asset_not_registered' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists notebook_assets_update_guard on public.notebook_assets;
create trigger notebook_assets_update_guard before update on public.notebook_assets
  for each row execute function public.notebook_assets_update_guard();

drop policy if exists notebook_assets_update on public.notebook_assets;
create policy notebook_assets_update on public.notebook_assets for update
  using (profile_id = public.current_profile_id() and public.notebook_has_access())
  with check (profile_id = public.current_profile_id());
grant update on public.notebook_assets to authenticated;

-- projeto (pasta de topo) de cada anexo já existente
with recursive up as (
  select a.id as asset_id, i.id, i.parent_id
  from public.notebook_assets a join public.notebook_items i on i.id = a.item_id
  where a.project_id is null
  union all
  select up.asset_id, p.id, p.parent_id
  from up join public.notebook_items p on p.id = up.parent_id
)
update public.notebook_assets a
set project_id = up.id
from up
where up.asset_id = a.id and up.parent_id is null and up.id <> a.item_id;

-- ---------------------------------------------------------------- limpeza (30 dias)
-- Chamada pela rotina diária (rota /api/notebook/purge, com a chave de serviço).
create or replace function public.notebook_purge_trash(p_days integer default 30)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  cut timestamptz := now() - make_interval(days => greatest(p_days, 1));
  n_items integer;
  n_entries integer;
  n_cats integer;
  n_sources integer;
  n_quotes integer;
  n_assets integer;
begin
  -- anexos das notas que vão sumir entram na lixeira de anexos (o arquivo sai do R2 depois)
  update public.notebook_assets a set deleted_at = now()
  where a.deleted_at is null and a.item_id in (select id from public.notebook_items where archived_at < cut);

  -- só as raízes da lixeira: os filhos vão junto (on delete cascade)
  delete from public.notebook_items i
  where i.archived_at < cut
    and not exists (select 1 from public.notebook_items p where p.id = i.parent_id and p.archived_at is not null);
  get diagnostics n_items = row_count;

  delete from public.notebook_entries where deleted_at < cut;
  get diagnostics n_entries = row_count;
  delete from public.notebook_codex_categories where deleted_at < cut;
  get diagnostics n_cats = row_count;
  delete from public.notebook_source_quotes where deleted_at < cut;
  get diagnostics n_quotes = row_count;
  delete from public.notebook_sources where deleted_at < cut;
  get diagnostics n_sources = row_count;

  select count(*) into n_assets from public.notebook_assets where deleted_at < cut;
  return jsonb_build_object('items', n_items, 'entries', n_entries, 'categories', n_cats, 'sources', n_sources, 'quotes', n_quotes, 'assets_due', n_assets);
end;
$$;
revoke all on function public.notebook_purge_trash(integer) from public, anon, authenticated;
grant execute on function public.notebook_purge_trash(integer) to service_role;

-- funções de gatilho não são chamáveis pela API
revoke execute on function public.notebook_items_version() from public, anon, authenticated;
revoke execute on function public.notebook_assets_update_guard() from public, anon, authenticated;
