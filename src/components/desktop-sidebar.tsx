import { Link, useNavigate, useParams, useRouterState } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/logo";
import { Plus, Search, Trash2, LogOut } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const NAV = [
  { to: "/home", label: "Home" },
  { to: "/research", label: "Deep research" },
  { to: "/documents", label: "Documents" },
  { to: "/images", label: "Images" },
  { to: "/premium", label: "Premium" },
] as const;

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

  async function signOut() {
    await supabase.auth.signOut();
    qc.clear();
    nav({ to: "/auth", replace: true });
  }

  return (
    <aside className="desktop-only flex h-[100dvh] w-64 shrink-0 flex-col border-r border-border bg-sidebar">
      <div className="flex items-center gap-2 px-4 py-4">
        <Logo size={26} />
        <span className="text-sm font-medium">Floating Space</span>
      </div>

      <div className="px-3">
        <button
          onClick={() => create.mutate()}
          disabled={create.isPending}
          className="btn-ghost h-10 w-full justify-start text-[13px]"
        >
          <Plus className="h-4 w-4" /> New chat
        </button>
      </div>

      <div className="mt-2 px-3">
        <label className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-2">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search chats"
            className="w-full bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
          />
        </label>
      </div>

      <nav className="mt-3 flex flex-col px-3">
        {NAV.map((it) => (
          <Link
            key={it.to}
            to={it.to}
            className={`rounded-lg px-2.5 py-2 text-[13px] transition-colors ${pathname === it.to ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            {it.label}
          </Link>
        ))}
      </nav>

      <div className="mt-4 flex-1 overflow-y-auto px-3">
        <div className="mb-1.5 px-1 text-[11px] text-muted-foreground">Conversations</div>
        {filtered.length === 0 ? (
          <div className="px-1 py-4 text-[12px] text-muted-foreground">No chats yet.</div>
        ) : (
          <ul className="flex flex-col">
            {filtered.map((c) => (
              <li key={c.id} className="group relative">
                <Link
                  to="/chat/$chatId"
                  params={{ chatId: c.id }}
                  className={`block truncate rounded-lg px-2.5 py-2 pr-8 text-[13px] transition-colors ${params.chatId === c.id ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {c.title}
                </Link>
                <button
                  onClick={(e) => {
                    e.preventDefault(); e.stopPropagation();
                    if (confirm("Delete this chat?")) del.mutate(c.id);
                  }}
                  className="absolute right-1.5 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100"
                  aria-label="Delete"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex items-center gap-2 border-t border-border p-3">
        <Link to="/profile" className="min-w-0 flex-1 truncate text-[13px] hover:underline">{name}</Link>
        <button onClick={signOut} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:text-destructive" aria-label="Sign out">
          <LogOut className="h-3.5 w-3.5" />
        </button>
      </div>
    </aside>
  );
}
