import { Battery, Zap } from "lucide-react";

export function CapacityMeter({ stats }: { stats?: { capacity: number; capacity_max: number } | null }) {
  const cur = stats?.capacity ?? 0;
  const max = stats?.capacity_max ?? 1000;
  const pct = Math.max(0, Math.min(100, (cur / Math.max(1, max)) * 100));
  return (
    <div className="glass rounded-2xl p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[13px] font-medium">
          <Battery className="h-4 w-4 text-primary" /> AI Capacity
        </div>
        <div className="font-mono text-xs text-muted-foreground">{cur}/{max}</div>
      </div>
      <div className="relative h-2.5 overflow-hidden rounded-full bg-white/5">
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-500"
          style={{
            width: `${pct}%`,
            background: "linear-gradient(90deg, oklch(0.78 0.18 295), oklch(0.78 0.14 220))",
            boxShadow: "0 0 16px oklch(0.72 0.2 295 / 0.6)",
          }}
        />
        <div className="absolute inset-0 animate-pulse-glow" style={{
          background: "linear-gradient(90deg, transparent, oklch(1 0 0 / 0.15), transparent)",
          transform: `translateX(${pct - 100}%)`,
          transition: "transform 700ms",
          width: "50%",
        }} />
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Zap className="h-3 w-3 text-primary" /> Your intelligence capacity grows with usage.
      </p>
    </div>
  );
}