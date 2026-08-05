import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Search, Trash2, MessagesSquare } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/chat")({
  head: () => ({
    meta: [{ title: "Chats — Floating Space" }],
  }),
  component: ChatShell,
});

function ChatShell() {
  const pathname = useRouterState({
    select: (s) => s.location.pathname,
  });

  if (pathname !== "/chat") {
    return <Outlet />;
  }

  return <ChatList />;
}

function ChatList() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [q, setQ] = useState("");

  const { data: chats = [], isLoading } = useQuery({
    queryKey: ["conversations"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return [];

      const { data, error } = await supabase
        .from("conversations")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", {
          ascending: false,
        });

      if (error) throw error;

      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("Not signed in");

      const { data, error } = await supabase
        .from("conversations")
        .insert({
          user_id: user.id,
          title: "New conversation",
        })
        .select()
        .single();

      if (error) throw error;

      return data;
    },

    onSuccess: (conversation) => {
      qc.invalidateQueries({
        queryKey: ["conversations"],
      });

      navigate({
        to: "/chat/$conversationId",
        params: {
          conversationId: conversation.id,
        },
      });
    },

    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Failed");
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("conversations")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },

    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ["conversations"],
      });

      toast.success("Conversation deleted");
    },
  });

  const filtered = q
    ? chats.filter((c) =>
        c.title?.toLowerCase().includes(q.toLowerCase())
      )
    : chats;

  return (
    <div className="flex flex-col gap-4 px-4 pb-8 pt-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          Conversations
        </h1>

        <button
          onClick={() => create.mutate()}
          className="btn-primary h-10 px-4"
        >
          <Plus className="h-4 w-4" />
          New
        </button>
      </div>

      <label className="flex items-center gap-2 rounded-xl border border-border px-3 py-2.5">
        <Search className="h-4 w-4 text-muted-foreground" />

        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search conversations"
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </label>

      {isLoading ? (
        <div className="mt-8 text-center text-sm text-muted-foreground">
          Loading...
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-8 flex flex-col items-center gap-3 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-muted">
            <MessagesSquare className="h-5 w-5 text-muted-foreground" />
          </div>

          <div className="text-sm font-medium">
            No conversations yet
          </div>

          <p className="max-w-xs text-xs text-muted-foreground">
            Start a new one to begin.
          </p>

          <button
            onClick={() => create.mutate()}
            className="btn-primary mt-2 h-10 px-4"
          >
            <Plus className="h-4 w-4" />
            Start chat
          </button>
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
          {filtered.map((conversation) => (
            <li
              key={conversation.id}
              className="flex items-center gap-2 px-3 py-2.5 transition-colors hover:bg-muted"
            >
              <Link
                to="/chat/$conversationId"
                params={{
                  conversationId: conversation.id,
                }}
                className="flex min-w-0 flex-1 items-center gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] font-medium">
                    {conversation.title}
                  </div>

                  <div className="text-[11px] text-muted-foreground">
                    {formatDistanceToNow(
                      new Date(conversation.updated_at),
                      {
                        addSuffix: true,
                      }
                    )}
                  </div>
                </div>
              </Link>

              <button
                onClick={() => {
                  if (confirm("Delete this conversation?")) {
                    del.mutate(conversation.id);
                  }
                }}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
