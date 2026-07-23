import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, ArrowUp, Copy, Share2, Loader2, Mic, Square, Sparkles, Zap, Compass } from "lucide-react";
import { Markdown } from "@/lib/markdown";
import { streamChat } from "@/lib/streams";
import { toast } from "sonner";
import { addCapacity } from "@/lib/user-stats.functions";
import { Logo } from "@/components/logo";

type Mode = "basic" | "standard" | "deep";

type SearchParams = { q?: string; mode?: Mode };

export const Route = createFileRoute("/_authenticated/chat/$chatId")({
  validateSearch: (s: Record<string, unknown>): SearchParams => ({
    q: typeof s.q === "string" ? s.q : undefined,
    mode: s.mode === "basic" || s.mode === "deep" || s.mode === "standard" ? s.mode : undefined,
  }),
  head: () => ({ meta: [{ title: "Conversation — FloatingAI" }] }),
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
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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
    if (!text.trim() || streaming) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    setInput("");

    const userMsg: Msg = { id: crypto.randomUUID(), role: "user", content: text };
    setMessages((m) => [...m, userMsg]);
    setStreaming(true);
    setStreamText("");

    // Persist user message + update chat title if first message
    const inserts: Promise<unknown>[] = [
      supabase.from("messages").insert({ chat_id: chatId, user_id: u.user.id, role: "user", content: text }),
    ];
    if (messages.length === 0) {
      inserts.push(supabase.from("chats").update({ title: text.slice(0, 60), mode }).eq("id", chatId));
    } else {
      inserts.push(supabase.from("chats").update({ mode, updated_at: new Date().toISOString() }).eq("id", chatId));
    }
    await Promise.all(inserts);

    const controller = new AbortController();
    abortRef.current = controller;
    let acc = "";
    try {
      await streamChat(
        "/api/chat",
        { mode, messages: [...messages, userMsg].map(({ role, content }) => ({ role, content })) },
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
    <div className="flex h-[100dvh] flex-col">
      {/* Header */}
      <header className="glass-strong sticky top-0 z-10 flex items-center gap-2 px-3 py-2.5">
        <Link to="/chat" className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-medium">{chat?.title ?? "Conversation"}</div>
          <div className="text-[10px] text-muted-foreground">FloatingAI · {modeMeta[mode].label}</div>
        </div>
        <ModeSelector value={mode} onChange={(m) => { setMode(m); supabase.from("chats").update({ mode: m }).eq("id", chatId); }} />
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 pt-4 pb-2">
        {messages.length === 0 && !streaming && (
          <div className="flex flex-col items-center gap-3 pt-14 text-center">
            <Logo size={64} />
            <div className="text-sm font-medium">How can I help, today?</div>
            <p className="max-w-xs text-xs text-muted-foreground">Ask anything — reasoning, research, code, analysis, creativity.</p>
          </div>
        )}
        <div className="flex flex-col gap-4">
          {messages.map((m) => <MessageBubble key={m.id} msg={m} />)}
          {streaming && (
            <div className="animate-float-in">
              <div className="mb-1 flex items-center gap-2">
                <Logo size={22} />
                <span className="shimmer-text text-[12px] font-medium">FloatingAI is thinking…</span>
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
      <div className="px-3 pb-3">
        <form
          onSubmit={(e) => { e.preventDefault(); send(input); }}
          className="glass-strong flex items-end gap-2 rounded-3xl p-2"
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
            rows={1}
            placeholder={`Message FloatingAI (${modeMeta[mode].label})…`}
            className="max-h-40 flex-1 resize-none bg-transparent px-3 py-2.5 text-[14px] outline-none placeholder:text-muted-foreground"
          />
          <button type="button" className="grid h-10 w-10 place-items-center rounded-full text-muted-foreground hover:text-foreground" aria-label="Voice">
            <Mic className="h-4 w-4" />
          </button>
          {streaming ? (
            <button type="button" onClick={stop} className="grid h-10 w-10 place-items-center rounded-full bg-destructive/90 text-white" aria-label="Stop">
              <Square className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button type="submit" disabled={!input.trim()} className="grid h-10 w-10 place-items-center rounded-full disabled:opacity-40" style={{ background: "linear-gradient(135deg, oklch(0.78 0.18 295), oklch(0.75 0.16 260))", boxShadow: "0 8px 24px -8px oklch(0.72 0.2 295 / 0.7)" }} aria-label="Send">
              <ArrowUp className="h-4 w-4 text-[oklch(0.15_0.03_275)]" />
            </button>
          )}
        </form>
      </div>
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
          <span className="text-[11px] font-medium text-muted-foreground">FloatingAI</span>
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