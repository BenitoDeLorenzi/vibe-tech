import { emptyFleetPage, getFrotaListPage, orderPageItems } from "@/lib/frotas-list-page";
import { FrotasEmptyState } from "@/components/frotas-empty-state";
import { getFrotasLoadingData } from "@/app/frotas/frotas-loading-data";
import { TableLoadingRows } from "@/components/table-loading";
import { CancellationDetails } from "@/components/cancellation-details";
import { CancelFrotaDialog } from "@/components/cancel-frota-dialog";
import { ListStatusActionButton } from "@/components/list-status-action-button";
import { ListPagination } from "@/components/list-pagination";
import { FrotasResponsiveTable } from "@/components/frotas-responsive-table";
import { ListMetrics } from "@/components/list-metrics";
import Link from "next/link";
import { forbidden } from "next/navigation";
import {
  Ban,
  CalendarClock,
  CircleAlert,
  CircleCheck,
  Eye,
  KeyRound,
  MapPin,
  Plus,
  Search,
  UserRound,
  X,
} from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { getFrotasPermissionAccess } from "@/lib/frotas-permissions";
import {
  formatCpf,
  formatUsoDateTime,
  formatUsoVeiculoStatus,
  getUsoVeiculosData,
  type FrotaUsoVeiculo,
  type UsoVeiculoStatus,
} from "@/lib/uso-veiculos-data";
import { FrotasShell } from "../frotas-shell";
import { cancelUsoVeiculo } from "./actions";
import { DevolucaoForm } from "./devolucao-form";
import { DeleteUsoButton } from "./delete-uso-button";
import { UsoVeiculoForm } from "./uso-veiculo-form";

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
  { label: "Todos", status: undefined },
  { label: "Em uso", status: "in_use" },
  { label: "Devolvidos", status: "returned" },
  { label: "Cancelados", status: "cancelled" },
];

export default async function UsoVeiculoPage({ searchParams, loading = false }: PageProps) {
  const profile = await requireUserProfile();
  const access = await getFrotasPermissionAccess(profile);

  if (!access.canViewUsoVeiculo) {
    forbidden();
  }

  const params = await searchParams;
  const prefeituraId =
    profile.role === "bdl_admin"
      ? params.prefeitura
      : profile.prefeitura_id ?? undefined;
  const databasePage = loading ? emptyFleetPage : await getFrotaListPage(profile, "uso-veiculo", params);
  const data = loading ? await getFrotasLoadingData(profile, prefeituraId) : await getUsoVeiculosData({
    ids: databasePage.ids,
    lightweight: true,
    registroId: params.registro,
    prefeituraId: databasePage.empresaId ?? prefeituraId,
    query: params.q,
    status: params.status,
  });
  const searchTerm = params.q?.trim();
  const usagePage = { ...databasePage, items: orderPageItems(data.usos, databasePage) };
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
    return `/frotas/uso-veiculo${queryString ? `?${queryString}` : ""}`;
  };

  return (
    <FrotasShell
      loading={loading}
      mobileList
      active="uso-veiculo"
      actions={
        <UsoVeiculoToolbar
          access={access}
          buildFilterHref={buildFilterHref}
          data={data}
          params={params}
        />
      }
      icon={KeyRound}
      prefeituras={data.prefeituras}
      profile={profile}
      selectedPrefeituraId={data.selectedPrefeituraId}
      title="Uso do Veículo"
    >
      <main className="flex min-h-full flex-col gap-3 p-4">
        <Card className="frotas-list-card flex flex-1 flex-col">
          <CardHeader>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg border bg-muted/40">
                  <KeyRound className="size-5 text-muted-foreground" />
                </div>
                <div>
                  <CardTitle>Controle de retirada</CardTitle>
                </div>
              </div>
              <ListMetrics
                loading={loading}
                items={[
                  { label: "Em uso", value: (databasePage.statuses.in_use ?? 0), tone: "inUse" },
                  { label: "Devolvidos", value: (databasePage.statuses.returned ?? 0), tone: "success" },
                  { label: "Total", value: databasePage.total },
                ]}
              />
            </div>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col">
            {loading || data.usos.length ? (
              <FrotasResponsiveTable page={usagePage.page} pageCount={usagePage.pageCount} total={usagePage.total} count={usagePage.items.length} pathname="/frotas/uso-veiculo" params={{ prefeitura: data.selectedPrefeituraId, q: params.q, status: params.status }} loading={loading}><div className="frotas-mobile-table overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Veículo</TableHead>
                      <TableHead>Motorista</TableHead>
                      <TableHead>Saída</TableHead>
                      <TableHead>Retorno</TableHead>
                      <TableHead>Quilometragem</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[120px] text-right">
                        Ações
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? <TableLoadingRows columns={7} /> : usagePage.items.map((uso) => (
                      <TableRow key={uso.id}>
                        <TableCell>
                          <div className="min-w-[180px]">
                            <div className="font-medium">
                              {uso.modelo}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {uso.marca} · {uso.placa}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="min-w-[180px]">
                            <div className="font-medium">{uso.funcionario_nome}</div>
                            <div className="text-xs text-muted-foreground">
                              {formatCpf(uso.funcionario_cpf)}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="min-w-[150px]">
                            <div className="text-sm">
                              {formatUsoDateTime(uso.data_saida)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {uso.destino || "Sem destino"}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {formatUsoDateTime(uso.data_retorno)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="min-w-[130px]">
                            <div className="font-medium">
                              {formatMileage(uso.km_saida)}
                            </div>
                            {uso.km_retorno ? (
                              <div className="text-xs text-muted-foreground">
                                Retorno {formatMileage(uso.km_retorno)}
                              </div>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          <UsoStatusBadge status={uso.status} />
                        </TableCell>
                        <TableCell>
                          <UsoVeiculoActions openDetails={params.registro === uso.id} access={access} uso={uso} canDelete={profile.role === "bdl_admin"} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div></FrotasResponsiveTable>
            ) : (
              <EmptyUsoState
                canCreate={access.canCreateUsoVeiculo}
                veiculos={data.veiculos} motoristas={data.motoristas}
              />
            )}
            {!loading && <ListPagination page={usagePage.page} pageCount={usagePage.pageCount} pathname="/frotas/uso-veiculo" params={{ size: params.size, prefeitura: data.selectedPrefeituraId, q: params.q, status: params.status }} />}
          </CardContent>
        </Card>
      </main>
    </FrotasShell>
  );
}

function UsoVeiculoToolbar({
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
  data: Awaited<ReturnType<typeof getUsoVeiculosData>>;
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
            placeholder="Buscar retirada"
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
            href="/frotas/uso-veiculo"
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

      {access.canCreateUsoVeiculo ? <HeaderSeparator className="hidden xl:block" /> : null}

      {access.canCreateUsoVeiculo ? (
        <Dialog>
          <DialogTrigger
            className={buttonVariants({
              className: "h-9 shrink-0 gap-2",
            })}
          >
            <Plus className="size-4" />
            Nova retirada
          </DialogTrigger>
          <DialogContent className="sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>Nova retirada</DialogTitle>
            </DialogHeader>
            <UsoVeiculoForm veiculos={data.veiculos} motoristas={data.motoristas} />
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}

function UsoVeiculoActions({
  openDetails = false,
  access,
  uso,
  canDelete,
}: {
  openDetails?: boolean;
  canDelete: boolean;
  access: Awaited<ReturnType<typeof getFrotasPermissionAccess>>;
  uso: FrotaUsoVeiculo;
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
                aria-label="Ver retirada"
              >
                <Eye className="size-4" />
              </DialogTrigger>
            }
          />
          <TooltipContent>Ver retirada</TooltipContent>
        </Tooltip>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes da retirada</DialogTitle>
            <DialogDescription>
              {uso.modelo} · {uso.placa}
            </DialogDescription>
          </DialogHeader>
          <UsoDetails uso={uso} />
        </DialogContent>
      </Dialog>

      {uso.status === "in_use" && access.canReturnUsoVeiculo ? (
        <Dialog>
          <Tooltip>
            <TooltipTrigger
              render={
                <DialogTrigger render={<ListStatusActionButton action="complete" aria-label="Registrar devolução" />} />
              }
            />
            <TooltipContent>Registrar devolução</TooltipContent>
          </Tooltip>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Registrar devolução</DialogTitle>
              <DialogDescription>
                Atualize a quilometragem final do veículo.
              </DialogDescription>
            </DialogHeader>
            <DevolucaoForm uso={uso} />
          </DialogContent>
        </Dialog>
      ) : null}

      {uso.status === "in_use" && access.canCancelUsoVeiculo ? (
        <CancelFrotaDialog id={uso.id} label="Cancelar retirada" action={cancelUsoVeiculo} />
      ) : null}
      {canDelete && uso.status === "cancelled" ? <DeleteUsoButton id={uso.id} placa={uso.placa} motorista={uso.funcionario_nome} /> : null}
    </div>
  );
}

function UsoDetails({ uso }: { uso: FrotaUsoVeiculo }) {
  const kmRodado =
    uso.km_retorno !== null ? Math.max(uso.km_retorno - uso.km_saida, 0) : null;

  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-muted/20 p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-lg font-semibold leading-none">
                {uso.modelo} · {uso.placa}
              </h3>
              <UsoStatusBadge status={uso.status} />
            </div>
            <div className="text-xs text-muted-foreground">
              {uso.marca}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:min-w-72">
            <MetricTile label="Saída" value={formatMileage(uso.km_saida)} />
            <MetricTile
              label="Retorno"
              value={uso.km_retorno ? formatMileage(uso.km_retorno) : "-"}
            />
            <MetricTile
              label="Rodado"
              value={kmRodado !== null ? formatMileage(kmRodado) : "-"}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border p-2.5">
          <div className="flex items-center gap-2 text-xs font-medium">
            <UserRound className="size-3.5 text-muted-foreground" />
            Motorista
          </div>
          <div className="mt-2 grid gap-1.5">
            <CompactDetail label="Nome" value={uso.funcionario_nome} />
            <CompactDetail label="CPF" value={formatCpf(uso.funcionario_cpf)} />
            <CompactDetail label="Destino" value={uso.destino ?? "-"} />
            <CompactDetail label="Finalidade" value={uso.finalidade ?? "-"} />
          </div>
        </div>

        <div className="rounded-lg border p-2.5">
          <div className="flex items-center gap-2 text-xs font-medium">
            <CalendarClock className="size-3.5 text-muted-foreground" />
            Movimentação
          </div>
          <div className="mt-2 grid gap-1.5">
            <CompactDetail
              label="Saída"
              value={formatUsoDateTime(uso.data_saida)}
            />
            <CompactDetail
              label="Retorno"
              value={formatUsoDateTime(uso.data_retorno)}
            />
            <CompactDetail
              label="Empresa"
              value={uso.prefeitura_nome}
            />
            <CompactDetail
              label="Status"
              value={formatUsoVeiculoStatus(uso.status)}
            />
          </div>
        </div>
      </div>

      {uso.status === "cancelled" ? <CancellationDetails date={uso.cancelled_at} reason={uso.motivo_cancelamento} /> : null}

      {uso.observacoes_saida || uso.observacoes_retorno ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <ObservationCard
            label="Observações da saída"
            value={uso.observacoes_saida}
          />
          <ObservationCard
            label="Observações da devolução"
            value={uso.observacoes_retorno}
          />
        </div>
      ) : null}
    </div>
  );
}

function EmptyUsoState({
  canCreate,
  veiculos,
  motoristas,
}: {
  canCreate: boolean;
  motoristas: Awaited<ReturnType<typeof getUsoVeiculosData>>["motoristas"];
  veiculos: Awaited<ReturnType<typeof getUsoVeiculosData>>["veiculos"];
}) {
  return (
    <FrotasEmptyState icon={KeyRound} title="Nenhuma retirada registrada" description="Registre a saída do veículo para controlar quem está usando a frota e quando ele deve retornar à garagem." action={canCreate ? (
        <Dialog>
          <DialogTrigger
            className={buttonVariants({
              className: "gap-2",
            })}
          >
            <Plus className="size-4" />
            Registrar retirada
          </DialogTrigger>
          <DialogContent className="sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>Nova retirada</DialogTitle>
            </DialogHeader>
            <UsoVeiculoForm veiculos={veiculos} motoristas={motoristas} />
          </DialogContent>
        </Dialog>
      ) : null} />
  );
}

function UsoStatusBadge({ status }: { status: UsoVeiculoStatus }) {
  const className: Record<UsoVeiculoStatus, string> = {
    cancelled: "border-zinc-200 bg-zinc-100 text-zinc-700 hover:bg-zinc-100",
    in_use: "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50",
    returned:
      "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50",
  };
  const Icon =
    status === "returned"
      ? CircleCheck
      : status === "cancelled"
        ? Ban
        : CircleAlert;

  return (
    <Badge variant="outline" className={className[status]}>
      <Icon className="size-3.5" />
      {formatUsoVeiculoStatus(status)}
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

function ObservationCard({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  if (!value) {
    return null;
  }

  return (
    <div className="rounded-lg border p-2.5">
      <div className="flex items-center gap-2 text-xs font-medium">
        <MapPin className="size-3.5 text-muted-foreground" />
        {label}
      </div>
      <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">
        {value}
      </p>
    </div>
  );
}

function formatMileage(value: number | null) {
  if (value === null) {
    return "-";
  }

  return `${new Intl.NumberFormat("pt-BR").format(value)} km`;
}
