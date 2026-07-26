# Chat with Document — Full RAG stack

Build document upload, indexing, and retrieval-augmented chat on top of the existing Floating Space app. No mock data.

## What ships

1. **Upload UI** on the Chat page: drag-drop / picker for PDF, DOCX, TXT, MD (≤10 MB). Real progress bar, then indexing status, then "Ready".
2. **Document library** panel: list user's documents with status pill (`uploading` → `indexing` → `ready` / `failed`), delete button, and "Chat with this doc" action.
3. **RAG chat mode**: when a document is attached to a chat, the assistant retrieves the top matching chunks per user question and answers using them (with light inline citations).

## Backend (new schema — required to make this work)

- Enable `pgvector`.
- Table `documents`: `id, user_id, name, mime, size, storage_path, status, error, chunk_count, created_at, updated_at`.
- Table `document_chunks`: `id, document_id, user_id, chunk_index, content, embedding vector(3072)`.
- Table `chat_documents`: join `chat_id ↔ document_id` so a conversation can be scoped to one or more docs.
- SQL function `match_document_chunks(query_embedding, doc_ids, match_count)` returning top chunks by cosine similarity (halfvec HNSW index).
- RLS: owner-only on every table + GRANTs to `authenticated` / `service_role`.
- Private Storage bucket `documents` with RLS: authenticated user can read/write only under `{auth.uid()}/…`.

## Server functions (TanStack `createServerFn`, no new edge functions)

- `createDocument({ name, mime, size })` → inserts a `documents` row with status `uploading`, returns `{ id, storagePath }`. Client then uploads directly to Storage using the browser Supabase client (real progress events).
- `processDocument({ id })` → downloads file from Storage, extracts text (PDF via `unpdf` — worker-compatible; DOCX via `mammoth`; TXT/MD as-is), chunks (~1000 chars, 150 overlap), embeds each chunk in batches via Lovable AI Gateway (`google/gemini-embedding-2`), inserts chunks, sets status `ready` or `failed` with error message.
- `listDocuments()`, `deleteDocument({ id })` (deletes chunks + storage object + row).
- `attachDocumentsToChat({ chatId, documentIds })`.

## Chat integration

Extend `src/routes/api/chat.ts`: accept optional `documentIds`. When present, embed the latest user message, call `match_document_chunks`, prepend a system message with the retrieved passages (numbered `[1]`, `[2]` …) and instruct the model to cite them. Existing streaming path unchanged.

## UI changes (kept minimal, within existing style)

- New route `_authenticated/documents.tsx` — library view.
- New component `DocumentPicker` used inside the chat composer's existing paperclip button: choose from library or upload new. Shows per-doc status.
- Chat header gains a subtle "📎 <name>" chip when a document is attached (click to detach).
- Bottom nav / sidebar: add "Docs" entry.

## Technical notes

- **Extraction on Cloudflare Workers**: `unpdf` and `mammoth` both work under `nodejs_compat`. Fallback: if extraction throws, status → `failed` with reason surfaced in UI.
- **Progress**: upload progress from `supabase.storage.upload` events (via `XMLHttpRequest` wrapper); indexing progress polled from `documents.status` with TanStack Query (`refetchInterval` while not terminal). Realtime not required — polling is simpler and reliable.
- **Retries**: user can click "Retry" on a `failed` doc → re-invokes `processDocument`.
- **Rate limits / errors**: server function catches 429/402 from the Gateway, marks doc `failed` with a friendly message; UI shows a retry button and a toast.
- **Constraints respected**: no new edge functions (uses TanStack server functions per project rules); Lovable Cloud only; no external services.

## Out of scope

- OCR of scanned PDFs (text-layer only).
- Multi-doc cross-referencing beyond top-K retrieval.
- Sharing documents between users.

Approve and I'll implement end-to-end.