"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { resolveFleetMonth } from "@/lib/fleet-month";

const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export function FleetMonthPicker({ value, onValueChange }: { value: string; onValueChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(Number(value.slice(0, 4)) || new Date().getFullYear());

  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger render={<Button type="button" variant="outline" className="h-9 shrink-0 gap-2" aria-label="Filtrar por mês e ano" />}>
      <CalendarDays className="size-4" />{value ? `${months[Number(value.slice(5)) - 1]} / ${value.slice(0, 4)}` : "Todo período"}
    </PopoverTrigger>
    <PopoverContent align="start" className="w-72 p-3">
      <PopoverTitle>Mês e ano</PopoverTitle>
      <div className="mt-2 flex items-center justify-between">
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Ano anterior" onClick={() => setYear(year - 1)}><ChevronLeft className="size-4" /></Button>
        <span className="font-medium tabular-nums">{year}</span>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Próximo ano" onClick={() => setYear(year + 1)}><ChevronRight className="size-4" /></Button>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1">
        {months.map((label, index) => {
          const month = `${year}-${String(index + 1).padStart(2, "0")}`;
          return <Button key={month} type="button" variant={value === month ? "default" : "ghost"} size="sm" aria-pressed={value === month} onClick={() => { onValueChange(month); setOpen(false); }}>{label}</Button>;
        })}
      </div>
      {value && <Button type="button" variant="ghost" className="mt-2 w-full" onClick={() => { onValueChange(""); setOpen(false); }}>Todo período</Button>}
    </PopoverContent>
  </Popover>;
}

export function FleetMonthFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return <div className="hidden lg:block"><FleetMonthPicker value={resolveFleetMonth(params.get("mes"))} onValueChange={value => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set("mes", value); else next.set("mes", "all");
    next.delete("page");
    router.push(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  }} /></div>;
}
