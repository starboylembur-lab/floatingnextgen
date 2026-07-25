import logoAsset from "@/assets/floating-logo.jpeg.asset.json";

export function Logo({ size = 36, glow = true, className = "" }: { size?: number; glow?: boolean; className?: string }) {
  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-full ${className}`}
      style={{ width: size, height: size }}
    >
      <img
        src={logoAsset.url}
        alt="Floating Space"
        width={size}
        height={size}
        className="h-full w-full object-cover"
        draggable={false}
      />
      {glow && (
        <div
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{ boxShadow: "0 0 30px -4px oklch(0.72 0.2 295 / 0.6), inset 0 0 12px oklch(0.72 0.2 295 / 0.4)" }}
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