"use client";

import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormSelect } from "@/components/form-select";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { DatePickerInput } from "@/app/licencas/date-picker-input";
import { intervaloPersonalizadoValido, periodosPainel } from "@/lib/gestao-painel";

export function PeriodoPainel({ value, inicio, fim }: { value: string; inicio: string; fim: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
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
    router.replace(`/gestao?${new URLSearchParams({ periodo: "personalizado", inicio: de, fim: ate })}`, { scroll: false });
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <div className="w-40 sm:w-44">
          <FormSelect
            aria-label="Período do painel"
            value={value}
            options={periodosPainel}
            groupLabel="Período"
            onValueChange={(periodo) => {
              if (periodo === "personalizado") abrir();
              else router.replace(`/gestao?periodo=${periodo}`, { scroll: false });
            }}
          />
        </div>
        {value === "personalizado" && (
          <Button type="button" variant="outline" size="icon" aria-label="Alterar datas personalizadas" onClick={abrir}>
            <CalendarDays className="size-4" />
          </Button>
        )}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Período personalizado</DialogTitle>
            <DialogDescription>Escolha as datas para analisar os resultados do estabelecimento.</DialogDescription>
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
