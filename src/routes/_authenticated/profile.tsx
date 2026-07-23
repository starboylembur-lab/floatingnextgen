import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Logo } from "@/components/logo";
import { CapacityMeter } from "@/components/capacity-meter";
import { initUserStats } from "@/lib/user-stats.functions";
import { LogOut, Crown, User, Mail, Save, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Profile — FloatingAI" }] }),
  component: Profile,
});

function Profile() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [name, setName] = useState("");

  const { data } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data: p } = await supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle();
      return { user: u.user, profile: p };
    },
  });
  const { data: stats } = useQuery({ queryKey: ["user-stats"], queryFn: () => initUserStats() });

  useEffect(() => { if (data?.profile?.display_name) setName(data.profile.display_name); }, [data?.profile?.display_name]);

  async function save() {
    if (!data?.user) return;
    const { error } = await supabase.from("profiles").upsert({ id: data.user.id, display_name: name.trim() || null });
    if (error) toast.error(error.message); else { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["profile"] }); }
  }
  async function signOut() {
    await supabase.auth.signOut();
    qc.clear();
    nav({ to: "/auth", replace: true });
  }

  const email = data?.user?.email ?? data?.user?.phone ?? "—";
  const initial = (name || email || "?").charAt(0).toUpperCase();

  return (
    <div className="flex flex-col gap-5 px-4 pb-8 pt-5">
      <div className="flex flex-col items-center gap-3 pt-2 text-center">
        <div className="relative">
          <div className="grid h-20 w-20 place-items-center rounded-full text-3xl font-semibold" style={{ background: "linear-gradient(135deg, oklch(0.75 0.18 295), oklch(0.65 0.16 260))", color: "oklch(0.12 0.03 275)", boxShadow: "0 12px 40px -12px oklch(0.72 0.2 295 / 0.6)" }}>
            {initial}
          </div>
          <Logo size={26} className="absolute -bottom-1 -right-1 ring-2 ring-background rounded-full" />
        </div>
        <div>
          <div className="text-lg font-semibold">{name || "FloatingAI User"}</div>
          <div className="text-xs text-muted-foreground">{email}</div>
        </div>
        {stats?.is_premium && (
          <div className="glass inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold text-primary">
            <Crown className="h-3 w-3" /> Premium member
          </div>
        )}
      </div>

      <CapacityMeter stats={stats} />

      <div className="glass rounded-3xl p-4">
        <div className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Account</div>
        <label className="flex flex-col gap-1.5">
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><User className="h-3 w-3" /> Display name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="rounded-xl bg-white/5 px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-primary/60" />
        </label>
        <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground"><Mail className="h-3 w-3" /> {email}</div>
        <button onClick={save} className="btn-primary mt-4 h-10 w-full justify-center"><Save className="h-4 w-4" /> Save</button>
      </div>

      {stats?.trial_ends_at && !stats.is_premium && (
        <div className="glass rounded-2xl p-4 text-center">
          <Sparkles className="mx-auto h-5 w-5 text-primary" />
          <div className="mt-1 text-sm font-medium">2-day Premium trial active</div>
          <div className="text-[11px] text-muted-foreground">Ends {new Date(stats.trial_ends_at).toLocaleString()}</div>
        </div>
      )}

      <button onClick={signOut} className="glass flex items-center justify-center gap-2 rounded-2xl py-3 text-sm text-destructive">
        <LogOut className="h-4 w-4" /> Sign out
      </button>
    </div>
  );
}