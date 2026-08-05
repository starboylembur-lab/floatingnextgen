import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ALLOWED_MIMES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
  "text/x-markdown",
  "",
]);
const MAX_SIZE = 10 * 1024 * 1024;

function safeName(name: string): string {
  return name.replace(/[^\w.\-]+/g, "_").slice(0, 120) || "document";
}

// Reserve a document row; the client uploads to storage at the returned path.
export const createDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { name: string; mime: string; size: number }) => {
    if (!input?.name) throw new Error("name required");
    if (typeof input.size !== "number" || input.size <= 0) throw new Error("invalid size");
    if (input.size > MAX_SIZE) throw new Error("File too large (max 10 MB)");
    if (input.mime && !ALLOWED_MIMES.has(input.mime) && !input.name.match(/\.(pdf|docx|txt|md|markdown)$/i)) {
      throw new Error("Unsupported file type");
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const cleanName = safeName(data.name);
    const { data: row, error } = await supabase
      .from("documents")
      .insert({
        user_id: userId,
        name: data.name,
        mime: data.mime || "application/octet-stream",
        size: data.size,
        storage_path: "",
        status: "uploading",
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    const storage_path = `${userId}/${row.id}/${cleanName}`;
    await supabase.from("documents").update({ storage_path }).eq("id", row.id);
    return { id: row.id as string, storagePath: storage_path };
  });

// Extract, chunk, embed, and store chunks. Marks the doc ready/failed.
export const processDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => {
    if (!input?.id) throw new Error("id required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: doc, error: fetchErr } = await supabase
      .from("documents")
      .select("*")
      .eq("id", data.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    if (!doc) throw new Error("Document not found");

    await supabase.from("documents").update({ status: "indexing", error: null }).eq("id", doc.id);

    try {
      const { data: file, error: dlErr } = await supabase.storage
        .from("documents")
        .download(doc.storage_path);
      if (dlErr || !file) throw new Error(dlErr?.message || "Download failed");
      const bytes = new Uint8Array(await file.arrayBuffer());

      const { extractTextFromFile, chunkText } = await import("./documents.server");
      const text = await extractTextFromFile(bytes, doc.mime, doc.name);
      if (!text.trim()) throw new Error("No text extracted from file");

      const chunks = chunkText(text);
      if (chunks.length === 0) throw new Error("No chunks produced");

      // Clear any previous chunks then insert in batches.
      await supabase.from("document_chunks").delete().eq("document_id", doc.id);

      const rows = chunks.map((content, i) => ({
        document_id: doc.id,
        user_id: userId,
        chunk_index: i,
        content,
      }));

      for (let i = 0; i < rows.length; i += 50) {
        const slice = rows.slice(i, i + 50);
        const { error: insErr } = await supabase.from("document_chunks").insert(slice);
        if (insErr) throw new Error(insErr.message);
      }

      await supabase
        .from("documents")
        .update({ status: "ready", chunk_count: chunks.length, error: null })
        .eq("id", doc.id);
      return { ok: true, chunkCount: chunks.length };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Processing failed";
      await supabase.from("documents").update({ status: "failed", error: msg.slice(0, 500) }).eq("id", doc.id);
      throw new Error(msg);
    }
  });

export const listDocuments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("documents")
      .select("id, name, mime, size, status, error, chunk_count, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const deleteDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => {
    if (!input?.id) throw new Error("id required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: doc } = await supabase
      .from("documents")
      .select("id, storage_path")
      .eq("id", data.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!doc) return { ok: true };
    if (doc.storage_path) {
      await supabase.storage.from("documents").remove([doc.storage_path]);
    }
    await supabase.from("documents").delete().eq("id", doc.id);
    return { ok: true };
  });

export const attachDocumentsToChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { conversationId: string; documentIds: string[] }) => {
    if (!input?.conversationId) throw new Error("conversationId required");
    if (!Array.isArray(input.documentIds)) throw new Error("documentIds required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Remove existing links then insert new ones.
    await supabase.from("conversation_documents").delete().eq("conversation_id", data.conversationId);
    if (data.documentIds.length === 0) return { ok: true };
    const rows = data.documentIds.map((document_id) => ({
      conversation_id: data.conversationId,
      document_id,
      user_id: userId,
    }));
    const { error } = await supabase.from("conversation_documents").insert(rows);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getChatDocuments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { conversationId: string }) => {
    if (!input?.conversationId) throw new Error("conversationId required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: links, error } = await supabase
      .from("conversation_documents")
      .select("document_id, documents(id, name, status, mime)")
      .eq("conversation_id", data.conversationId);
    if (error) throw new Error(error.message);
    return (links ?? []).map((l) => l.documents).filter(Boolean) as {
      id: string;
      name: string;
      status: string;
      mime: string;
    }[];
  });

// Retrieves the top matching chunks across the chat's attached documents for a given query.
export const retrieveContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { conversationId: string; query: string; matchCount?: number }) => {
    if (!input?.conversationId) throw new Error("conversationId required");
    if (!input?.query) throw new Error("query required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: links } = await supabase
      .from("conversation_documents")
      .select("document_id")
      .eq("conversation_id", data.conversationId);
    const docIds = (links ?? []).map((l) => l.document_id);
    if (docIds.length === 0) return { passages: [] as { document_id: string; chunk_index: number; content: string; similarity: number; name: string }[] };

    const { data: matches, error } = await supabase.rpc("search_document_chunks", {
      query_text: data.query,
      doc_ids: docIds,
      match_count: data.matchCount ?? 6,
    });
    if (error) throw new Error(error.message);

    const { data: docs } = await supabase
      .from("documents")
      .select("id, name")
      .in("id", docIds);
    const nameById = new Map((docs ?? []).map((d) => [d.id, d.name]));

    return {
      passages: (matches ?? []).map((m: {
        document_id: string;
        chunk_index: number;
        content: string;
        similarity: number;
      }) => ({
        ...m,
        name: nameById.get(m.document_id) ?? "Document",
      })),
    };
  });