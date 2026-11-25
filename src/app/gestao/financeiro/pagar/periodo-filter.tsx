"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FormSelect } from "@/components/form-select";

const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export function PeriodoPagarFilter({ mes, ano, anos, categorias, categoria }: {
  mes: number;
  ano: number;
  anos: number[];
  categorias: string[];
  categoria?: string;
}) {
  const router = useRouter();
  const search = useSearchParams();
  const [open, setOpen] = useState(false);
  const selecionado = new Date(ano, mes - 1, 1);
  const [mesEscolhido, setMesEscolhido] = useState(selecionado);

  function atualizar(chave: "periodo" | "categoria", valor: Date | string) {
    const params = new URLSearchParams(search.toString());
    if (chave === "periodo" && valor instanceof Date) {
      params.set("mes", String(valor.getMonth() + 1));
      params.set("ano", String(valor.getFullYear()));
      params.delete("dia");
      setOpen(false);
    } else if (chave === "categoria" && typeof valor === "string") {
      if (valor === "todas") params.delete("categoria");
      else params.set("categoria", valor);
    }
    params.delete("limite");
    router.push(`/gestao/financeiro/pagar?${params.toString()}`, { scroll: false });
  }

  return <div className="mb-4 flex flex-wrap items-center gap-2">
    <div className="flex items-center gap-1" aria-label="Vencimento">
    <Button type="button" variant="outline" size="icon-sm" aria-label="Mês anterior"
      onClick={() => atualizar("periodo", new Date(ano, mes - 2, 1))}>
      <ChevronLeft className="size-4" />
    </Button>
    <Popover open={open} onOpenChange={(next) => {
      if (next) setMesEscolhido(selecionado);
      setOpen(next);
    }}>
      <PopoverTrigger render={<Button type="button" variant="outline" className="min-w-28" aria-label="Escolher mês e ano do vencimento" />}>
        {meses[mes - 1]}, {ano}
      </PopoverTrigger>
      <PopoverContent className="w-72 gap-3 p-3" align="start">
        <FormSelect
          aria-label="Ano do vencimento"
          value={String(mesEscolhido.getFullYear())}
          options={[...new Set([...anos, mesEscolhido.getFullYear()])].sort((a, b) => b - a).map((valor) => ({ value: String(valor), label: String(valor) }))}
          onValueChange={(valor) => setMesEscolhido(new Date(Number(valor), mesEscolhido.getMonth(), 1))}
        />
        <div className="grid grid-cols-4 gap-1" role="group" aria-label="Mês do vencimento">
          {meses.map((nome, index) => (
            <Button
              key={nome}
              type="button"
              size="sm"
              variant={mesEscolhido.getMonth() === index ? "default" : "ghost"}
              aria-pressed={mesEscolhido.getMonth() === index}
              onClick={() => setMesEscolhido(new Date(mesEscolhido.getFullYear(), index, 1))}
            >
              {nome}
            </Button>
          ))}
        </div>
        <Button type="button" size="sm" className="w-full" onClick={() => atualizar("periodo", mesEscolhido)}>
          Aplicar mês
        </Button>
      </PopoverContent>
    </Popover>
    <Button type="button" variant="outline" size="icon-sm" aria-label="Próximo mês"
      onClick={() => atualizar("periodo", new Date(ano, mes, 1))}>
      <ChevronRight className="size-4" />
    </Button>
    </div>
    <div className="w-44 sm:w-52">
      <FormSelect
        aria-label="Filtrar contas a pagar por categoria"
        value={categoria || "todas"}
        options={[{ value: "todas", label: "Todas as categorias" }, ...categorias.map((nome) => ({ value: nome, label: nome }))]}
        onValueChange={(valor) => atualizar("categoria", valor)}
      />
    </div>
  </div>;
}
