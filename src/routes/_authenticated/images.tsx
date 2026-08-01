import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { generateImage } from "@/lib/streams";
import { toast } from "sonner";
import { Download, Loader2, Sparkles, Wand2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/images")({
  head: () => ({ meta: [{ title: "Image Studio — Floating Space" }, { name: "description", content: "Generate ultra-realistic HD images with Floating Space." }] }),
  component: Images,
});

const STYLES = ["Photorealistic", "Cinematic", "Editorial", "Luxury brand", "Anime", "Concept design"] as const;
const RATIOS = [
  { k: "1:1", label: "Square" },
  { k: "3:4", label: "Portrait" },
  { k: "16:9", label: "Wide" },
] as const;

function Images() {
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState<(typeof STYLES)[number]>("Photorealistic");
  const [ratio, setRatio] = useState<(typeof RATIOS)[number]["k"]>("1:1");
  const [busy, setBusy] = useState(false);
  const [img, setImg] = useState<string | null>(null);
  const [isFinal, setIsFinal] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  async function generate() {
    if (!prompt.trim() || busy) return;
    setBusy(true); setImg(null); setIsFinal(false);
    const controller = new AbortController();
    abortRef.current = controller;
    const fullPrompt = `${prompt.trim()} — Style: ${style}, aspect ratio ${ratio}, ultra-high fidelity, professional composition.`;
    try {
      const { url } = await generateImage(fullPrompt, controller.signal);
      setImg(url);
      setIsFinal(true);
    } catch (e) {
      if ((e as Error).name !== "AbortError") toast.error((e as Error).message || "Failed");
    } finally { setBusy(false); }
  }

  function download() {
    if (!img) return;
    const a = document.createElement("a");
    a.href = img; a.download = `floatingai-${Date.now()}.png`; a.click();
  }

  const aspectClass = ratio === "1:1" ? "aspect-square" : ratio === "3:4" ? "aspect-[3/4]" : "aspect-video";

  return (
    <div className="flex flex-col gap-5 px-4 pb-8 pt-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Images</h1>
        <p className="mt-1 text-sm text-muted-foreground">Describe an image and generate it.</p>
      </div>

      <div className={`overflow-hidden rounded-xl border border-border ${aspectClass} grid place-items-center`}>
        {img ? (
          <img src={img} alt="Generated" className={`h-full w-full object-cover transition-all duration-500 ${isFinal ? "" : "blur-lg scale-105"}`} />
        ) : busy ? (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            <div className="text-xs">Rendering pixels…</div>
          </div>
        ) : (
          <div className="p-6 text-center text-xs text-muted-foreground">No image yet</div>
        )}
      </div>

      {img && isFinal && (
        <button onClick={download} className="btn-ghost h-11 w-full">
          <Download className="h-4 w-4" /> Download
        </button>
      )}

      <div className="flex flex-col gap-3 rounded-xl border border-border p-3">
        <textarea
          value={prompt} onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          placeholder="e.g. A luxury watch on obsidian, dramatic studio lighting…"
          className="w-full resize-none bg-transparent px-2 py-1 text-[14px] outline-none placeholder:text-muted-foreground"
        />
        <div>
          <div className="mb-1.5 text-xs text-muted-foreground">Style</div>
          <div className="flex flex-wrap gap-1.5">
            {STYLES.map((s) => (
              <button key={s} onClick={() => setStyle(s)} className={`rounded-lg border border-border px-3 py-1.5 text-[12px] ${style === s ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{s}</button>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-1.5 text-xs text-muted-foreground">Aspect ratio</div>
          <div className="flex gap-1.5">
            {RATIOS.map((r) => (
              <button key={r.k} onClick={() => setRatio(r.k)} className={`flex-1 rounded-lg border border-border px-3 py-1.5 text-[12px] ${ratio === r.k ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{r.k}</button>
            ))}
          </div>
        </div>
        <button onClick={generate} disabled={!prompt.trim() || busy} className="btn-primary h-11 justify-center">
          {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</> : "Generate image"}
        </button>
      </div>
    </div>
  );
}// touch
