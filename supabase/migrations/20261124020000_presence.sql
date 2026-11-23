-- Status online automático: "visto por último" + opção de ficar invisível.
alter table public.profiles add column if not exists last_seen_at timestamptz;
alter table public.profiles add column if not exists presence_visible boolean not null default true;

-- marca o perfil logado como ativo agora (no máximo uma escrita a cada 45 s)
create or replace function public.touch_presence()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := public.current_profile_id();
begin
  if me is null then
    return;
  end if;
  update public.profiles
     set last_seen_at = now()
   where id = me
     and presence_visible
     and (last_seen_at is null or last_seen_at < now() - interval '45 seconds');
end;
$$;
revoke all on function public.touch_presence() from public, anon;
grant execute on function public.touch_presence() to authenticated;

-- liga/desliga a visibilidade; ao ficar invisível, apaga o "visto por último"
create or replace function public.set_presence_visible(p_visible boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := public.current_profile_id();
begin
  if me is null then
    raise exception 'not_authenticated';
  end if;
  update public.profiles
     set presence_visible = coalesce(p_visible, true),
         last_seen_at = case when coalesce(p_visible, true) then now() else null end
   where id = me;
end;
$$;
revoke all on function public.set_presence_visible(boolean) from public, anon;
grant execute on function public.set_presence_visible(boolean) to authenticated;
