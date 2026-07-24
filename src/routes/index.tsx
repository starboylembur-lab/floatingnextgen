import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Logo, Wordmark } from "@/components/logo";
import { ArrowRight, Sparkles, Zap, Brain } from "lucide-react";

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
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/home", replace: true });
      else setReady(true);
    });
  }, [navigate]);
  if (!ready) {
    return (
      <div className="stars flex min-h-screen items-center justify-center">
        <div className="animate-pulse-glow"><Logo size={56} /></div>
      </div>
    );
  }
  return (
    <div className="stars relative min-h-screen overflow-hidden">
      <div className="relative z-10 mx-auto flex min-h-screen max-w-md flex-col px-6 pb-10 pt-16 safe-top">
        <div className="flex items-center gap-3 animate-float-in">
          <Logo size={40} />
          <div>
            <Wordmark className="text-lg" />
            <p className="text-[11px] text-muted-foreground">by HanStack · HanStack</p>
          </div>
        </div>

        <div className="mt-16 flex flex-1 flex-col items-center text-center">
          <div className="animate-float-in" style={{ animationDelay: "80ms" }}>
            <Logo size={128} />
          </div>
          <h1 className="mt-8 text-4xl font-semibold leading-[1.05] tracking-tight text-gradient animate-float-in" style={{ animationDelay: "160ms" }}>
            Intelligence,<br />elegantly infinite.
          </h1>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground animate-float-in" style={{ animationDelay: "240ms" }}>
            Floating Space blends deep research, expert reasoning, and generative
            creativity into a single, weightless surface.
          </p>

          <div className="mt-10 grid w-full grid-cols-3 gap-2 animate-float-in" style={{ animationDelay: "320ms" }}>
            {[
              { i: Brain, t: "Reasoning" },
              { i: Sparkles, t: "Research" },
              { i: Zap, t: "Creation" },
            ].map(({ i: I, t }) => (
              <div key={t} className="glass rounded-2xl p-3 text-center">
                <I className="mx-auto h-4 w-4 text-primary" />
                <div className="mt-1.5 text-[11px] text-muted-foreground">{t}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3 animate-float-in" style={{ animationDelay: "400ms" }}>
          <Link to="/auth" className="btn-primary h-12 text-[15px]">
            Enter Floating Space <ArrowRight className="h-4 w-4" />
          </Link>
          <p className="text-center text-[11px] text-muted-foreground">
            2-day premium trial · unlocked on sign-in
          </p>
        </div>
      </div>
    </div>
  );
}
