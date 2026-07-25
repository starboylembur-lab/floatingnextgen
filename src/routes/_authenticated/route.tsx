import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/bottom-nav";
import { DesktopSidebar } from "@/components/desktop-sidebar";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  return (
    <div className="stars relative min-h-screen">
      <div className="relative z-10 flex min-h-screen">
        <DesktopSidebar />
        <main className="min-w-0 flex-1">
          <div className="mx-auto w-full max-w-md pb-28 safe-top md:max-w-4xl md:pb-4">
            <Outlet />
          </div>
        </main>
      </div>
      <div className="mobile-only">
        <BottomNav />
      </div>
    </div>
  );
}