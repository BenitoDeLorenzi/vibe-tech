import { CalendarClock } from "lucide-react";
import { pendentePagar, type ContaPagar } from "@/lib/gestao-contas";
import { dinheiro } from "@/lib/gestao-types";
import { Panel } from "../../ui";

export function VencimentosGrafico({ contas, hoje }: { contas: ContaPagar[]; hoje: string }) {
  const ano = Number(hoje.slice(0, 4));
  const mes = Number(hoje.slice(5, 7));
  const meses = Array.from({ length: 6 }, (_, index) => {
    const data = new Date(Date.UTC(ano, mes - 1 + index, 1));
    return {
      chave: `${data.getUTCFullYear()}-${String(data.getUTCMonth() + 1).padStart(2, "0")}`,
      nome: new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit", timeZone: "UTC" }).format(data),
    };
  });
  const ativos = contas.filter((conta) => pendentePagar(conta) > 0);
  const linhas = [
    { nome: "Vencidos", valor: ativos.filter((conta) => conta.vencimento < hoje).reduce((s, conta) => s + pendentePagar(conta), 0), destaque: true },
    ...meses.map(({ chave, nome }) => ({
      nome,
      valor: ativos.filter((conta) => conta.vencimento.startsWith(chave) && conta.vencimento >= hoje)
        .reduce((s, conta) => s + pendentePagar(conta), 0),
      destaque: false,
    })),
  ];
  const maximo = Math.max(...linhas.map((linha) => linha.valor), 0);
  const fim = `${meses[5].chave}-31`;
  const depois = ativos.filter((conta) => conta.vencimento > fim).reduce((s, conta) => s + pendentePagar(conta), 0);

  return <Panel title="Próximos vencimentos" icon={CalendarClock} description="Contas em aberto por mês, incluindo atrasos.">
    {maximo > 0 || depois > 0 ? <div className="space-y-2.5">
      {linhas.map((linha) => <div key={linha.nome} className="grid grid-cols-[4.5rem_minmax(0,1fr)_5.5rem] items-center gap-2 text-xs">
        <span className="truncate text-muted-foreground">{linha.nome}</span>
        <div className="h-3 overflow-hidden rounded-full bg-muted" aria-hidden="true">
          {linha.valor > 0 && <div className={`h-full rounded-full ${linha.destaque ? "bg-amber-500" : "bg-primary"}`}
            style={{ width: `${Math.max(3, linha.valor / maximo * 100)}%` }} />}
        </div>
        <strong className="text-right tabular-nums">{dinheiro(linha.valor)}</strong>
      </div>)}
      {depois > 0 && <p className="border-t pt-2 text-xs text-muted-foreground">Após esse período: {dinheiro(depois)}</p>}
    </div> : <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma conta em aberto neste período.</p>}
  </Panel>;
}
