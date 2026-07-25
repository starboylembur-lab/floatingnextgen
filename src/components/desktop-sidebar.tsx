import { Link, useNavigate, useParams, useRouterState } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Logo, Wordmark } from "@/components/logo";
import { initUserStats } from "@/lib/user-stats.functions";
import {
  Plus, Search, MessagesSquare, Compass, Image as ImageIcon,
  Crown, Settings, LogOut, Trash2, Sparkles, Home,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export function DesktopSidebar() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const params = useParams({ strict: false }) as { chatId?: string };
  const [q, setQ] = useState("");

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data: p } = await supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle();
      return { user: u.user, profile: p };
    },
  });
  const { data: stats } = useQuery({ queryKey: ["user-stats"], queryFn: () => initUserStats() });
  const { data: chats = [] } = useQuery({
    queryKey: ["chats"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return [];
      const { data, error } = await supabase
        .from("chats").select("*").eq("user_id", u.user.id)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const { data, error } = await supabase.from("chats")
        .insert({ user_id: u.user.id, title: "New conversation" }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (chat) => {
      qc.invalidateQueries({ queryKey: ["chats"] });
      nav({ to: "/chat/$chatId", params: { chatId: chat.id } });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("chats").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chats"] }),
  });

  const filtered = useMemo(
    () => (q ? chats.filter((c) => c.title.toLowerCase().includes(q.toLowerCase())) : chats),
    [chats, q],
  );

  const name = profile?.profile?.display_name || profile?.user?.email?.split("@")[0] || "You";
  const email = profile?.user?.email ?? profile?.user?.phone ?? "";
  const initial = name.charAt(0).toUpperCase();

  const navItems = [
    { to: "/home", label: "Home", icon: Home },
    { to: "/research", label: "Deep Research", icon: Compass },
    { to: "/images", label: "Image Studio", icon: ImageIcon },
    { to: "/premium", label: "Premium", icon: Crown },
  ] as const;

  async function signOut() {
    await supabase.auth.signOut();
    qc.clear();
    nav({ to: "/auth", replace: true });
  }

  return (
    <aside className="desktop-only flex h-[100dvh] w-72 shrink-0 flex-col border-r border-white/5 bg-[oklch(0.12_0.03_275_/_0.6)] backdrop-blur-2xl">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-4 pt-5 pb-3">
        <Logo size={32} />
        <div className="min-w-0 flex-1">
          <Wordmark className="text-[15px]" />
          <div className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground">Nexus · HanStack</div>
        </div>
      </div>

      {/* Primary actions */}
      <div className="px-3">
        <button
          onClick={() => create.mutate()}
          disabled={create.isPending}
          className="group flex w-full items-center gap-2 rounded-2xl border border-white/10 bg-gradient-to-br from-primary/25 to-accent/10 px-3 py-2.5 text-[13px] font-semibold text-foreground transition-all hover:from-primary/35 hover:to-accent/20 active:scale-[0.99]"
        >
          <span className="grid h-6 w-6 place-items-center rounded-lg bg-white/10">
            <Plus className="h-3.5 w-3.5" />
          </span>
          New Chat
          <span className="ml-auto rounded-md bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">⌘N</span>
        </button>
      </div>

      {/* Search */}
      <div className="mt-2 px-3">
        <label className="flex items-center gap-2 rounded-xl bg-white/5 px-2.5 py-2 ring-1 ring-white/5 focus-within:ring-primary/40">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search chats"
            className="w-full bg-transparent text-[12.5px] outline-none placeholder:text-muted-foreground"
          />
        </label>
      </div>

      {/* Quick nav */}
      <nav className="mt-3 flex flex-col gap-0.5 px-3">
        {navItems.map((it) => {
          const active = pathname === it.to;
          const Icon = it.icon;
          return (
            <Link
              key={it.to}
              to={it.to}
              className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[12.5px] transition-colors ${active ? "bg-white/10 text-foreground" : "text-muted-foreground hover:bg-white/5 hover:text-foreground"}`}
            >
              <Icon className="h-3.5 w-3.5" />
              {it.label}
            </Link>
          );
        })}
      </nav>

      {/* Conversations */}
      <div className="mt-4 flex-1 overflow-y-auto px-2">
        <div className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          Conversations
        </div>
        {filtered.length === 0 ? (
          <div className="px-3 py-6 text-center text-[11px] text-muted-foreground">
            No chats yet. Start a new one.
          </div>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {filtered.map((c) => {
              const active = params.chatId === c.id;
              return (
                <li key={c.id} className="group relative">
                  <Link
                    to="/chat/$chatId"
                    params={{ chatId: c.id }}
                    className={`flex items-center gap-2 rounded-xl px-2.5 py-2 pr-8 text-[12.5px] transition-colors ${active ? "bg-white/10 text-foreground" : "text-muted-foreground hover:bg-white/5 hover:text-foreground"}`}
                  >
                    <MessagesSquare className="h-3.5 w-3.5 shrink-0 opacity-60" />
                    <span className="truncate">{c.title}</span>
                  </Link>
                  <button
                    onClick={(e) => {
                      e.preventDefault(); e.stopPropagation();
                      if (confirm("Delete this chat?")) del.mutate(c.id);
                    }}
                    className="absolute right-1.5 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-white/10 hover:text-destructive group-hover:opacity-100"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Subscription badge */}
      {stats?.is_premium ? (
        <Link to="/premium" className="mx-3 mb-2 flex items-center gap-2 rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/20 to-accent/10 px-3 py-2.5">
          <Crown className="h-4 w-4 text-primary" />
          <div className="flex-1">
            <div className="text-[12px] font-semibold">Premium</div>
            <div className="text-[10px] text-muted-foreground">Nexus unlimited</div>
          </div>
        </Link>
      ) : (
        <Link to="/premium" className="mx-3 mb-2 flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 hover:bg-white/10 transition-colors">
          <Sparkles className="h-4 w-4 text-primary" />
          <div className="flex-1">
            <div className="text-[12px] font-semibold">Upgrade to Premium</div>
            <div className="text-[10px] text-muted-foreground">2-day trial available</div>
          </div>
        </Link>
      )}

      {/* Profile row */}
      <div className="border-t border-white/5 p-2">
        <div className="flex items-center gap-2 rounded-xl p-1.5">
          <Link to="/profile" className="flex flex-1 items-center gap-2.5 rounded-lg p-1.5 hover:bg-white/5">
            <div className="grid h-8 w-8 place-items-center rounded-full text-[13px] font-semibold" style={{ background: "linear-gradient(135deg, oklch(0.75 0.18 295), oklch(0.65 0.16 260))", color: "oklch(0.12 0.03 275)" }}>
              {initial}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12.5px] font-medium">{name}</div>
              <div className="truncate text-[10px] text-muted-foreground">{email}</div>
            </div>
          </Link>
          <Link to="/profile" className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-white/5 hover:text-foreground" aria-label="Settings">
            <Settings className="h-3.5 w-3.5" />
          </Link>
          <button onClick={signOut} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-white/5 hover:text-destructive" aria-label="Sign out">
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}