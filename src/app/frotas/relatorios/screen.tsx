import { emptyFleetPage, getFrotaListPage, orderPageItems } from "@/lib/frotas-list-page";
import { getFrotasLoadingData } from "@/app/frotas/frotas-loading-data";
import { TableLoadingRows } from "@/components/table-loading";
import { ListDeleteButton } from "@/components/list-delete-button";
import { ListMetrics } from "@/components/list-metrics";
import { ListPagination } from "@/components/list-pagination";
import Link from "next/link";
import { forbidden } from "next/navigation";
import {
  Archive,
  CalendarClock,
  Car,
  Eye,
  FileText,
  Fuel,
  Plus,
  Printer,
  Search,
  Trash2,
  Wrench,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
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
import { HeaderSeparator } from "@/components/header-separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { requireUserProfile } from "@/lib/auth-data";
import { getAbastecimentosData } from "@/lib/frotas-data";
import { getFrotasPermissionAccess } from "@/lib/frotas-permissions";
import {
  formatRelatorioStatus,
  getRelatorios,
  reportTypeOptions,
  type FrotaRelatorio,
  type RelatorioStatus,
  type RelatorioTipo,
} from "@/lib/relatorios-data";
import { cn } from "@/lib/utils";
import { FrotasShell } from "../frotas-shell";
import { deleteRelatorio } from "./actions";
import { RelatorioForm } from "./relatorio-form";

export const dynamic = "force-dynamic";

type PageProps = {
  loading?: boolean;
  searchParams: Promise<{
    prefeitura?: string;
    q?: string;
    status?: string;
    tipo?: string;
    size?: string; page?: string;
  }>;
};

const reportTypeStyles: Record<RelatorioTipo, string> = {
  expirations: "border-amber-200 bg-amber-50 text-amber-700",
  fuel: "border-sky-200 bg-sky-50 text-sky-700",
  maintenance: "border-violet-200 bg-violet-50 text-violet-700",
  vehicles: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

const reportTypeIcons = {
  expirations: CalendarClock,
  fuel: Fuel,
  maintenance: Wrench,
  vehicles: Car,
} satisfies Record<RelatorioTipo, typeof Fuel>;

const reportNames: Record<RelatorioTipo, string> = {
  expirations: "Débitos",
  fuel: "Abastecimento",
  maintenance: "Manutenção",
  vehicles: "Veículos",
};

const reportStatusStyles: Record<RelatorioStatus, string> = {
  archived: "border-zinc-200 bg-zinc-50 text-zinc-700",
  cancelled: "border-red-200 bg-red-50 text-red-700",
  generated: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

export default async function RelatoriosPage({ searchParams, loading = false }: PageProps) {
  const profile = await requireUserProfile();
  const access = await getFrotasPermissionAccess(profile);

  if (!access.canViewRelatorios) {
    forbidden();
  }

  const params = await searchParams;
  const prefeituraId =
    profile.role === "bdl_admin"
      ? params.prefeitura
      : profile.prefeitura_id ?? undefined;
  const databasePage = loading ? emptyFleetPage : await getFrotaListPage(profile, "relatorios", params);
  const [data, relatorios] = await Promise.all([
    loading ? getFrotasLoadingData(profile, prefeituraId) : getAbastecimentosData({ prefeituraId: databasePage.empresaId ?? prefeituraId, ids: [], lightweight: true }),
    loading ? Promise.resolve([]) : getRelatorios({
      ids: databasePage.ids,
      prefeituraId: databasePage.empresaId ?? prefeituraId,
      query: params.q,
      status: params.status,
      tipo: params.tipo,
    }),
  ]);
  const buildFilterHref = (values: {
    status?: string | null;
    tipo?: string | null;
  }) => {
    const query = new URLSearchParams();
    const tipo = Object.hasOwn(values, "tipo") ? values.tipo : params.tipo;
    const status = Object.hasOwn(values, "status")
      ? values.status
      : params.status;

    if (params.q?.trim()) {
      query.set("q", params.q.trim());
    }

    if (tipo && tipo !== "all") {
      query.set("tipo", tipo);
    }

    if (status && status !== "all") {
      query.set("status", status);
    }

    if (data.selectedPrefeituraId) {
      query.set("prefeitura", data.selectedPrefeituraId);
    }

    const queryString = query.toString();
    return `/frotas/relatorios${queryString ? `?${queryString}` : ""}`;
  };
  const reportPage = { ...databasePage, items: orderPageItems(relatorios, databasePage) };

  return (
    <FrotasShell
      loading={loading}
      active="relatorios"
      actions={
        <RelatoriosToolbar
          buildFilterHref={buildFilterHref}
          canCreate={access.canCreateRelatorios}
          data={data}
          params={params}
        />
      }
      icon={FileText}
      prefeituras={data.prefeituras}
      profile={profile}
      selectedPrefeituraId={data.selectedPrefeituraId}
      title="Relatórios"
    >
      <main className="flex min-h-full flex-col gap-4 p-4">
        <Card className="flex flex-1 flex-col">
          <CardHeader>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>Relatórios criados</CardTitle>
              </div>
              <ListMetrics
                loading={loading}
                items={[
                  { label: "Total", value: databasePage.total },
                ]}
              />
            </div>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col">
            {loading || relatorios.length ? (
              <div className="overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Relatório</TableHead>
                      <TableHead>Criado por</TableHead>
                      <TableHead>Emissão</TableHead>
                      <TableHead>Período</TableHead>
                      <TableHead>Registros</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[88px] text-right">
                        Ações
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? <TableLoadingRows columns={8} /> : reportPage.items.map((relatorio) => (
                      <RelatorioRow key={relatorio.id} relatorio={relatorio} canDelete={profile.role === "bdl_admin"} />
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <EmptyReportsState
                canCreate={access.canCreateRelatorios}
                data={data}
                profile={profile}

                showPrefeituraField={profile.role === "bdl_admin"}
              />
            )}
            {!loading && <ListPagination page={reportPage.page} pageCount={reportPage.pageCount} pathname="/frotas/relatorios" params={{ size: params.size, prefeitura: prefeituraId, q: params.q, status: params.status, tipo: params.tipo }} />}
          </CardContent>
        </Card>
      </main>
    </FrotasShell>
  );
}

function RelatoriosToolbar({
  buildFilterHref,
  canCreate,
  data,
  params,
}: {
  buildFilterHref: (values: {
    status?: string | null;
    tipo?: string | null;
  }) => string;
  canCreate: boolean;
  data: Awaited<ReturnType<typeof getAbastecimentosData>>;
  params: Awaited<PageProps["searchParams"]>;
}) {
  const hasFilters = Boolean(params.q?.trim() || params.tipo || params.status);

  return (
    <div className="flex w-full min-w-0 items-center justify-end gap-2">
      <form className="hidden min-w-0 shrink-0 gap-2 xl:flex">
        <div className="relative min-w-0 w-[280px]">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-9 pl-9"
            name="q"
            placeholder="Buscar relatório"
            defaultValue={params.q}
          />
        </div>
        {params.tipo ? <input name="tipo" type="hidden" value={params.tipo} /> : null}
        {params.status ? (
          <input name="status" type="hidden" value={params.status} />
        ) : null}
        {data.selectedPrefeituraId ? (
          <input name="prefeitura" type="hidden" value={data.selectedPrefeituraId} />
        ) : null}
        {hasFilters ? (
          <Link
            className={buttonVariants({
              className: "h-9 gap-2",
              variant: "outline",
            })}
            href="/frotas/relatorios"
          >
            <X className="size-4" />
            Limpar
          </Link>
        ) : (
          <Button className="h-9" type="submit" variant="outline">
            <Search className="size-4" />
            Filtrar
          </Button>
        )}
      </form>

      <div className="hidden shrink-0 gap-1 rounded-lg bg-muted p-1 lg:flex">
        {reportTypeOptions.map((option) => {
          const isActive = option.value === (params.tipo ?? "all");

          return (
            <Link
              key={option.value}
              href={buildFilterHref({ tipo: option.value })}
              className={buttonVariants({
                className: isActive
                  ? "h-7 shrink-0 px-2 text-xs shadow-sm"
                  : "h-7 shrink-0 px-2 text-xs text-muted-foreground",
                size: "sm",
                variant: isActive ? "default" : "ghost",
              })}
            >
              {option.label}
            </Link>
          );
        })}
      </div>

      {canCreate && <HeaderSeparator className="hidden xl:block" />}

      {canCreate && <Dialog>
        <DialogTrigger
          className={buttonVariants({
            className: "h-9 shrink-0 gap-2",
          })}
        >
          <Plus className="size-4" />
          Novo relatório
        </DialogTrigger>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Novo relatório</DialogTitle>
          </DialogHeader>
          <RelatorioForm
            postos={data.postos}
            prefeituras={data.prefeituras}
            selectedPrefeituraId={data.selectedPrefeituraId}

            showPrefeituraField={false}
            veiculos={data.veiculos}
          />
        </DialogContent>
      </Dialog>}
    </div>
  );
}

function RelatorioRow({ relatorio, canDelete }: { relatorio: FrotaRelatorio; canDelete: boolean }) {
  const ReportIcon = reportTypeIcons[relatorio.tipo];
  return (
    <TableRow>
      <TableCell>
        <Badge variant="outline" className={cn(reportTypeStyles[relatorio.tipo], "h-7 gap-1.5 text-sm font-normal [&>svg]:size-4!")}>
          <ReportIcon className="size-4 shrink-0" aria-hidden="true" />
          {reportNames[relatorio.tipo]}
        </Badge>
      </TableCell>
      <TableCell>{relatorio.criado_por ?? "-"}</TableCell>
      <TableCell className="tabular-nums">{formatDateTime(relatorio.created_at)}</TableCell>
      <TableCell>{formatReportPeriod(relatorio)}</TableCell>
      <TableCell>{relatorio.total_registros}</TableCell>
      <TableCell className="text-right font-medium tabular-nums">{formatCurrency(relatorio.valor_total)}</TableCell>
      <TableCell>
        <Badge
          className={reportStatusStyles[relatorio.status]}
          variant="outline"
        >
          {relatorio.status === "archived" ? (
            <Archive className="size-3.5" />
          ) : null}
          {formatRelatorioStatus(relatorio.status)}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="flex justify-end gap-1">
          <Tooltip>
            <TooltipTrigger
              render={
                <Link
                  aria-label="Visualizar relatório"
                  className={buttonVariants({
                    size: "icon-sm",
                    variant: "ghost",
                  })}
                  href={`/frotas/relatorios/${relatorio.id}`}
                >
                  <Eye className="size-4" />
                </Link>
              }
            />
            <TooltipContent>Visualizar relatório</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Link
                  aria-label="Imprimir relatório"
                  className={buttonVariants({
                    size: "icon-sm",
                    variant: "ghost",
                  })}
                  href={`/frotas/relatorios/${relatorio.id}?print=1`}
                >
                  <Printer className="size-4" />
                </Link>
              }
            />
            <TooltipContent>Imprimir relatório</TooltipContent>
          </Tooltip>
          {canDelete ? <Dialog>
            <Tooltip>
              <TooltipTrigger
                render={
                  <DialogTrigger
                    aria-label="Remover relatório"
                    render={<ListDeleteButton />}
                  >
                    <Trash2 className="size-4" />
                  </DialogTrigger>
                }
              />
              <TooltipContent>Remover relatório</TooltipContent>
            </Tooltip>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Remover relatório</DialogTitle>
                <DialogDescription>
                  Esta ação remove o relatório {relatorio.titulo}. O documento
                  poderá ser gerado novamente depois, se necessário.
                </DialogDescription>
              </DialogHeader>
              <form action={deleteRelatorio} className="flex justify-end gap-2">
                <input name="id" type="hidden" value={relatorio.id} />
                <Button type="submit" variant="destructive" className="gap-2">
                  <Trash2 className="size-4" />
                  Remover relatório
                </Button>
              </form>
            </DialogContent>
          </Dialog> : null}
        </div>
      </TableCell>
    </TableRow>
  );
}

function EmptyReportsState({
  canCreate,
  data,
  profile,
  showPrefeituraField,
}: {
  canCreate: boolean;
  data: Awaited<ReturnType<typeof getAbastecimentosData>>;
  profile: Awaited<ReturnType<typeof requireUserProfile>>;
  showPrefeituraField: boolean;
}) {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center rounded-lg border bg-muted/20 p-8 text-center">
      <div className="flex size-12 items-center justify-center rounded-lg border bg-background">
        <FileText className="size-6 text-muted-foreground" />
      </div>
      <h3 className="mt-4 text-base font-semibold">
        Nenhum relatório criado
      </h3>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">
        {canCreate ? "Gere relatórios para conferência, impressão e envio aos setores responsáveis da empresa." : "Ainda não há relatórios disponíveis para consulta."}
      </p>
      {canCreate && <Dialog>
        <DialogTrigger
          className={buttonVariants({
            className: "mt-4 gap-2",
          })}
        >
          <Plus className="size-4" />
          Criar relatório
        </DialogTrigger>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Novo relatório</DialogTitle>
          </DialogHeader>
          <RelatorioForm
            postos={data.postos}
            prefeituras={data.prefeituras}
            selectedPrefeituraId={data.selectedPrefeituraId}

            showPrefeituraField={showPrefeituraField && profile.role === "bdl_admin"}
            veiculos={data.veiculos}
          />
        </DialogContent>
      </Dialog>}
    </div>
  );
}

function formatReportPeriod(relatorio: FrotaRelatorio) {
  if (!relatorio.periodo_inicio || !relatorio.periodo_fim) {
    return "Atual";
  }

  return `${formatDate(relatorio.periodo_inicio)} - ${formatDate(
    relatorio.periodo_fim
  )}`;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    currency: "BRL",
    style: "currency",
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}
