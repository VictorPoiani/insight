-- O nome interno (tag) do tópico era único no site inteiro: dois usuários não
-- podiam ter o mesmo tópico ("dev", modelos iguais...). Agora é único por dono.
alter table public.custom_topics drop constraint if exists custom_topics_tag_key;
create unique index if not exists custom_topics_profile_tag_key
  on public.custom_topics (profile_id, lower(tag));
