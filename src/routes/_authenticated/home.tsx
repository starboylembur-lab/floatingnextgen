import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { initUserStats } from "@/lib/user-stats.functions";
import { Logo } from "@/components/logo";
import { CapacityMeter } from "@/components/capacity-meter";
import { Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({
    meta: [
      { title: "Home — Floating Space" },
      { name: "description", content: "Your Floating Space dashboard — start a conversation or pick a suggested topic." },
    ],
  }),
  component: Home,
});

const TOPICS = [
  "Latest AI breakthroughs",
  "Global economy today",
  "Quantum computing explained",
  "Lessons from world history",
  "Stock market analysis",
  "Future technology trends",
];

function Home() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return null;
      const { data: p } = await supabase.from("profiles").select("*").eq("id", data.user.id).maybeSingle();
      return { user: data.user, profile: p };
    },
  });

  const { data: stats } = useQuery({ queryKey: ["user-stats"], queryFn: () => initUserStats() });

  const startChat = useMutation({
    mutationFn: async (text: string) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const { data: chat, error } = await supabase.from("chats").insert({
        user_id: u.user.id, title: text.slice(0, 60), mode: "standard",
      }).select().single();
      if (error) throw error;
      return { chatId: chat.id, text };
    },
    onSuccess: ({ chatId, text }) => {
      qc.invalidateQueries({ queryKey: ["chats"] });
      navigate({ to: "/chat/$chatId", params: { chatId }, search: { q: text } });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const name = profile?.profile?.display_name || profile?.user?.email?.split("@")[0] || "there";

  return (
    <div className="flex flex-col gap-6 px-4 pb-8 pt-5">
      <header className="flex items-center gap-2.5">
        <Logo size={30} />
        <span className="text-[15px] font-medium">Floating Space</span>
      </header>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Hi, {name}.</h1>
        <p className="mt-1 text-sm text-muted-foreground">What would you like to explore today?</p>
      </div>

      <Link
        to="/chat"
        className="flex items-center gap-3 rounded-xl border border-border px-4 py-3 text-sm text-muted-foreground"
      >
        <Search className="h-4 w-4" />
        Ask anything…
      </Link>

      <CapacityMeter stats={stats} />

      <section>
        <div className="mb-2 text-xs text-muted-foreground">Suggested</div>
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
          {TOPICS.map((topic) => (
            <li key={topic}>
              <button
                disabled={startChat.isPending}
                onClick={() => startChat.mutate(topic)}
                className="w-full px-4 py-3 text-left text-sm transition-colors hover:bg-muted disabled:opacity-50"
              >
                {topic}
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
