-- ============================================================================
-- MY NOTEBOOK — espaço livre de criação (estilo Obsidian) com modo escritor.
-- Beta fechada: só admin. Para abrir: update notebook_settings set is_public = true;
-- ============================================================================

create table if not exists public.notebook_settings (
  id smallint primary key default 1 check (id = 1),
  is_public boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into public.notebook_settings (id) values (1) on conflict do nothing;
alter table public.notebook_settings enable row level security;
drop policy if exists notebook_settings_read on public.notebook_settings;
create policy notebook_settings_read on public.notebook_settings for select using (true);

create or replace function public.notebook_has_access()
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.current_profile_id() is not null
     and (public.is_insight_admin()
          or coalesce((select is_public from public.notebook_settings where id = 1), false))
$$;
grant execute on function public.notebook_has_access() to authenticated;

-- ---------------------------------------------------------------- itens
create table if not exists public.notebook_items (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  parent_id uuid references public.notebook_items(id) on delete cascade,
  kind text not null default 'note' check (kind in ('folder', 'note')),
  -- markdown | blocks | book | chapter | character | world | journal | screenplay
  -- | study | goals | habits | tasks | roadmap | mindmap | diet | agenda ...
  template text not null default 'markdown' check (template ~ '^[a-z_]{2,32}$'),
  title text not null default 'Sem título' check (char_length(title) between 1 and 200),
  icon text check (icon is null or char_length(icon) <= 40),
  color text check (color is null or color ~ '^#[0-9a-fA-F]{6}$'),
  content text not null default '' check (octet_length(content) <= 2000000),
  blocks jsonb,
  data jsonb not null default '{}'::jsonb,
  tags text[] not null default '{}',
  links text[] not null default '{}',
  word_count integer not null default 0 check (word_count >= 0),
  position double precision not null default 0,
  pinned boolean not null default false,
  is_template boolean not null default false,
  published_post_id uuid references public.posts(id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notebook_items_blocks_size check (blocks is null or octet_length(blocks::text) <= 4000000),
  constraint notebook_items_data_size check (octet_length(data::text) <= 4000000),
  constraint notebook_items_not_self_parent check (parent_id is null or parent_id <> id)
);

create index if not exists notebook_items_owner_parent on public.notebook_items (profile_id, parent_id, position);
create index if not exists notebook_items_tags on public.notebook_items using gin (tags);
create index if not exists notebook_items_links on public.notebook_items using gin (links);
create index if not exists notebook_items_updated on public.notebook_items (profile_id, updated_at desc);

-- dono fixo, pai do mesmo dono, updated_at automático
create or replace function public.notebook_items_guard()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    new.profile_id := old.profile_id;
    new.created_at := old.created_at;
  end if;
  if new.parent_id is not null and not exists (
    select 1 from public.notebook_items p
    where p.id = new.parent_id and p.profile_id = new.profile_id
  ) then
    raise exception 'notebook_invalid_parent' using errcode = '42501';
  end if;
  -- impede ciclos (mover pasta para dentro de si mesma)
  if tg_op = 'UPDATE' and new.parent_id is distinct from old.parent_id and new.parent_id is not null then
    if exists (
      with recursive up as (
        select id, parent_id from public.notebook_items where id = new.parent_id
        union all
        select i.id, i.parent_id from public.notebook_items i join up on i.id = up.parent_id
      )
      select 1 from up where id = new.id
    ) then
      raise exception 'notebook_cycle' using errcode = '22023';
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists notebook_items_guard on public.notebook_items;
create trigger notebook_items_guard
  before insert or update on public.notebook_items
  for each row execute function public.notebook_items_guard();

alter table public.notebook_items enable row level security;
drop policy if exists notebook_items_select on public.notebook_items;
drop policy if exists notebook_items_insert on public.notebook_items;
drop policy if exists notebook_items_update on public.notebook_items;
drop policy if exists notebook_items_delete on public.notebook_items;
create policy notebook_items_select on public.notebook_items for select
  using (profile_id = public.current_profile_id() and public.notebook_has_access());
create policy notebook_items_insert on public.notebook_items for insert
  with check (profile_id = public.current_profile_id() and public.notebook_has_access());
create policy notebook_items_update on public.notebook_items for update
  using (profile_id = public.current_profile_id() and public.notebook_has_access())
  with check (profile_id = public.current_profile_id());
create policy notebook_items_delete on public.notebook_items for delete
  using (profile_id = public.current_profile_id() and public.notebook_has_access());

-- ---------------------------------------------------------------- revisões
create table if not exists public.notebook_revisions (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.notebook_items(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  content text not null default '' check (octet_length(content) <= 2000000),
  blocks jsonb,
  data jsonb,
  word_count integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists notebook_revisions_item on public.notebook_revisions (item_id, created_at desc);

create or replace function public.notebook_revisions_guard()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if not exists (
    select 1 from public.notebook_items i
    where i.id = new.item_id and i.profile_id = new.profile_id
  ) then
    raise exception 'notebook_invalid_item' using errcode = '42501';
  end if;
  new.created_at := now();
  return new;
end;
$$;
drop trigger if exists notebook_revisions_guard on public.notebook_revisions;
create trigger notebook_revisions_guard
  before insert on public.notebook_revisions
  for each row execute function public.notebook_revisions_guard();

-- guarda só as 40 revisões mais recentes de cada nota
create or replace function public.notebook_revisions_prune()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  delete from public.notebook_revisions r
  where r.item_id = new.item_id
    and r.id not in (
      select id from public.notebook_revisions
      where item_id = new.item_id order by created_at desc limit 40
    );
  return null;
end;
$$;
drop trigger if exists notebook_revisions_prune on public.notebook_revisions;
create trigger notebook_revisions_prune
  after insert on public.notebook_revisions
  for each row execute function public.notebook_revisions_prune();

alter table public.notebook_revisions enable row level security;
drop policy if exists notebook_revisions_select on public.notebook_revisions;
drop policy if exists notebook_revisions_insert on public.notebook_revisions;
drop policy if exists notebook_revisions_delete on public.notebook_revisions;
create policy notebook_revisions_select on public.notebook_revisions for select
  using (profile_id = public.current_profile_id() and public.notebook_has_access());
create policy notebook_revisions_insert on public.notebook_revisions for insert
  with check (profile_id = public.current_profile_id() and public.notebook_has_access());
create policy notebook_revisions_delete on public.notebook_revisions for delete
  using (profile_id = public.current_profile_id());

-- ---------------------------------------------------------------- anexos (R2)
create table if not exists public.notebook_assets (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  item_id uuid references public.notebook_items(id) on delete set null,
  r2_key text not null,
  url text not null,
  content_type text,
  size_bytes bigint not null default 0,
  created_at timestamptz not null default now(),
  constraint notebook_assets_key check (r2_key ~ '^users/[0-9a-f-]+/notebook/')
);
create unique index if not exists notebook_assets_key_unique on public.notebook_assets (r2_key);
create index if not exists notebook_assets_item on public.notebook_assets (item_id);

-- a chave tem de ter sido registrada (media_uploads) pelo próprio usuário
create or replace function public.notebook_assets_guard()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if not exists (
    select 1 from public.media_uploads m
    where m.r2_key = new.r2_key and m.profile_id = new.profile_id
  ) then
    raise exception 'notebook_asset_not_registered' using errcode = '42501';
  end if;
  if new.item_id is not null and not exists (
    select 1 from public.notebook_items i where i.id = new.item_id and i.profile_id = new.profile_id
  ) then
    raise exception 'notebook_invalid_item' using errcode = '42501';
  end if;
  select coalesce(m.size_bytes, 0), m.content_type into new.size_bytes, new.content_type
  from public.media_uploads m where m.r2_key = new.r2_key limit 1;
  return new;
end;
$$;
drop trigger if exists notebook_assets_guard on public.notebook_assets;
create trigger notebook_assets_guard
  before insert on public.notebook_assets
  for each row execute function public.notebook_assets_guard();

alter table public.notebook_assets enable row level security;
drop policy if exists notebook_assets_select on public.notebook_assets;
drop policy if exists notebook_assets_insert on public.notebook_assets;
drop policy if exists notebook_assets_delete on public.notebook_assets;
create policy notebook_assets_select on public.notebook_assets for select
  using (profile_id = public.current_profile_id());
create policy notebook_assets_insert on public.notebook_assets for insert
  with check (profile_id = public.current_profile_id() and public.notebook_has_access());
create policy notebook_assets_delete on public.notebook_assets for delete
  using (profile_id = public.current_profile_id());

revoke all on public.notebook_items, public.notebook_revisions, public.notebook_assets from anon;
grant select, insert, update, delete on public.notebook_items to authenticated;
grant select, insert, delete on public.notebook_revisions, public.notebook_assets to authenticated;
grant select on public.notebook_settings to anon, authenticated;
revoke execute on function public.notebook_items_guard() from public, anon, authenticated;
revoke execute on function public.notebook_revisions_guard() from public, anon, authenticated;
revoke execute on function public.notebook_revisions_prune() from public, anon, authenticated;
revoke execute on function public.notebook_assets_guard() from public, anon, authenticated;
