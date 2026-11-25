import Link from "next/link";
import { forbidden } from "next/navigation";
import { Receipt, Clock, CheckCheck, CircleAlert, Ban, CalendarDays, List } from "lucide-react";
import { getGestaoContext } from "@/lib/gestao-data";
import { getFinanceiroData } from "@/lib/gestao-contas-data";
import {
  hojeFinanceiro,
  pendentePagar,
  valorReservado,
} from "@/lib/gestao-contas";
import { dataBR, dinheiro } from "@/lib/gestao-types";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { GestaoShell } from "../../gestao-shell";
import { GestaoShowMore } from "../../gestao-show-more";
import { gestaoListLimit } from "@/lib/gestao-list-limit";
import { Panel, ListBadge, Empty, MetricBadge, SearchToolbar } from "../../ui";
import { FinanceiroForm } from "../financeiro-form";
import { ContaActions } from "./conta-actions";
import { PeriodoPagarFilter } from "./periodo-filter";
import { CalendarioContas } from "./calendario-contas";
export default async function PagarPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; cartao?: string; categoria?: string; mes?: string; ano?: string; limite?: string; visualizacao?: string; dia?: string }>;
}) {
  const { profile } = await getGestaoContext();
  if (profile.role !== "bdl_admin") forbidden();
  const [fin, params] = await Promise.all([getFinanceiroData(), searchParams]);
  const hoje = hojeFinanceiro();
  const mesAtual = Number(hoje.slice(5, 7));
  const anoAtual = Number(hoje.slice(0, 4));
  const mes = /^(?:[1-9]|1[0-2])$/.test(params.mes ?? "") ? Number(params.mes) : mesAtual;
  const ano = /^\d{4}$/.test(params.ano ?? "") && Number(params.ano) >= 2000 && Number(params.ano) <= 2100
    ? Number(params.ano) : anoAtual;
  const anosEncontrados = fin.pagar.map((p) => Number(p.vencimento.slice(0, 4)));
  const primeiroAno = Math.min(anoAtual, ano, ...anosEncontrados);
  const ultimoAno = Math.max(anoAtual + 1, ano, ...anosEncontrados);
  const anos = Array.from({ length: ultimoAno - primeiroAno + 1 }, (_, index) => ultimoAno - index);
  const periodo = `${ano}-${String(mes).padStart(2, "0")}`;
  const calendario = params.visualizacao !== "lista";
  const dia = /^\d{4}-\d{2}-\d{2}$/.test(params.dia ?? "") && params.dia?.startsWith(`${periodo}-`) ? params.dia : undefined;
  const categorias = [...new Set([...fin.categorias.filter((c) => c.nome !== "Fechamento").map((c) => c.nome), ...fin.pagar.map((p) => p.categoria)])].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const categoria = categorias.includes(params.categoria ?? "") ? params.categoria : undefined;
  const contasDoMes = fin.pagar.filter((p) =>
    p.vencimento.startsWith(periodo) && (!params.cartao || p.cartao_id === params.cartao),
  );
  const parcelasPorGrupo = new Map<string, typeof fin.pagar>();
  for (const conta of fin.pagar) {
    if (!conta.parcelamento_id) continue;
    const grupo = parcelasPorGrupo.get(conta.parcelamento_id) ?? [];
    grupo.push(conta);
    parcelasPorGrupo.set(conta.parcelamento_id, grupo);
  }
  const rows = contasDoMes
    .filter(
      (p) =>
        (!params.q ||
          [p.descricao, p.fornecedor, p.categoria, fin.cartoes.find((c) => c.id === p.cartao_id)?.nome ?? ""]
            .join(" ")
            .toLocaleLowerCase("pt-BR")
            .includes(params.q.toLocaleLowerCase("pt-BR"))) &&
        (!categoria || p.categoria === categoria) &&
        (!params.status ||
          (params.status === "pendentes"
            ? pendentePagar(p) > 0
            : params.status === "pagas"
              ? !p.cancelada && pendentePagar(p) === 0
              : p.cancelada)),
    )
    .sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  const lista = dia && !calendario ? rows.filter((p) => p.vencimento === dia) : rows;
  const queryBase = new URLSearchParams({
    mes: String(mes), ano: String(ano),
    ...(params.q ? { q: params.q } : {}),
    ...(params.status ? { status: params.status } : {}),
    ...(params.cartao ? { cartao: params.cartao } : {}),
    ...(categoria ? { categoria } : {}),
  });
  return (
    <GestaoShell
      title="Contas a pagar"
      icon={Receipt}
      actions={
        fin.inicio ? (
          <SearchToolbar
            placeholder="Buscar descrição ou fornecedor"
            query={params.q}
            clearHref={`/gestao/financeiro/pagar?${new URLSearchParams({ mes: String(mes), ano: String(ano), ...(params.status ? { status: params.status } : {}), ...(params.cartao ? { cartao: params.cartao } : {}), ...(categoria ? { categoria } : {}), ...(!calendario ? { visualizacao: "lista" } : {}), ...(dia && !calendario ? { dia } : {}) })}`}
            hidden={{ mes: String(mes), ano: String(ano), ...(params.status ? { status: params.status } : {}), ...(params.cartao ? { cartao: params.cartao } : {}), ...(categoria ? { categoria } : {}), ...(!calendario ? { visualizacao: "lista" } : {}), ...(dia && !calendario ? { dia } : {}) }}
          >
            <div className="hidden shrink-0 gap-1 rounded-lg bg-muted p-1 lg:flex">
              {[
                ["Todas", ""],
                ["Em aberto", "pendentes"],
                ["Pagas", "pagas"],
                ["Canceladas", "canceladas"],
              ].map(([label, status]) => (
                <Link
                  key={label}
                  href={
                    "/gestao/financeiro/pagar?" +
                    new URLSearchParams({
                      ...(params.q ? { q: params.q } : {}),
                      ...(params.cartao ? { cartao: params.cartao } : {}),
                      ...(categoria ? { categoria } : {}),
                      mes: String(mes),
                      ano: String(ano),
                      ...(status ? { status } : {}),
                      ...(!calendario ? { visualizacao: "lista" } : {}),
                      ...(dia && !calendario ? { dia } : {}),
                    })
                  }
                  className={buttonVariants({
                    variant:
                      (params.status ?? "") === status ? "default" : "ghost",
                    size: "sm",
                    className: "h-7 shrink-0 px-2 text-xs",
                  })}
                >
                  {label}
                </Link>
              ))}
            </div>
            <FinanceiroForm acao="pagar_cadastrar" label="Nova conta a pagar" cartoes={fin.cartoes} categorias={fin.categorias} />
          </SearchToolbar>
        ) : null
      }
    >
      {!fin.inicio ? (
        <Empty
          title="Ative o financeiro"
          description="Configure as contas e os saldos iniciais antes de registrar compromissos."
          href="/gestao/financeiro/contas"
          action="Contas e saldos"
        />
      ) : (
        <Panel
          title="Compromissos da empresa"
          description="O saldo só é movimentado quando o pagamento é registrado. Os saldos da equipe continuam no cadastro dos colaboradores."
          icon={Receipt}
          metrics={
            <>
              <MetricBadge
                label="em aberto"
                value={dinheiro(
                  contasDoMes.reduce(
                    (s, p) => s + Math.round(pendentePagar(p) * 100),
                    0,
                  ) / 100,
                )}
                icon={Clock}
                tone="warning"
              />
              <MetricBadge
                label="vencidas"
                value={
                  contasDoMes.filter(
                    (p) => p.vencimento < hoje && pendentePagar(p) > 0,
                  ).length
                }
                icon={CircleAlert}
                tone="danger"
              />
            </>
          }
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <PeriodoPagarFilter mes={mes} ano={ano} anos={anos} categorias={categorias} categoria={categoria} />
            <div className="mb-4 ml-auto flex shrink-0 gap-1 rounded-lg bg-muted p-1" aria-label="Visualização das contas">
              <Link href={`/gestao/financeiro/pagar?${queryBase}`} className={buttonVariants({ variant: calendario ? "default" : "ghost", size: "sm", className: "h-8 gap-1.5 px-2.5" })} aria-current={calendario ? "page" : undefined}><CalendarDays className="size-4" />Calendário</Link>
              <Link href={`/gestao/financeiro/pagar?${queryBase}&visualizacao=lista`} className={buttonVariants({ variant: calendario ? "ghost" : "default", size: "sm", className: "h-8 gap-1.5 px-2.5" })} aria-current={!calendario ? "page" : undefined}><List className="size-4" />Lista</Link>
            </div>
          </div>
          {params.cartao && <div className="mb-3 flex items-center justify-between gap-2 text-sm">
            <span>Cartão: {fin.cartoes.find((c) => c.id === params.cartao)?.nome ?? "Cartão selecionado"}</span>
            <Link className="text-primary hover:underline" href={`/gestao/financeiro/pagar?mes=${mes}&ano=${ano}`}>Ver todas</Link>
          </div>}
          {dia && !calendario && <div className="mb-3 flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2 text-sm"><span>Vencimento em {dataBR(dia)}</span><Link className="text-primary hover:underline" href={`/gestao/financeiro/pagar?${queryBase}`}>Ver o mês inteiro</Link></div>}
          {calendario ? <CalendarioContas ano={ano} mes={mes} contas={rows} hoje={hoje} fin={fin} parcelasPorGrupo={parcelasPorGrupo} /> : <>
          <div className="overflow-hidden rounded-lg border">
            <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Descrição</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-right">Pago</TableHead>
                <TableHead className="text-right">Pendente</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lista.slice(0, gestaoListLimit(params.limite)).map((p) => {
                const saldo = pendentePagar(p);
                const solicitado = valorReservado(
                  fin.solicitacoes,
                  undefined,
                  p.id,
                );
                const livre =
                  Math.max(0, Math.round((saldo - solicitado) * 100)) / 100;
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="font-medium">{p.descricao}</div>
                      {p.fornecedor && <div className="text-xs text-muted-foreground">{p.fornecedor}</div>}
                      {p.parcelamento_id && <div className="text-xs text-muted-foreground">
                        Parcela {p.parcela_numero}/{p.parcelas_total}
                        {p.cartao_id && ` · ${fin.cartoes.find((c) => c.id === p.cartao_id)?.nome ?? "Cartão de crédito"}`}
                      </div>}
                      {p.observacoes && (
                        <p
                          className="max-w-xs truncate text-xs text-muted-foreground"
                          title={p.observacoes}
                        >
                          {p.observacoes}
                        </p>
                      )}
                      {p.fechamento_id && (
                        <Link
                          className="text-xs text-primary hover:underline"
                          href={`/gestao/fechamentos/${p.fechamento_id}`}
                        >
                          Ver fechamento
                        </Link>
                      )}
                    </TableCell>
                    <TableCell>{p.categoria}</TableCell>
                    <TableCell>{dataBR(p.vencimento)}</TableCell>
                    <TableCell>
                      <ListBadge
                        tone={
                          p.cancelada
                            ? "neutral"
                            : !saldo
                              ? "success"
                              : p.vencimento < hoje
                                ? "danger"
                                : "warning"
                        }
                        icon={
                          p.cancelada
                            ? Ban
                            : !saldo
                              ? CheckCheck
                              : p.vencimento < hoje
                                ? CircleAlert
                                : Clock
                        }
                      >
                        {p.cancelada
                          ? "Cancelada"
                          : !saldo
                            ? "Paga"
                            : Number(p.pago) > 0
                              ? "Parcialmente paga"
                              : p.vencimento < hoje
                                ? "Vencida"
                                : "Em aberto"}
                      </ListBadge>
                      {solicitado > 0 && (
                        <Link
                          href="/gestao/financeiro/contas"
                          className="mt-1 block text-xs text-primary hover:underline"
                        >
                          {dinheiro(solicitado)} solicitados ao sistema
                        </Link>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {dinheiro(Number(p.valor))}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {dinheiro(Number(p.pago))}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {dinheiro(saldo)}
                    </TableCell>
                    <TableCell className="text-right">
                      <ContaActions
                        conta={p}
                        contas={fin.contas}
                        livre={livre}
                        solicitado={solicitado}
                        categorias={fin.categorias}
                        parcelas={p.parcelamento_id ? (parcelasPorGrupo.get(p.parcelamento_id) ?? [p]) : [p]}
                        podeEditarTodas={Boolean(p.parcelamento_id &&
                          (parcelasPorGrupo.get(p.parcelamento_id)?.length ?? 0) === p.parcelas_total &&
                          parcelasPorGrupo.get(p.parcelamento_id)?.every((parcela) =>
                            !parcela.cancelada && !parcela.fechamento_id && Number(parcela.pago) === 0 &&
                            !fin.solicitacoes.some((solicitacao) => solicitacao.pagar_id === parcela.id)))}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
              {!lista.length && (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="py-8 text-center text-muted-foreground"
                  >
                    Nenhuma conta encontrada.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          </div>
          <GestaoShowMore shown={Math.min(gestaoListLimit(params.limite), lista.length)} total={lista.length} />
          </>}
          <p className="mt-4 text-xs text-muted-foreground">
            Consulte os pagamentos e estorne lançamentos em{" "}
            <Link className="underline" href="/gestao/financeiro/extratos">
              Financeiro → Extratos
            </Link>
            .
          </p>
        </Panel>
      )}
    </GestaoShell>
  );
}
