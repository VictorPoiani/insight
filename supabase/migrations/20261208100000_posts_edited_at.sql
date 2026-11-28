-- Marca de "editado": preenchida só quando o autor edita o conteúdo do post.
alter table public.posts add column if not exists edited_at timestamptz;
