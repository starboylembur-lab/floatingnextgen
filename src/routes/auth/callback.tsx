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

    const { data: sub } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        console.log("Auth event:", _event);
        console.log("Auth session:", session);

        if (session) {
          finish("/home");
        }
      }
    );

    const run = async () => {
      try {
        const url = new URL(window.location.href);
        const hash = new URLSearchParams(
          url.hash.replace(/^#/, "")
        );

        const errorDescription =
          url.searchParams.get("error_description") ??
          hash.get("error_description");

        if (errorDescription) {
          setMessage(errorDescription);
          setTimeout(() => finish("/auth"), 1500);
          return;
        }

        // Consume OAuth tokens
        const authed = await consumeAuthFromUrl();

        console.log("authed =", authed);

        const {
          data: { session },
        } = await supabase.auth.getSession();

        console.log("session =", session);

        if (authed && session) {
          finish("/home");
          return;
        }

        setTimeout(async () => {
          const retry = await supabase.auth.getSession();

          console.log(
            "retry session =",
            retry.data.session
          );

          finish(
            retry.data.session ? "/home" : "/auth"
          );
        }, 1000);
      } catch (err) {
        console.error("[auth/callback]", err);

        const {
          data: { session },
        } = await supabase.auth.getSession();

        console.log("catch session =", session);

        finish(session ? "/home" : "/auth");
      }
    };

    void run();

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mb-4"></div>
      <p className="text-sm text-gray-400">
        {message}
      </p>
    </div>
  );
}
