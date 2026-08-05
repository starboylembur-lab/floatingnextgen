// Client transport for AI requests.
// Every AI call goes: client → Supabase Edge Function "ai-chat" → OpenRouter.

import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

// Edge Function
const CHAT_FN_URL = `${SUPABASE_URL}/functions/v1/ai-chat`;

const REQUEST_TIMEOUT_MS = 30_000;

/** Combines the caller signal with a 30s timeout. */
function withTimeout(signal?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  return signal
    ? AbortSignal.any([signal, timeout])
    : timeout;
}

async function edgeFetch(
  body: unknown,
  signal?: AbortSignal
): Promise<Response> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const token = session?.access_token;

  if (!token) {
    throw new Error("You need to be signed in.");
  }

  const res = await fetch(CHAT_FN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
    signal: withTimeout(signal),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let message = text || `HTTP ${res.status}`;

    try {
      const parsed = JSON.parse(text);

      if (parsed?.error) {
        message = parsed.error;
      }
    } catch {}

    throw new Error(message);
  }

  return res;
}

export type ChatDelta = string;

export type ChatRequest = {
  mode?: "basic" | "standard" | "deep";
  messages: {
    role: "user" | "assistant" | "system";
    content: string;
  }[];
  passages?: {
    name: string;
    content: string;
    chunk_index: number;
  }[];
};

export async function streamChat(
  body: ChatRequest,
  onDelta: (chunk: ChatDelta) => void,
  signal?: AbortSignal
): Promise<void> {
  const res = await edgeFetch(
    {
      kind: "chat",
      ...body,
    },
    signal
  );

  if (!res.body) {
    throw new Error("Empty response");
  }

  const reader = res.body
    .pipeThrough(new TextDecoderStream())
    .getReader();

  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();

      if (done) break;

      buffer += value;

      let index;

      while ((index = buffer.indexOf("\n")) !== -1) {
        const line = buffer
          .slice(0, index)
          .replace(/\r$/, "");

        buffer = buffer.slice(index + 1);

        if (!line.startsWith("data:")) continue;

        const data = line.slice(5).trim();

        if (data === "[DONE]") {
          return;
        }

        try {
          const json = JSON.parse(data);

          const delta =
            json.choices?.[0]?.delta?.content ??
            json.choices?.[0]?.message?.content ??
            "";

          if (delta) {
            onDelta(delta);
          }
        } catch {
          // ignore keep-alive
        }
      }
    }
  } finally {
    reader.cancel().catch(() => {});
  }
}

export type GeneratedImage = {
  url: string;
  path: string | null;
  expiresIn: number;
};

const imageCache = new Map<string, GeneratedImage>();
const imageInFlight = new Map<
  string,
  Promise<GeneratedImage>
>();

export async function generateImage(
  prompt: string,
  signal?: AbortSignal
): Promise<GeneratedImage> {
  const key = prompt.trim();

  const cached = imageCache.get(key);

  if (cached) {
    return cached;
  }

  const pending = imageInFlight.get(key);

  if (pending) {
    return pending;
  }

  const request = (async () => {
    const res = await edgeFetch(
      {
        kind: "image",
        prompt: key,
      },
      signal
    );

    const result =
      (await res.json()) as GeneratedImage;

    imageCache.set(key, result);

    return result;
  })().finally(() => {
    imageInFlight.delete(key);
  });

  imageInFlight.set(key, request);

  return request;
    }
