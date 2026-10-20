import { emptyFleetPage, getFrotaListPage, orderPageItems } from "@/lib/frotas-list-page";
import { getFrotasLoadingData } from "@/app/frotas/frotas-loading-data";
import { TableLoadingRows } from "@/components/table-loading";
import { CancellationDetails } from "@/components/cancellation-details";
import { CancelFrotaDialog } from "@/components/cancel-frota-dialog";
import { DeleteManutencaoButton } from "./delete-manutencao-button";
import { ListStatusActionButton } from "@/components/list-status-action-button";
import { ListPagination } from "@/components/list-pagination";
import { ListMetrics } from "@/components/list-metrics";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CalendarClock,
  CircleAlert,
  CircleCheck,
  CircleX,
  Eye,
  FileText,
  Paperclip,
  Plus,
  Search,
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
import {
  formatFrotaDate,
  formatManutencaoStatus,
  getManutencoesData,
  type FrotaManutencao,
  type ManutencaoStatus,
} from "@/lib/frotas-data";
import { requireUserProfile } from "@/lib/auth-data";
import { getFrotasPermissionAccess } from "@/lib/frotas-permissions";
import { cancelManutencao } from "../actions";
import { AnexosManagerForm } from "../anexos-manager-form";
import { FinishManutencaoForm } from "../finish-manutencao-form";
import { FrotasShell } from "../frotas-shell";
import { ManutencaoForm } from "../manutencao-form";

export const dynamic = "force-dynamic";

type PageProps = {
  loading?: boolean;
  searchParams: Promise<{
    cancelled?: string;
    error?: string;
    prefeitura?: string;
    q?: string;
    registro?: string;
    status?: string;
    size?: string; page?: string;
  }>;
};

const statusFilters = [
  { label: "Todas", status: undefined },
  { label: "Abertas", status: "open" },
  { label: "Concluídas", status: "completed" },
  { label: "Canceladas", status: "cancelled" },
];

export default async function ManutencaoPage({ searchParams, loading = false }: PageProps) {
  const profile = await requireUserProfile();
  const access = await getFrotasPermissionAccess(profile);
  if (!access.canViewManutencao) redirect("/frotas");

  const params = await searchParams;
  const prefeituraId =
    profile.role === "bdl_admin"
      ? params.prefeitura
      : profile.prefeitura_id ?? undefined;
  const databasePage = loading ? emptyFleetPage : await getFrotaListPage(profile, "manutencao", params);
  const data = loading ? await getFrotasLoadingData(profile, prefeituraId) : await getManutencoesData({
    ids: databasePage.ids,
    lightweight: true,
    registroId: params.registro,
    prefeituraId: databasePage.empresaId ?? prefeituraId,
    query: params.q,
    status: params.status,
  });
  const searchTerm = params.q?.trim();
  const maintenancePage = { ...databasePage, items: orderPageItems(data.manutencoes, databasePage) };
  const buildFilterHref = (values: {
    prefeitura?: string | null;
    status?: string | null;
  }) => {
    const query = new URLSearchParams();
    const status = Object.hasOwn(values, "status")
      ? values.status
      : params.status;
    const prefeitura = Object.hasOwn(values, "prefeitura")
      ? values.prefeitura
      : data.selectedPrefeituraId;

    if (searchTerm) {
      query.set("q", searchTerm);
    }

    if (status) {
      query.set("status", status);
    }

    if (prefeitura) {
      query.set("prefeitura", prefeitura);
    }

    const queryString = query.toString();
    return `/frotas/manutencao${queryString ? `?${queryString}` : ""}`;
  };

  return (
    <FrotasShell
      loading={loading}
      active="manutencao"
      actions={
        <ManutencaoToolbar
          access={access}
          buildFilterHref={buildFilterHref}
          data={data}
          params={params}
        />
      }
      icon={Wrench}
      prefeituras={data.prefeituras}
      profile={profile}
      selectedPrefeituraId={data.selectedPrefeituraId}
      title="Manutenção"
    >
      <main className="flex min-h-full flex-col gap-3 p-4">
        <Card className="flex flex-1 flex-col">
          <CardHeader>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg border bg-muted/40">
                  <Wrench className="size-5 text-muted-foreground" />
                </div>
                <div>
                  <CardTitle>Registros de manutenção</CardTitle>
                </div>
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
            {loading || data.manutencoes.length ? (
              <div className="overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Veículo</TableHead>
                      <TableHead>Oficina</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Serviço</TableHead>
                      <TableHead>Entrada</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Anexos</TableHead>
                      <TableHead className="w-[112px] text-right">
                        Ações
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? <TableLoadingRows columns={10} /> : maintenancePage.items.map((manutencao) => (
                      <TableRow key={manutencao.id}>
                        <TableCell>
                          <div className="min-w-[180px]">
                            <div className="font-medium">
                              {manutencao.modelo}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {manutencao.marca} · {manutencao.placa}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{manutencao.oficina ?? "-"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-normal">
                            {manutencao.tipo}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="min-w-[180px] max-w-[320px] whitespace-normal break-words text-sm">
                            {manutencao.descricao}
                          </div>
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {formatFrotaDate(manutencao.data_entrada)}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {manutencao.valor != null ? formatCurrency(manutencao.valor) : "-"}
                        </TableCell>
                        <TableCell>
                          <ManutencaoStatusBadge status={manutencao.status} />
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-normal">
                            <FileText className="size-3.5" />
                            {manutencao.anexos.length}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <ManutencaoActions
                            openDetails={params.registro === manutencao.id}
                            access={access}
                            canDelete={profile.role === "bdl_admin"}
                            manutencao={manutencao}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <EmptyMaintenanceState
                canCreate={access.canCreateManutencao}
                veiculos={data.veiculos} oficinas={data.oficinas}
              />
            )}
            {!loading && <ListPagination page={maintenancePage.page} pageCount={maintenancePage.pageCount} pathname="/frotas/manutencao" params={{ size: params.size, prefeitura: data.selectedPrefeituraId, q: params.q, status: params.status }} />}
          </CardContent>
        </Card>
      </main>
    </FrotasShell>
  );
}

function ManutencaoToolbar({
  access,
  buildFilterHref,
  data,
  params,
}: {
  access: Awaited<ReturnType<typeof getFrotasPermissionAccess>>;
  buildFilterHref: (values: {
    prefeitura?: string | null;
    status?: string | null;
  }) => string;
  data: Awaited<ReturnType<typeof getManutencoesData>>;
  params: Awaited<PageProps["searchParams"]>;
}) {
  const hasActiveFilters = Boolean(params.q?.trim() || params.status || params.prefeitura || params.registro);

  return (
    <div className="flex w-full min-w-0 items-center justify-end gap-2">
      <form className="hidden min-w-0 shrink-0 gap-2 xl:flex">
        <div className="relative min-w-0 w-[320px]">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-9 pl-9"
            name="q"
            placeholder="Buscar manutenção"
            defaultValue={params.q}
          />
        </div>
        {params.status ? (
          <input type="hidden" name="status" value={params.status} />
        ) : null}
        {data.selectedPrefeituraId ? (
          <input
            type="hidden"
            name="prefeitura"
            value={data.selectedPrefeituraId}
          />
        ) : null}
        {hasActiveFilters ? (
          <Link
            href="/frotas/manutencao"
            className={buttonVariants({
              variant: "outline",
              className: "h-9 gap-2",
            })}
          >
            <X className="size-4" />
            Limpar
          </Link>
        ) : (
          <Button type="submit" variant="outline" className="h-9">
            <Search className="size-4" />
            Filtrar
          </Button>
        )}
      </form>

      <div className="hidden shrink-0 gap-1 rounded-lg bg-muted p-1 lg:flex">
        {statusFilters.map((option) => {
          const isActive = option.status
            ? params.status === option.status
            : !params.status;

          return (
            <Link
              key={option.label}
              href={buildFilterHref({ status: option.status ?? null })}
              className={buttonVariants({
                variant: isActive ? "default" : "ghost",
                size: "sm",
                className: isActive
                  ? "h-7 shrink-0 px-2 text-xs shadow-sm"
                  : "h-7 shrink-0 px-2 text-xs text-muted-foreground",
              })}
            >
              {option.label}
            </Link>
          );
        })}
      </div>

      {access.canCreateManutencao ? <HeaderSeparator className="hidden xl:block" /> : null}

      {access.canCreateManutencao ? (
        <Dialog>
          <DialogTrigger
            className={buttonVariants({
              className: "h-9 shrink-0 gap-2",
            })}
          >
            <Plus className="size-4" />
            Nova manutenção
          </DialogTrigger>
          <DialogContent className="sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>Nova manutenção</DialogTitle>
            </DialogHeader>
            <ManutencaoForm veiculos={data.veiculos} oficinas={data.oficinas} />
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}

function ManutencaoActions({
  openDetails = false,
  canDelete,
  access,
  manutencao,
}: {
  openDetails?: boolean;
  canDelete: boolean;
  access: Awaited<ReturnType<typeof getFrotasPermissionAccess>>;
  manutencao: FrotaManutencao;
}) {
  return (
    <div className="flex justify-end gap-1">
      <Dialog defaultOpen={openDetails}>
        <Tooltip>
          <TooltipTrigger
            render={
              <DialogTrigger
                className={buttonVariants({
                  variant: "ghost",
                  size: "icon-sm",
                })}
                aria-label="Ver manutenção"
              >
                <Eye className="size-4" />
              </DialogTrigger>
            }
          />
          <TooltipContent>Ver manutenção</TooltipContent>
        </Tooltip>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes da manutenção</DialogTitle>
            <DialogDescription>
              {manutencao.modelo} · {manutencao.placa}
            </DialogDescription>
          </DialogHeader>
          <ManutencaoDetails manutencao={manutencao} />
        </DialogContent>
      </Dialog>

      {access.canUpdateManutencao ? (
        <Dialog>
          <Tooltip>
            <TooltipTrigger
              render={
                <DialogTrigger
                  className={buttonVariants({
                    variant: "ghost",
                    size: "icon-sm",
                  })}
                  aria-label="Gerenciar anexos"
                >
                  <Paperclip className="size-4" />
                </DialogTrigger>
              }
            />
            <TooltipContent>Gerenciar anexos</TooltipContent>
          </Tooltip>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Anexos da manutenção</DialogTitle>
              <DialogDescription>
                {manutencao.modelo} · {manutencao.placa}
              </DialogDescription>
            </DialogHeader>
            <AnexosManagerForm
              anexos={manutencao.anexos}
              ownerId={manutencao.id}
              ownerLabel="manutenção"
              type="manutencao"
            />
          </DialogContent>
        </Dialog>
      ) : null}

      {manutencao.status === "open" &&
      (access.canCompleteManutencao || access.canCancelManutencao) ? (
        <>
          {access.canCompleteManutencao ? (
            <Dialog>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <DialogTrigger render={<ListStatusActionButton action="complete" aria-label="Concluir manutenção" />} />
                  }
                />
                <TooltipContent>Concluir manutenção</TooltipContent>
              </Tooltip>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Concluir manutenção</DialogTitle>
                  <DialogDescription>
                    O veículo voltará para o status ativo.
                  </DialogDescription>
                </DialogHeader>
                <FinishManutencaoForm manutencao={manutencao} />
              </DialogContent>
            </Dialog>
          ) : null}

          {access.canCancelManutencao ? (
            <CancelFrotaDialog id={manutencao.id} label="Cancelar manutenção" action={cancelManutencao} />
          ) : null}
        </>
      ) : null}
      {canDelete && manutencao.status === "cancelled" ? <DeleteManutencaoButton id={manutencao.id} nome={`${manutencao.modelo} · ${manutencao.placa}`} /> : null}
    </div>
  );
}

function ManutencaoDetails({
  manutencao,
}: {
  manutencao: FrotaManutencao;
}) {
  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-muted/20 p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-lg font-semibold leading-none">
                {manutencao.tipo}
              </h3>
              <ManutencaoStatusBadge status={manutencao.status} />
            </div>
            <div>
              <div className="text-base font-medium leading-tight">
                {manutencao.modelo} · {manutencao.placa}
              </div>
              <div className="text-xs text-muted-foreground">
                {manutencao.marca} · {manutencao.oficina ?? "Sem oficina"}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:min-w-72">
            <MetricTile
              label="Valor"
              value={manutencao.valor ? formatCurrency(manutencao.valor) : "-"}
            />
            <MetricTile
              label="Km"
              value={formatMileage(manutencao.quilometragem)}
            />
            <MetricTile
              label="Anexos"
              value={String(manutencao.anexos.length)}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border p-2.5">
          <div className="flex items-center gap-2 text-xs font-medium">
            <CalendarClock className="size-3.5 text-muted-foreground" />
            Prazos
          </div>
          <div className="mt-2 grid gap-1.5">
            <CompactDetail
              label="Entrada"
              value={formatFrotaDate(manutencao.data_entrada)}
            />
            <CompactDetail
              label="Saída"
              value={
                manutencao.data_saida
                  ? formatFrotaDate(manutencao.data_saida)
                  : "-"
              }
            />
            <CompactDetail
              label="Responsável"
              value={manutencao.responsavel ?? "-"}
            />
            <CompactDetail label="Oficina" value={manutencao.oficina ?? "-"} />
          </div>
        </div>

        <div className="rounded-lg border p-2.5">
          <div className="flex items-center gap-2 text-xs font-medium">
            <Wrench className="size-3.5 text-muted-foreground" />
            Serviço
          </div>
          <p className="mt-2 line-clamp-4 rounded-md bg-muted/35 px-2.5 py-2 text-xs text-muted-foreground">
            {manutencao.descricao}
          </p>
        </div>
      </div>

      <div className="grid gap-2 rounded-lg border p-2.5 sm:grid-cols-3">
        <CompactTotal
          label="Status"
          value={formatManutencaoStatus(manutencao.status)}
        />
        <CompactTotal
          label="Valor"
          value={manutencao.valor ? formatCurrency(manutencao.valor) : "-"}
        />
        <CompactTotal
          label="Quilometragem"
          value={formatMileage(manutencao.quilometragem)}
        />
      </div>

      {manutencao.status === "cancelled" ? <CancellationDetails date={manutencao.cancelled_at} reason={manutencao.motivo_cancelamento} /> : null}

      {manutencao.observacoes || manutencao.anexos.length ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {manutencao.observacoes ? (
            <div className="rounded-lg border p-2.5">
              <div className="text-xs font-medium">Observações</div>
              <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">
                {manutencao.observacoes}
              </p>
            </div>
          ) : null}

          {manutencao.anexos.length ? (
            <div className="rounded-lg border p-2.5">
              <div className="text-xs font-medium">Anexos</div>
              <div className="mt-2 grid gap-1.5">
                {manutencao.anexos.slice(0, 3).map((anexo) => (
                  <CompactDetail
                    key={anexo.id}
                    label={anexo.file_name}
                    value={formatFileSize(anexo.file_size)}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function EmptyMaintenanceState({
  canCreate,
  veiculos,
  oficinas,
}: {
  canCreate: boolean;
  veiculos: Awaited<ReturnType<typeof getManutencoesData>>["veiculos"];
  oficinas: Awaited<ReturnType<typeof getManutencoesData>>["oficinas"];
}) {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center rounded-lg border bg-muted/20 p-8 text-center">
      <div className="flex size-12 items-center justify-center rounded-lg border bg-background">
        <Wrench className="size-6 text-muted-foreground" />
      </div>
      <h3 className="mt-4 text-base font-semibold">
        Nenhuma manutenção registrada
      </h3>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">
        Registre a primeira manutenção para acompanhar custos, documentos e
        status operacional da frota.
      </p>
      {canCreate ? (
        <Dialog>
          <DialogTrigger
            className={buttonVariants({
              className: "mt-4 gap-2",
            })}
          >
            <Plus className="size-4" />
            Registrar manutenção
          </DialogTrigger>
          <DialogContent className="sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>Nova manutenção</DialogTitle>
            </DialogHeader>
            <ManutencaoForm veiculos={veiculos} oficinas={oficinas} />
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}

function ManutencaoStatusBadge({ status }: { status: ManutencaoStatus }) {
  const className: Record<ManutencaoStatus, string> = {
    cancelled: "border-zinc-200 bg-zinc-100 text-zinc-700 hover:bg-zinc-100",
    completed:
      "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50",
    open: "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50",
  };
  const Icon =
    status === "completed"
      ? CircleCheck
      : status === "cancelled"
        ? CircleX
        : CircleAlert;

  return (
    <Badge variant="outline" className={className[status]}>
      <Icon className="size-3.5" />
      {formatManutencaoStatus(status)}
    </Badge>
  );
}

function CompactDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md bg-muted/35 px-2.5 py-1.5 text-xs">
      <span className="truncate text-muted-foreground">{label}</span>
      <span className="shrink-0 truncate text-right font-medium">{value}</span>
    </div>
  );
}

function CompactTotal({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/35 px-2.5 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="truncate text-sm font-semibold">{value}</div>
    </div>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-background px-2.5 py-1.5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="truncate text-base font-semibold leading-tight">
        {value}
      </div>
    </div>
  );
}

function formatMileage(value: number | null) {
  if (value === null) {
    return "-";
  }

  return `${new Intl.NumberFormat("pt-BR").format(value)} km`;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    currency: "BRL",
    style: "currency",
  }).format(value);
}

function formatFileSize(value: number | null) {
  if (!value) {
    return "-";
  }

  if (value < 1024 * 1024) {
    return `${Math.ceil(value / 1024)} KB`;
  }

  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}
