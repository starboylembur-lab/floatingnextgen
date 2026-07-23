import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Compass, ArrowRight, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/research")({
  head: () => ({ meta: [{ title: "Deep Research — FloatingAI" }, { name: "description", content: "Comprehensive multi-source research with FloatingAI." }] }),
  component: Research,
});

const PROMPTS = [
  "Analyze the geopolitical impact of AI on global power structures over the next decade.",
  "Investigate the future of quantum computing and its commercial applications.",
  "Compare the strategic economic positions of the US, China, and the EU in 2026.",
  "Deep dive: The unresolved mysteries of ancient civilizations.",
];

function Research() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const start = useMutation({
    mutationFn: async (text: string) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const { data, error } = await supabase.from("chats").insert({
        user_id: u.user.id, title: text.slice(0, 60), mode: "deep",
      }).select().single();
      if (error) throw error;
      return { id: data.id, text };
    },
    onSuccess: ({ id, text }) => navigate({ to: "/chat/$chatId", params: { chatId: id }, search: { q: text, mode: "deep" } }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div className="flex flex-col gap-5 px-4 pb-8 pt-5">
      <div>
        <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-primary">
          <Compass className="h-3 w-3" /> Deep Research
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-gradient">Investigate anything, deeply.</h1>
        <p className="mt-1 text-sm text-muted-foreground">Multi-source analysis, structured reports, expert-level depth.</p>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); if (q.trim()) start.mutate(q.trim()); }} className="glass-strong flex flex-col gap-2 rounded-3xl p-3">
        <textarea
          value={q} onChange={(e) => setQ(e.target.value)}
          rows={4}
          placeholder="Describe the topic to investigate…"
          className="w-full resize-none bg-transparent px-2 py-1 text-[14px] outline-none placeholder:text-muted-foreground"
        />
        <button disabled={!q.trim() || start.isPending} className="btn-primary h-11 justify-center">
          {start.isPending ? "Starting…" : (<><Sparkles className="h-4 w-4" /> Begin research</>)}
        </button>
      </form>

      <div>
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Suggested inquiries</div>
        <div className="flex flex-col gap-2">
          {PROMPTS.map((p) => (
            <button key={p} onClick={() => start.mutate(p)} disabled={start.isPending} className="glass group flex items-start gap-3 rounded-2xl p-3 text-left">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary/30 to-accent/20"><Compass className="h-3.5 w-3.5 text-primary" /></div>
              <div className="flex-1 text-[13px] leading-snug">{p}</div>
              <ArrowRight className="mt-1 h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}// touch
