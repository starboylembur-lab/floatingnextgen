import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CapacityMeter } from "@/components/capacity-meter";
import { initUserStats } from "@/lib/user-stats.functions";
import { LogOut, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Profile — Floating Space" },
      { name: "description", content: "Manage your Floating Space account, capacity and plan." },
    ],
  }),
  component: Profile,
});

const LINKS = [
  { to: "/home", label: "Home" },
  { to: "/research", label: "Deep research" },
  { to: "/documents", label: "Documents" },
  { to: "/premium", label: "Premium" },
] as const;

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
    if (error) toast.error(error.message);
    else { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["profile"] }); }
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
      <div className="flex items-center gap-3">
        <div className="grid h-14 w-14 place-items-center rounded-full bg-muted text-xl font-medium">{initial}</div>
        <div className="min-w-0">
          <div className="truncate text-base font-medium">{name || "Floating Space user"}</div>
          <div className="truncate text-xs text-muted-foreground">{email}</div>
          {stats?.is_premium && <div className="mt-0.5 text-[11px] text-muted-foreground">Premium member</div>}
        </div>
      </div>

      <CapacityMeter stats={stats} />

      <div className="flex flex-col gap-2">
        <label className="text-xs text-muted-foreground">Display name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          className="rounded-xl border border-border bg-transparent px-3 py-2.5 text-sm outline-none focus:border-ring"
        />
        <button onClick={save} className="btn-primary h-10 w-full">Save</button>
      </div>

      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
        {LINKS.map((l) => (
          <li key={l.to}>
            <Link to={l.to} className="flex items-center justify-between px-4 py-3 text-sm transition-colors hover:bg-muted">
              {l.label}
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>

      {stats?.trial_ends_at && !stats.is_premium && (
        <p className="text-center text-xs text-muted-foreground">
          Trial ends {new Date(stats.trial_ends_at).toLocaleDateString()}
        </p>
      )}

      <button onClick={signOut} className="btn-ghost h-11 w-full text-destructive">
        <LogOut className="h-4 w-4" /> Sign out
      </button>
    </div>
  );
}
