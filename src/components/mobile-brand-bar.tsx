import Image from "next/image";

export function MobileBrandBar({ section }: { section: "Painel" | "Frotas" | "Gestão" }) {
  const background = section === "Frotas"
    ? "bg-[linear-gradient(105deg,#0b2447_0%,#174a8b_55%,#12658d_100%)]"
    : section === "Gestão"
      ? "bg-[linear-gradient(105deg,#103d2b_0%,#176b50_55%,#287a57_100%)]"
      : "bg-[linear-gradient(105deg,#07143b_0%,#0a3291_55%,#14104d_100%)]";
  return <div className={`relative isolate flex h-11 shrink-0 items-center justify-center gap-2.5 overflow-hidden border-b border-white/10 px-4 text-white md:hidden print:hidden ${background}`}>
    <span aria-hidden="true" className={`pointer-events-none absolute -right-6 -top-8 size-28 rounded-full blur-2xl ${section === "Gestão" ? "bg-lime-200/20" : "bg-cyan-400/20"}`} />
    <span aria-hidden="true" className={`pointer-events-none absolute -bottom-10 left-1/3 size-24 rounded-full blur-2xl ${section === "Frotas" ? "bg-sky-300/20" : section === "Gestão" ? "bg-emerald-200/20" : "bg-violet-500/20"}`} />
    <Image src="/brand/vibe-tech-icon.png" alt="" width={28} height={28} className="relative size-7 rounded-lg object-contain shadow-sm" />
    <span className="relative text-sm font-semibold tracking-wide">Vibe Tech <span className="font-normal text-white/55">·</span> {section}</span>
  </div>;
}
