import logoAsset from "@/assets/floating-mark.jpg.asset.json";

export function Logo({ size = 32, className = "" }: { size?: number; glow?: boolean; className?: string }) {
  return (
    <div
      className={`shrink-0 overflow-hidden rounded-lg bg-black ${className}`}
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
    </div>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return <span className={`font-medium tracking-tight ${className}`}>Floating Space</span>;
}
