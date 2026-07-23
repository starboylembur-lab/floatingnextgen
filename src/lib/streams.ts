// Lightweight SSE parser for the OpenAI-compatible chat/completions and
// Lovable image streams. No external dependencies.

export type ChatDelta = string;

export async function streamChat(
  endpoint: string,
  body: unknown,
  onDelta: (chunk: ChatDelta) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) throw new Error((await res.text().catch(() => "")) || `HTTP ${res.status}`);
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
        } catch { /* ignore */ }
      }
    }
  } finally { reader.cancel().catch(() => {}); }
}

export type ImgFrame = { dataUrl: string; isFinal: boolean };

export async function streamImage(
  endpoint: string,
  body: unknown,
  onFrame: (f: ImgFrame) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) throw new Error((await res.text().catch(() => "")) || `HTTP ${res.status}`);
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buf = "";
  let event = "";
  let sawCompleted = false;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += value;
      let idx;
      while ((idx = buf.indexOf("\n")) !== -1) {
        const line = buf.slice(0, idx).replace(/\r$/, "");
        buf = buf.slice(idx + 1);
        if (line === "") { event = ""; continue; }
        if (line.startsWith("event:")) { event = line.slice(6).trim(); continue; }
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (data === "[DONE]") continue;
        let payload: any; try { payload = JSON.parse(data); } catch { continue; }
        const type = event || payload?.type;
        if (type === "error" || payload?.type === "error") {
          throw new Error(payload?.error?.message || "Image generation failed");
        }
        if (type === "image_generation.partial_image" || type === "image_generation.completed") {
          const b64 = payload?.b64_json;
          if (!b64) continue;
          const isFinal = type === "image_generation.completed";
          onFrame({ dataUrl: `data:image/png;base64,${b64}`, isFinal });
          if (isFinal) sawCompleted = true;
        }
      }
    }
  } finally { reader.cancel().catch(() => {}); }
  if (!sawCompleted) throw new Error("Image stream ended without a completed event");
}