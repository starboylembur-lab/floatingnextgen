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

export const Route = createFileRoute("/_authenticated")({
  ssr: false,

  beforeLoad: async () => {
    // Jika baru selesai OAuth, konsumsi token dari URL
    if (hasAuthArtifactsInUrl()) {
      await consumeAuthFromUrl();
    }

    // Beri waktu Supabase menyimpan session ke localStorage
    await new Promise((resolve) => setTimeout(resolve, 500));

    let {
      data: { session },
    } = await supabase.auth.getSession();

    // Retry sekali jika session belum tersedia
    if (!session) {
      await new Promise((resolve) => setTimeout(resolve, 500));

      const retry = await supabase.auth.getSession();
      session = retry.data.session;
    }

    // Jika masih tidak ada session, kembali ke auth
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
