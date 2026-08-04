import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { Logo, Wordmark } from "@/components/logo";
import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      {
        title: "Floating Space — Your next-generation intelligence assistant",
      },
      {
        name: "description",
        content:
          "Ultra-premium AI assistant combining GPT-class reasoning with Perplexity-style deep research.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        navigate({
          to: "/home",
          replace: true,
        });
        return;
      }

      setChecking(false);
    };

    checkSession();
  }, [navigate]);

  if (checking) {
    return (
      <div className="stars flex min-h-screen items-center justify-center bg-black">
        <Logo size={56} />
      </div>
    );
  }

  return (
    <div className="stars relative min-h-screen overflow-hidden bg-black text-white">
      <div className="relative z-10 mx-auto flex min-h-screen max-w-md flex-col px-6 pb-10 pt-16">
        <div className="flex items-center gap-3">
          <Logo size={40} />
          <div>
            <Wordmark className="text-lg" />
            <p className="text-xs text-gray-400">
              by ZNTech
            </p>
          </div>
        </div>

        <div className="mt-20 flex flex-1 flex-col items-center justify-center text-center">
          <Logo size={96} />

          <h1 className="mt-8 text-4xl font-bold">
            Ask anything.
          </h1>

          <p className="mt-4 max-w-sm text-gray-400">
            Research, reasoning, image generation and deep AI intelligence in
            one assistant.
          </p>
        </div>

        <div className="pb-10">
          <Link
            to="/auth"
            className="btn-primary flex h-12 w-full items-center justify-center gap-2"
          >
            Get Started
            <ArrowRight size={18} />
          </Link>
        </div>
      </div>
    </div>
  );
}
