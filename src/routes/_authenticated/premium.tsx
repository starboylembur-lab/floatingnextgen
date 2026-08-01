import { createFileRoute } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { initUserStats, activateTrial } from "@/lib/user-stats.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/premium")({
  head: () => ({ meta: [{ title: "Premium — Floating Space" }, { name: "description", content: "Unlock unlimited intelligence with Floating Space Premium." }] }),
  component: Premium,
});

const FEATURES = [
  "+10,000 AI capacity",
  "Unlimited deep research",
  "Advanced reasoning mode",
  "Higher image quality",
  "Faster, priority responses",
  "Large document analysis",
  "Premium AI models",
  "No advertising",
  "Early access to new features",
];

function Premium() {
  const qc = useQueryClient();
  const { data: stats } = useQuery({ queryKey: ["user-stats"], queryFn: () => initUserStats() });

  const activate = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Sign in first");
      const { error } = await supabase.from("user_stats").update({ is_premium: true, capacity_max: 10000 }).eq("user_id", u.user.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Premium activated"); qc.invalidateQueries({ queryKey: ["user-stats"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const trial = useMutation({
    mutationFn: () => activateTrial(),
    onSuccess: () => { toast.success("2-day trial activated"); qc.invalidateQueries({ queryKey: ["user-stats"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to activate trial"),
  });

  const trialActive = stats?.trial_ends_at ? new Date(stats.trial_ends_at).getTime() > Date.now() : false;
  const trialUsed = Boolean(stats?.trial_started_at);

  return (
    <div className="flex flex-col gap-5 px-4 pb-8 pt-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Premium</h1>
        <p className="mt-1 text-sm text-muted-foreground">Everything Floating Space can do, unrestricted.</p>
      </div>

      <div className="rounded-xl border border-border p-5">
        <div className="flex items-baseline gap-1.5">
          <span className="text-3xl font-semibold tracking-tight">Rp 200.000</span>
          <span className="text-sm text-muted-foreground">/ month</span>
        </div>

        {stats?.is_premium ? (
          <p className="mt-4 text-sm text-muted-foreground">Premium is active — thank you.</p>
        ) : (
          <>
            <button onClick={() => activate.mutate()} disabled={activate.isPending} className="btn-primary mt-4 h-11 w-full">
              {activate.isPending ? "Activating…" : "Activate Premium"}
            </button>
            {trialActive ? (
              <p className="mt-2 text-center text-xs text-muted-foreground">
                Trial ends {new Date(stats!.trial_ends_at!).toLocaleDateString()}
              </p>
            ) : trialUsed ? (
              <p className="mt-2 text-center text-xs text-muted-foreground">Your free trial has ended.</p>
            ) : (
              <button onClick={() => trial.mutate()} disabled={trial.isPending} className="btn-ghost mt-2 h-11 w-full">
                {trial.isPending ? "Activating…" : "Start free 2-day trial"}
              </button>
            )}
          </>
        )}
      </div>

      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
        {FEATURES.map((t) => (
          <li key={t} className="flex items-center gap-3 px-4 py-3 text-sm">
            <Check className="h-4 w-4 shrink-0 text-muted-foreground" />
            {t}
          </li>
        ))}
      </ul>
    </div>
  );
}
