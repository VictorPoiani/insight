-- ============================================================================
-- Limites contra força bruta / abuso (auditoria AppSec, itens baixos)
-- ============================================================================

-- IP de quem chama (PostgREST repassa os cabeçalhos HTTP da requisição)
create or replace function public.request_ip()
returns text
language sql
stable
set search_path = public
as $$
  select nullif(trim(split_part(coalesce(
    (nullif(current_setting('request.headers', true), '')::json ->> 'cf-connecting-ip'),
    (nullif(current_setting('request.headers', true), '')::json ->> 'x-real-ip'),
    (nullif(current_setting('request.headers', true), '')::json ->> 'x-forwarded-for'),
    ''
  ), ',', 1)), '')
$$;

-- 1. Verificação de convite: no máximo 15 tentativas por IP a cada 10 minutos
create table if not exists public.invite_check_attempts (
  ip_hash text not null,
  at timestamptz not null default now()
);
create index if not exists invite_check_attempts_idx on public.invite_check_attempts (ip_hash, at desc);
alter table public.invite_check_attempts enable row level security; -- sem políticas: só funções do banco

drop function if exists public.check_invite_code(text);
create function public.check_invite_code(p_code text)
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  ip text := coalesce(public.request_ip(), 'desconhecido');
  h text := encode(extensions.digest(ip, 'sha256'), 'hex');
  recent int;
  ic public.invite_codes;
begin
  select count(*) into recent from public.invite_check_attempts
   where ip_hash = h and at > now() - interval '10 minutes';
  -- sem IP identificável, o balde é compartilhado: limite maior
  if recent >= (case when ip = 'desconhecido' then 200 else 15 end) then
    return 'rate_limited';
  end if;
  insert into public.invite_check_attempts (ip_hash) values (h);
  delete from public.invite_check_attempts where at < now() - interval '1 day';

  select * into ic from public.invite_codes where code = upper(trim(coalesce(p_code, '')));
  if ic.id is null then return 'invalid'; end if;
  if ic.expires_at is not null and ic.expires_at < now() then return 'expired'; end if;
  if coalesce(ic.uses_count, 0) >= coalesce(ic.max_uses, 1) then return 'exhausted'; end if;
  return 'ok';
end;
$$;
grant execute on function public.check_invite_code(text) to anon, authenticated;

-- 2. Recuperação de senha: além do limite por e-mail, limite por IP
alter table public.account_email_log add column if not exists ip_hash text;
create index if not exists account_email_log_ip_idx on public.account_email_log (ip_hash, kind, sent_at desc);
