import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Toaster } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { initializeAuth } from "@/lib/auth-session";
import { Logo } from "@/components/logo";

export const Route =
  createRootRouteWithContext<{
    queryClient: QueryClient;
  }>()({
    component: RootComponent,
});

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    initializeAuth().finally(() => {
      if (mounted) setReady(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (
        event === "SIGNED_IN" ||
        event === "TOKEN_REFRESHED" ||
        event === "USER_UPDATED"
      ) {
        queryClient.invalidateQueries();
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [queryClient]);

  if (!ready) {
    return (
      <div className="stars flex min-h-screen items-center justify-center bg-black">
        <Logo size={56} />
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster
        theme="dark"
        richColors
        position="top-center"
      />
    </QueryClientProvider>
  );
}
