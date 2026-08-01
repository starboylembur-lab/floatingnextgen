import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/research")({
  head: () => ({ meta: [{ title: "Deep Research — Floating Space" }, { name: "description", content: "Comprehensive multi-source research with Floating Space." }] }),
  component: Research,
});

const PROMPTS = [
  "Analyze the geopolitical impact of AI over the next decade.",
  "The future of quantum computing and its commercial uses.",
  "Compare the economic positions of the US, China and the EU.",
  "The unresolved mysteries of ancient civilizations.",
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
        <h1 className="text-2xl font-semibold tracking-tight">Deep research</h1>
        <p className="mt-1 text-sm text-muted-foreground">Structured, in-depth answers on any topic.</p>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); if (q.trim()) start.mutate(q.trim()); }} className="flex flex-col gap-2">
        <textarea
          value={q} onChange={(e) => setQ(e.target.value)}
          rows={4}
          placeholder="Describe the topic to investigate…"
          className="w-full resize-none rounded-xl border border-border bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-ring"
        />
        <button disabled={!q.trim() || start.isPending} className="btn-primary h-11 w-full">
          {start.isPending ? "Starting…" : "Begin research"}
        </button>
      </form>

      <section>
        <div className="mb-2 text-xs text-muted-foreground">Suggested</div>
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
          {PROMPTS.map((p) => (
            <li key={p}>
              <button onClick={() => start.mutate(p)} disabled={start.isPending} className="w-full px-4 py-3 text-left text-sm transition-colors hover:bg-muted disabled:opacity-50">
                {p}
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
