import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  useEffect(() => {
    const processSession = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");

      if (code) {
        await supabase.auth.exchangeCodeForSession(code);
      }

      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        // Arahkan ke root utama (/) agar masuk ke area _authenticated
        window.location.href = "/";
      } else {
        window.location.href = "/auth";
      }
    };

    processSession();
  }, []);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mb-4"></div>
      <p className="text-sm text-gray-400">Authenticating...</p>
    </div>
  );
}
