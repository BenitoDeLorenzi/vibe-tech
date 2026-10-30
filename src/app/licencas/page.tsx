import { ListPanelHeader } from "@/components/list-panel-header";
import { ListMetrics } from "@/components/list-metrics";
import { AdminMobileFilters } from "@/components/admin-mobile-filters";
import { AdminMobileList } from "@/components/admin-mobile-list";
import { AdminMobileCard } from "@/components/admin-mobile-card";
import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";
import {
  CalendarDays,
  Ban,
  CircleCheck,
  CircleX,
  Clock3,
  KeyRound,
  Pencil,
  Plus,
  Search,
  RefreshCw,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatCurrency,
  formatDate,
  formatDaysRemaining,
  formatLicencaStatus,
  getLicencaFormOptions,
  getLicencas,
  type LicencaStatus,
  type LicencaVigenciaStatus,
} from "@/lib/licencas-data";
import { requireRole } from "@/lib/auth-data";
import { LicencaRenewForm } from "./licenca-renew-form";
import { LicencaForm } from "./licenca-form";
import { CancelLicencaForm } from "./cancel-licenca-form";
import { todayInSaoPaulo } from "@/lib/license-schedule";
import { LicencasToasts } from "./licencas-toasts";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{
    deleted?: string;
    error?: string;
    q?: string;
    status?: string;
  }>;
};



const filterOptions = [
  { label: "Todas", status: undefined },
  { label: "Ativas", status: "active" },
  { label: "Suspensas", status: "suspended" },
  { label: "Vencidas", status: "expired" },
  { label: "Canceladas", status: "cancelled" },
];

export default async function LicencasPage({ searchParams }: PageProps) {
  const profile = await requireRole(["bdl_admin"]);

  const params = await searchParams;
  const defaultInicio = getTodayIsoDate();
  const defaultFim = addOneYearIsoDate(defaultInicio);
  const [licencas, formOptions] = await Promise.all([
    getLicencas({
      query: params.q,
      status: params.status,
    }),
    getLicencaFormOptions(),
  ]);
  const activeCount = licencas.filter((licenca) => licenca.status === "active")
    .length;
  const searchTerm = params.q?.trim();
  const hasActiveFilters = Boolean(searchTerm || params.status);
  const buildFilterHref = (status?: string) => {
    const query = new URLSearchParams();

    if (searchTerm) {
      query.set("q", searchTerm);
    }

    if (status) {
      query.set("status", status);
    }

    const queryString = query.toString();
    return `/licencas${queryString ? `?${queryString}` : ""}`;
  };

  return (
    <AdminShell
      active="licencas"
      icon={KeyRound}
      profile={profile}
      title="Licenças"
      actions={
        <div className="flex w-full min-w-0 items-center justify-end gap-2">
          <AdminMobileFilters key={`${params.q ?? ""}:${params.status ?? ""}`} pathname="/licencas" title="Licenças" query={params.q} status={params.status} statusOptions={filterOptions.map(option => ({ value: option.status ?? "all", label: option.label }))} />
          <Dialog><DialogTrigger aria-label="Nova licença" className={buttonVariants({ size: "icon", className: "md:hidden" })}><Plus className="size-4" /></DialogTrigger><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg"><DialogHeader><DialogTitle>Nova licença</DialogTitle></DialogHeader><LicencaForm defaultFim={defaultFim} defaultInicio={defaultInicio} modulos={formOptions.modulos} prefeituras={formOptions.prefeituras} /></DialogContent></Dialog>
          <div className="hidden min-w-0 items-center justify-end gap-2 md:flex">
          <form className="flex min-w-0 shrink-0 justify-end gap-2">
            <div className="relative min-w-0 w-[320px]">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-9 pl-9"
                name="q"
                placeholder="Buscar licença"
                defaultValue={params.q}
              />
            </div>
            {params.status ? (
              <input type="hidden" name="status" value={params.status} />
            ) : null}
            {hasActiveFilters ? (
              <Link
                href="/licencas"
                className={buttonVariants({
                  variant: "outline",
                  className: "h-9 gap-2",
                })}
              >
                <X className="size-4" />
                Limpar
              </Link>
            ) : (
              <button
                type="submit"
                className={buttonVariants({
                  variant: "outline",
                  className: "h-9 gap-2",
                })}
              >
                <Search className="size-4" />
                Filtrar
              </button>
            )}
          </form>

          <div className="flex shrink-0 gap-1 overflow-x-auto rounded-lg bg-muted p-1">
            {filterOptions.map((option) => {
              const isActive = option.status
                ? params.status === option.status
                : !params.status;

              return (
                <Link
                  key={option.label}
                  href={buildFilterHref(option.status)}
                  className={buttonVariants({
                    variant: isActive ? "default" : "ghost",
                    size: "sm",
                    className: isActive
                      ? "h-7 px-2 text-xs shadow-sm"
                      : "h-7 px-2 text-xs text-muted-foreground",
                  })}
                >
                  {option.label}
                </Link>
              );
            })}
          </div>

          <Separator orientation="vertical" className="hidden h-5 xl:block" />

          <Dialog>
            <DialogTrigger
              className={buttonVariants({
                className: "h-9 shrink-0 gap-2",
              })}
            >
              <Plus className="size-4" />
              Nova licença
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Nova licença</DialogTitle>
              </DialogHeader>
              <LicencaForm
                defaultFim={defaultFim}
                defaultInicio={defaultInicio}
                modulos={formOptions.modulos}
                prefeituras={formOptions.prefeituras}
              />
            </DialogContent>
          </Dialog>
          </div>
        </div>
      }
    >
      <LicencasToasts deleted={params.deleted} error={params.error} />
      <main className="flex flex-1 flex-col gap-3 p-4 md:p-4">
          <Card className="gap-0 overflow-visible bg-transparent py-0 ring-0 md:gap-(--card-spacing) md:overflow-hidden md:bg-card md:py-(--card-spacing) md:ring-1">
            <ListPanelHeader mobileMetricsOnly
              title="Licenças cadastradas"
              icon={KeyRound}
              metrics={<ListMetrics items={[
                { label: "Ativas", value: activeCount, tone: "success" },
                { label: "Total", value: licencas.length },
              ]} />}
            />
            <CardContent className="px-0 md:px-(--card-spacing)">
              {licencas.length ? (
                <>
                <AdminMobileList key={`${params.q ?? ""}:${params.status ?? ""}`} items={licencas.map(licenca => <AdminMobileCard key={licenca.id}
                  title={licenca.prefeitura_nome} subtitle={`${licenca.modulo_nome} · ${licenca.prefeitura_cnpj}`}
                  badge={<LicencaStatusBadge status={licenca.status} />}
                  details={[{ label: "Vigência", value: `${formatDate(licenca.inicio)} a ${formatDate(licenca.fim)}` }, { label: "Mensalidade", value: formatCurrency(licenca.valor_mensal) }, { label: "Situação", value: <LicencaVigenciaBadge diasRestantes={licenca.dias_restantes} status={licenca.vigencia_status} /> }]}
                  actions={<LicencaActions licenca={licenca} modulos={formOptions.modulos} prefeituras={formOptions.prefeituras} />} />)} />
                <div className="hidden overflow-hidden rounded-lg border md:block">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Empresa</TableHead>
                        <TableHead>Módulo</TableHead>
                        <TableHead>Vigência</TableHead>
                        <TableHead>Cobrança</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-[92px] text-right">
                          Ações
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {licencas.map((licenca) => (
                        <TableRow key={licenca.id}>
                          <TableCell>
                            <div className="font-medium">
                              {licenca.prefeitura_nome}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {licenca.prefeitura_cnpj}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{licenca.modulo_nome}</div>
                            <div className="text-xs text-muted-foreground">
                              {licenca.modulo_subdominio}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 text-sm">
                                <CalendarDays className="size-4 text-muted-foreground" />
                                {formatDate(licenca.inicio)} até{" "}
                                {formatDate(licenca.fim)}
                              </div>
                              <LicencaVigenciaBadge
                                diasRestantes={licenca.dias_restantes}
                                status={licenca.vigencia_status}
                              />
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">
                              {formatCurrency(licenca.valor_mensal)}/mês
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Contrato: {formatCurrency(licenca.pagamentos.filter(p => p.contrato_id === licenca.contrato.id && p.status !== "cancelled").reduce((n,p)=>n+Number(p.valor),0))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <LicencaStatusBadge status={licenca.status} />
                          </TableCell>
                          <TableCell>
                            <LicencaActions licenca={licenca} modulos={formOptions.modulos} prefeituras={formOptions.prefeituras} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                </>
              ) : (
                <div className="flex min-h-[320px] flex-col items-center justify-center rounded-lg border bg-muted/20 p-8 text-center">
                  <div className="flex size-12 items-center justify-center rounded-lg border bg-background">
                    <KeyRound className="size-6 text-muted-foreground" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold">
                    Nenhuma licença encontrada
                  </h3>
                  <p className="mt-1 max-w-md text-sm text-muted-foreground">
                    Cadastre uma licença para liberar um módulo para uma
                    empresa.
                  </p>
                  <Dialog>
                    <DialogTrigger
                      className={buttonVariants({
                        className: "mt-4 gap-2",
                      })}
                    >
                      <Plus className="size-4" />
                      Cadastrar licença
                    </DialogTrigger>
                    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
                      <DialogHeader>
                        <DialogTitle>Nova licença</DialogTitle>
                      </DialogHeader>
                      <LicencaForm
                        defaultFim={defaultFim}
                        defaultInicio={defaultInicio}
                        modulos={formOptions.modulos}
                        prefeituras={formOptions.prefeituras}
                      />
                    </DialogContent>
                  </Dialog>
                </div>
              )}
            </CardContent>
          </Card>
        </main>
    </AdminShell>
  );
}

function LicencaActions({ licenca, modulos, prefeituras }: { licenca: Awaited<ReturnType<typeof getLicencas>>[number]; modulos: Awaited<ReturnType<typeof getLicencaFormOptions>>["modulos"]; prefeituras: Awaited<ReturnType<typeof getLicencaFormOptions>>["prefeituras"] }) {
  return (
                            <div className="flex justify-end gap-1">
                              {licenca.status !== "cancelled" && <Dialog>
                                <Tooltip>
                                  <TooltipTrigger render={<DialogTrigger
                                    aria-label="Editar licença"
                                    className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
                                  ><Pencil className="size-4" /></DialogTrigger>} />
                                  <TooltipContent>Editar licença</TooltipContent>
                                </Tooltip>
                                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
                                  <DialogHeader>
                                    <DialogTitle>Editar licença</DialogTitle>
                                  </DialogHeader>
                                  <LicencaForm
                                    licenca={licenca}
                                    modulos={modulos}
                                    prefeituras={prefeituras}
                                  />
                                </DialogContent>
                              </Dialog>}

                              {licenca.status !== "cancelled" && <Dialog>
                                <Tooltip>
                                  <TooltipTrigger render={<DialogTrigger
                                    aria-label="Renovar licença"
                                    className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
                                  ><RefreshCw className="size-4" /></DialogTrigger>} />
                                  <TooltipContent>Renovar licença</TooltipContent>
                                </Tooltip>
                                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
                                  <DialogHeader>
                                    <DialogTitle>Renovar licença</DialogTitle>
                                    <DialogDescription>
                                      Novo período de{" "}
                                      {licenca.modulo_nome} para{" "}
                                      {licenca.prefeitura_nome}.
                                    </DialogDescription>
                                  </DialogHeader>
                                  <LicencaRenewForm licenca={licenca} />
                                </DialogContent>
                              </Dialog>}
                              {licenca.status !== "cancelled" && <Dialog>
                                <Tooltip>
                                  <TooltipTrigger render={<DialogTrigger aria-label="Cancelar licença" className={buttonVariants({ variant: "ghost", size: "icon-sm", className: "text-destructive hover:bg-destructive/10 hover:text-destructive" })}><Ban className="size-4" /></DialogTrigger>} />
                                  <TooltipContent>Cancelar licença</TooltipContent>
                                </Tooltip>
                                <DialogContent className="sm:max-w-md">
                                  <DialogHeader>
                                    <DialogTitle>Cancelar licença</DialogTitle>
                                    <DialogDescription>{licenca.modulo_nome} · {licenca.prefeitura_nome}</DialogDescription>
                                  </DialogHeader>
                                  <CancelLicencaForm id={licenca.id} futureCount={licenca.pagamentos.filter(p => p.competencia > todayInSaoPaulo().slice(0, 7) + "-01" && (p.status === "open" || p.status === "overdue") && !Number(p.valor_pago)).length} />
                                </DialogContent>
                              </Dialog>}
                            </div>
  );
}

function LicencaStatusBadge({ status }: { status: LicencaStatus }) {
  const styles: Record<LicencaStatus, string> = {
    active:
      "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50",
    cancelled:
      "border-zinc-200 bg-zinc-100 text-zinc-700 hover:bg-zinc-100",
    expired: "border-red-200 bg-red-50 text-red-700 hover:bg-red-50",
    suspended: "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50",
  };
  const icons = {
    active: CircleCheck,
    cancelled: CircleX,
    expired: Clock3,
    suspended: Clock3,
  } satisfies Record<LicencaStatus, typeof CircleCheck>;
  const Icon = icons[status];

  return (
    <Badge variant="outline" className={styles[status]}>
      <Icon className="size-3.5" />
      {formatLicencaStatus(status)}
    </Badge>
  );
}

function LicencaVigenciaBadge({
  diasRestantes,
  status,
}: {
  diasRestantes: number;
  status: LicencaVigenciaStatus;
}) {
  const styles: Record<LicencaVigenciaStatus, string> = {
    active:
      "border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-50",
    expired: "border-red-200 bg-red-50 text-red-700 hover:bg-red-50",
    expiring: "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50",
  };
  const icons = {
    active: CircleCheck,
    expired: Clock3,
    expiring: Clock3,
  } satisfies Record<LicencaVigenciaStatus, typeof CircleCheck>;
  const Icon = icons[status];

  return (
    <Badge variant="outline" className={styles[status]}>
      <Icon className="size-3.5" />
      {formatDaysRemaining(diasRestantes)}
    </Badge>
  );
}

function getTodayIsoDate() {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Sao_Paulo",
    year: "numeric",
  }).formatToParts(new Date());
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";

  return `${year}-${month}-${day}`;
}

function addOneYearIsoDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const nextDate = new Date(Date.UTC(year + 1, month - 1, day));

  if (nextDate.getUTCMonth() !== month - 1) {
    nextDate.setUTCDate(0);
  }

  nextDate.setUTCDate(nextDate.getUTCDate() - 1);
  return [
    nextDate.getUTCFullYear(),
    String(nextDate.getUTCMonth() + 1).padStart(2, "0"),
    String(nextDate.getUTCDate()).padStart(2, "0"),
  ].join("-");
}
