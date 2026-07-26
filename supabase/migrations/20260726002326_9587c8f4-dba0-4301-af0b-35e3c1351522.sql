
-- pgvector
create extension if not exists vector;

-- documents table
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  mime text not null,
  size integer not null,
  storage_path text not null,
  status text not null default 'uploading' check (status in ('uploading','indexing','ready','failed')),
  error text,
  chunk_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.documents to authenticated;
grant all on public.documents to service_role;
alter table public.documents enable row level security;
create policy "documents self all" on public.documents for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- document_chunks table
create table public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  embedding vector(3072) not null,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.document_chunks to authenticated;
grant all on public.document_chunks to service_role;
alter table public.document_chunks enable row level security;
create policy "chunks self all" on public.document_chunks for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index document_chunks_doc_idx on public.document_chunks(document_id);
create index document_chunks_embedding_idx
  on public.document_chunks using hnsw ((embedding::halfvec(3072)) halfvec_cosine_ops);

-- chat_documents join
create table public.chat_documents (
  chat_id uuid not null references public.chats(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (chat_id, document_id)
);
grant select, insert, update, delete on public.chat_documents to authenticated;
grant all on public.chat_documents to service_role;
alter table public.chat_documents enable row level security;
create policy "chat_documents self all" on public.chat_documents for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- similarity search function
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
language sql stable security definer set search_path = public
as $$
  select
    c.id,
    c.document_id,
    c.chunk_index,
    c.content,
    1 - (c.embedding::halfvec(3072) <=> query_embedding::halfvec(3072)) as similarity
  from public.document_chunks c
  where c.document_id = any(doc_ids)
    and c.user_id = auth.uid()
  order by c.embedding::halfvec(3072) <=> query_embedding::halfvec(3072)
  limit match_count;
$$;
grant execute on function public.match_document_chunks(vector, uuid[], integer) to authenticated;

-- updated_at trigger
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public
as $$ begin new.updated_at = now(); return new; end $$;
create trigger documents_touch_updated_at
  before update on public.documents
  for each row execute function public.touch_updated_at();
