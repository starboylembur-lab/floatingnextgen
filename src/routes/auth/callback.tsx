import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        navigate({ to: "/auth", replace: true });
        return;
      }

      if (session) {
        navigate({ to: "/home", replace: true });
      } else {
        supabase.auth.exchangeCodeForSession(window.location.href).then(({ error: exError }) => {
          if (exError) {
            navigate({ to: "/auth", replace: true });
          } else {
            navigate({ to: "/home", replace: true });
          }
        });
      }
    });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mb-4"></div>
      <p className="text-sm text-gray-400">Verifying your login...</p>
    </div>
  );
}
