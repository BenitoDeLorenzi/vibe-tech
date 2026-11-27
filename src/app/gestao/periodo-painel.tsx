"use client";

import { useState, useTransition } from "react";
import { CalendarDays, Check, ChevronDown, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { DatePickerInput } from "@/app/licencas/date-picker-input";
import { intervaloPersonalizadoValido, periodosPainel } from "@/lib/gestao-painel";
import { dataBR } from "@/lib/gestao-types";

export function PeriodoPainel({ value, inicio, fim }: { value: string; inicio: string; fim: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [de, setDe] = useState(inicio);
  const [ate, setAte] = useState(fim);
  const [erro, setErro] = useState("");

  function abrir() {
    setDe(inicio === "0001-01-01" ? `${fim.slice(0, 7)}-01` : inicio);
    setAte(fim);
    setErro("");
    setOpen(true);
  }

  function aplicar() {
    const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
    if (!intervaloPersonalizadoValido(de, ate, hoje)) {
      setErro("Informe um intervalo válido, com a data final até hoje.");
      return;
    }
    setOpen(false);
    startTransition(() => router.replace(`/gestao?${new URLSearchParams({ periodo: "personalizado", inicio: de, fim: ate })}`, { scroll: false }));
  }

  function selecionar(periodo: string) {
    setMenuOpen(false);
    if (periodo === "personalizado") abrir();
    else startTransition(() => router.replace(`/gestao?periodo=${periodo}`, { scroll: false }));
  }

  const nome = periodosPainel.find((item) => item.value === value)?.label ?? "Este mês";

  return (
    <>
      <Popover open={menuOpen} onOpenChange={setMenuOpen}>
        <PopoverTrigger render={<Button type="button" variant="outline" className="h-9 gap-2" aria-label="Selecionar período dos resultados" disabled={pending} />}>
          {pending ? <LoaderCircle className="size-4 animate-spin" /> : <CalendarDays className="size-4" />}
          <span>{value === "personalizado" ? `${dataBR(inicio)} – ${dataBR(fim)}` : nome}</span>
          <ChevronDown className="size-3.5 text-muted-foreground" />
        </PopoverTrigger>
        <PopoverContent align="end" className="w-56 gap-1 p-1.5">
          <PopoverTitle className="px-2 py-1 text-xs text-muted-foreground">Período dos resultados</PopoverTitle>
          {periodosPainel.map((item) => <button key={item.value} type="button"
            className="flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-sm hover:bg-muted data-[selected=true]:bg-muted"
            data-selected={value === item.value}
            onClick={() => selecionar(item.value)}>
            {item.label}{value === item.value && <Check className="size-4 text-primary" />}
          </button>)}
        </PopoverContent>
      </Popover>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Período personalizado</DialogTitle>
          <DialogDescription className="sr-only">Escolha as datas para analisar os resultados do estabelecimento.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <DatePickerInput key={`inicio-${open}`} id="painel-inicio" name="inicio" label="De" defaultValue={de} onValueChange={setDe} />
            <DatePickerInput key={`fim-${open}`} id="painel-fim" name="fim" label="Até" defaultValue={ate} onValueChange={setAte} />
          </div>
          {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="button" onClick={aplicar}>Aplicar período</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
