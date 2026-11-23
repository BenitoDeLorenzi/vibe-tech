import Link from "next/link";
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  Car,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  KeyRound,
  LayoutDashboard,
  Users,
  ArrowRight,
  Headset,
  Wallet,
} from "lucide-react";

import { AdminShell } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireRole } from "@/lib/auth-data";
import { BrandMark } from "@/components/brand-mark";
import {
  getLicencas,
  type Licenca,
} from "@/lib/licencas-data";
import { getModulos, type Modulo } from "@/lib/modulos-data";
import {
  formatPrefeituraStatus,
  getPrefeituras,
  type Prefeitura,
  type PrefeituraStatus,
} from "@/lib/prefeituras-data";
import {
  getUsuarios,
} from "@/lib/usuarios-data";
import { cn } from "@/lib/utils";
import { todayInSaoPaulo } from "@/lib/license-schedule";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const prefeituraStatusMeta: Record<
  PrefeituraStatus,
  {
    badge: string;
    bar: string;
  }
> = {
  active: {
    badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
    bar: "bg-emerald-500",
  },
  cancelled: {
    badge: "border-zinc-200 bg-zinc-50 text-zinc-700",
    bar: "bg-zinc-400",
  },
  expired: {
    badge: "border-red-200 bg-red-50 text-red-700",
    bar: "bg-red-500",
  },
  suspended: {
    badge: "border-amber-200 bg-amber-50 text-amber-700",
    bar: "bg-amber-500",
  },
};

export default async function Home() {
  const profile = await requireRole(["bdl_admin"]);
  const [prefeituras, licencas, modulos, usuarios, suporte] = await Promise.all([
    getPrefeituras(),
    getLicencas(),
    getModulos(),
    getUsuarios(),
    createSupabaseServerClient().from("suporte_conversas").select("id", { count: "exact", head: true }).neq("status", "resolved"),
  ]);
  if (suporte.error) throw new Error("Não foi possível carregar os atendimentos.");
  const today = todayInSaoPaulo();
  const month = today.slice(0, 7);
  const payments = licencas.flatMap((licenca) => licenca.pagamentos.map((payment) => ({ ...payment, licenca })));
  const currentPayments = payments.filter((payment) => payment.competencia.slice(0, 7) === month && payment.status !== "cancelled");
  const overduePayments = payments.filter((payment) => payment.status !== "cancelled" && payment.vencimento < today && Number(payment.valor) > Number(payment.valor_pago ?? 0)).sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  const overdueBalance = overduePayments.reduce((total, payment) => total + Math.max(0, Number(payment.valor) - Number(payment.valor_pago ?? 0)), 0);
  const receivedThisMonth = payments.flatMap((payment) => payment.recebimentos ?? []).filter((receipt) => !receipt.estornado_em && receipt.pago_em.slice(0, 7) === month).reduce((total, receipt) => total + Number(receipt.valor), 0);
  const pendingAccess = usuarios.filter((usuario) => usuario.ativo && !usuario.primeiro_acesso_concluido_em).length;

  const activePrefeituras = prefeituras.filter(
    (prefeitura) => prefeitura.status === "active"
  ).length;
  const activeLicencas = licencas.filter(
    (licenca) => licenca.status === "active" && licenca.dias_restantes >= 0
  );
  const monthlyRevenue = activeLicencas.reduce((total, licenca) => total + Number(licenca.valor_mensal ?? 0), 0);
  const expiringLicencas = activeLicencas.filter(
    (licenca) => licenca.dias_restantes >= 0 && licenca.dias_restantes <= 30
  );
  const expiredLicencas = licencas.filter(
    (licenca) =>
      licenca.status === "expired" ||
      (licenca.status === "active" && licenca.dias_restantes < 0)
  );
  const clientesComLicenca = prefeituras.filter(
    (prefeitura) => prefeitura.status === "active" && activeLicencas.some((licenca) => licenca.prefeitura_id === prefeitura.id)
  ).length;
  const licencasCriticas = licencas
    .filter(
      (licenca) =>
        licenca.status !== "cancelled" &&
        (licenca.dias_restantes < 0 || licenca.dias_restantes <= 30)
    )
    .sort((a, b) => a.dias_restantes - b.dias_restantes)
    .slice(0, 5);
  const clientesRecentes = prefeituras.slice(0, 5);
  const topModulos = modulos.filter((modulo) => modulo.ativo).sort(
    (a, b) => b.clientes_ativos - a.clientes_ativos
  );

  return (
    <AdminShell
      active="dashboard"
      icon={LayoutDashboard}
      profile={profile}
      title="Visão geral"
    >
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-5 md:p-5">
        <Card className="relative overflow-hidden border-primary/20 bg-primary text-primary-foreground">
          <div className="pointer-events-none absolute -right-20 -top-32 size-80 rounded-full border border-primary-foreground/10 bg-primary-foreground/5" />
          <CardContent className="relative flex flex-col gap-5 py-5 lg:flex-row lg:items-end lg:justify-between lg:py-6">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-primary-foreground/65">
                <BrandMark className="size-6" />
                Painel administrativo
              </div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">
                Visão da operação
              </h2>
              <p className="mt-2 max-w-xl text-sm text-primary-foreground/70">
                Acompanhe contratos, recebimentos e situações que precisam de atenção neste mês.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <QuickLink href="/cobrancas" label="Cobranças" />
              <QuickLink href="/licencas" label="Licenças" />
              <QuickLink href="/empresas" label="Empresas" />
            </div>
          </CardContent>
        </Card>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Indicadores principais">
          <MetricCard
            icon={Building2}
            label="Clientes com acesso"
            note={`de ${prefeituras.length} empresas cadastradas`}
            value={clientesComLicenca.toString()}
            href="/empresas"
          />
          <MetricCard
            icon={KeyRound}
            label="Licenças vigentes"
            note={`${expiringLicencas.length + expiredLicencas.length} exigem atenção`}
            value={activeLicencas.length.toString()}
            variant={expiringLicencas.length ? "warning" : "default"}
            href="/licencas"
          />
          <MetricCard
            icon={CircleDollarSign}
            label="Receita mensal prevista"
            note="licenças pagas vigentes"
            value={formatCurrency(monthlyRevenue)}
            href="/licencas"
          />
          <MetricCard
            icon={AlertTriangle}
            label="Saldo vencido"
            note={`${overduePayments.length} mensalidade(s) em atraso`}
            value={formatCurrency(overdueBalance)}
            variant={overduePayments.length ? "danger" : "default"}
            href="/cobrancas"
          />
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <div>
                <CardTitle>Financeiro do mês</CardTitle>
                <CardDescription>Competência {month.slice(5)}/{month.slice(0, 4)}</CardDescription>
              </div>
              <SectionLink href="/cobrancas" label="Ver cobranças" />
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-3">
                <FinancialStat icon={Wallet} label="Cobrado" value={formatCurrency(currentPayments.reduce((total, payment) => total + Number(payment.valor), 0))} />
                <FinancialStat icon={CheckCircle2} label="Recebido no mês" value={formatCurrency(receivedThisMonth)} />
                <FinancialStat icon={CalendarClock} label="A receber" value={formatCurrency(currentPayments.reduce((total, payment) => total + Math.max(0, Number(payment.valor) - Number(payment.valor_pago ?? 0)), 0))} />
              </div>
              <p className="mt-3 text-xs text-muted-foreground">Recebido considera a data do pagamento. A receber considera o saldo desta competência.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Acompanhamento</CardTitle>
              <CardDescription>Pendências de acesso e atendimento.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
              <AttentionLink href="/usuarios" icon={Users} label="Primeiro acesso pendente" count={pendingAccess} />
              <AttentionLink href="/atendimentos" icon={Headset} label="Atendimentos em aberto" count={suporte.count ?? 0} />
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Carteira de clientes</CardTitle>
              <CardDescription>
                Distribuição das empresas por status administrativo.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <PrefeituraStatusRow
                count={activePrefeituras}
                status="active"
                total={prefeituras.length}
              />
              <PrefeituraStatusRow
                count={
                  prefeituras.filter(
                    (prefeitura) => prefeitura.status === "suspended"
                  ).length
                }
                status="suspended"
                total={prefeituras.length}
              />
              <PrefeituraStatusRow
                count={
                  prefeituras.filter(
                    (prefeitura) => prefeitura.status === "expired"
                  ).length
                }
                status="expired"
                total={prefeituras.length}
              />
              <PrefeituraStatusRow
                count={
                  prefeituras.filter(
                    (prefeitura) => prefeitura.status === "cancelled"
                  ).length
                }
                status="cancelled"
                total={prefeituras.length}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <div>
              <CardTitle>Licenças em atenção</CardTitle>
              <CardDescription>
                Contratos vencidos ou próximos do fim da vigência.
              </CardDescription>
              </div>
              <SectionLink href="/licencas" label="Ver todas" />
            </CardHeader>
            <CardContent>
              {licencasCriticas.length ? (
                <div className="space-y-2">
                  {licencasCriticas.map((licenca) => (
                    <LicencaRow key={licenca.id} licenca={licenca} />
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={CheckCircle2}
                  text="Nenhuma licença crítica para os próximos 30 dias."
                />
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <div>
                <CardTitle>Cobranças vencidas</CardTitle>
                <CardDescription>Saldo em aberto após o vencimento.</CardDescription>
              </div>
              <SectionLink href="/cobrancas" label="Abrir cobranças" />
            </CardHeader>
            <CardContent className="space-y-2">
              {overduePayments.length ? overduePayments.slice(0, 4).map((payment) => (
                <Link key={payment.id} href={`/cobrancas?mes=${payment.competencia.slice(0, 7)}&status=overdue`} className="flex items-center justify-between gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{payment.licenca.prefeitura_nome}</p>
                    <p className="truncate text-xs text-muted-foreground">{payment.licenca.modulo_nome} · {formatDate(payment.vencimento)}</p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-destructive">{formatCurrency(Math.max(0, Number(payment.valor) - Number(payment.valor_pago ?? 0)))}</span>
                </Link>
              )) : <EmptyState icon={CheckCircle2} text="Nenhuma cobrança vencida." />}
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <Card className="xl:col-span-1">
            <CardHeader>
              <CardTitle>Módulos em operação</CardTitle>
              <CardDescription>
                Clientes e mensalidade prevista por produto.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {topModulos.length ? (
                <div className="space-y-2">
                  {topModulos.map((modulo) => (
                    <ModuloRow key={modulo.id} modulo={modulo} licencas={activeLicencas} />
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={ClipboardList}
                  text="Nenhum módulo ativo."
                />
              )}
            </CardContent>
          </Card>

          <Card className="xl:col-span-1">
            <CardHeader>
              <CardTitle>Clientes recentes</CardTitle>
              <CardDescription>
                Últimas empresas cadastradas no portal.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {clientesRecentes.length ? (
                <div className="space-y-2">
                  {clientesRecentes.map((prefeitura) => (
                    <PrefeituraRow
                      key={prefeitura.id}
                      prefeitura={prefeitura}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={Building2}
                  text="Nenhuma empresa cadastrada."
                />
              )}
            </CardContent>
          </Card>
        </section>
      </main>
    </AdminShell>
  );
}

type MetricCardProps = {
  icon: typeof Building2;
  href: string;
  label: string;
  note: string;
  value: string;
  variant?: "default" | "danger" | "warning";
};

function MetricCard({
  icon: Icon,
  href,
  label,
  note,
  value,
  variant = "default",
}: MetricCardProps) {
  return (
    <Link href={href} className="group rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
    <Card className="h-full transition-colors group-hover:border-foreground/20 group-hover:bg-muted/20">
      <CardContent className="flex items-center gap-3 py-4">
        <div
          className={cn(
            "flex size-10 items-center justify-center rounded-lg border",
            variant === "danger"
              ? "border-red-200 bg-red-50 text-red-700"
              : variant === "warning"
                ? "border-amber-200 bg-amber-50 text-amber-700"
                : "border-sky-200 bg-sky-50 text-sky-700"
          )}
        >
          <Icon className="size-5" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-xl font-semibold">{value}</div>
          <div className="truncate text-xs font-medium text-muted-foreground">
            {label}
          </div>
          <div className="truncate text-xs text-muted-foreground">{note}</div>
        </div>
      </CardContent>
    </Card>
    </Link>
  );
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return <Link href={href} className="inline-flex items-center gap-1 rounded-lg border border-primary-foreground/20 bg-primary-foreground/10 px-3 py-2 text-xs font-medium transition-colors hover:bg-primary-foreground/20">{label}<ArrowRight className="size-3.5" /></Link>;
}

function SectionLink({ href, label }: { href: string; label: string }) {
  return <Link href={href} className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">{label}<ArrowRight className="size-3.5" /></Link>;
}

function FinancialStat({ icon: Icon, label, value }: { icon: typeof Wallet; label: string; value: string }) {
  return <div className="rounded-xl border bg-muted/20 p-3"><div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className="size-4" />{label}</div><p className="mt-2 text-lg font-semibold tabular-nums">{value}</p></div>;
}

function AttentionLink({ href, icon: Icon, label, count }: { href: string; icon: typeof Users; label: string; count: number }) {
  return <Link href={href} className="flex items-center gap-3 rounded-xl border p-3 transition-colors hover:bg-muted/50"><span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"><Icon className="size-4" /></span><span className="min-w-0 flex-1 truncate text-sm">{label}</span><span className="text-sm font-semibold tabular-nums">{count}</span><ArrowRight className="size-4 text-muted-foreground" /></Link>;
}

function PrefeituraStatusRow({
  count,
  status,
  total,
}: {
  count: number;
  status: PrefeituraStatus;
  total: number;
}) {
  const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
  const meta = prefeituraStatusMeta[status];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge className={meta.badge} variant="outline">
            {formatPrefeituraStatus(status)}
          </Badge>
          <span className="text-sm text-muted-foreground">
            {count} empresa(s)
          </span>
        </div>
        <span className="text-sm font-medium">{percentage}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full", meta.bar)}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function LicencaRow({ licenca }: { licenca: Licenca }) {
  const isExpired = licenca.dias_restantes < 0 || licenca.status === "expired";
  const isExpiring = !isExpired && licenca.dias_restantes <= 30;

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2">
      <div className="flex min-w-0 items-center gap-3">
        <div
          className={cn(
            "flex size-9 items-center justify-center rounded-lg border",
            isExpired
              ? "border-red-200 bg-red-50 text-red-700"
              : isExpiring
                ? "border-amber-200 bg-amber-50 text-amber-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-700"
          )}
        >
          {isExpired ? (
            <AlertTriangle className="size-4" />
          ) : (
            <CalendarClock className="size-4" />
          )}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">
            {licenca.prefeitura_nome}
          </div>
          <div className="truncate text-xs text-muted-foreground">
            {licenca.modulo_nome} · vence em {formatDate(licenca.fim)}
          </div>
        </div>
      </div>
      <div className="text-right">
        <div className="text-sm font-semibold">
          {Number(licenca.valor_mensal) === 0 ? "Gratuita" : formatCurrency(licenca.pagamentos.filter(p => p.contrato_id === licenca.contrato.id && p.status !== "cancelled").reduce((n,p)=>n+Number(p.valor),0))}
        </div>
        <Badge
          className={
            isExpired
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-amber-200 bg-amber-50 text-amber-700"
          }
          variant="outline"
        >
          {formatDays(licenca.dias_restantes)}
        </Badge>
      </div>
    </div>
  );
}

function ModuloRow({ modulo, licencas }: { modulo: Modulo; licencas: Licenca[] }) {
  const isFrotas = modulo.slug.includes("frota");
  const Icon = isFrotas ? Car : ClipboardList;
  const licencasModulo = licencas.filter((licenca) => licenca.modulo_id === modulo.id);
  const mensalidade = licencasModulo.reduce((total, licenca) => total + Number(licenca.valor_mensal ?? 0), 0);

  return (
    <div className={cn("rounded-xl border px-3 py-3", isFrotas ? "border-blue-200 bg-blue-50/50" : "border-emerald-200 bg-emerald-50/50")}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className={cn("flex size-9 items-center justify-center rounded-lg", isFrotas ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700")}>
            <Icon className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{modulo.nome}</div>
            <div className="truncate text-xs text-muted-foreground">
              {licencasModulo.length} cliente(s) com licença vigente
            </div>
          </div>
        </div>
        <Badge
          className={
            modulo.ativo
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-zinc-200 bg-zinc-50 text-zinc-700"
          }
          variant="outline"
        >
          {modulo.ativo ? "Ativo" : "Inativo"}
        </Badge>
      </div>
      <div className="mt-3 border-t border-current/10 pt-3 text-sm">
        <span className="text-xs text-muted-foreground">Receita mensal prevista</span>
        <p className="text-lg font-semibold tabular-nums">{formatCurrency(mensalidade)}</p>
      </div>
    </div>
  );
}

function PrefeituraRow({ prefeitura }: { prefeitura: Prefeitura }) {
  const meta = prefeituraStatusMeta[prefeitura.status];

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2">
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{prefeitura.nome}</div>
        <div className="truncate text-xs text-muted-foreground">
          {prefeitura.cidade || "Cidade não informada"}
          {prefeitura.uf ? ` · ${prefeitura.uf}` : ""}
        </div>
      </div>
      <div className="text-right">
        <Badge className={meta.badge} variant="outline">
          {formatPrefeituraStatus(prefeitura.status)}
        </Badge>
        <div className="mt-1 text-xs text-muted-foreground">
          {prefeitura.licencas_ativas} licença(s)
        </div>
      </div>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  text,
}: {
  icon: typeof AlertTriangle;
  text: string;
}) {
  return (
    <div className="flex min-h-24 items-center justify-center rounded-lg border border-dashed bg-muted/20 px-4 text-center text-sm text-muted-foreground">
      <div>
        <Icon className="mx-auto mb-2 size-5" />
        {text}
      </div>
    </div>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    currency: "BRL",
    maximumFractionDigits: 2,
    style: "currency",
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function formatDays(days: number) {
  if (days < 0) {
    return `Vencida há ${Math.abs(days)} dia(s)`;
  }

  if (days === 0) {
    return "Vence hoje";
  }

  return `Vence em ${days} dia(s)`;
}
