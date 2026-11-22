-- ============================================================================
-- Migração Supabase Storage → Cloudflare R2: troca os links salvos no banco.
-- Percorre todas as colunas texto/jsonb/array de texto do schema public e
-- substitui o prefixo antigo pelo novo. Só o servidor (service role) executa.
-- ============================================================================
create or replace function public.rewrite_storage_urls(p_old text, p_new text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  col record;
  n integer;
  result jsonb := '{}'::jsonb;
begin
  if p_old is null or p_new is null or length(p_old) < 20 or p_old !~ '/storage/v1/object/public/$' then
    raise exception 'prefixo inválido';
  end if;
  for col in
    select c.table_name, c.column_name, c.data_type, c.udt_name
    from information_schema.columns c
    join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name
    where c.table_schema = 'public' and t.table_type = 'BASE TABLE'
      and (c.data_type in ('text', 'character varying', 'jsonb') or c.udt_name = '_text')
  loop
    if col.data_type = 'jsonb' then
      execute format(
        'update public.%I set %I = replace(%I::text, $1, $2)::jsonb where %I::text like ''%%'' || $1 || ''%%''',
        col.table_name, col.column_name, col.column_name, col.column_name
      ) using p_old, p_new;
    elsif col.udt_name = '_text' then
      execute format(
        'update public.%I set %I = (select array_agg(replace(x, $1, $2)) from unnest(%I) x) where array_to_string(%I, '' '') like ''%%'' || $1 || ''%%''',
        col.table_name, col.column_name, col.column_name, col.column_name
      ) using p_old, p_new;
    else
      execute format(
        'update public.%I set %I = replace(%I, $1, $2) where %I like ''%%'' || $1 || ''%%''',
        col.table_name, col.column_name, col.column_name, col.column_name
      ) using p_old, p_new;
    end if;
    get diagnostics n = row_count;
    if n > 0 then
      result := result || jsonb_build_object(col.table_name || '.' || col.column_name, n);
    end if;
  end loop;
  return result;
end;
$$;
revoke execute on function public.rewrite_storage_urls(text, text) from public, anon, authenticated;
grant execute on function public.rewrite_storage_urls(text, text) to service_role;
