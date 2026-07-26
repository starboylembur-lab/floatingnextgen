import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  createDocument,
  deleteDocument,
  listDocuments,
  processDocument,
} from "@/lib/documents.functions";
import { FileText, Upload, Trash2, Loader2, CheckCircle2, AlertTriangle, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/documents")({
  head: () => ({
    meta: [
      { title: "Documents — Floating Space" },
      { name: "description", content: "Upload PDF, DOCX, TXT and Markdown files. Chat with your documents." },
    ],
  }),
  component: DocumentsPage,
});

type Doc = {
  id: string;
  name: string;
  mime: string;
  size: number;
  status: string;
  error: string | null;
  chunk_count: number;
  created_at: string;
};

const ACCEPT = ".pdf,.docx,.txt,.md,.markdown";

function DocumentsPage() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<{ name: string; progress: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const { data: docs = [], isLoading } = useQuery<Doc[]>({
    queryKey: ["documents"],
    queryFn: () => listDocuments() as unknown as Promise<Doc[]>,
    refetchInterval: (query) => {
      const rows = query.state.data as Doc[] | undefined;
      return rows?.some((d) => d.status === "uploading" || d.status === "indexing") ? 2000 : false;
    },
  });

  const upload = useCallback(async (file: File) => {
    try {
      if (file.size > 10 * 1024 * 1024) {
        toast.error("File too large (max 10 MB)");
        return;
      }
      setUploading({ name: file.name, progress: 0 });
      const { id, storagePath } = await createDocument({
        data: { name: file.name, mime: file.type, size: file.size },
      });
      // Real upload — supabase-js streams the file; simulate progress with staged ticks.
      const tick = setInterval(() => {
        setUploading((cur) => cur ? { ...cur, progress: Math.min(90, cur.progress + 7) } : cur);
      }, 200);
      const { error: upErr } = await supabase.storage
        .from("documents")
        .upload(storagePath, file, { contentType: file.type || "application/octet-stream", upsert: true });
      clearInterval(tick);
      if (upErr) throw new Error(upErr.message);
      setUploading({ name: file.name, progress: 100 });
      qc.invalidateQueries({ queryKey: ["documents"] });

      // Trigger indexing (fire-and-forget; status will poll).
      processDocument({ data: { id } })
        .then(() => qc.invalidateQueries({ queryKey: ["documents"] }))
        .catch((e) => {
          toast.error(e instanceof Error ? e.message : "Indexing failed");
          qc.invalidateQueries({ queryKey: ["documents"] });
        });
      toast.success("Uploaded — indexing…");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setTimeout(() => setUploading(null), 800);
    }
  }, [qc]);

  const del = useMutation({
    mutationFn: (id: string) => deleteDocument({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documents"] });
      toast.success("Deleted");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Delete failed"),
  });

  const retry = useMutation({
    mutationFn: (id: string) => processDocument({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["documents"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Retry failed"),
  });

  return (
    <div
      className={`flex flex-col gap-4 px-4 pb-8 pt-5 ${dragOver ? "dropzone-active" : ""}`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={(e) => { e.preventDefault(); setDragOver(false); }}
      onDrop={(e) => {
        e.preventDefault(); setDragOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f) upload(f);
      }}
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Documents</h1>
          <p className="text-xs text-muted-foreground">Upload PDF, DOCX, TXT or Markdown to chat with them.</p>
        </div>
        <button onClick={() => fileRef.current?.click()} className="btn-primary h-10 px-4">
          <Upload className="h-4 w-4" /> Upload
        </button>
        <input ref={fileRef} type="file" accept={ACCEPT} className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
      </div>

      {/* Dropzone */}
      <button
        onClick={() => fileRef.current?.click()}
        className="glass flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/10 py-8 text-center transition-colors hover:border-primary/40"
      >
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-primary/30 to-accent/20">
          <Upload className="h-5 w-5 text-primary" />
        </div>
        <div className="text-sm font-medium">Drop a file or tap to upload</div>
        <div className="text-[11px] text-muted-foreground">PDF · DOCX · TXT · MD · up to 10 MB</div>
      </button>

      {uploading && (
        <div className="glass rounded-2xl p-3">
          <div className="mb-1.5 flex items-center justify-between text-[12px]">
            <span className="truncate pr-2">{uploading.name}</span>
            <span className="text-muted-foreground">{uploading.progress}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
            <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-[width] duration-200" style={{ width: `${uploading.progress}%` }} />
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="mt-4 text-center text-sm text-muted-foreground">Loading…</div>
      ) : docs.length === 0 ? (
        <div className="mt-6 text-center text-xs text-muted-foreground">No documents yet.</div>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {docs.map((d) => (
            <li key={d.id} className="glass flex items-center gap-3 rounded-2xl p-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary/25 to-accent/15">
                <FileText className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-medium">{d.name}</div>
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <StatusPill status={d.status} />
                  <span>·</span>
                  <span>{(d.size / 1024).toFixed(0)} KB</span>
                  {d.status === "ready" && <><span>·</span><span>{d.chunk_count} chunks</span></>}
                  {d.status === "failed" && d.error && <><span>·</span><span className="truncate text-destructive">{d.error}</span></>}
                </div>
              </div>
              {d.status === "failed" && (
                <button onClick={() => retry.mutate(d.id)} className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:text-primary" aria-label="Retry">
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                onClick={() => { if (confirm(`Delete "${d.name}"?`)) del.mutate(d.id); }}
                className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground opacity-60 hover:text-destructive hover:opacity-100"
                aria-label="Delete"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  if (status === "ready") return <span className="inline-flex items-center gap-1 text-emerald-400"><CheckCircle2 className="h-3 w-3" /> Ready</span>;
  if (status === "failed") return <span className="inline-flex items-center gap-1 text-destructive"><AlertTriangle className="h-3 w-3" /> Failed</span>;
  if (status === "indexing") return <span className="inline-flex items-center gap-1 text-primary"><Loader2 className="h-3 w-3 animate-spin" /> Indexing</span>;
  return <span className="inline-flex items-center gap-1 text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Uploading</span>;
}