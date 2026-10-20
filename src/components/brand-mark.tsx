import Image from "next/image";

export function BrandMark({ className = "size-10" }: { className?: string }) {
  return (
    <Image
      src="/brand/vibe-tech-icon.png"
      alt="Vibe Tech"
      width={64}
      height={64}
      className={`${className} shrink-0 rounded-lg object-contain`}
      unoptimized
    />
  );
}

export function BrandLogo({ className = "w-64" }: { className?: string }) {
  return (
    <div className={`${className} max-w-full rounded-lg bg-[#0b101d] p-3`}>
      <Image
        src="/brand/vibe-tech-horizontal.png"
        alt="Vibe Tech — Soluções Tecnológicas"
        width={576}
        height={99}
        className="h-auto w-full object-contain"
        unoptimized
      />
    </div>
  );
}
