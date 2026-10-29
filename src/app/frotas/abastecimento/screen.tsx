import { emptyFleetPage, getFrotaListPage, orderPageItems } from "@/lib/frotas-list-page";
import { FrotasEmptyState } from "@/components/frotas-empty-state";
import { getFrotasLoadingData } from "@/app/frotas/frotas-loading-data";
import { TableLoadingRows } from "@/components/table-loading";
import { CancellationDetails } from "@/components/cancellation-details";
import { CancelFrotaDialog } from "@/components/cancel-frota-dialog";
import { DeleteAbastecimentoButton } from "./delete-abastecimento-button";
import { ListStatusActionButton } from "@/components/list-status-action-button";
import { ListPagination } from "@/components/list-pagination";
import { ListMetrics } from "@/components/list-metrics";
import Link from "next/link";
import { forbidden } from "next/navigation";
import {
  CalendarClock,
  CircleCheck,
  CircleX,
  Droplet,
  Eye,
  Fuel,
  Printer,
  Search,
  SquareCheckBig,
  X,
} from "lucide-react";

import { cancelAbastecimento } from "../actions";
import { AbastecimentoCompleteForm } from "@/app/frotas/abastecimento-complete-form";
import { AbastecimentoCreateDialog } from "@/app/frotas/abastecimento-create-dialog";
import { AbastecimentoPrintOrder } from "@/app/frotas/abastecimento-print-order";
import { FrotasShell } from "@/app/frotas/frotas-shell";
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
  formatAbastecimentoStatus,
  formatFrotaDate,
  getAbastecimentosData,
  type AbastecimentoStatus,
  type FrotaAbastecimento,
} from "@/lib/frotas-data";
import { requireUserProfile } from "@/lib/auth-data";
import { getFrotasPermissionAccess } from "@/lib/frotas-permissions";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type PageProps = {
  loading?: boolean;
  searchParams: Promise<{
    prefeitura?: string;
    q?: string;
    ordem?: string;
    status?: string;
    size?: string; page?: string;
  }>;
};

const statusFilters = [
  { label: "Todas", status: undefined },
  { label: "Pendentes", status: "issued" },
  { label: "Concluídas", status: "completed" },
  { label: "Canceladas", status: "cancelled" },
  { label: "Vencidas", status: "expired" },
];

export default async function AbastecimentoPage({ searchParams, loading = false }: PageProps) {
  const profile = await requireUserProfile();
  const access = await getFrotasPermissionAccess(profile);
  if (!access.canViewAbastecimento) forbidden();

  const params = await searchParams;
  const prefeituraId =
    profile.role === "bdl_admin"
      ? params.prefeitura
      : profile.prefeitura_id ?? undefined;
  const databasePage = loading ? emptyFleetPage : await getFrotaListPage(profile, "abastecimento", params);
  const data = loading ? await getFrotasLoadingData(profile, prefeituraId) : await getAbastecimentosData({
    ids: databasePage.ids,
    lightweight: true,
    prefeituraId: databasePage.empresaId ?? prefeituraId,
    query: params.q,
    status: params.status,
  });
  const searchTerm = params.q?.trim();
  const fuelPage = { ...databasePage, items: orderPageItems(data.abastecimentos, databasePage) };
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
    return `/frotas/abastecimento${queryString ? `?${queryString}` : ""}`;
  };

  return (
    <FrotasShell
      loading={loading}
      active="abastecimento"
      actions={
        <AbastecimentoToolbar
          access={access}
          buildFilterHref={buildFilterHref}
          data={data}
          params={params}
        />
      }
      icon={Fuel}
      prefeituras={data.prefeituras}
      profile={profile}
      selectedPrefeituraId={data.selectedPrefeituraId}
      title="Abastecimento"
    >
      <main className="flex min-h-full flex-col gap-3 p-4">
        <Card className="flex flex-1 flex-col">
          <CardHeader>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg border bg-muted/40">
                  <Fuel className="size-5 text-muted-foreground" />
                </div>
                <div>
                  <CardTitle>Ordens de abastecimento</CardTitle>
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
            {loading || data.abastecimentos.length ? (
              <div className="overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Ordem</TableHead>
                      <TableHead>Veículo</TableHead>
                      <TableHead>Posto</TableHead>
                      <TableHead>Combustível</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Emissão</TableHead>
                      <TableHead>Validade</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[92px] text-right">
                        Ações
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? <TableLoadingRows columns={9} /> : fuelPage.items.map((abastecimento) => (
                      <TableRow key={abastecimento.id}>
                        <TableCell className="font-medium">
                          {abastecimento.numero_ordem}
                        </TableCell>
                        <TableCell>
                          <div className="min-w-[180px]">
                            <div className="font-medium">{abastecimento.modelo}</div>
                            <div className="text-xs text-muted-foreground">
                              {abastecimento.marca} · {abastecimento.placa}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{abastecimento.posto_nome ?? "-"}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            <Badge variant="secondary" className="font-normal">
                              <Droplet className="size-3.5" />
                              {abastecimento.combustivel}
                            </Badge>
                            {abastecimento.arla_incluso ? (
                              <Badge variant="outline" className="font-normal">ARLA</Badge>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {abastecimento.valor_total != null ? formatCurrency(abastecimento.valor_total) : "-"}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {formatDateTime(abastecimento.created_at)}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {abastecimento.expires_at ? formatDateTime(abastecimento.expires_at) : "-"}
                        </TableCell>
                        <TableCell>
                          <AbastecimentoStatusBadge
                            status={abastecimento.status}
                          />
                        </TableCell>
                        <TableCell>
                          <AbastecimentoActions
                            openDetails={params.ordem === abastecimento.id}
                            access={access}
                            canDelete={profile.role === "bdl_admin"}
                            abastecimento={abastecimento}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <EmptyFuelState
                canCreate={access.canCreateAbastecimento}
                postos={data.postos} motoristas={data.motoristas}
                veiculos={data.veiculos}
              />
            )}
            {!loading && data.abastecimentos.length > 0 && <ListPagination page={fuelPage.page} pageCount={fuelPage.pageCount} pathname="/frotas/abastecimento" params={{ size: params.size, prefeitura: data.selectedPrefeituraId, q: params.q, status: params.status }} />}
          </CardContent>
        </Card>
      </main>
    </FrotasShell>
  );
}

function AbastecimentoToolbar({
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
  data: Awaited<ReturnType<typeof getAbastecimentosData>>;
  params: Awaited<PageProps["searchParams"]>;
}) {
  const hasActiveFilters = Boolean(params.q?.trim() || params.status || params.prefeitura);

  return (
    <div className="flex w-full min-w-0 items-center justify-end gap-2">
      <form className="hidden min-w-0 shrink-0 gap-2 xl:flex">
        <div className="relative min-w-0 w-[320px]">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-9 pl-9"
            name="q"
            placeholder="Buscar abastecimento"
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
            href="/frotas/abastecimento"
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

      {access.canCreateAbastecimento ? <HeaderSeparator className="hidden xl:block" /> : null}

      {access.canCreateAbastecimento ? (
        <AbastecimentoCreateDialog
          className="h-9 shrink-0 gap-2"
          postos={data.postos} motoristas={data.motoristas}
          veiculos={data.veiculos}
        />
      ) : null}

    </div>
  );
}

function AbastecimentoActions({
  openDetails,
  canDelete,
  access,
  abastecimento,
}: {
  openDetails?: boolean;
  canDelete: boolean;
  access: Awaited<ReturnType<typeof getFrotasPermissionAccess>>;
  abastecimento: FrotaAbastecimento;
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
                aria-label="Ver ordem"
              >
                <Eye className="size-4" />
              </DialogTrigger>
            }
          />
          <TooltipContent>Ver ordem</TooltipContent>
        </Tooltip>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes da ordem</DialogTitle>
            <DialogDescription>{abastecimento.numero_ordem}</DialogDescription>
          </DialogHeader>
          <AbastecimentoDetails abastecimento={abastecimento} />
        </DialogContent>
      </Dialog>

      {abastecimento.status === "issued" && access.canManageAbastecimento ? (
        <Dialog>
          <Tooltip>
            <TooltipTrigger
              render={
                <DialogTrigger
                  className={buttonVariants({
                    variant: "ghost",
                    size: "icon-sm",
                  })}
                  aria-label="Imprimir ordem"
                >
                  <Printer className="size-4" />
                </DialogTrigger>
              }
            />
            <TooltipContent>Imprimir ordem</TooltipContent>
          </Tooltip>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Impressão térmica</DialogTitle>
              <DialogDescription>
                Prévia em largura aproximada de 80 mm.
              </DialogDescription>
            </DialogHeader>
            <AbastecimentoPrintOrder abastecimento={abastecimento} />
          </DialogContent>
        </Dialog>
      ) : null}

      {abastecimento.status === "issued" && access.canCompleteAbastecimento ? (
        <Dialog>
          <Tooltip>
            <TooltipTrigger
              render={
                <DialogTrigger render={<ListStatusActionButton action="complete" aria-label="Concluir abastecimento" />} />
              }
            />
            <TooltipContent>Concluir abastecimento</TooltipContent>
          </Tooltip>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Concluir abastecimento</DialogTitle>
              <DialogDescription>
                Preenchimento do posto credenciado para{" "}
                {abastecimento.numero_ordem}.
              </DialogDescription>
            </DialogHeader>
            <AbastecimentoCompleteForm abastecimento={abastecimento} />
          </DialogContent>
        </Dialog>
      ) : null}

      {abastecimento.status === "issued" && access.canCancelAbastecimento ? (
        <CancelFrotaDialog id={abastecimento.id} label="Cancelar ordem" action={cancelAbastecimento} />
      ) : null}
      {canDelete && abastecimento.status === "cancelled" ? <DeleteAbastecimentoButton id={abastecimento.id} nome={abastecimento.numero_ordem} /> : null}
    </div>
  );
}

function AbastecimentoDetails({
  abastecimento,
}: {
  abastecimento: FrotaAbastecimento;
}) {
  const fuelTotal = getFuelTotal(abastecimento);

  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-muted/20 p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-lg font-semibold leading-none">
                {abastecimento.numero_ordem}
              </h3>
              <AbastecimentoStatusBadge status={abastecimento.status} />
              {abastecimento.arla_incluso ? (
                <Badge variant="outline" className="h-6 font-normal">
                  ARLA
                </Badge>
              ) : null}
            </div>
            <div>
              <div className="text-base font-medium leading-tight">
                {abastecimento.modelo} · {abastecimento.placa}
              </div>
              <div className="text-xs text-muted-foreground">
                {abastecimento.combustivel}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:min-w-72">
            <MetricTile
              className="col-span-2 border-primary/20 bg-primary text-primary-foreground"
              label="Total da ordem"
              labelClassName="text-primary-foreground/75"
              value={
                abastecimento.valor_total
                  ? formatCurrency(abastecimento.valor_total)
                  : "-"
              }
              valueClassName="text-xl"
            />
            <MetricTile
              label="Litros"
              value={
                abastecimento.litros
                  ? `${formatNumber(abastecimento.litros)} L`
                  : "-"
              }
            />
            <MetricTile
              label="Km"
              value={
                abastecimento.quilometragem
                  ? formatNumber(abastecimento.quilometragem)
                  : "-"
              }
            />
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border p-2.5">
          <div className="flex items-center gap-2 text-xs font-medium">
            <CalendarClock className="size-3.5 text-muted-foreground" />
            Ordem
          </div>
          <div className="mt-2 grid gap-1.5">
            <CompactDetail
              label="Data"
              value={formatFrotaDate(abastecimento.data_abastecimento)}
            />
            <CompactDetail
              label="Validade"
              value={
                abastecimento.expires_at
                  ? formatDateTime(abastecimento.expires_at)
                  : "-"
              }
            />
            <CompactDetail label="Motorista" value={abastecimento.motorista} />
            <CompactDetail
              label="Emitido por"
              value={abastecimento.emitido_por ?? "-"}
            />
            <CompactDetail
              label="Posto"
              value={abastecimento.posto_nome ?? "-"}
            />
            <CompactDetail
              label="Reimpressões"
              value={
                abastecimento.print_count > 0
                  ? `${abastecimento.print_count} vez(es)`
                  : "Nenhuma"
              }
            />
            {abastecimento.last_printed_at ? (
              <CompactDetail
                label="Última impressão"
                value={formatDateTime(abastecimento.last_printed_at)}
              />
            ) : null}
          </div>
        </div>

        <div className="rounded-lg border p-2.5">
          <div className="flex items-center gap-2 text-xs font-medium">
            <SquareCheckBig className="size-4 text-muted-foreground" />
            Dados do posto
          </div>
          <div className="mt-2 grid gap-1.5">
            <CompactDetail
              label="Funcionário"
              value={abastecimento.concluido_por ?? "-"}
            />
            <CompactDetail
              label="Nota fiscal"
              value={abastecimento.numero_nota_fiscal ?? "-"}
            />
            <CompactDetail
              label="Quilometragem"
              value={
                abastecimento.quilometragem
                  ? `${formatNumber(abastecimento.quilometragem)} km`
                  : "Pendente"
              }
            />
            <CompactDetail
              label="Consumo médio"
              value={
                abastecimento.consumo_medio_km_l
                  ? `${formatNumber(abastecimento.consumo_medio_km_l)} km/L`
                  : "-"
              }
            />
            <CompactDetail
              label="Combustível"
              value={
                abastecimento.litros
                  ? `${formatNumber(abastecimento.litros)} L · ${
                      abastecimento.valor_litro
                        ? formatCurrency(abastecimento.valor_litro)
                        : "-"
                    }/L`
                  : "-"
              }
            />
            {abastecimento.arla_incluso ? (
              <CompactDetail
                label="ARLA"
                value={
                  abastecimento.arla_litros
                    ? `${formatNumber(abastecimento.arla_litros)} L · ${
                        abastecimento.arla_valor_litro
                          ? formatCurrency(abastecimento.arla_valor_litro)
                          : "-"
                      }/L`
                    : "Autorizado"
                }
              />
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-2 rounded-lg border p-2.5 sm:grid-cols-3">
        <CompactTotal
          label="Combustível"
          value={fuelTotal ? formatCurrency(fuelTotal) : "-"}
        />
        <CompactTotal
          label="ARLA"
          value={
            abastecimento.arla_incluso
              ? abastecimento.arla_valor_total
                ? formatCurrency(abastecimento.arla_valor_total)
                : "Autorizado"
              : "-"
          }
        />
        <CompactTotal
          label="Total geral"
          value={
            abastecimento.valor_total
              ? formatCurrency(abastecimento.valor_total)
              : "-"
          }
        />
      </div>

      {abastecimento.anexos.length ? (
        <div className="rounded-lg border p-2.5">
          <div className="text-xs font-medium">Comprovantes</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {abastecimento.anexos.map((anexo) => (
              <Button
                key={anexo.id}
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                render={
                  <a
                    href={anexo.signed_url ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                  />
                }
              >
                {anexo.file_name}
              </Button>
            ))}
          </div>
        </div>
      ) : null}

      {abastecimento.observacoes || abastecimento.status === "cancelled" ? (
        <div className="grid gap-2">
          {abastecimento.observacoes ? (
            <div className="rounded-lg border p-2.5">
              <div className="text-xs font-medium">Observações</div>
              <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">
                {abastecimento.observacoes}
              </p>
            </div>
          ) : null}

          {abastecimento.status === "cancelled" ? <CancellationDetails date={abastecimento.cancelled_at} reason={abastecimento.motivo_cancelamento} /> : null}
        </div>
      ) : null}
    </div>
  );
}

function EmptyFuelState({
  motoristas,
  canCreate,
  postos,
  veiculos,
}: {
  canCreate: boolean;
  motoristas: Awaited<ReturnType<typeof getAbastecimentosData>>["motoristas"];
  postos: Awaited<ReturnType<typeof getAbastecimentosData>>["postos"];
  veiculos: Awaited<ReturnType<typeof getAbastecimentosData>>["veiculos"];
}) {
  return (
    <FrotasEmptyState icon={Fuel} title="Nenhuma ordem de abastecimento" description="Emita a primeira ordem para controlar abastecimento, quilometragem, litros e impressão térmica." action={canCreate ? (
        <AbastecimentoCreateDialog
          className="gap-2"
          label="Emitir ordem"
          postos={postos} motoristas={motoristas}
          veiculos={veiculos}
        />
      ) : null} />
  );
}

function AbastecimentoStatusBadge({ status }: { status: AbastecimentoStatus }) {
  const className: Record<AbastecimentoStatus, string> = {
    cancelled: "border-zinc-200 bg-zinc-100 text-zinc-700 hover:bg-zinc-100",
    completed:
      "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50",
    expired: "border-red-200 bg-red-50 text-red-700 hover:bg-red-50",
    issued: "border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-50",
  };
  const Icon =
    status === "completed"
      ? CircleCheck
      : status === "cancelled"
        ? CircleX
        : status === "expired"
          ? CircleX
          : CalendarClock;

  return (
    <Badge variant="outline" className={className[status]}>
      <Icon className="size-3.5" />
      {formatAbastecimentoStatus(status)}
    </Badge>
  );
}

function CompactDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md bg-muted/35 px-2.5 py-1.5 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate text-right font-medium">{value}</span>
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

function MetricTile({
  className,
  label,
  labelClassName,
  value,
  valueClassName,
}: {
  className?: string;
  label: string;
  labelClassName?: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className={cn("rounded-lg border bg-background px-2.5 py-1.5", className)}>
      <div className={cn("text-xs text-muted-foreground", labelClassName)}>
        {label}
      </div>
      <div className={cn("text-base font-semibold leading-tight", valueClassName)}>
        {value}
      </div>
    </div>
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    currency: "BRL",
    style: "currency",
  }).format(value);
}

function getFuelTotal(abastecimento: FrotaAbastecimento) {
  if (!abastecimento.valor_total) {
    return 0;
  }

  return abastecimento.valor_total - (abastecimento.arla_valor_total ?? 0);
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}
