-- ============================================================================
-- Notificações no app: voto em enquete + preferências por tipo
--
--  * poll_vote: quem vota na enquete de um post avisa o autor (só no app; sem
--    push nem e-mail). Uma notificação por pessoa por enquete (trocar o voto
--    não gera outra).
--  * notification_prefs: cada perfil liga/desliga cada tipo. O filtro roda no
--    banco (BEFORE INSERT em notifications): tipo desligado nem é gravado.
--    'system' (pagamentos, avisos da plataforma) é sempre entregue.
-- ============================================================================

create table if not exists public.notification_prefs (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  prefs jsonb not null default '{}'::jsonb check (jsonb_typeof(prefs) = 'object' and octet_length(prefs::text) <= 2000),
  updated_at timestamptz not null default now()
);
alter table public.notification_prefs enable row level security;
drop policy if exists notification_prefs_select on public.notification_prefs;
drop policy if exists notification_prefs_insert on public.notification_prefs;
drop policy if exists notification_prefs_update on public.notification_prefs;
create policy notification_prefs_select on public.notification_prefs for select
  using (profile_id = public.current_profile_id());
create policy notification_prefs_insert on public.notification_prefs for insert
  with check (profile_id = public.current_profile_id());
create policy notification_prefs_update on public.notification_prefs for update
  using (profile_id = public.current_profile_id())
  with check (profile_id = public.current_profile_id());
revoke all on public.notification_prefs from anon;
grant select, insert, update on public.notification_prefs to authenticated;

-- filtro: tipo desligado pelo destinatário não é gravado
create or replace function public.notifications_respect_prefs()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  allowed boolean;
begin
  if new.type = 'system' then return new; end if;
  select (p.prefs ->> new.type)::boolean into allowed
  from public.notification_prefs p
  where p.profile_id = coalesce(new.recipient_id, new.user_id);
  if allowed is false then
    return null;
  end if;
  return new;
end;
$$;
revoke execute on function public.notifications_respect_prefs() from public, anon, authenticated;

drop trigger if exists notifications_respect_prefs on public.notifications;
create trigger notifications_respect_prefs
  before insert on public.notifications
  for each row execute function public.notifications_respect_prefs();

-- voto em enquete avisa o autor do post
create or replace function public.notify_on_poll_vote()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  post_owner uuid;
  question text;
begin
  select coalesce(p.profile_id, p.author_id),
         left(coalesce((
           select b ->> 'pollQuestion' from jsonb_array_elements(coalesce(p.blocks, '[]'::jsonb)) b
           where b ->> 'id' = new.block_id limit 1
         ), 'sua enquete'), 110)
  into post_owner, question
  from public.posts p where p.id = new.post_id;

  if post_owner is null or post_owner = new.profile_id then
    return new;
  end if;
  -- uma por pessoa por post (várias opções ou troca de voto não repetem)
  if exists (
    select 1 from public.notifications n
    where n.recipient_id = post_owner and n.actor_id = new.profile_id
      and n.type = 'poll_vote' and n.post_id = new.post_id
  ) then
    return new;
  end if;

  insert into public.notifications (recipient_id, actor_id, type, post_id, content_preview, message)
  values (post_owner, new.profile_id, 'poll_vote', new.post_id, question, 'votou na sua enquete');
  return new;
end;
$$;
revoke execute on function public.notify_on_poll_vote() from public, anon, authenticated;

drop trigger if exists trg_notify_poll_vote on public.poll_votes;
create trigger trg_notify_poll_vote
  after insert on public.poll_votes
  for each row execute function public.notify_on_poll_vote();
