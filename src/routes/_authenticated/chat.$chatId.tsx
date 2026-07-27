import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, ArrowUp, Copy, Share2, Mic, Square, Sparkles, Zap, Compass, Paperclip, Image as ImageIcon, Telescope, X, FileText } from "lucide-react";
import { Markdown } from "@/lib/markdown";
import { streamChat } from "@/lib/streams";
import { toast } from "sonner";
import { addCapacity } from "@/lib/user-stats.functions";
import { Logo } from "@/components/logo";
import { DocumentPicker } from "@/components/document-picker";
import { getChatDocuments, retrieveContext } from "@/lib/documents.functions";

type Mode = "basic" | "standard" | "deep";

type SearchParams = { q?: string; mode?: Mode };

export const Route = createFileRoute("/_authenticated/chat/$chatId")({
  validateSearch: (s: Record<string, unknown>): SearchParams => ({
    q: typeof s.q === "string" ? s.q : undefined,
    mode: s.mode === "basic" || s.mode === "deep" || s.mode === "standard" ? s.mode : undefined,
  }),
  head: () => ({ meta: [{ title: "Conversation — Floating Space" }] }),
  component: ChatDetail,
});

type Msg = { id: string; role: "user" | "assistant" | "system"; content: string };

function ChatDetail() {
  const { chatId } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [mode, setMode] = useState<Mode>(search.mode ?? "standard");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [attachments, setAttachments] = useState<{ name: string; text: string }[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // auto-grow textarea
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 240)}px`;
  }, [input]);

  async function readFiles(files: FileList | File[]) {
    const arr = Array.from(files).slice(0, 5);
    const parsed = await Promise.all(arr.map(async (f) => {
      if (f.size > 200_000) {
        toast.error(`${f.name} too large (max 200KB text)`);
        return null;
      }
      try {
        const text = await f.text();
        return { name: f.name, text: text.slice(0, 100_000) };
      } catch { return null; }
    }));
    setAttachments((a) => [...a, ...parsed.filter(Boolean) as { name: string; text: string }[]]);
  }

  const { data: chat } = useQuery({
    queryKey: ["chat", chatId],
    queryFn: async () => {
      const { data, error } = await supabase.from("chats").select("*").eq("id", chatId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (chat?.mode) setMode(chat.mode as Mode);
  }, [chat?.mode]);

  const { data: attachedDocs = [] } = useQuery({
    queryKey: ["chat-documents", chatId],
    queryFn: () => getChatDocuments({ data: { chatId } }),
  });

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from("messages").select("*").eq("chat_id", chatId).order("created_at", { ascending: true });
      if (error) { toast.error(error.message); return; }
      setMessages(data as Msg[]);
    })();
  }, [chatId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streamText]);

  // Auto-send from ?q= query
  const autoSentRef = useRef(false);
  useEffect(() => {
    if (autoSentRef.current) return;
    if (search.q && messages.length === 0 && !streaming) {
      autoSentRef.current = true;
      send(search.q);
      navigate({ to: "/chat/$chatId", params: { chatId }, search: {}, replace: true });
    }
  }, [search.q, messages.length, streaming]);

  useEffect(() => { inputRef.current?.focus(); }, [chatId]);

  async function send(text: string) {
    if ((!text.trim() && attachments.length === 0) || streaming) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    setInput("");

    const attachedBlock = attachments.length
      ? "\n\n" + attachments.map((a) => `Attached file: ${a.name}\n\n\`\`\`\n${a.text}\n\`\`\``).join("\n\n")
      : "";
    const composed = text + attachedBlock;
    setAttachments([]);

    const userMsg: Msg = { id: crypto.randomUUID(), role: "user", content: composed };
    setMessages((m) => [...m, userMsg]);
    setStreaming(true);
    setStreamText("");

    // Persist user message + update chat metadata
    await supabase.from("messages").insert({ chat_id: chatId, user_id: u.user.id, role: "user", content: composed });
    if (messages.length === 0) {
      await supabase.from("chats").update({ title: text.slice(0, 60), mode }).eq("id", chatId);
    } else {
      await supabase.from("chats").update({ mode, updated_at: new Date().toISOString() }).eq("id", chatId);
    }

    // If documents are attached to this chat, fetch relevant passages first.
    let passages: { name: string; content: string; chunk_index: number }[] = [];
    if (attachedDocs.length > 0) {
      try {
        const { passages: p } = await retrieveContext({ data: { chatId, query: text, matchCount: 6 } });
        passages = p.map((x) => ({ name: x.name, content: x.content, chunk_index: x.chunk_index }));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Retrieval failed");
      }
    }

    const controller = new AbortController();
    abortRef.current = controller;
    let acc = "";
    try {
      await streamChat(
        {
          mode,
          messages: [...messages, userMsg].map(({ role, content }) => ({ role, content })),
          passages,
        },
        (delta) => { acc += delta; setStreamText(acc); },
        controller.signal,
      );
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") toast.error((e as Error).message || "Stream failed");
    } finally {
      abortRef.current = null;
      setStreaming(false);
      if (acc.trim()) {
        const asst: Msg = { id: crypto.randomUUID(), role: "assistant", content: acc };
        setMessages((m) => [...m, asst]);
        setStreamText("");
        await supabase.from("messages").insert({ chat_id: chatId, user_id: u.user.id, role: "assistant", content: acc });
        addCapacity({ data: mode === "deep" ? 20 : mode === "standard" ? 10 : 5 }).then(() => qc.invalidateQueries({ queryKey: ["user-stats"] })).catch(() => {});
      }
    }
  }

  function stop() { abortRef.current?.abort(); }

  const modeMeta = {
    basic: { i: Zap, label: "BASIC", desc: "Fast answers" },
    standard: { i: Sparkles, label: "STANDARD", desc: "Balanced" },
    deep: { i: Compass, label: "DEEP RESEARCH", desc: "Comprehensive" },
  } as const;

  return (
    <div
      className={`flex h-[100dvh] flex-col ${dragOver ? "dropzone-active" : ""}`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={(e) => { e.preventDefault(); setDragOver(false); }}
      onDrop={(e) => {
        e.preventDefault(); setDragOver(false);
        if (e.dataTransfer.files.length) readFiles(e.dataTransfer.files);
      }}
    >
      {/* Header */}
      <header className="glass-strong sticky top-0 z-10 flex items-center gap-2 px-3 py-2.5">
        <Link to="/chat" className="mobile-only grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-medium">{chat?.title ?? "Conversation"}</div>
          <div className="text-[10px] text-muted-foreground">Floating Space · {modeMeta[mode].label}</div>
        </div>
        <ModeSelector value={mode} onChange={(m) => { setMode(m); supabase.from("chats").update({ mode: m }).eq("id", chatId); }} />
      </header>

      {attachedDocs.length > 0 && (
        <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-1.5 px-4 pt-2">
          {attachedDocs.map((d) => (
            <button key={d.id} onClick={() => setPickerOpen(true)} className="glass flex items-center gap-1.5 rounded-full py-1 pl-2.5 pr-2.5 text-[11px]" title="Manage attached documents">
              <FileText className="h-3 w-3 text-primary" /> {d.name}
            </button>
          ))}
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 pt-4 pb-2 md:px-8">
        {messages.length === 0 && !streaming && (
          <div className="mx-auto flex max-w-2xl flex-col items-center gap-3 pt-14 text-center">
            <Logo size={64} />
            <div className="font-display text-lg font-semibold text-gradient">How can I help today?</div>
            <p className="max-w-xs text-xs text-muted-foreground">Ask anything — reasoning, research, code, analysis, creativity.</p>
          </div>
        )}
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          {messages.map((m) => <MessageBubble key={m.id} msg={m} />)}
          {streaming && (
            <div className="animate-float-in">
              <div className="mb-1 flex items-center gap-2">
                <Logo size={22} />
                <span className="shimmer-text text-[12px] font-medium">Floating Space is thinking…</span>
              </div>
              {streamText ? (
                <Markdown text={streamText} />
              ) : (
                <div className="flex gap-1 pl-8">
                  <span className="typing-dot h-1.5 w-1.5 rounded-full bg-primary" />
                  <span className="typing-dot h-1.5 w-1.5 rounded-full bg-primary" />
                  <span className="typing-dot h-1.5 w-1.5 rounded-full bg-primary" />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Composer */}
      <div className="px-3 pb-3 md:px-8 md:pb-6">
        <div className="mx-auto max-w-3xl">
          {attachments.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {attachments.map((a, idx) => (
                <span key={idx} className="glass flex items-center gap-1.5 rounded-full py-1 pl-2.5 pr-1 text-[11px]">
                  <Paperclip className="h-3 w-3 text-primary" /> {a.name}
                  <button onClick={() => setAttachments((arr) => arr.filter((_, i) => i !== idx))} className="grid h-4 w-4 place-items-center rounded-full text-muted-foreground hover:bg-white/10 hover:text-foreground" aria-label="Remove">
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <form
            onSubmit={(e) => { e.preventDefault(); send(input); }}
            className="glass-strong flex flex-col gap-1.5 rounded-3xl p-2"
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
              rows={1}
              placeholder={`Message Floating Space (${modeMeta[mode].label})…`}
              className="max-h-[240px] w-full resize-none bg-transparent px-3 py-2.5 text-[14px] outline-none placeholder:text-muted-foreground"
            />
            <div className="flex items-center gap-1 px-1">
              <input
                ref={fileRef}
                type="file"
                multiple
                accept=".txt,.md,.csv,.json,.js,.ts,.tsx,.jsx,.py,.html,.css,.log"
                className="hidden"
                onChange={(e) => { if (e.target.files) readFiles(e.target.files); e.target.value = ""; }}
              />
              <button type="button" onClick={() => fileRef.current?.click()} className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-white/5 hover:text-foreground" aria-label="Attach file" title="Upload file">
                <Paperclip className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => setPickerOpen(true)} className={`grid h-9 w-9 place-items-center rounded-full transition-colors ${attachedDocs.length > 0 ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-white/5 hover:text-foreground"}`} aria-label="Chat with document" title="Chat with a document">
                <FileText className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => navigate({ to: "/images" })} className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-white/5 hover:text-foreground" aria-label="Generate image" title="Generate image">
                <ImageIcon className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => setMode("deep")} className={`grid h-9 place-items-center rounded-full px-2.5 text-[11px] font-medium transition-colors ${mode === "deep" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-white/5 hover:text-foreground"}`} title="Deep research">
                <Telescope className="mr-1 inline h-3.5 w-3.5" /> Research
              </button>
              <button type="button" className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-white/5 hover:text-foreground" aria-label="Voice">
                <Mic className="h-4 w-4" />
              </button>
              <div className="ml-auto">
                {streaming ? (
                  <button type="button" onClick={stop} className="grid h-9 w-9 place-items-center rounded-full bg-destructive/90 text-white" aria-label="Stop">
                    <Square className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <button type="submit" disabled={!input.trim() && attachments.length === 0} className="grid h-9 w-9 place-items-center rounded-full disabled:opacity-40" style={{ background: "linear-gradient(135deg, oklch(0.78 0.18 295), oklch(0.75 0.16 260))", boxShadow: "0 8px 24px -8px oklch(0.72 0.2 295 / 0.7)" }} aria-label="Send">
                    <ArrowUp className="h-4 w-4 text-[oklch(0.15_0.03_275)]" />
                  </button>
                )}
              </div>
            </div>
          </form>
          <div className="mt-1.5 text-center text-[10px] text-muted-foreground">
            Enter to send · Shift+Enter for newline · Drop files anywhere to attach
          </div>
        </div>
      </div>

      {pickerOpen && <DocumentPicker chatId={chatId} onClose={() => setPickerOpen(false)} />}
    </div>
  );
}

function MessageBubble({ msg }: { msg: Msg }) {
  const isUser = msg.role === "user";
  async function copy() { await navigator.clipboard.writeText(msg.content); toast.success("Copied"); }
  async function share() {
    if (navigator.share) { try { await navigator.share({ text: msg.content }); } catch {} }
    else { copy(); }
  }
  return (
    <div className={`animate-float-in flex ${isUser ? "justify-end" : "flex-col"}`}>
      {!isUser && (
        <div className="mb-1 flex items-center gap-2">
          <Logo size={22} />
          <span className="text-[11px] font-medium text-muted-foreground">Floating Space</span>
        </div>
      )}
      {isUser ? (
        <div className="max-w-[85%] rounded-3xl rounded-tr-lg px-4 py-2.5 text-[14px]" style={{ background: "linear-gradient(135deg, oklch(0.72 0.18 295), oklch(0.65 0.16 260))", color: "oklch(0.12 0.03 275)", boxShadow: "0 8px 24px -12px oklch(0.72 0.2 295 / 0.6)" }}>
          {msg.content}
        </div>
      ) : (
        <div>
          <Markdown text={msg.content} />
          <div className="mt-2 flex gap-1 opacity-60">
            <button onClick={copy} className="grid h-7 w-7 place-items-center rounded-full hover:bg-white/5" aria-label="Copy"><Copy className="h-3 w-3" /></button>
            <button onClick={share} className="grid h-7 w-7 place-items-center rounded-full hover:bg-white/5" aria-label="Share"><Share2 className="h-3 w-3" /></button>
          </div>
        </div>
      )}
    </div>
  );
}

function ModeSelector({ value, onChange }: { value: Mode; onChange: (m: Mode) => void }) {
  const items: { k: Mode; label: string }[] = [
    { k: "basic", label: "Basic" },
    { k: "standard", label: "Std" },
    { k: "deep", label: "Deep" },
  ];
  return (
    <div className="flex rounded-full bg-white/5 p-0.5 text-[10px] font-semibold uppercase tracking-wider">
      {items.map((it) => (
        <button
          key={it.k}
          onClick={() => onChange(it.k)}
          className={`rounded-full px-2.5 py-1 transition-all ${value === it.k ? "bg-gradient-to-br from-primary/80 to-accent/60 text-[oklch(0.12_0.03_275)] shadow" : "text-muted-foreground"}`}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}