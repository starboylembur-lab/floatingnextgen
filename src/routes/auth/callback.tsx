import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth/callback")({
  ssr: false,
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const [message, setMessage] = useState("Authenticating...");

  useEffect(() => {
    let done = false;

    const finish = (path: string) => {
      if (done) return;
      done = true;
      window.history.replaceState({}, "", "/auth/callback");
      window.location.replace(path);
    };

    // Any session that arrives while we're on this page wins.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) finish("/home");
    });

    const run = async () => {
      try {
        const url = new URL(window.location.href);
        const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
        const errorDescription =
          url.searchParams.get("error_description") ?? hash.get("error_description");

        if (errorDescription) {
          setMessage(errorDescription);
          setTimeout(() => finish("/auth"), 1500);
          return;
        }

        // 1. Implicit flow: tokens delivered in the URL hash.
        const access_token = hash.get("access_token");
        const refresh_token = hash.get("refresh_token");
        if (access_token && refresh_token) {
          await supabase.auth.setSession({ access_token, refresh_token });
        }

        // 2. PKCE flow: ?code= must be exchanged for a session.
        const code = url.searchParams.get("code");
        if (code) {
          await supabase.auth.exchangeCodeForSession(window.location.href);
        }

        // 3. Whatever path we came through, confirm the session exists.
        const {
          data: { session },
        } = await supabase.auth.getSession();

        finish(session ? "/home" : "/auth");
      } catch (err) {
        console.error("[auth/callback]", err);
        const {
          data: { session },
        } = await supabase.auth.getSession();
        finish(session ? "/home" : "/auth");
      }
    };

    void run();

    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mb-4"></div>
      <p className="text-sm text-gray-400">{message}</p>
    </div>
  );
}
