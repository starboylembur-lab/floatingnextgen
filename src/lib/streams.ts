// Client transport for AI requests.
// Every AI call goes: client → Supabase Edge Function "ai-chat".

import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

// Ganti dari "chat" menjadi "ai-chat"
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
