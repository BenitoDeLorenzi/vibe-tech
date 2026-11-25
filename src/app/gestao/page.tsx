import Link from "next/link";
import type { ReactNode } from "react";
import {
  CircleGauge,
  ClipboardCheck,
  TrendingUp,
  Users,
  ArrowDownRight,
  Plus,
  Wallet,
  ArrowUpRight,
  Store,
  CalendarDays,
  Package,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { getGestaoContext } from "@/lib/gestao-data";
import { getFinanceiroData } from "@/lib/gestao-contas-data";
import { ResumoFinanceiro } from "./financeiro/resumo-financeiro";
import { getEquipeData } from "@/lib/gestao-equipe-data";
import { resumirFinanceiro } from "@/lib/gestao-financeiro";
import { getPainelData } from "@/lib/gestao-painel-data";
import {
  periodoPainel,
  resumirPainel,
  diferencaFechamento,
} from "@/lib/gestao-painel";
import { dinheiro, dataBR, quantidade } from "@/lib/gestao-types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { GestaoShell } from "./gestao-shell";
import { Empty, Panel } from "./ui";
import { PeriodoPainel } from "./periodo-painel";
import {
  alertaEstoque,
  ordenarAlertasEstoque,
} from "@/lib/gestao-estoque-alertas";
import { EstoqueStatus } from "./estoque/estoque-status";

function BlocoPainel({
  title,
  description,
  icon: Icon,
  metrics,
  children,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  metrics?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="gap-3">
      <CardHeader className="gap-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted/50">
              <Icon className="size-4 text-muted-foreground" />
            </span>
            <CardTitle className="text-sm font-semibold">{title}</CardTitle>
          </div>
          {metrics}
        </div>
        <CardDescription className="text-xs">{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export default async function GestaoPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; inicio?: string; fim?: string }>;
}) {
  const [{ unidade, empresa, gestor, profile }, query] = await Promise.all([
    getGestaoContext(),
    searchParams,
  ]);
  if (!unidade)
    return (
      <GestaoShell title="Visão geral" icon={CircleGauge}>
        <Panel title="Vibe Gestão" description="Gestão de estabelecimentos">
          <Empty
            title="Vamos preparar seu estabelecimento"
            description="Cadastre a empresa no painel central e libere uma licença do Vibe Gestão. A primeira unidade será criada automaticamente."
          />
        </Panel>
      </GestaoShell>
    );
  const periodo = periodoPainel(query.periodo, new Date(), query.inicio, query.fim);
  const [{ fechamentos, produtos }, equipe, contas] = await Promise.all([
    getPainelData(periodo.fim),
    getEquipeData(),
    profile.role === "bdl_admin" ? getFinanceiroData() : Promise.resolve(null),
  ]);
  const resumo = resumirPainel(
    fechamentos.filter((f) => f.data >= periodo.inicio),
  );
  const financeiro = resumirFinanceiro(
    fechamentos,
    equipe.extrato,
    periodo.inicio,
    periodo.fim,
  );
  const movimento = financeiro.periodo;
  const baixos = produtos
    .filter((p) => alertaEstoque(p).prioridade <= 2)
    .sort(ordenarAlertasEstoque);
  const criticos = baixos.filter(
    (p) => alertaEstoque(p).nivel === "critico",
  ).length;
  const pendentes = [...resumo.pendentes].sort(
    (a, b) =>
      Number(diferencaFechamento(b) !== 0) -
        Number(diferencaFechamento(a) !== 0) || a.data.localeCompare(b.data),
  );
  const metrics = [
    {
      label: "Vendas do período",
      value: dinheiro(resumo.vendas / 100),
      icon: TrendingUp,
      note: "Produtos vendidos · sem cortesias",
    },
    {
      label: "Recebimentos líquidos",
      value: dinheiro(movimento.liquido / 100),
      icon: Wallet,
      note: `${dinheiro(movimento.taxas / 100)} descontados em taxas`,
    },
    {
      label: gestor ? "Despesas e equipe paga" : "Despesas do período",
      value: dinheiro((movimento.despesas + movimento.equipePaga) / 100),
      icon: ArrowDownRight,
      note: "Saídas dos fechamentos no período",
    },
    {
      label: gestor ? "Equipe a pagar" : "Estoque para revisar",
      value: gestor ? dinheiro(financeiro.equipePendente / 100) : baixos.length,
      icon: gestor ? Users : Package,
      note: gestor
        ? `${financeiro.colaboradoresPendentes} colaborador(es) com saldo pendente · até hoje`
        : `${criticos} críticos · ${baixos.length - criticos} próximos do mínimo`,
    },
  ];
  return (
    <GestaoShell
      title="Visão geral"
      icon={CircleGauge}
      actions={
        <>
          <Link
            href="/gestao/fechamentos?novo=1"
            className={buttonVariants({ className: "h-9 gap-2" })}
          >
            <Plus className="size-4" />
            <span className="hidden sm:inline">Novo fechamento</span>
            <span className="sr-only sm:hidden">Novo fechamento</span>
          </Link>
        </>
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-gradient-to-br from-primary/[0.07] via-card to-card px-4 py-4 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-primary/15 bg-card shadow-sm">
            <Store className="size-5 text-primary" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">Painel do estabelecimento</p>
            <h2 className="truncate text-lg font-semibold tracking-tight">
              {empresa?.nome ?? unidade.nome}
            </h2>
            <p className="truncate text-xs text-muted-foreground">{unidade.nome}</p>
          </div>
        </div>
        <div className="flex flex-col gap-1.5 sm:items-end">
          <PeriodoPainel value={periodo.periodo} inicio={periodo.inicio} fim={periodo.fim} />
          <span className="flex items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground">
            <CalendarDays className="size-3.5" />
            {periodo.periodo === "todo" ? `Todo o histórico até ${dataBR(periodo.fim)}` : `${dataBR(periodo.inicio)} a ${dataBR(periodo.fim)}`}
          </span>
        </div>
      </div>
      {contas && (
        <ResumoFinanceiro
          data={contas}
          equipe={financeiro.equipePendente / 100}
        />
      )}
      <section
        className="space-y-3"
        aria-label="Posição financeira"
      >
        {!contas?.inicio && (
          <Card className="gap-4 border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Wallet className="size-4" />
                {gestor
                  ? "Saldo acumulado dos registros"
                  : "Saldo acumulado antes da equipe"}
              </CardTitle>
              <CardDescription>
                Todo o histórico confirmado desta unidade até hoje
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p
                className={`text-3xl font-semibold tracking-tight tabular-nums ${financeiro.acumulado.saldo < 0 ? "text-destructive" : ""}`}
              >
                {dinheiro(financeiro.acumulado.saldo / 100)}
              </p>
              {gestor && (
                <div className="mt-4 flex flex-wrap justify-between gap-2 border-t pt-3 text-sm">
                  <span className="text-muted-foreground">
                    Após quitar o saldo da equipe
                  </span>
                  <strong className="tabular-nums">
                    {dinheiro(financeiro.aposQuitarEquipe / 100)}
                  </strong>
                </div>
              )}
              <p className="mt-3 text-xs text-muted-foreground">
                Calculado pelos lançamentos. Não inclui saldo inicial, saques ou
                confirmação de repasses bancários.
              </p>
            </CardContent>
          </Card>
        )}
        <BlocoPainel
          title="Movimentação dos fechamentos"
          icon={ArrowDownRight}
          description="Entradas e saídas dos fechamentos no período selecionado."
          metrics={contas?.inicio ? (
            <Link href="/gestao/financeiro/extratos" className={buttonVariants({ variant: "ghost", size: "sm" })}>
              Ver extrato <ArrowUpRight className="size-4" />
            </Link>
          ) : undefined}
        >
          <dl className={`grid gap-2 sm:grid-cols-2 ${gestor ? "lg:grid-cols-5" : "lg:grid-cols-4"}`}>
            {[
              ["Recebimentos brutos", movimento.bruto],
              ["Taxas", -movimento.taxas],
              ["Despesas", -movimento.despesas],
              ...(gestor
                ? [["Pagamentos à equipe", -movimento.equipePaga]]
                : []),
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-lg border bg-muted/25 px-3 py-2.5">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="mt-1 text-base font-semibold tabular-nums">
                  {dinheiro((Number(value) || 0) / 100)}
                </dd>
              </div>
            ))}
            <div className="rounded-lg border border-primary/15 bg-primary/[0.06] px-3 py-2.5">
              <dt className="text-xs font-medium text-muted-foreground">
                {gestor ? "Saldo gerado no período" : "Saldo antes da equipe"}
              </dt>
              <dd
                className={`mt-1 text-base font-semibold tabular-nums ${movimento.saldo < 0 ? "text-destructive" : ""}`}
              >
                {dinheiro(movimento.saldo / 100)}
              </dd>
            </div>
          </dl>
        </BlocoPainel>
      </section>
      <section
        aria-label="Indicadores do estabelecimento"
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        {metrics.map(({ label, value, icon: Icon, note }) => (
          <Card key={label} className="gap-0 py-4">
            <CardContent className="px-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  {label}
                </span>
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <Icon className="size-4" />
                </span>
              </div>
              <div className="text-2xl font-semibold tracking-tight tabular-nums">
                {value}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{note}</p>
            </CardContent>
          </Card>
        ))}
      </section>
      <section className="grid items-start gap-4 lg:grid-cols-2" aria-label="Resultados e atenção do estabelecimento">
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">Financeiro e fechamentos</h3>
          <BlocoPainel
            title="Formas de recebimento"
            icon={Wallet}
            description="Valores informados nos fechamentos conferidos do período."
          >
            {resumo.formas.length ? (
              <div className="space-y-4">
                {resumo.formas.map((forma) => {
                  const percentual = resumo.recebimentos
                    ? (forma.total / resumo.recebimentos) * 100
                    : 0;
                  return (
                    <div key={forma.nome}>
                      <div className="mb-1.5 flex justify-between gap-3 text-sm">
                        <span>{forma.nome}</span>
                        <span className="tabular-nums">
                          {dinheiro(forma.total / 100)}{" "}
                          <span className="text-xs text-muted-foreground">
                            (
                            {percentual.toLocaleString("pt-BR", {
                              maximumFractionDigits: 1,
                            })}
                            %)
                          </span>
                        </span>
                      </div>
                      <div
                        aria-hidden="true"
                        className="h-1.5 overflow-hidden rounded-full bg-muted"
                      >
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${percentual}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="rounded-lg bg-muted/30 px-3 py-4 text-sm text-muted-foreground">
                Nenhum recebimento conferido neste período.
              </p>
            )}
          </BlocoPainel>
          <BlocoPainel
            title="Fechamentos pendentes"
            icon={ClipboardCheck}
            description={`${resumo.divergentes.length} com diferença entre vendas e recebimentos no período.`}
            metrics={
              <Link
                href="/gestao/fechamentos?status=rascunho"
                className={buttonVariants({ variant: "ghost", size: "sm" })}
              >
                Ver todos
                <ArrowUpRight className="size-4" />
              </Link>
            }
          >
            {pendentes.length ? (
              <div className="overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Fechamento</TableHead>
                      <TableHead className="text-right">Vendas</TableHead>
                      <TableHead className="text-right">Diferença</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendentes.slice(0, 5).map((f) => (
                      <TableRow key={f.id}>
                        <TableCell>
                          <Link
                            href={`/gestao/fechamentos/${f.id}`}
                            className="font-medium hover:underline"
                          >
                            {dataBR(f.data)} · {f.turno}
                          </Link>
                          <div className="text-xs text-muted-foreground">
                            {f.origem}
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {dinheiro(f.total)}
                        </TableCell>
                        <TableCell
                          className={`text-right tabular-nums ${diferencaFechamento(f) ? "text-destructive" : "text-muted-foreground"}`}
                        >
                          {dinheiro(diferencaFechamento(f) / 100)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="rounded-lg bg-muted/30 px-3 py-4 text-sm text-muted-foreground">
                Nenhum rascunho pendente neste período.
              </p>
            )}
            {pendentes.length > 5 && (
              <p className="mt-2 text-xs text-muted-foreground">
                Exibindo 5 de {pendentes.length}. Divergências aparecem
                primeiro.
              </p>
            )}
          </BlocoPainel>
        </div>
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">Vendas e operação</h3>
          <BlocoPainel
            title="Destaques de vendas"
            icon={Trophy}
            description="Produtos com maior valor vendido no período."
          >
            {resumo.produtos.length ? (
              <div className="divide-y">
                {resumo.produtos.map((p, index) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <span className="text-xs text-muted-foreground">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1 text-sm font-medium">
                      {p.nome}
                    </span>
                    <span className="text-sm tabular-nums">
                      {dinheiro(p.total / 100)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-lg bg-muted/30 px-3 py-4 text-sm text-muted-foreground">
                Ainda não há vendas confirmadas neste período.
              </p>
            )}
          </BlocoPainel>
          <BlocoPainel
            title="Reposição de estoque"
            icon={Package}
            description="Amarelo: até 50% acima do mínimo. Vermelho: reposição necessária."
            metrics={
              <Link
                href="/gestao/estoque"
                className={buttonVariants({ variant: "ghost", size: "sm" })}
              >
                Ver estoque
                <ArrowUpRight className="size-4" />
              </Link>
            }
          >
            {baixos.length ? (
              <div className="overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Produto</TableHead>
                      <TableHead className="text-right">Saldo</TableHead>
                      <TableHead className="text-right">Mínimo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {baixos.slice(0, 5).map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>
                          <Link
                            className="font-medium hover:underline"
                            href={`/gestao/estoque?q=${encodeURIComponent(p.nome)}`}
                          >
                            {p.nome}
                          </Link>
                          <div className="mt-1">
                            <EstoqueStatus produto={p} />
                          </div>
                        </TableCell>
                        <TableCell
                          className={`text-right tabular-nums ${Number(p.saldo) <= 0 ? "text-destructive" : ""}`}
                        >
                          {quantidade(p.saldo)} {p.unidade}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {quantidade(p.minimo)} {p.unidade}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="rounded-lg bg-muted/30 px-3 py-4 text-sm text-muted-foreground">
                {produtos.length
                  ? "Nenhum produto próximo ou abaixo do estoque mínimo."
                  : "Nenhum produto ativo com controle de estoque."}
              </p>
            )}
            {baixos.length > 5 && (
              <p className="mt-2 text-xs text-muted-foreground">
                Exibindo 5 de {baixos.length} produtos que precisam de revisão.
              </p>
            )}
          </BlocoPainel>
        </div>
      </section>
    </GestaoShell>
  );
}
