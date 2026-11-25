-- ============================================================================
-- Ranking semanal de contribuição (card de domingo no feed)
-- Ranking = apoio acumulado até o fim de cada semana (domingo, horário de Brasília).
-- Devolve o top 5 atual com a posição da semana anterior e o histórico de
-- líderes das últimas 26 semanas (para as frases de sequência/hegemonia).
-- ============================================================================
create or replace function public.weekly_contribution_ranking()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with weeks as (
    -- fim de cada semana: domingo 23:59:59 em São Paulo (a atual primeiro)
    select g as idx,
           ((date_trunc('week', (now() at time zone 'America/Sao_Paulo')) + interval '6 days 23:59:59')
             - (g * interval '7 days')) at time zone 'America/Sao_Paulo' as week_end
    from generate_series(0, 25) g
  ),
  don as (
    select coalesce('p:' || d.profile_id::text, 'n:' || lower(trim(coalesce(d.donor_name, 'apoiador')))) as k,
           d.profile_id, d.donor_name, d.amount, d.created_at
    from public.donations d
    where d.status = 'approved'
  ),
  totals as (
    select w.idx, x.k, sum(x.amount) as total
    from weeks w join don x on x.created_at <= w.week_end
    group by w.idx, x.k
  ),
  ranked as (
    select idx, k, total, row_number() over (partition by idx order by total desc, k) as pos
    from totals
  ),
  who as (
    select distinct on (x.k) x.k, x.profile_id,
           coalesce(p.display_name, p.full_name, p.username, nullif(trim(x.donor_name), ''), 'Apoiador') as name,
           p.username, p.avatar_url
    from don x left join public.profiles p on p.id = x.profile_id
    order by x.k, x.created_at desc
  )
  select jsonb_build_object(
    'top', coalesce((
      select jsonb_agg(jsonb_build_object(
        'key', r.k, 'name', w.name, 'username', w.username, 'avatar_url', w.avatar_url,
        'points', floor(r.total), 'rank', r.pos,
        'prev_rank', (select r2.pos from ranked r2 where r2.idx = 1 and r2.k = r.k)
      ) order by r.pos)
      from ranked r join who w on w.k = r.k
      where r.idx = 0 and r.pos <= 5
    ), '[]'::jsonb),
    'leaders', coalesce((
      select jsonb_agg(jsonb_build_object('week', r.idx, 'key', r.k, 'name', w.name) order by r.idx)
      from ranked r join who w on w.k = r.k
      where r.pos = 1
    ), '[]'::jsonb)
  )
$$;
grant execute on function public.weekly_contribution_ranking() to anon, authenticated;
