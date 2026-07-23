import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { initUserStats } from "@/lib/user-stats.functions";
import { Logo, Wordmark } from "@/components/logo";
import { Search, Sparkles, Brain, LineChart, Wand2, ImagePlus, Compass, ArrowRight, Zap } from "lucide-react";
import { CapacityMeter } from "@/components/capacity-meter";
import { useEffect } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({
    meta: [
      { title: "Home — FloatingAI" },
      { name: "description", content: "Your FloatingAI dashboard — capabilities, recommended topics, and instant access to intelligence." },
    ],
  }),
  component: Home,
});

const CAPS = [
  { i: Compass, t: "Deep Research" },
  { i: LineChart, t: "Data Analysis" },
  { i: Wand2, t: "Creative Generation" },
  { i: ImagePlus, t: "Image Creation" },
  { i: Brain, t: "Knowledge Discovery" },
];

const TOPICS: { cat: string; items: string[] }[] = [
  { cat: "Technology", items: ["Latest AI breakthroughs", "Future of robotics", "Quantum computing development", "Future technology trends"] },
  { cat: "Geopolitics", items: ["Global power competition", "World economic shifts", "International conflicts analysis"] },
  { cat: "Finance", items: ["Stock market analysis", "Global economy", "Investment trends"] },
  { cat: "History", items: ["Ancient civilizations", "Historical mysteries", "Lessons from world history"] },
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

  const { data: stats } = useQuery({
    queryKey: ["user-stats"],
    queryFn: async () => initUserStats(),
  });

  useEffect(() => { if (stats?.trial_started_at && stats?.trial_ends_at) return; }, [stats]);

  const startChat = useMutation({
    mutationFn: async ({ text, mode }: { text: string; mode: "basic" | "standard" | "deep" }) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const { data: chat, error } = await supabase.from("chats").insert({
        user_id: u.user.id, title: text.slice(0, 60), mode,
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

  const name = profile?.profile?.display_name || profile?.user?.email?.split("@")[0] || "friend";
  const trialLeft = stats?.trial_ends_at ? Math.max(0, Math.ceil((new Date(stats.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60))) : 0;

  return (
    <div className="flex flex-col gap-6 px-4 pb-8 pt-4">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Logo size={36} />
          <div>
            <Wordmark className="text-[15px]" />
            <div className="text-[10px] text-muted-foreground">HanStack Labs</div>
          </div>
        </div>
        <Link to="/profile" className="glass grid h-10 w-10 place-items-center rounded-full text-sm font-semibold">
          {name.charAt(0).toUpperCase()}
        </Link>
      </header>

      {/* Welcome */}
      <section className="animate-float-in">
        <p className="text-[13px] text-muted-foreground">Welcome back, {name}</p>
        <h1 className="mt-1 text-3xl font-semibold leading-tight tracking-tight text-gradient">
          Your next-generation<br />intelligence assistant.
        </h1>
      </section>

      {/* Search */}
      <button
        onClick={() => navigate({ to: "/chat" })}
        className="glass-strong flex items-center gap-3 rounded-2xl px-4 py-3.5 text-left transition-transform active:scale-[0.99]"
      >
        <Search className="h-4 w-4 text-muted-foreground" />
        <span className="flex-1 text-sm text-muted-foreground">Ask FloatingAI anything…</span>
        <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-muted-foreground">⌘K</span>
      </button>

      {/* Capacity meter */}
      <CapacityMeter stats={stats} />

      {trialLeft > 0 && !stats?.is_premium && (
        <div className="glass flex items-center gap-3 rounded-2xl p-3">
          <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-primary/40 to-accent/30">
            <Zap className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <div className="text-[13px] font-medium">Premium trial active</div>
            <div className="text-[11px] text-muted-foreground">{trialLeft} hours remaining · Enjoy every feature</div>
          </div>
        </div>
      )}

      {/* Capabilities */}
      <section>
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Capabilities</div>
        <div className="-mx-4 overflow-x-auto px-4">
          <div className="flex gap-2">
            {CAPS.map(({ i: I, t }) => (
              <div key={t} className="glass flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-xs">
                <I className="h-3.5 w-3.5 text-primary" /> {t}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Topics */}
      {TOPICS.map((group) => (
        <section key={group.cat}>
          <div className="mb-2 flex items-center justify-between">
            <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{group.cat}</div>
            <Sparkles className="h-3 w-3 text-primary/60" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {group.items.map((topic) => (
              <button
                key={topic}
                disabled={startChat.isPending}
                onClick={() => startChat.mutate({ text: topic, mode: "standard" })}
                className="glass group flex flex-col items-start gap-3 rounded-2xl p-3 text-left transition-all active:scale-[0.98]"
              >
                <div className="text-[13px] font-medium leading-snug">{topic}</div>
                <div className="flex w-full items-center justify-between text-[10px] text-muted-foreground">
                  <span>Explore</span>
                  <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                </div>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}