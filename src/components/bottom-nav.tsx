import { Link, useRouterState } from "@tanstack/react-router";
import { MessagesSquare, Image as ImageIcon, User } from "lucide-react";

const items = [
  { to: "/chat", label: "Chat", icon: MessagesSquare },
  { to: "/images", label: "Images", icon: ImageIcon },
  { to: "/profile", label: "Profile", icon: User },
] as const;

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background safe-bottom">
      <div className="mx-auto flex max-w-md items-stretch">
        {items.map((it) => {
          const active = pathname === it.to || pathname.startsWith(`${it.to}/`);
          const Icon = it.icon;
          return (
            <Link
              key={it.to}
              to={it.to}
              className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] transition-colors ${active ? "text-foreground" : "text-muted-foreground"}`}
            >
              <Icon className="h-5 w-5" strokeWidth={1.75} />
              <span>{it.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
