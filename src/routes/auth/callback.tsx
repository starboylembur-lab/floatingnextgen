import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    // Tangani parameter kode otorisasi dari URL secara langsung
    const handleAuthCallback = async () => {
      const hash = window.location.hash;
      const searchParams = new URLSearchParams(window.location.search);
      const code = searchParams.get("code");

      if (code) {
        await supabase.auth.exchangeCodeForSession(code);
      } else if (hash && hash.includes("access_token")) {
        // Jika token dikembalikan via hash
        await supabase.auth.getSession();
      }

      // Periksa apakah sesi sudah aktif
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        navigate({ to: "/home", replace: true });
      } else {
        // Jika masih gagal, kembalikan ke halaman login
        navigate({ to: "/auth", replace: true });
      }
    };

    handleAuthCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mb-4"></div>
      <p className="text-sm text-gray-400">Completing login...</p>
    </div>
  );
}
