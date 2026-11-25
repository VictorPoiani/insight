-- ============================================================================
-- Posts salvos: cada pessoa salva Insights para ler depois (lista privada,
-- aparece na aba "Salvos" do painel Sua atividade).
-- ============================================================================
create table if not exists public.post_saves (
  post_id uuid not null references public.posts(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, post_id)
);
create index if not exists post_saves_profile_idx on public.post_saves (profile_id, created_at desc);
alter table public.post_saves enable row level security;

drop policy if exists post_saves_select on public.post_saves;
drop policy if exists post_saves_insert on public.post_saves;
drop policy if exists post_saves_delete on public.post_saves;
create policy post_saves_select on public.post_saves for select to authenticated
  using (profile_id = public.current_profile_id());
create policy post_saves_insert on public.post_saves for insert to authenticated
  with check (profile_id = public.current_profile_id());
create policy post_saves_delete on public.post_saves for delete to authenticated
  using (profile_id = public.current_profile_id());
revoke all on public.post_saves from anon;
grant select, insert, delete on public.post_saves to authenticated;

-- só salva o que a pessoa pode ver (mesma regra de curtir/repostar)
drop trigger if exists post_saves_guard on public.post_saves;
create trigger post_saves_guard before insert on public.post_saves
  for each row execute function public.guard_post_interaction();
