import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { listDocuments, attachDocumentsToChat, getChatDocuments } from "@/lib/documents.functions";
import { FileText, X, CheckCircle2, Loader2, AlertTriangle, Upload } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useState } from "react";

type Doc = { id: string; name: string; status: string };

export function DocumentPicker({ chatId, onClose }: { chatId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: docs = [] } = useQuery<Doc[]>({
    queryKey: ["documents"],
    queryFn: () => listDocuments() as unknown as Promise<Doc[]>,
    refetchInterval: (q) => {
      const rows = q.state.data as Doc[] | undefined;
      return rows?.some((d) => d.status === "uploading" || d.status === "indexing") ? 2000 : false;
    },
  });
  const { data: attached = [] } = useQuery<Doc[]>({
    queryKey: ["chat-documents", chatId],
    queryFn: () => getChatDocuments({ data: { chatId } }) as unknown as Promise<Doc[]>,
  });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  useEffect(() => { setSelected(new Set(attached.map((d) => d.id))); }, [attached]);

  const save = useMutation({
    mutationFn: () => attachDocumentsToChat({ data: { chatId, documentIds: Array.from(selected) } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chat-documents", chatId] });
      toast.success("Attached");
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm md:items-center" onClick={onClose}>
      <div className="glass-strong w-full max-w-md rounded-t-3xl border-t border-white/10 p-4 md:rounded-3xl md:border" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">Chat with a document</div>
            <div className="text-[11px] text-muted-foreground">Pick which of your documents to ground answers in.</div>
          </div>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-white/5"><X className="h-4 w-4" /></button>
        </div>

        {docs.length === 0 ? (
          <Link to="/documents" onClick={onClose} className="glass flex items-center gap-2 rounded-2xl border border-dashed border-white/10 p-4 text-[12px] text-muted-foreground">
            <Upload className="h-4 w-4 text-primary" />
            No documents yet — upload one.
          </Link>
        ) : (
          <ul className="max-h-72 overflow-y-auto pr-1">
            {docs.map((d) => {
              const disabled = d.status !== "ready";
              const checked = selected.has(d.id);
              return (
                <li key={d.id}>
                  <label className={`flex items-center gap-2.5 rounded-xl px-2 py-2 text-[12.5px] ${disabled ? "opacity-60" : "hover:bg-white/5 cursor-pointer"}`}>
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[oklch(0.75_0.16_295)]"
                      checked={checked}
                      disabled={disabled}
                      onChange={(e) => {
                        const next = new Set(selected);
                        if (e.target.checked) next.add(d.id); else next.delete(d.id);
                        setSelected(next);
                      }}
                    />
                    <FileText className="h-3.5 w-3.5 shrink-0 text-primary" />
                    <span className="min-w-0 flex-1 truncate">{d.name}</span>
                    <StatusIcon status={d.status} />
                  </label>
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-3 flex items-center justify-between gap-2">
          <Link to="/documents" onClick={onClose} className="text-[11px] text-muted-foreground underline underline-offset-2">Manage documents</Link>
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="btn-primary h-9 px-4 text-[12.5px] disabled:opacity-50"
          >
            {save.isPending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: string }) {
  if (status === "ready") return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />;
  if (status === "failed") return <AlertTriangle className="h-3.5 w-3.5 text-destructive" />;
  return <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />;
}