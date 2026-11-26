-- ============================================================================
-- Notebook: instantâneos nomeados.
-- Uma versão com nome ("antes da revisão do editor") é um instantâneo: não
-- entra na limpeza automática das 40 versões recentes (limite próprio de 60).
-- ============================================================================

alter table public.notebook_revisions
  add column if not exists label text check (label is null or char_length(label) between 1 and 80);

create index if not exists notebook_revisions_labeled
  on public.notebook_revisions (item_id, created_at desc) where label is not null;

create or replace function public.notebook_revisions_prune()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  -- automáticas: guarda as 40 mais recentes
  delete from public.notebook_revisions r
  where r.item_id = new.item_id
    and r.label is null
    and r.id not in (
      select id from public.notebook_revisions
      where item_id = new.item_id and label is null
      order by created_at desc limit 40
    );
  -- instantâneos nomeados: guarda os 60 mais recentes
  delete from public.notebook_revisions r
  where r.item_id = new.item_id
    and r.label is not null
    and r.id not in (
      select id from public.notebook_revisions
      where item_id = new.item_id and label is not null
      order by created_at desc limit 60
    );
  return null;
end;
$$;

-- renomear um instantâneo (só o dono; o resto da versão é imutável)
create or replace function public.notebook_revision_rename(p_id uuid, p_label text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_label text := nullif(btrim(coalesce(p_label, '')), '');
begin
  if v_label is not null and char_length(v_label) > 80 then
    v_label := left(v_label, 80);
  end if;
  update public.notebook_revisions
     set label = v_label
   where id = p_id
     and profile_id = public.current_profile_id()
     and public.notebook_has_access();
end;
$$;
revoke all on function public.notebook_revision_rename(uuid, text) from public, anon;
grant execute on function public.notebook_revision_rename(uuid, text) to authenticated;
