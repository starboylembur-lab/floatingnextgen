// Floating Space — unified AI edge function.
// Client → this function → OpenRouter (free models only).
// Never hardcodes keys; everything comes from Supabase secrets.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Max-Age": "86400",
};

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

// Free models, tried in priority order.
const CHAT_MODELS = [
  "openai/gpt-oss-20b:free",
  "openai/gpt-oss-120b:free",
  "google/gemma-3-27b-it:free",
  "meta-llama/llama-3.3-8b-instruct:free",
];
const FAST_MODELS = [
  "meta-llama/llama-3.3-8b-instruct:free",
  "openai/gpt-oss-20b:free",
  "google/gemma-3-27b-it:free",
];
const DEEP_MODELS = [
  "openai/gpt-oss-120b:free",
  "openai/gpt-oss-20b:free",
  "google/gemma-3-27b-it:free",
  "meta-llama/llama-3.3-8b-instruct:free",
];
const IMAGE_MODELS = [
  "google/gemini-2.5-flash-image-preview:free",
  "google/gemini-2.0-flash-exp:free",
];

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

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function callOpenRouter(
  apiKey: string,
  payload: Record<string, unknown>,
  models: string[],
): Promise<Response> {
  let lastError = "No model responded";
  for (const model of models) {
    // Two attempts per model for transient failures.
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
        });
        if (res.ok) return res;
        const text = await res.text().catch(() => "");
        lastError = `${model} → ${res.status}: ${text.slice(0, 300)}`;
        console.error("[chat] upstream error", lastError);
        // Retry same model only on transient statuses; otherwise fall through to next model.
        if (res.status === 429 || res.status >= 500) {
          await sleep(400 * (attempt + 1));
          continue;
        }
        break;
      } catch (err) {
        lastError = `${model} → ${(err as Error).message}`;
        console.error("[chat] network error", lastError);
        await sleep(400 * (attempt + 1));
      }
    }
  }
  throw new Error(lastError);
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
