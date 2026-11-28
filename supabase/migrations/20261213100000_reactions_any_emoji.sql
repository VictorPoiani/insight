-- Reações com qualquer emoji (antes eram 5 ids fixos). As reações já salvas
-- viram o próprio emoji.
alter table public.post_reactions drop constraint if exists post_reactions_reaction_check;
update public.post_reactions set reaction = case reaction
  when 'idea' then '💡' when 'fire' then '🔥' when 'laugh' then '😂'
  when 'think' then '🤔' when 'wow' then '😮' else reaction end;
-- só emoji: curto e sem letras, números ou marcação
alter table public.post_reactions add constraint post_reactions_reaction_check
  check (char_length(reaction) between 1 and 16 and reaction !~ '[A-Za-z0-9<>&"''\s]');
