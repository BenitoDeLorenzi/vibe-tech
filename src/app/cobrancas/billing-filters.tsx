"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { FormSelect } from "@/components/form-select";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";

const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const statuses = [
  ["all", "Todas"], ["open", "Em aberto"], ["partial", "Parciais"],
  ["paid", "Pagas"], ["overdue", "Atrasadas"], ["cancelled", "Canceladas"],
  ["previous", "Atrasadas anteriores"],
];

export function BillingFilters({ mes, query, modulo, status, modulos, currentMonth }: {
  mes: string; query: string; modulo: string; status: string;
  modulos: { value: string; label: string }[]; currentMonth: string;
}) {
  const router = useRouter();
  const [month, setMonth] = useState(mes);
  const [year, setYear] = useState(Number(mes.slice(0, 4)));
  const [open, setOpen] = useState(false);
  const hasFilters = Boolean(query || modulo !== "all" || status !== "all" || mes !== currentMonth);
  const statusHref = (value: string) => {
    const params = new URLSearchParams({ mes });
    if (query) params.set("q", query);
    if (modulo !== "all") params.set("modulo", modulo);
    if (value !== "all") params.set("status", value);
    return `/cobrancas?${params}`;
  };
  return (
    <div className="hidden w-full min-w-0 items-center justify-end gap-2 overflow-x-auto md:flex">
      <form id="billing-filters" action="/cobrancas" className="flex min-w-0 shrink-0 justify-end gap-2">
        <div className="relative w-[320px] min-w-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" aria-label="Buscar cobrança por empresa ou CNPJ" placeholder="Buscar cobrança" defaultValue={query} className="h-9 pl-9" />
        </div>
        <input type="hidden" name="status" value={status} />
        <input type="hidden" name="mes" value={month} />
        {hasFilters ? (
          <Link href="/cobrancas" className={buttonVariants({ variant: "outline", className: "h-9 gap-2" })}><X className="size-4" />Limpar</Link>
        ) : (
          <Button type="submit" variant="outline" className="h-9 gap-2"><Search className="size-4" />Filtrar</Button>
        )}
      </form>
      <div aria-label="Situação da cobrança" className="flex shrink-0 gap-1 overflow-x-auto rounded-lg bg-muted p-1">
        {statuses.map(([value, label]) => (
          <Link key={value} href={statusHref(value)} aria-current={status === value ? "page" : undefined}
            className={buttonVariants({ variant: status === value ? "default" : "ghost", size: "sm", className: status === value ? "h-7 px-2 text-xs shadow-sm" : "h-7 px-2 text-xs text-muted-foreground" })}>{label}</Link>
        ))}
      </div>
      <Separator orientation="vertical" className="hidden h-5 xl:block" />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger render={<Button type="button" variant="outline" className="h-9 shrink-0 gap-2" aria-label="Selecionar competência" />}>
          <CalendarDays className="size-4" />{months[Number(month.slice(5)) - 1]} / {month.slice(0, 4)}
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 p-3">
          <PopoverTitle>Competência</PopoverTitle>
          <div className="flex items-center justify-between">
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Ano anterior" disabled={year <= 1} onClick={() => setYear(year - 1)}><ChevronLeft className="size-4" /></Button>
            <span aria-live="polite" className="font-medium">{year}</span>
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Próximo ano" disabled={year >= 9999} onClick={() => setYear(year + 1)}><ChevronRight className="size-4" /></Button>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {months.map((label, index) => {
              const value = `${String(year).padStart(4, "0")}-${String(index + 1).padStart(2, "0")}`;
              return <Button key={label} type="button" variant={month === value ? "default" : "ghost"} size="sm" aria-pressed={month === value} onClick={() => {
                setMonth(value);
                setOpen(false);
                const form = document.getElementById("billing-filters") as HTMLFormElement | null;
                const input = form?.elements.namedItem("mes") as HTMLInputElement | null;
                if (input) input.value = value;
                form?.requestSubmit();
              }}>{label}</Button>;
            })}
          </div>
        </PopoverContent>
      </Popover>
      <div className="w-44 shrink-0">
        <FormSelect aria-label="Módulo" value={modulo} options={[{ value: "all", label: "Todos os módulos" }, ...modulos]} onValueChange={(value) => {
          const params = new URLSearchParams({ mes: month, status, modulo: value });
          const form = document.getElementById("billing-filters") as HTMLFormElement | null;
          const search = form?.elements.namedItem("q") as HTMLInputElement | null;
          if (search?.value) params.set("q", search.value);
          router.push(`/cobrancas?${params}`);
        }} />
        <input form="billing-filters" type="hidden" name="modulo" value={modulo} />
      </div>
    </div>
  );
}
