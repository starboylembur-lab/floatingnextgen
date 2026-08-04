import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { Logo, Wordmark } from "@/components/logo";
import { ArrowRight } from "lucide-react";

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
      { property: "og:title", content: "Floating Space — AI Assistant" },
      { property: "og:description", content: "Research, reason, and create with a premium AI assistant." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
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
