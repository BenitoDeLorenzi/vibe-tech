"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LoaderCircle, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function MobileLiveSearch({ placeholder }: { placeholder: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = params.get("q") ?? "";
  const [value, setValue] = useState(current);
  const [submittedQuery, setSubmittedQuery] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searching = submittedQuery !== null && submittedQuery !== current;

  useEffect(() => {
    if (document.activeElement === inputRef.current) return;
    const timer = window.setTimeout(() => setValue(current), 0);
    return () => window.clearTimeout(timer);
  }, [current]);

  useEffect(() => {
    if (value.trim() === current) return;
    const timer = window.setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      const query = value.trim();
      setSubmittedQuery(query);
      if (query) next.set("q", query);
      else next.delete("q");
      next.delete("page");
      router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [current, params, pathname, router, value]);

  return <div className="shrink-0 border-b bg-background px-4 py-2.5 md:hidden">
    <div className="relative">
      {searching ? <LoaderCircle aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" /> : <Search aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />}
      <Input ref={inputRef} aria-label={placeholder} value={value} onChange={event => { setSubmittedQuery(null); setValue(event.target.value); }} placeholder={placeholder} className="h-9 w-full bg-background pl-9 pr-9" />
      {value && <Button type="button" variant="ghost" size="icon-sm" aria-label="Limpar busca" onClick={() => { setSubmittedQuery(null); setValue(""); }} className="absolute right-1 top-1/2 -translate-y-1/2"><X className="size-3.5" /></Button>}
      <span className="sr-only" role="status">{searching ? "Buscando resultados…" : ""}</span>
    </div>
  </div>;
}
