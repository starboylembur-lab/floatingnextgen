// Floating Space — Production V2 unified AI edge function.
// Client → this function → OpenRouter.
// The API key is read ONLY from the OPENROUTER_API_KEY environment variable.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Max-Age": "86400",
};

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

// --- AI configuration (Production V2) ---
const PRIMARY_MODEL = "google/gemini-2.5-flash";
const DEEP_MODEL = "google/gemini-2.5-pro";
const IMAGE_MODEL = "google/gemini-3.1-flash-image";

const FAST_MODELS = [PRIMARY_MODEL];
const CHAT_MODELS = [PRIMARY_MODEL];
const DEEP_MODELS = [DEEP_MODEL, PRIMARY_MODEL];
const IMAGE_MODELS = [IMAGE_MODEL];

const MAX_TOKENS_CAP = 4096;
const GEN = {
  temperature: 0.2,
  top_p: 0.9,
  max_tokens: Math.min(1024, MAX_TOKENS_CAP),
};
// Only the most recent turns are forwarded, to minimise tokens and latency.
const MAX_HISTORY_MESSAGES = 12;
const REQUEST_TIMEOUT_MS = 30_000;

const SYS: Record<string, string> = {
  basic:
    "You are Floating Space, a fast, precise AI assistant created by HanStack. Answer concisely and clearly in the user's language.",
  standard:
    "You are Floating Space, a next-generation AI assistant created by HanStack. Provide clear, structured, expert answers with markdown headings, bullets, tables and code blocks where helpful.",
  deep:
    "You are Floating Space in DEEP RESEARCH mode — think like a senior analyst blending advanced reasoning with Perplexity-style investigation. Produce comprehensive, structured research: executive summary, key findings, detailed analysis with subsections, tables where useful, considerations/risks, and a short conclusion. Cite reasoning inline as [n] where appropriate. Use markdown headings and be thorough.",
};

type Msg = { role: "user" | "assistant" | "system"; content: string };
type Passage = { name: string; content: string; chunk_index: number };

const ACCURACY_RULES =
  "\n\nRules: never hallucinate or invent facts; if uncertain, say so explicitly. Always answer in the user's language. " +
  "Prefer concise responses and Markdown formatting. Verify calculations before answering. Produce production-ready code. " +
  "Rely on recent/live knowledge only for news, weather, sports, prices, regulations or recent software updates — not for timeless knowledge. " +
  "Your reply is capped at roughly 1024 tokens: if the full answer would exceed that, summarise first and ask the user whether to continue.";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Upstream failure we surface verbatim to the client. */
class UpstreamError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function messageForStatus(status: number, raw: string): string {
  switch (status) {
    case 401:
      return "The AI provider rejected the API key (401). Please check that OPENROUTER_API_KEY is valid.";
    case 402:
      return "The OpenRouter account has insufficient credits or reached its spending limit (402). Check your OpenRouter balance or the API key's spending limit, then try again.";
    case 429:
      return "Too many requests right now (429). Please wait a moment and try again.";
    case 500:
      return "The AI provider had an internal error (500). Please try again.";
    case 503:
      return "The AI provider is temporarily unavailable (503). Please try again shortly.";
    default:
      return raw ? `AI provider error (${status}): ${raw.slice(0, 200)}` : `AI provider error (${status}).`;
  }
}

/** The key must exist and look like an OpenRouter key before we spend a round-trip. */
function validateApiKey(key: string | undefined): key is string {
  return typeof key === "string" && key.trim().length > 20 && key.trim().startsWith("sk-or-");
}

async function callOpenRouter(
  apiKey: string,
  payload: Record<string, unknown>,
  models: string[],
): Promise<Response> {
  let lastError = new UpstreamError(502, "No model responded");
  for (const model of models) {
    // One retry per model, only for transient failures.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(OPENROUTER_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://floatingnextgen.lovable.app",
            "X-Title": "Floating Space",
          },
          body: JSON.stringify({ ...payload, model }),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
        if (res.ok) return res;
        const text = await res.text().catch(() => "");
        console.error(`[chat] upstream ${res.status} on ${model}: ${text.slice(0, 300)}`);
        lastError = new UpstreamError(res.status, messageForStatus(res.status, text));
        // 401/402 are terminal — never retry, never try another model.
        if (res.status === 401 || res.status === 402) throw lastError;
        if ((res.status === 429 || res.status >= 500) && attempt === 0) {
          await sleep(500);
          continue;
        }
        break;
      } catch (err) {
        if (err instanceof UpstreamError) throw err;
        const e = err as Error;
        const timedOut = e.name === "TimeoutError" || e.name === "AbortError";
        console.error(`[chat] ${timedOut ? "timeout" : "network error"} on ${model}: ${e.message}`);
        lastError = new UpstreamError(
          timedOut ? 504 : 502,
          timedOut
            ? "The AI provider timed out after 30 seconds. Please try again."
            : "Could not reach the AI provider. Please try again.",
        );
        if (attempt === 0) await sleep(500);
      }
    }
  }
  throw lastError;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const apiKey = Deno.env.get("OPENROUTER_API_KEY");
    if (!apiKey) return json({ error: "Server is missing OPENROUTER_API_KEY" }, 500);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // --- Authenticate the caller with their Supabase JWT ---
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const authed = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: userData, error: authError } = await authed.auth.getUser();
    if (authError || !userData?.user) return json({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;

    const body = await req.json();
    const kind: "chat" | "image" = body?.kind === "image" ? "image" : "chat";

    // ---------------- Image generation ----------------
    if (kind === "image") {
      const prompt: string = String(body?.prompt ?? "").trim();
      if (!prompt) return json({ error: "prompt required" }, 400);

      const res = await callOpenRouter(
        apiKey,
        { messages: [{ role: "user", content: prompt }], modalities: ["image", "text"] },
        IMAGE_MODELS,
      );
      const payload = await res.json();
      const message = payload?.choices?.[0]?.message ?? {};
      const dataUrl: string | undefined =
        message?.images?.[0]?.image_url?.url ?? message?.images?.[0]?.url;
      if (!dataUrl || !dataUrl.startsWith("data:")) {
        console.error("[chat] image response had no image", JSON.stringify(payload).slice(0, 500));
        return json({ error: "The image model did not return an image. Please try again." }, 502);
      }

      const [meta, b64] = dataUrl.split(",");
      const contentType = meta.slice(5).split(";")[0] || "image/png";
      const ext = contentType.includes("jpeg") ? "jpg" : contentType.includes("webp") ? "webp" : "png";
      const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

      const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
      const path = `${userId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await admin.storage
        .from("generated-images")
        .upload(path, bin, { contentType, upsert: false });
      if (upErr) {
        console.error("[chat] storage upload failed", upErr.message);
        return json({ url: dataUrl, path: null, expiresIn: 0 });
      }
      const { data: signed, error: signErr } = await admin.storage
        .from("generated-images")
        .createSignedUrl(path, 60 * 60 * 24);
      if (signErr || !signed) {
        console.error("[chat] signed url failed", signErr?.message);
        return json({ url: dataUrl, path, expiresIn: 0 });
      }
      return json({ url: signed.signedUrl, path, expiresIn: 60 * 60 * 24 });
    }

    // ---------------- Chat completion (streaming) ----------------
    const messages: Msg[] = Array.isArray(body?.messages) ? body.messages : [];
    if (messages.length === 0) return json({ error: "messages required" }, 400);
    const mode: "basic" | "standard" | "deep" =
      body?.mode === "basic" || body?.mode === "deep" ? body.mode : "standard";
    const passages: Passage[] = Array.isArray(body?.passages) ? body.passages : [];

    const contextMsg: Msg | null = passages.length
      ? {
          role: "system",
          content:
            "You have access to the following excerpts from the user's uploaded documents. " +
            "Use them as the primary source of truth when relevant, and cite them inline as [n] matching the numbering below. " +
            "If the answer is not in the excerpts, say so plainly.\n\n" +
            passages
              .map((p, i) => `[${i + 1}] Source: ${p.name} (chunk ${p.chunk_index})\n"""\n${p.content}\n"""`)
              .join("\n\n"),
        }
      : null;

    const models = mode === "deep" ? DEEP_MODELS : mode === "basic" ? FAST_MODELS : CHAT_MODELS;
    const upstream = await callOpenRouter(
      apiKey,
      {
        stream: true,
        messages: [
          { role: "system", content: SYS[mode] },
          ...(contextMsg ? [contextMsg] : []),
          ...messages,
        ],
      },
      models,
    );
    if (!upstream.body) return json({ error: "Empty upstream response" }, 502);

    return new Response(upstream.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err) {
    console.error("[chat] fatal", (err as Error).message);
    return json({ error: (err as Error).message || "Unexpected error" }, 500);
  }
});
