import {
  createFileRoute,
  Outlet,
  redirect,
} from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";

import {
  consumeAuthFromUrl,
  hasAuthArtifactsInUrl,
} from "@/lib/auth-session";

import { BottomNav } from "@/components/bottom-nav";
import { DesktopSidebar } from "@/components/desktop-sidebar";

export const Route =
  createFileRoute("/_authenticated")({
    ssr: false,

    beforeLoad: async () => {

      if (hasAuthArtifactsInUrl()) {
        await consumeAuthFromUrl();
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw redirect({
          to: "/auth",
        });
      }

      return {
        session,
      };
    },

    component: Layout,
  });

function Layout() {
  return (
    <div className="min-h-screen">

      <div className="flex min-h-screen">

        <DesktopSidebar />

        <main className="flex-1 min-w-0">

          <div className="mx-auto max-w-md md:max-w-3xl pb-24 md:pb-6">

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
