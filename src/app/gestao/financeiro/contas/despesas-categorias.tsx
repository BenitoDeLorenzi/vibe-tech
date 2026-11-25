import { ChartPie } from "lucide-react";
import type { ContaPagar } from "@/lib/gestao-contas";
import { centavosFin } from "@/lib/gestao-contas";
import { dinheiro } from "@/lib/gestao-types";
import { Panel } from "../../ui";

const cores = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--muted-foreground)"];

export function DespesasCategorias({ contas, equipePaga }: { contas: ContaPagar[]; equipePaga: number }) {
  const porCategoria = new Map<string, number>();
  for (const conta of contas) {
    if (conta.cancelada) continue;
    porCategoria.set(conta.categoria, (porCategoria.get(conta.categoria) ?? 0) + centavosFin(conta.valor));
  }
  if (equipePaga > 0) porCategoria.set("Pessoal", (porCategoria.get("Pessoal") ?? 0) + centavosFin(equipePaga));
  const ordenadas = [...porCategoria].sort((a, b) => b[1] - a[1]);
  const fatias = ordenadas.slice(0, 5);
  if (ordenadas.length > 5) fatias.push(["Outras categorias", ordenadas.slice(5).reduce((s, item) => s + item[1], 0)]);
  const total = fatias.reduce((s, item) => s + item[1], 0);
  const gradiente = fatias.map(([, valor], index) => {
    const inicio = fatias.slice(0, index).reduce((s, item) => s + item[1], 0) / total * 100;
    return `${cores[index]} ${inicio}% ${(inicio + valor / total * 100)}%`;
  }).join(", ");

  return <Panel title="Despesas por categoria" icon={ChartPie} description="Contas lançadas e valores pagos à equipe.">
    {total > 0 ? <div className="flex flex-col items-center gap-5 md:flex-row md:items-center md:gap-8">
      <div className="relative size-36 shrink-0 rounded-full" role="img" aria-label={`Distribuição de ${dinheiro(total / 100)} em despesas por categoria`}
        style={{ background: `conic-gradient(${gradiente})` }}>
        <div className="absolute inset-7 flex flex-col items-center justify-center rounded-full bg-card text-center">
          <span className="text-[10px] text-muted-foreground">Total</span>
          <strong className="text-sm tabular-nums">{dinheiro(total / 100)}</strong>
        </div>
      </div>
      <div className="grid w-full min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {fatias.map(([categoria, valor], index) => <div key={categoria} className="min-w-0 rounded-lg bg-muted/40 px-3 py-2 text-xs">
          <div className="flex min-w-0 items-center gap-2 text-muted-foreground">
            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: cores[index] }} />
            <span className="truncate" title={categoria}>{categoria}</span>
          </div>
          <div className="mt-1 tabular-nums">
            <span className="font-semibold">{dinheiro(valor / 100)}</span>
            <span className="ml-1 text-muted-foreground">{Math.round(valor / total * 100)}%</span>
          </div>
        </div>)}
      </div>
    </div> : <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma despesa lançada até agora.</p>}
  </Panel>;
}
