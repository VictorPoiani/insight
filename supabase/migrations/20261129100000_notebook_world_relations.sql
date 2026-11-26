-- ============================================================================
-- Notebook · Worldbuilding (Preview), Fase 3: relações de hierarquia e mundo.
-- Novos tipos: governa, vassalo (vassalo de), parte (parte de), fundou,
-- venera, criou, rival (rival de). Os antigos continuam iguais.
-- ============================================================================
alter table public.notebook_entry_links drop constraint if exists notebook_entry_links_rel_check;
alter table public.notebook_entry_links add constraint notebook_entry_links_rel_check
  check (rel in ('pai', 'conjuge', 'irmao', 'aliado', 'inimigo', 'conhece', 'mentor', 'membro', 'mora', 'outro',
                 'governa', 'vassalo', 'parte', 'fundou', 'venera', 'criou', 'rival'));
