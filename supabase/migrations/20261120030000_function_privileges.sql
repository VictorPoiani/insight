-- ============================================================================
-- Limpeza apontada pelo verificador de segurança do Supabase
-- ============================================================================

-- 1. Funções de trigger não devem ser chamáveis pela API (/rest/v1/rpc/...).
--    Triggers continuam funcionando: o privilégio só é checado em chamadas diretas.
revoke execute on function
  public.auto_confirm_new_user(),
  public.handle_new_user(),
  public.notify_followers_on_new_post(),
  public.notify_on_follow(),
  public.notify_on_post_like(),
  public.notify_on_reply(),
  public.sync_followers_count(),
  public.sync_profile_contributor_level(),
  public.sync_replies_and_notify(),
  public.sync_post_replies_count(),
  public.sync_profile_posts_count(),
  public.set_default_update_profile_id(),
  public.trg_follows_followers_count(),
  public.fill_reply_author(),
  public.protect_profile_cosmetics(),
  public.protect_profile_privileged_columns(),
  public.protect_post_columns()
from public, anon, authenticated;

-- 2. Expunha a estrutura do banco a qualquer visitante; o app não usa.
revoke execute on function public.get_tables_and_columns() from public, anon, authenticated;

-- 3. Exigem login: tira o acesso anônimo.
revoke execute on function public.toggle_post_like(uuid) from public, anon;
revoke execute on function public.toggle_reply_like(uuid) from public, anon;
revoke execute on function public.set_my_cosmetics(jsonb) from public, anon;
grant execute on function public.toggle_post_like(uuid) to authenticated;
grant execute on function public.toggle_reply_like(uuid) to authenticated;
grant execute on function public.set_my_cosmetics(jsonb) to authenticated;

-- 4. search_path fixo
alter function public.calculate_contributor_level(integer) set search_path = public;
alter function public.calculate_contributor_level(numeric) set search_path = public;
alter function public.protect_profile_cosmetics() set search_path = public;
alter function public.sync_post_replies_count() set search_path = public;
alter function public.sync_profile_posts_count() set search_path = public;
alter function public.set_default_update_profile_id() set search_path = public;
alter function public.get_tables_and_columns() set search_path = public;
