import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { consumeAuthFromUrl, hasAuthArtifactsInUrl } from "@/lib/auth-session";
import { BottomNav } from "@/components/bottom-nav";
import { DesktopSidebar } from "@/components/desktop-sidebar";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // If we just came back from OAuth, finish establishing the session first
    // so we never bounce an authenticating user back to /auth.
    if (hasAuthArtifactsInUrl()) {
      await consumeAuthFromUrl();
    }
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      // Retry once: the client may still be hydrating its persisted session.
      const { data: retry } = await supabase.auth.getSession();
      if (!retry.session?.user) throw redirect({ to: "/auth" });
      return { user: retry.session.user };
    }
    return { user: data.user };
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  return (
    <div className="min-h-screen">
      <div className="flex min-h-screen">
        <DesktopSidebar />
        <main className="min-w-0 flex-1">
          <div className="mx-auto w-full max-w-md pb-24 safe-top md:max-w-3xl md:pb-4">
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
