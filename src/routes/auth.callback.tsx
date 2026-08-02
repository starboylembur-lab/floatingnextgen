import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/logo";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        navigate({ to: "/home", replace: true });
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        navigate({ to: "/home", replace: true });
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  return (
    <div className="stars flex min-h-screen items-center justify-center bg-black text-white">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-pulse">
          <Logo size={64} />
        </div>
        <p className="text-sm text-gray-400">Authenticating, please wait...</p>
      </div>
    </div>
  );
}
