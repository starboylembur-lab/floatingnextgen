ALTER TABLE public.document_chunks ALTER COLUMN embedding DROP NOT NULL;

CREATE INDEX IF NOT EXISTS document_chunks_content_fts
  ON public.document_chunks USING gin (to_tsvector('simple', content));

CREATE OR REPLACE FUNCTION public.search_document_chunks(query_text text, doc_ids uuid[], match_count integer DEFAULT 6)
RETURNS TABLE(id uuid, document_id uuid, chunk_index integer, content text, similarity double precision)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  select
    c.id,
    c.document_id,
    c.chunk_index,
    c.content,
    ts_rank(to_tsvector('simple', c.content), plainto_tsquery('simple', query_text))::double precision as similarity
  from public.document_chunks c
  where c.document_id = any(doc_ids)
  order by
    ts_rank(to_tsvector('simple', c.content), plainto_tsquery('simple', query_text)) desc,
    c.chunk_index asc
  limit match_count;
$$;

GRANT EXECUTE ON FUNCTION public.search_document_chunks(text, uuid[], integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_document_chunks(text, uuid[], integer) TO service_role;