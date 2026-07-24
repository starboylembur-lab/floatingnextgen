import { createFileRoute } from "@tanstack/react-router";

type Msg = { role: "user" | "assistant" | "system"; content: string };
type Body = { messages: Msg[]; mode?: "basic" | "standard" | "deep" };

const SYS = {
  basic:
    "You are FloatingAI, a fast, precise AI assistant. Answer concisely and clearly in the user's language.",
  standard:
    "You are FloatingAI, a next-generation AI assistant created by Zehan Nurhafizh at HanStack. Provide clear, structured, expert answers with markdown headings, bullets, and code where helpful.",
  deep:
    "You are FloatingAI in DEEP RESEARCH mode — think like a senior analyst blending GPT-class reasoning with Perplexity-style investigation. Produce comprehensive, structured research: executive summary, key findings, detailed analysis with subsections, tables where useful, considerations/risks, and a short conclusion. Cite reasoning inline as [n] where appropriate. Use markdown headings and be thorough.",
};

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { messages, mode = "standard" } = (await request.json()) as Body;
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });
        if (!Array.isArray(messages)) return new Response("messages required", { status: 400 });

        const upstream = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model:
              mode === "deep"
                ? "google/gemini-3.6-flash"
                : mode === "standard"
                  ? "google/gemini-3.6-flash"
                  : "google/gemini-3.1-flash-lite",
            stream: true,
            messages: [{ role: "system", content: SYS[mode] }, ...messages],
          }),
        });
        if (!upstream.ok || !upstream.body) {
          const text = await upstream.text().catch(() => "");
          return new Response(text || "Upstream error", { status: upstream.status });
        }
        return new Response(upstream.body, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
          },
        });
      },
    },
  },
});