import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Logo, Wordmark } from "@/components/logo";
import { ArrowRight } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Floating Space — Your next-generation intelligence assistant" },
      { name: "description", content: "Ultra-premium AI assistant combining GPT-class reasoning with Perplexity-style deep research. Built by HanStack." },
      { property: "og:title", content: "Floating Space — Your next-generation intelligence assistant" },
      { property: "og:description", content: "Ultra-premium AI assistant combining GPT-class reasoning with Perplexity-style deep research. Built by HanStack." },
    ],
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // 1. Cek session awal
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        navigate({ to: "/home", replace: true });
      } else {
        setReady(true);
      }
    });

    // 2. Tangkap event login dari Supabase (penting untuk callback OAuth)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
        navigate({ to: "/home", replace: true });
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  if (!ready) {
    return (
      <div className="stars flex min-h-screen items-center justify-center bg-black">
        <div className="animate-pulse-glow"><Logo size={56} /></div>
      </div>
    );
  }

  return (
    <div className="stars relative min-h-screen overflow-hidden bg-black text-white">
      <div className="relative z-10 mx-auto flex min-h-screen max-w-md flex-col px-6 pb-10 pt-16 safe-top">
        <div className="flex items-center gap-3 animate-float-in">
          <Logo size={40} />
          <div>
            <Wordmark className="text-lg" />
            <p className="text-[11px] text-muted-foreground">by HanStack</p>
          </div>
        </div>

        <div className="mt-16 flex flex-1 flex-col items-center text-center">
          <Logo size={96} />
          <h1 className="mt-8 text-3xl font-semibold leading-tight tracking-tight">
            Ask anything.
          </h1>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
            Research, reasoning and image generation in one simple assistant.
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-3">
          <Link to="/auth" className="btn-primary h-12 text-[15px]">
            Get started <ArrowRight className="h-4 w-4" />
          </Link>
          <p className="text-center text-[11px] text-muted-foreground">
            2-day premium trial · unlocked on sign-in
          </p>
        </div>
      </div>
    </div>
  );
}
