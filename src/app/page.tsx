import {
  Activity,
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
  formatUsuarioRole,
  getUsuarios,
  type Usuario,
  type UsuarioRole,
} from "@/lib/usuarios-data";
import { cn } from "@/lib/utils";

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

const usuarioRoleMeta: Record<
  UsuarioRole,
  {
    badge: string;
    label: string;
  }
> = {
  bdl_admin: {
    badge: "border-sky-200 bg-sky-50 text-sky-700",
    label: "Master",
  },
  municipal_admin: {
    badge: "border-violet-200 bg-violet-50 text-violet-700",
    label: "Administradores",
  },
  municipal_user: {
    badge: "border-zinc-200 bg-zinc-50 text-zinc-700",
    label: "Usuários",
  },
};

export default async function Home() {
  const profile = await requireRole(["bdl_admin"]);
  const [prefeituras, licencas, modulos, usuarios] = await Promise.all([
    getPrefeituras(),
    getLicencas(),
    getModulos(),
    getUsuarios(),
  ]);

  const activePrefeituras = prefeituras.filter(
    (prefeitura) => prefeitura.status === "active"
  ).length;
  const activeLicencas = licencas.filter(
    (licenca) => licenca.status === "active"
  );
  const expiringLicencas = activeLicencas.filter(
    (licenca) => licenca.dias_restantes >= 0 && licenca.dias_restantes <= 30
  );
  const expiredLicencas = licencas.filter(
    (licenca) =>
      licenca.status === "expired" ||
      (licenca.status === "active" && licenca.dias_restantes < 0)
  );
  const receitaAnual = activeLicencas.reduce(
    (total, licenca) => total + licenca.pagamentos.filter(p => p.contrato_id === licenca.contrato.id && p.status !== "cancelled").reduce((n,p)=>n+Number(p.valor),0),
    0
  );
  const usuariosAtivos = usuarios.filter((usuario) => usuario.ativo).length;
  const modulosAtivos = modulos.filter((modulo) => modulo.ativo).length;
  const clientesComLicenca = prefeituras.filter(
    (prefeitura) => prefeitura.licencas_ativas > 0
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
  const topModulos = [...modulos].sort(
    (a, b) => b.clientes_ativos - a.clientes_ativos
  );

  return (
    <AdminShell
      active="dashboard"
      icon={LayoutDashboard}
      profile={profile}
      title="Visão geral"
    >
      <main className="flex flex-1 flex-col gap-4 p-4">
        <Card className="border-foreground/10 bg-gradient-to-r from-card via-card to-muted/40">
          <CardContent className="flex flex-col gap-4 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <BrandMark className="size-6" />
                Portal administrativo
              </div>
              <h2 className="mt-1 truncate text-2xl font-semibold">
                Vibe Tech
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Panorama comercial e operacional dos clientes, módulos,
                licenças e acessos.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-right">
              <HeroStat
                label="Clientes ativos"
                value={`${activePrefeituras}/${prefeituras.length}`}
              />
              <HeroStat label="Módulos ativos" value={`${modulosAtivos}`} />
              <HeroStat
                label="Atenções"
                value={`${expiringLicencas.length + expiredLicencas.length}`}
              />
            </div>
          </CardContent>
        </Card>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <MetricCard
            icon={Building2}
            label="Empresas"
            note={`${clientesComLicenca} com licença ativa`}
            value={prefeituras.length.toString()}
          />
          <MetricCard
            icon={KeyRound}
            label="Licenças ativas"
            note={`${expiringLicencas.length} vencendo em 30 dias`}
            value={activeLicencas.length.toString()}
            variant={expiringLicencas.length ? "warning" : "default"}
          />
          <MetricCard
            icon={CircleDollarSign}
            label="Total contratado"
            note="Contratos atuais das licenças ativas"
            value={formatCurrency(receitaAnual)}
          />
          <MetricCard
            icon={Users}
            label="Usuários ativos"
            note={`${usuarios.length - usuariosAtivos} inativo(s)`}
            value={usuariosAtivos.toString()}
          />
          <MetricCard
            icon={ClipboardList}
            label="Módulos cadastrados"
            note={`${modulosAtivos} disponível(is)`}
            value={modulos.length.toString()}
          />
        </section>

        <section className="grid gap-4 xl:grid-cols-[1fr_1.25fr]">
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
            <CardHeader>
              <CardTitle>Licenças em atenção</CardTitle>
              <CardDescription>
                Contratos vencidos ou próximos do encerramento anual.
              </CardDescription>
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
        </section>

        <section className="grid gap-4 xl:grid-cols-3">
          <Card className="xl:col-span-1">
            <CardHeader>
              <CardTitle>Módulos</CardTitle>
              <CardDescription>
                Aderência dos módulos por clientes ativos.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {topModulos.length ? (
                <div className="space-y-2">
                  {topModulos.map((modulo) => (
                    <ModuloRow key={modulo.id} modulo={modulo} />
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={ClipboardList}
                  text="Nenhum módulo cadastrado."
                />
              )}
            </CardContent>
          </Card>

          <Card className="xl:col-span-1">
            <CardHeader>
              <CardTitle>Acessos</CardTitle>
              <CardDescription>
                Distribuição dos usuários por perfil de acesso.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <UsuarioRoleRow role="bdl_admin" usuarios={usuarios} />
              <UsuarioRoleRow role="municipal_admin" usuarios={usuarios} />
              <UsuarioRoleRow role="municipal_user" usuarios={usuarios} />
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
  icon: typeof Activity;
  label: string;
  note: string;
  value: string;
  variant?: "default" | "danger" | "warning";
};

function MetricCard({
  icon: Icon,
  label,
  note,
  value,
  variant = "default",
}: MetricCardProps) {
  return (
    <Card>
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
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-background/80 px-4 py-3">
      <div className="text-lg font-semibold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
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
          {formatCurrency(licenca.pagamentos.filter(p => p.contrato_id === licenca.contrato.id && p.status !== "cancelled").reduce((n,p)=>n+Number(p.valor),0))}
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

function ModuloRow({ modulo }: { modulo: Modulo }) {
  const Icon = modulo.nome.toLowerCase().includes("frota") ? Car : ClipboardList;

  return (
    <div className="rounded-lg border bg-background px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg border border-sky-200 bg-sky-50 text-sky-700">
            <Icon className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{modulo.nome}</div>
            <div className="truncate text-xs text-muted-foreground">
              {modulo.subdominio}
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
      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <SmallStat label="Clientes" value={modulo.clientes_ativos} />
        <SmallStat
          label="Receita"
          value={formatCurrency(modulo.receita_anual)}
          valueClassName="text-sm"
        />
      </div>
    </div>
  );
}

function UsuarioRoleRow({
  role,
  usuarios,
}: {
  role: UsuarioRole;
  usuarios: Usuario[];
}) {
  const count = usuarios.filter((usuario) => usuario.role === role).length;
  const active = usuarios.filter(
    (usuario) => usuario.role === role && usuario.ativo
  ).length;
  const meta = usuarioRoleMeta[role];

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2">
      <div className="min-w-0">
        <Badge className={meta.badge} variant="outline">
          {formatUsuarioRole(role)}
        </Badge>
        <div className="mt-1 truncate text-xs text-muted-foreground">
          {active} ativo(s)
        </div>
      </div>
      <div className="text-xl font-semibold">{count}</div>
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

function SmallStat({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: number | string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-lg border bg-muted/30 px-3 py-2">
      <div className={cn("text-lg font-semibold", valueClassName)}>{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
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
