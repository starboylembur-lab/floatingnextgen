import logoAsset from "@/assets/floating-mark.jpg.asset.json";

export function Logo({ size = 36, glow = true, className = "" }: { size?: number; glow?: boolean; className?: string }) {
  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-2xl bg-[oklch(0_0_0)] ${className}`}
      style={{ width: size, height: size }}
    >
      <img
        src={logoAsset.url}
        alt="Floating Space"
        width={size}
        height={size}
        className="h-full w-full object-contain"
        draggable={false}
      />
      {glow && (
        <div
          className="pointer-events-none absolute inset-0 rounded-2xl"
          style={{ boxShadow: "0 0 28px -6px oklch(1 0 0 / 0.45), inset 0 0 0 1px oklch(1 0 0 / 0.12)" }}
        />
      )}
    </div>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`text-gradient font-semibold tracking-[0.02em] ${className}`}
      style={{ fontFamily: "var(--font-display)" }}
    >
      Floating Space
    </span>
  );
}