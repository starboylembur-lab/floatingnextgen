import { createFileRoute } from "@tanstack/react-router";
import { Check, Crown, Sparkles, Zap, Rocket, Diamond, ShieldCheck, Infinity as InfIcon, Brain, ImagePlus, FileText, TrendingUp } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { initUserStats } from "@/lib/user-stats.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/premium")({
  head: () => ({ meta: [{ title: "Premium — FloatingAI" }, { name: "description", content: "Unlock unlimited intelligence with FloatingAI Premium." }] }),
  component: Premium,
});

const FEATURES = [
  { i: InfIcon, t: "Unlimited Deep Research access" },
  { i: Brain, t: "Advanced AI reasoning mode" },
  { i: ImagePlus, t: "Higher image generation quality" },
  { i: Zap, t: "Faster AI response" },
  { i: Rocket, t: "Priority processing" },
  { i: TrendingUp, t: "Advanced data analysis" },
  { i: FileText, t: "Large document analysis" },
  { i: Diamond, t: "Premium AI models" },
  { i: Sparkles, t: "Exclusive research tools" },
  { i: Crown, t: "Advanced creativity mode" },
  { i: ShieldCheck, t: "No advertising" },
  { i: Rocket, t: "Future feature access" },
];

function Premium() {
  const qc = useQueryClient();
  const { data: stats } = useQuery({ queryKey: ["user-stats"], queryFn: () => initUserStats() });

  const activate = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Sign in first");
      const { error } = await supabase.from("user_stats").update({
        is_premium: true,
      }).eq("user_id", u.user.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Welcome to Premium ✨"); qc.invalidateQueries({ queryKey: ["user-stats"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div className="flex flex-col gap-5 px-4 pb-8 pt-5">
      <div>
        <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-primary">
          <Crown className="h-3 w-3" /> Premium
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-gradient">Intelligence, unrestricted.</h1>
        <p className="mt-1 text-sm text-muted-foreground">Unlock everything FloatingAI can do.</p>
      </div>

      {/* Luxury pricing card */}
      <div className="relative overflow-hidden rounded-3xl p-[1px]" style={{
        background: "linear-gradient(135deg, oklch(0.75 0.18 295 / 0.9), oklch(0.65 0.16 220 / 0.4), oklch(0.75 0.18 295 / 0.9))",
      }}>
        <div className="glass-strong relative rounded-[calc(1.5rem-1px)] p-5">
          <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full" style={{ background: "radial-gradient(circle, oklch(0.72 0.2 295 / 0.35), transparent 70%)" }} />
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">FloatingAI</div>
              <div className="text-2xl font-semibold tracking-tight">Premium</div>
            </div>
            <Crown className="h-8 w-8 text-primary" />
          </div>
          <div className="mt-4 flex items-baseline gap-1.5">
            <span className="font-mono text-4xl font-semibold tracking-tight text-gradient">Rp 200.000</span>
            <span className="text-sm text-muted-foreground">/ month</span>
          </div>
          {stats?.is_premium ? (
            <div className="mt-4 flex items-center gap-2 rounded-2xl bg-primary/10 p-3 text-[13px]">
              <ShieldCheck className="h-4 w-4 text-primary" /> Premium active — thank you.
            </div>
          ) : (
            <button onClick={() => activate.mutate()} disabled={activate.isPending} className="btn-primary mt-4 h-12 w-full justify-center text-[14px] font-semibold">
              {activate.isPending ? "Activating…" : "Activate Premium"}
            </button>
          )}
          {!stats?.is_premium && stats?.trial_ends_at && new Date(stats.trial_ends_at).getTime() > Date.now() && (
            <div className="mt-2 text-center text-[11px] text-muted-foreground">You're currently on your 2-day trial.</div>
          )}
        </div>
      </div>

      <div className="glass rounded-3xl p-4">
        <div className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Included</div>
        <ul className="grid gap-2.5">
          {FEATURES.map(({ i: I, t }) => (
            <li key={t} className="flex items-center gap-3">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-primary/30 to-accent/20"><I className="h-3.5 w-3.5 text-primary" /></span>
              <span className="text-[13px]">{t}</span>
              <Check className="ml-auto h-4 w-4 text-primary" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}// touch
