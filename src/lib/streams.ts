// Client transport for AI requests.
// Every AI call goes: client → Supabase Edge Function "chat" → OpenRouter.
import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
const CHAT_FN_URL = `${SUPABASE_URL}/functions/v1/chat`;

async function edgeFetch(body: unknown, signal?: AbortSignal): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("You need to be signed in.");
  const res = await fetch(CHAT_FN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let message = text || `HTTP ${res.status}`;
    try {
      const parsed = JSON.parse(text);
      if (parsed?.error) message = parsed.error;
    } catch { /* keep raw text */ }
    throw new Error(message);
  }
  return res;
}

export type ChatDelta = string;

export type ChatRequest = {
  mode?: "basic" | "standard" | "deep";
  messages: { role: "user" | "assistant" | "system"; content: string }[];
  passages?: { name: string; content: string; chunk_index: number }[];
};

export async function streamChat(
  body: ChatRequest,
  onDelta: (chunk: ChatDelta) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await edgeFetch({ kind: "chat", ...body }, signal);
  if (!res.body) throw new Error("Empty response");
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buf = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += value;
      let idx;
      while ((idx = buf.indexOf("\n")) !== -1) {
        const line = buf.slice(0, idx).replace(/\r$/, "");
        buf = buf.slice(idx + 1);
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (data === "[DONE]") return;
        try {
          const j = JSON.parse(data);
          const delta = j.choices?.[0]?.delta?.content ?? j.choices?.[0]?.message?.content ?? "";
          if (delta) onDelta(delta);
        } catch { /* ignore keep-alive comments */ }
      }
    }
  } finally {
    reader.cancel().catch(() => {});
  }
}

export type GeneratedImage = { url: string; path: string | null; expiresIn: number };

// Generates an image and returns a 24h signed URL from the `generated-images` bucket.
export async function generateImage(prompt: string, signal?: AbortSignal): Promise<GeneratedImage> {
  const res = await edgeFetch({ kind: "image", prompt }, signal);
  return (await res.json()) as GeneratedImage;
}
