-- ============================================================================
-- Notebook · Canvas profissional (Preview), Fase 1.
-- Os cartões e as ligações saem do JSON do item (data.canvas) e ganham tabelas
-- próprias: cada mudança grava só o que mudou, e canvases grandes não pesam
-- no carregamento da lista de notas. O JSON antigo fica como cópia de segurança.
-- Anexos ganham metadados do arquivo original (envio sem perda para o R2).
-- ============================================================================

create table if not exists public.notebook_canvas_nodes (
  canvas_id uuid not null references public.notebook_items(id) on delete cascade,
  id text not null check (char_length(id) between 1 and 40),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  type text not null default 'text' check (type in ('text', 'note', 'image', 'link', 'group', 'file')),
  x double precision not null default 0,
  y double precision not null default 0,
  width double precision not null default 260 check (width between 20 and 100000),
  height double precision not null default 140 check (height between 20 and 100000),
  z integer not null default 0,
  color text check (color is null or char_length(color) <= 20),
  text text check (text is null or char_length(text) <= 20000),
  item_id uuid references public.notebook_items(id) on delete set null,
  url text check (url is null or (char_length(url) <= 2000 and url ~* '^https?://')),
  label text check (label is null or char_length(label) <= 300),
  asset_id uuid references public.notebook_assets(id) on delete set null,
  locked boolean not null default false,
  extra jsonb not null default '{}'::jsonb check (jsonb_typeof(extra) = 'object' and octet_length(extra::text) <= 20000),
  updated_at timestamptz not null default now(),
  primary key (canvas_id, id)
);
create index if not exists notebook_canvas_nodes_profile on public.notebook_canvas_nodes (profile_id);
create index if not exists notebook_canvas_nodes_item on public.notebook_canvas_nodes (item_id) where item_id is not null;

create table if not exists public.notebook_canvas_edges (
  canvas_id uuid not null references public.notebook_items(id) on delete cascade,
  id text not null check (char_length(id) between 1 and 40),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  from_node text not null check (char_length(from_node) <= 40),
  to_node text not null check (char_length(to_node) <= 40),
  from_side text check (from_side is null or from_side in ('top', 'right', 'bottom', 'left')),
  to_side text check (to_side is null or to_side in ('top', 'right', 'bottom', 'left')),
  label text check (label is null or char_length(label) <= 300),
  color text check (color is null or char_length(color) <= 20),
  extra jsonb not null default '{}'::jsonb check (jsonb_typeof(extra) = 'object' and octet_length(extra::text) <= 5000),
  updated_at timestamptz not null default now(),
  primary key (canvas_id, id)
);
create index if not exists notebook_canvas_edges_profile on public.notebook_canvas_edges (profile_id);

-- o canvas, a nota incorporada e o anexo precisam ser do mesmo usuário
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
  end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists notebook_canvas_nodes_guard on public.notebook_canvas_nodes;
create trigger notebook_canvas_nodes_guard before insert or update on public.notebook_canvas_nodes
  for each row execute function public.notebook_canvas_guard();
drop trigger if exists notebook_canvas_edges_guard on public.notebook_canvas_edges;
create trigger notebook_canvas_edges_guard before insert or update on public.notebook_canvas_edges
  for each row execute function public.notebook_canvas_guard();

alter table public.notebook_canvas_nodes enable row level security;
alter table public.notebook_canvas_edges enable row level security;
do $$
declare t text;
begin
  foreach t in array array['notebook_canvas_nodes', 'notebook_canvas_edges'] loop
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

-- ---------------------------------------------------------------- anexos
alter table public.notebook_assets add column if not exists width integer check (width is null or width between 1 and 100000);
alter table public.notebook_assets add column if not exists height integer check (height is null or height between 1 and 100000);
alter table public.notebook_assets add column if not exists sha256 text check (sha256 is null or sha256 ~ '^[0-9a-f]{64}$');
alter table public.notebook_assets add column if not exists original_name text check (original_name is null or char_length(original_name) <= 300);
alter table public.notebook_assets add column if not exists preview_key text check (preview_key is null or preview_key ~ '^users/[0-9a-f-]+/notebook/');
create index if not exists notebook_assets_sha on public.notebook_assets (profile_id, sha256) where sha256 is not null;

-- ---------------------------------------------------------------- dados atuais
-- copia os canvases que já existem (data.canvas) para as tabelas novas
insert into public.notebook_canvas_nodes (canvas_id, id, profile_id, type, x, y, width, height, z, color, text, item_id, url, label)
select i.id, n.value->>'id', i.profile_id,
  case when n.value->>'type' in ('text', 'note', 'image', 'link', 'group') then n.value->>'type' else 'text' end,
  coalesce((n.value->>'x')::double precision, 0),
  coalesce((n.value->>'y')::double precision, 0),
  greatest(20, least(100000, coalesce((n.value->>'width')::double precision, 260))),
  greatest(20, least(100000, coalesce((n.value->>'height')::double precision, 140))),
  (n.ordinality - 1)::integer,
  left(n.value->>'color', 20),
  left(n.value->>'text', 20000),
  case when (n.value->>'itemId') ~ '^[0-9a-f-]{36}$'
    and exists (select 1 from public.notebook_items t where t.id = (n.value->>'itemId')::uuid and t.profile_id = i.profile_id)
    then (n.value->>'itemId')::uuid end,
  case when n.value->>'url' ~* '^https?://' then left(n.value->>'url', 2000) end,
  left(n.value->>'label', 300)
from public.notebook_items i
cross join lateral jsonb_array_elements(case when jsonb_typeof(i.data->'canvas'->'nodes') = 'array' then i.data->'canvas'->'nodes' else '[]'::jsonb end) with ordinality as n(value, ordinality)
where i.template = 'canvas'
  and jsonb_typeof(i.data->'canvas'->'nodes') = 'array'
  and char_length(coalesce(n.value->>'id', '')) between 1 and 40
on conflict (canvas_id, id) do nothing;

insert into public.notebook_canvas_edges (canvas_id, id, profile_id, from_node, to_node, from_side, to_side, label, color)
select i.id, e.value->>'id', i.profile_id, e.value->>'fromNode', e.value->>'toNode',
  case when e.value->>'fromSide' in ('top', 'right', 'bottom', 'left') then e.value->>'fromSide' end,
  case when e.value->>'toSide' in ('top', 'right', 'bottom', 'left') then e.value->>'toSide' end,
  left(e.value->>'label', 300),
  left(e.value->>'color', 20)
from public.notebook_items i
cross join lateral jsonb_array_elements(case when jsonb_typeof(i.data->'canvas'->'edges') = 'array' then i.data->'canvas'->'edges' else '[]'::jsonb end) as e(value)
where i.template = 'canvas'
  and jsonb_typeof(i.data->'canvas'->'edges') = 'array'
  and char_length(coalesce(e.value->>'id', '')) between 1 and 40
  and char_length(coalesce(e.value->>'fromNode', '')) between 1 and 40
  and char_length(coalesce(e.value->>'toNode', '')) between 1 and 40
on conflict (canvas_id, id) do nothing;

-- o app marca data.canvasV = 2 ao gravar nas tabelas; enquanto a marca não
-- existir, o JSON antigo continua valendo (cobre edições feitas antes do deploy).
