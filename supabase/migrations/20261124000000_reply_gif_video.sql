-- Respostas: blocos de GIF (Giphy/Tenor) e vídeo (R2), além dos já existentes.
create or replace function public.validate_reply_blocks()
returns trigger
language plpgsql
set search_path to 'public'
as $$
declare
  b jsonb;
  total int := 0;
  media int := 0;
begin
  if char_length(coalesce(new.content, '')) > 4000 then
    raise exception 'reply_too_long' using errcode = '22023';
  end if;
  if new.blocks is null then
    return new;
  end if;
  if jsonb_typeof(new.blocks) <> 'array' or jsonb_array_length(new.blocks) > 12 then
    raise exception 'invalid_reply_blocks' using errcode = '22023';
  end if;
  for b in select * from jsonb_array_elements(new.blocks) loop
    if jsonb_typeof(b) <> 'object'
       or coalesce(b->>'type', '') not in ('paragraph', 'quote', 'code', 'bullet', 'image', 'spotify', 'gif', 'video') then
      raise exception 'invalid_reply_blocks' using errcode = '22023';
    end if;
    total := total + char_length(coalesce(b->>'text', ''));
    if b ? 'url' and (b->>'url') !~ '^https://' then
      raise exception 'invalid_reply_media' using errcode = '22023';
    end if;
    if b->>'type' in ('gif', 'video') then
      media := media + 1;
      if coalesce(b->>'url', '') = '' then
        raise exception 'invalid_reply_media' using errcode = '22023';
      end if;
    end if;
    if b->>'type' = 'spotify' and coalesce(b->>'trackId', '') !~ '^[A-Za-z0-9]{10,40}$' then
      raise exception 'invalid_reply_media' using errcode = '22023';
    end if;
  end loop;
  if media > 4 then
    raise exception 'invalid_reply_media' using errcode = '22023';
  end if;
  if total > 4000 then
    raise exception 'reply_too_long' using errcode = '22023';
  end if;
  return new;
end;
$$;
