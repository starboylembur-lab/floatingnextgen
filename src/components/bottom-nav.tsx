import { Link, useRouterState } from "@tanstack/react-router";
import { Home, MessagesSquare, Sparkles, Image as ImageIcon, Crown } from "lucide-react";

const items = [
  { to: "/home", label: "Home", icon: Home },
  { to: "/chat", label: "Chat", icon: MessagesSquare },
  { to: "/research", label: "Research", icon: Sparkles },
  { to: "/images", label: "Images", icon: ImageIcon },
  { to: "/premium", label: "Premium", icon: Crown },
] as const;

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 safe-bottom">
      <div className="mx-auto max-w-md px-3 pb-2">
        <div className="glass-strong flex items-center justify-between rounded-full px-2 py-2 shadow-2xl">
          {items.map((it) => {
            const active =
              pathname === it.to ||
              (it.to === "/chat" && pathname.startsWith("/chat"));
            const Icon = it.icon;
            return (
              <Link
                key={it.to}
                to={it.to}
                className={`group flex flex-1 flex-col items-center gap-1 py-1.5 text-[10px] font-medium tracking-wide transition-colors ${active ? "nav-active" : "text-muted-foreground"}`}
              >
                <span
                  className={`nav-icon-wrap flex h-9 w-9 items-center justify-center rounded-full transition-transform ${active ? "" : "group-active:scale-95"}`}
                >
                  <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
                </span>
                <span>{it.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}