export function CapacityMeter({ stats }: { stats?: { capacity: number; capacity_max: number } | null }) {
  const cur = stats?.capacity ?? 0;
  const max = stats?.capacity_max ?? 1000;
  const pct = Math.max(0, Math.min(100, (cur / Math.max(1, max)) * 100));
  return (
    <div className="rounded-xl border border-border p-4">
      <div className="mb-2 flex items-center justify-between text-[13px]">
        <span>AI capacity</span>
        <span className="font-mono text-xs text-muted-foreground">{cur}/{max}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-foreground transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
