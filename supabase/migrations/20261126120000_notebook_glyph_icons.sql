-- Notebook sem emojis: ícones salvos como emoji viram o nome do ícone autoral.
update public.notebook_items set icon = case icon
  when '📝' then 'note' when '🧱' then 'blocks' when '📁' then 'folder' when '📂' then 'folder'
  when '📖' then 'book' when '📚' then 'book' when '📄' then 'chapter' when '🎭' then 'character'
  when '🗺️' then 'world' when '🗺' then 'world' when '🌍' then 'world' when '📔' then 'journal'
  when '📓' then 'journal' when '🎬' then 'screenplay' when '🎓' then 'study' when '🗓️' then 'meeting'
  when '🗓' then 'meeting' when '💡' then 'idea' when '🎯' then 'goals' when '🔁' then 'habits'
  when '✅' then 'tasks' when '🧭' then 'roadmap' when '🕸️' then 'mindmap' when '🕸' then 'mindmap'
  when '🍎' then 'diet' when '📅' then 'agenda' when '⭐' then 'star' when '🔥' then 'flame'
  when '🌙' then 'moon' when '🌱' then 'leaf' when '🎵' then 'music' when '🧪' then 'flask'
  when '💼' then 'briefcase' when '❤️' then 'heart' when '❤' then 'heart' when '🐉' then 'feather'
  when '🚀' then 'rocket' when '✨' then 'sparkle'
  else null end
where icon is not null and icon !~ '^[a-z]+$';
