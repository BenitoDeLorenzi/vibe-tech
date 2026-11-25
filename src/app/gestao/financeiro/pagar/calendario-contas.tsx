import { pendentePagar, valorReservado, type ContaPagar } from "@/lib/gestao-contas";
import { getFinanceiroData } from "@/lib/gestao-contas-data";
import { dinheiro } from "@/lib/gestao-types";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ContaActions } from "./conta-actions";

const diasSemana = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
type FinanceiroData = Awaited<ReturnType<typeof getFinanceiroData>>;

export function CalendarioContas({ ano, mes, contas, hoje, fin, parcelasPorGrupo }: {
  ano: number;
  mes: number;
  contas: ContaPagar[];
  hoje: string;
  fin: FinanceiroData;
  parcelasPorGrupo: Map<string, ContaPagar[]>;
}) {
  const primeiroDia = new Date(ano, mes - 1, 1);
  const deslocamento = (primeiroDia.getDay() + 6) % 7;
  const diasNoMes = new Date(ano, mes, 0).getDate();
  const totalCelulas = Math.ceil((deslocamento + diasNoMes) / 7) * 7;
  const porDia = new Map<string, ContaPagar[]>();
  for (const conta of contas) {
    const grupo = porDia.get(conta.vencimento) ?? [];
    grupo.push(conta);
    porDia.set(conta.vencimento, grupo);
  }

  function evento(conta: ContaPagar) {
    const saldo = pendentePagar(conta);
    const solicitado = valorReservado(fin.solicitacoes, undefined, conta.id);
    const livre = Math.max(0, Math.round((saldo - solicitado) * 100)) / 100;
    const parcelas = conta.parcelamento_id ? (parcelasPorGrupo.get(conta.parcelamento_id) ?? [conta]) : [conta];
    const cor = conta.cancelada
      ? "border-border bg-muted/60 text-muted-foreground"
      : saldo === 0
        ? "border-emerald-500 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200"
        : conta.vencimento < hoje
          ? "border-destructive bg-destructive/5 text-foreground"
          : "border-primary bg-primary/5 text-foreground";
    return <div key={conta.id} title={`${conta.descricao} · ${dinheiro(Number(conta.valor))}`}>
      <ContaActions conta={conta} contas={fin.contas} livre={livre} solicitado={solicitado}
        categorias={fin.categorias} parcelas={parcelas}
        podeEditarTodas={Boolean(conta.parcelamento_id && parcelas.length === conta.parcelas_total && parcelas.every((parcela) =>
          !parcela.cancelada && !parcela.fechamento_id && Number(parcela.pago) === 0 &&
          !fin.solicitacoes.some((solicitacao) => solicitacao.pagar_id === parcela.id)))}
        calendarLabel={`${conta.descricao} · ${dinheiro(Number(conta.valor))}`}
        calendarClassName={`h-auto w-full min-w-0 justify-start truncate rounded border-l-[3px] px-1.5 py-0.5 text-[11px] leading-4 font-medium ${cor}`}
      />
    </div>;
  }

  return <>
    <div className="overflow-hidden rounded-lg border">
      <div className="grid grid-cols-7 border-b bg-muted/50">
        {diasSemana.map((dia) => <div key={dia} className="py-1.5 text-center text-[11px] font-medium text-muted-foreground">{dia}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {Array.from({ length: totalCelulas }, (_, index) => {
          const numero = index - deslocamento + 1;
          const noMes = numero >= 1 && numero <= diasNoMes;
          const data = new Date(ano, mes - 1, numero);
          const dia = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
          const itens = noMes ? porDia.get(dia) ?? [] : [];
          return <div key={dia} className={`min-h-14 min-w-0 border-b border-r p-1 sm:min-h-20 sm:p-1.5 lg:min-h-24 ${noMes ? "bg-card" : "bg-muted/20"}`}>
            {noMes && <>
              <span className={`inline-flex size-6 items-center justify-center rounded-full text-xs font-semibold ${dia === hoje ? "bg-primary text-primary-foreground" : ""}`}>
                {numero}
              </span>
              {itens.length > 0 && <Popover>
                <PopoverTrigger render={<button type="button" className="mt-0.5 block w-full rounded bg-primary/10 text-center text-[10px] font-semibold text-primary sm:hidden" aria-label={`Ver ${itens.length} conta${itens.length === 1 ? "" : "s"} de ${data.toLocaleDateString("pt-BR")}`} />}>{itens.length}</PopoverTrigger>
                <PopoverContent className="w-72 space-y-1 p-2" align="start">
                  <p className="px-1 pb-1 text-xs font-semibold">{data.toLocaleDateString("pt-BR")}</p>
                  {itens.map(evento)}
                </PopoverContent>
              </Popover>}
              <div className="hidden space-y-0.5 sm:block">
                {itens.slice(0, 2).map(evento)}
                {itens.length > 2 && <Popover>
                  <PopoverTrigger render={<button type="button" className="block px-1 text-[11px] font-medium text-primary hover:underline" />}>+ {itens.length - 2} mais</PopoverTrigger>
                  <PopoverContent className="w-72 space-y-1 p-2" align="start">
                    <p className="px-1 pb-1 text-xs font-semibold">{data.toLocaleDateString("pt-BR")}</p>
                    {itens.slice(2).map(evento)}
                  </PopoverContent>
                </Popover>}
              </div>
            </>}
          </div>;
        })}
      </div>
    </div>
    {!contas.length && <p className="pt-3 text-center text-sm text-muted-foreground">Nenhuma conta para os filtros selecionados neste mês.</p>}
  </>;
}
