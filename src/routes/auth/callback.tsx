import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { consumeAuthFromUrl } from "@/lib/auth-session";

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

        // Handles both the hash (#access_token) and PKCE (?code=) flows.
        const authed = await consumeAuthFromUrl();
        if (authed) {
          finish("/home");
          return;
        }
        // Give Supabase a brief moment to hydrate/emit before giving up.
        setTimeout(async () => {
          const { data } = await supabase.auth.getSession();
          finish(data.session ? "/home" : "/auth");
        }, 800);
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
