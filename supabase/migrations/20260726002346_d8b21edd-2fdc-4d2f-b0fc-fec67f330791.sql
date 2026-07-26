
create or replace function public.match_document_chunks(
  query_embedding vector(3072),
  doc_ids uuid[],
  match_count integer default 6
)
returns table (
  id uuid,
  document_id uuid,
  chunk_index integer,
  content text,
  similarity float
)
language sql stable security invoker set search_path = public
as $$
  select
    c.id,
    c.document_id,
    c.chunk_index,
    c.content,
    1 - (c.embedding::halfvec(3072) <=> query_embedding::halfvec(3072)) as similarity
  from public.document_chunks c
  where c.document_id = any(doc_ids)
  order by c.embedding::halfvec(3072) <=> query_embedding::halfvec(3072)
  limit match_count;
$$;
