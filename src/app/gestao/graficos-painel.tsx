import { BarChart3, ChartPie } from "lucide-react";
import type { Fechamento } from "@/lib/gestao-types";
import { dinheiro } from "@/lib/gestao-types";
import { Panel } from "./ui";

const cores = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

export function GraficosPainel({ fechamentos, inicio, fim, formas }: {
  fechamentos: Fechamento[];
  inicio: string;
  fim: string;
  formas: { nome: string; total: number }[];
}) {
  const primeiroDia = inicio === "0001-01-01"
    ? [...fechamentos].sort((a, b) => a.data.localeCompare(b.data))[0]?.data ?? fim
    : inicio;
  const inicioMs = Date.parse(`${primeiroDia}T12:00:00Z`);
  const dias = Math.max(1, Math.round((Date.parse(`${fim}T12:00:00Z`) - inicioMs) / 86400000) + 1);
  const largura = Math.ceil(dias / 12);
  const serie = Array.from({ length: Math.ceil(dias / largura) }, (_, index) => {
    const de = new Date(inicioMs + index * largura * 86400000).toISOString().slice(0, 10);
    const ate = new Date(Math.min(inicioMs + ((index + 1) * largura - 1) * 86400000, Date.parse(`${fim}T12:00:00Z`))).toISOString().slice(0, 10);
    return { de, ate, valor: 0 };
  });
  for (const fechamento of fechamentos) {
    const indice = Math.floor((Date.parse(`${fechamento.data}T12:00:00Z`) - inicioMs) / 86400000 / largura);
    if (serie[indice]) serie[indice].valor += Math.round(Number(fechamento.total) * 100);
  }
  const maiorVenda = Math.max(1, ...serie.map(({ valor }) => valor));
  const totalFormas = formas.reduce((s, forma) => s + forma.total, 0);
  const fatias = formas.slice(0, 4).map((forma) => ({ ...forma }));
  if (formas.length > 4) fatias.push({ nome: "Outras", total: formas.slice(4).reduce((s, forma) => s + forma.total, 0) });
  const gradiente = fatias.map((forma, index) => {
    const inicioFatia = fatias.slice(0, index).reduce((s, item) => s + item.total, 0) / totalFormas * 100;
    const fimFatia = inicioFatia + forma.total / totalFormas * 100;
    return `${cores[index]} ${inicioFatia}% ${fimFatia}%`;
  }).join(", ");

  return <section aria-label="Gráficos do período" className="grid gap-4 xl:grid-cols-2 [&>[data-slot=card]]:h-full">
    <Panel title="Evolução das vendas" icon={BarChart3}>
      {fechamentos.length ? <div className="flex h-44 items-end gap-1.5 border-b pb-2 sm:gap-2" role="img" aria-label="Evolução das vendas confirmadas">
        {serie.map(({ de, ate, valor }) => <div key={de} className="flex h-full min-w-0 flex-1 flex-col items-center gap-1" title={`${de === ate ? de : `${de} a ${ate}`}: ${dinheiro(valor / 100)}`}>
          <div className="flex min-h-0 w-full flex-1 items-end justify-center">
            <div className="w-full max-w-10 rounded-t bg-primary/80" style={{ height: `${valor > 0 ? Math.max(3, valor / maiorVenda * 100) : 0}%` }} />
          </div>
          <span className="w-full truncate text-center text-[10px] text-muted-foreground">{de.slice(8)}/{de.slice(5, 7)}</span>
        </div>)}
      </div> : <p className="py-12 text-center text-sm text-muted-foreground">Nenhuma venda conferida neste período.</p>}
    </Panel>
    <Panel title="Formas de recebimento" icon={ChartPie}>
      {totalFormas > 0 ? <div className="flex min-h-44 flex-col items-center gap-5 sm:flex-row">
        <div className="relative size-36 shrink-0 rounded-full" role="img" aria-label={`Total recebido: ${dinheiro(totalFormas / 100)}`}
          style={{ background: `conic-gradient(${gradiente})` }}>
          <div className="absolute inset-7 flex flex-col items-center justify-center rounded-full bg-card text-center">
            <span className="text-[10px] text-muted-foreground">Total</span>
            <strong className="text-sm tabular-nums">{dinheiro(totalFormas / 100)}</strong>
          </div>
        </div>
        <div className="w-full min-w-0 space-y-2">
          {fatias.map((forma, index) => <div key={forma.nome} className="flex items-center gap-2 text-xs">
            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: cores[index] }} />
            <span className="min-w-0 flex-1 truncate">{forma.nome}</span>
            <strong className="shrink-0 tabular-nums">{dinheiro(forma.total / 100)}</strong>
          </div>)}
        </div>
      </div> : <p className="py-12 text-center text-sm text-muted-foreground">Nenhum recebimento conferido neste período.</p>}
    </Panel>
  </section>;
}
