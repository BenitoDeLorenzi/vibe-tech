import Link from "next/link";
import type { ReactNode } from "react";
import {
  CircleGauge,
  ClipboardCheck,
  TrendingUp,
  TrendingDown,
  Plus,
  Wallet,
  ArrowUpRight,
  Store,
  Package,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { getGestaoContext } from "@/lib/gestao-data";
import { getFinanceiroData } from "@/lib/gestao-contas-data";
import { centavosFin, pendentePagar, resumoContas } from "@/lib/gestao-contas";
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
import { GraficosPainel } from "./graficos-painel";

function BlocoPainel({
  title,
  icon: Icon,
  metrics,
  children,
}: {
  title: string;
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
  const pendentes = [...resumo.pendentes].sort(
    (a, b) =>
      Number(diferencaFechamento(b) !== 0) -
        Number(diferencaFechamento(a) !== 0) || a.data.localeCompare(b.data),
  );
  const saldoAtual = contas?.inicio ? resumoContas(contas) : null;
  const totalAberto = contas?.pagar.reduce((s, conta) => s + centavosFin(pendentePagar(conta)), 0) ?? 0;
  const saldoTotal = saldoAtual
    ? (centavosFin(saldoAtual.disponivel) + centavosFin(saldoAtual.retido) - totalAberto) / 100
    : null;
  const metrics = [
    ...(saldoTotal !== null ? [{
      label: "Saldo total atual",
      value: dinheiro(saldoTotal),
      icon: Wallet,
    }] : []),
    {
      label: "Vendas do período",
      value: dinheiro(resumo.vendas / 100),
      icon: TrendingUp,
    },
    {
      label: "Recebimentos líquidos",
      value: dinheiro(movimento.liquido / 100),
      icon: Wallet,
    },
    {
      label: gestor ? "Despesas + equipe paga" : "Despesas dos fechamentos",
      value: dinheiro((movimento.despesas + (gestor ? movimento.equipePaga : 0)) / 100),
      icon: TrendingDown,
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
            <h2 className="truncate text-lg font-semibold tracking-tight">
              {empresa?.nome ?? unidade.nome}
            </h2>
            {empresa?.nome !== unidade.nome && <p className="text-xs text-muted-foreground">{unidade.nome}</p>}
          </div>
        </div>
        <PeriodoPainel value={periodo.periodo} inicio={periodo.inicio} fim={periodo.fim} />
      </div>
      {contas && !contas.inicio && <Link href="/gestao/financeiro/contas" className="text-sm font-medium text-primary hover:underline">Ativar controle financeiro</Link>}
      {!contas && (
          <Card className="gap-4 border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Wallet className="size-4" />
                Saldo dos fechamentos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p
                className={`text-3xl font-semibold tracking-tight tabular-nums ${financeiro.acumulado.saldo < 0 ? "text-destructive" : ""}`}
              >
                {dinheiro(financeiro.acumulado.saldo / 100)}
              </p>
            </CardContent>
          </Card>
      )}
      <section
        aria-label="Indicadores do estabelecimento"
        className={`grid gap-3 sm:grid-cols-2 ${saldoTotal === null ? "lg:grid-cols-3" : "lg:grid-cols-4"}`}
      >
        {metrics.map(({ label, value, icon: Icon }) => (
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
            </CardContent>
          </Card>
        ))}
      </section>
      <section aria-label="Resumo operacional" className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Fechamentos conferidos", value: resumo.confirmados.length, href: "/gestao/fechamentos?status=conferido", icon: ClipboardCheck },
          { label: "Fechamentos pendentes", value: pendentes.length, href: "/gestao/fechamentos?status=rascunho", icon: CircleGauge },
          { label: "Estoque em atenção", value: baixos.length, href: "/gestao/estoque", icon: Package },
        ].map(({ label, value, href, icon: Icon }) => <Link key={label} href={href} className="flex items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 hover:bg-muted/30">
          <span className="flex items-center gap-2 text-sm text-muted-foreground"><Icon className="size-4" />{label}</span>
          <strong className="text-lg tabular-nums">{value}</strong>
        </Link>)}
      </section>
      <GraficosPainel fechamentos={resumo.confirmados} inicio={periodo.inicio} fim={periodo.fim} formas={resumo.formas} />
      <section className="grid items-start gap-4 lg:grid-cols-2" aria-label="Resultados e atenção do estabelecimento">
        <div className="space-y-4">
          <BlocoPainel
            title="Fechamentos pendentes"
            icon={ClipboardCheck}
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
          <BlocoPainel
            title="Destaques de vendas"
            icon={Trophy}
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
        </div>
      </section>
      <section aria-label="Estoque que precisa de atenção">
          <BlocoPainel
            title="Reposição de estoque"
            icon={Package}
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
                    {baixos.slice(0, 8).map((p) => (
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
            {baixos.length > 8 && (
              <p className="mt-2 text-xs text-muted-foreground">
                Exibindo 8 de {baixos.length} produtos que precisam de revisão.
              </p>
            )}
          </BlocoPainel>
      </section>
    </GestaoShell>
  );
}
