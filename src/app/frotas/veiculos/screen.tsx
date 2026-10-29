import { emptyFleetPage, getFrotaListPage, orderPageItems } from "@/lib/frotas-list-page";
import { FrotasEmptyState } from "@/components/frotas-empty-state";
import { ListPanelHeader } from "@/components/list-panel-header";
import { ListPagination } from "@/components/list-pagination";
import { getFrotasLoadingData } from "@/app/frotas/frotas-loading-data";
import { TableLoadingRows } from "@/components/table-loading";
import { ListDeleteButton } from "@/components/list-delete-button";
import { ListMetrics } from "@/components/list-metrics";
import Link from "next/link";
import { forbidden } from "next/navigation";
import {
  AlertTriangle,
  Car,
  CircleCheck,
  CircleX,
  ClipboardCheck,
  LoaderCircle,
  Clock3,
  Pencil,
  Search,
  Settings,
  Trash2,
  Wrench,
  X,
} from "lucide-react";

import { VeiculoAvatar } from "@/components/veiculo-avatar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
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
  formatVeiculoStatus,
  getFrotasData,
  type VeiculoStatus,
} from "@/lib/frotas-data";
import { requireUserProfile } from "@/lib/auth-data";
import { getFrotasPermissionAccess } from "@/lib/frotas-permissions";
import { getVehicleDebtSummaries, type VehicleDebtSummary } from "@/lib/frotas-debt-summary";
import { CopyValueButton } from "../copy-value-button";
import { DeleteVeiculoForm } from "../delete-veiculo-form";
import { FrotasShell } from "../frotas-shell";
import { FrotasToasts } from "../frotas-toasts";
import { VeiculoCadastroDialog } from "../veiculo-cadastro-dialog";
import { VeiculoForm } from "../veiculo-form";
import { VehicleRealtimeSync } from "./vehicle-realtime-sync";
import { VehicleLookupSync } from "./vehicle-lookup-sync";

export const dynamic = "force-dynamic";

type PageProps = {
  loading?: boolean;
  searchParams: Promise<{
    deleted?: string;
    error?: string;
    prefeitura?: string;
    q?: string;
    status?: string;
    size?: string; page?: string;
  }>;
};

const statusFilters = [
  { label: "Todos", status: undefined },
  { label: "Ativos", status: "active" },
  { label: "Manutenção", status: "maintenance" },
  { label: "Inativos", status: "inactive" },
];

export default async function FrotasPage({ searchParams, loading = false }: PageProps) {
  const profile = await requireUserProfile();
  const access = await getFrotasPermissionAccess(profile);
  if (!access.canViewVeiculos) forbidden();

  const params = await searchParams;
  const prefeituraId =
    profile.role === "bdl_admin"
      ? params.prefeitura
      : profile.prefeitura_id ?? undefined;
  const databasePage = loading ? emptyFleetPage : await getFrotaListPage(profile, "veiculos", params);
  const [data, debtSummaries] = await Promise.all([
    loading ? getFrotasLoadingData(profile, prefeituraId) : getFrotasData({
      ids: databasePage.ids,
      lightweight: true,
      prefeituraId: databasePage.empresaId ?? prefeituraId,
      query: params.q,
      status: params.status,
    }),
    loading ? Promise.resolve({} as Record<string, VehicleDebtSummary>) : getVehicleDebtSummaries(databasePage.empresaId, databasePage.ids),
  ]);
  const searchTerm = params.q?.trim();
  const vehiclePage = { ...databasePage, items: orderPageItems(data.veiculos, databasePage) };
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
    return `/frotas/veiculos${queryString ? `?${queryString}` : ""}`;
  };

  return (
    <FrotasShell
      loading={loading}
      active="veiculos"
      actions={
        <VeiculosToolbar
          access={access}
          buildFilterHref={buildFilterHref}
          data={data}
          params={params}
          showPrefeituraField={profile.role === "bdl_admin"}
        />
      }
      icon={Car}
      prefeituras={data.prefeituras}
      profile={profile}
      selectedPrefeituraId={data.selectedPrefeituraId}
      title="Veículos"
    >
      <VehicleRealtimeSync prefeituraId={data.selectedPrefeituraId} />
      <VehicleLookupSync prefeituraId={data.selectedPrefeituraId} vehicleIds={data.veiculos.filter((vehicle) => vehicle.status === "processing").map((vehicle) => vehicle.id)} />
      <FrotasToasts deleted={params.deleted} error={params.error} />
        <main className="flex min-h-full flex-col gap-3 p-4">
            <Card className="flex flex-1 flex-col">
              <ListPanelHeader title="Veículos cadastrados" icon={Car} metrics={<ListMetrics
                loading={loading}
                    items={[
                      { label: "Ativos", value: (databasePage.statuses.active ?? 0), tone: "success" },
                      { label: "Total", value: databasePage.total },
                    ]}
                  />} />
              <CardContent className="flex flex-1 flex-col">
                {loading || data.veiculos.length ? (
                  <div className="overflow-hidden rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="w-[72px]">Foto</TableHead>
                          <TableHead>Veículo</TableHead>
                          <TableHead>Placa / Renavam</TableHead>
                          <TableHead>Combustível</TableHead>
                          <TableHead className="text-right">Quilometragem</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Débitos</TableHead>
                          <TableHead>Última atualização</TableHead>
                          <TableHead className="w-[92px] text-right">
                            Ações
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {loading ? <TableLoadingRows columns={9} /> : vehiclePage.items.map((veiculo) => (
                          <TableRow key={veiculo.id}>
                            <TableCell>
                              <VeiculoAvatar fotoUrl={veiculo.foto_url} placa={veiculo.placa} className="size-12" />
                            </TableCell>
                            <TableCell>
                              <div className="min-w-[190px]">
                                <div className="truncate font-medium">
                                  {veiculo.modelo || "Dados cadastrais pendentes"}
                                </div>
                                <div className="truncate text-sm text-muted-foreground">
                                  {veiculo.marca ? `${veiculo.marca} · ` : ""}{veiculo.ano_modelo || veiculo.ano || "Ano não informado"}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <div className="flex items-center gap-1">
                                  <span className="font-medium">
                                    {veiculo.placa}
                                  </span>
                                  <CopyValueButton
                                    label="placa"
                                    value={veiculo.placa}
                                  />
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="text-xs text-muted-foreground">
                                    {veiculo.renavam ?? "-"}
                                  </span>
                                  <CopyValueButton
                                    label="Renavam"
                                    value={veiculo.renavam}
                                  />
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="font-normal">
                                {veiculo.combustivel ?? "-"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap tabular-nums">
                              {veiculo.quilometragem != null ? (
                                <>
                                  {veiculo.quilometragem.toLocaleString("pt-BR")}
                                  <span className="ml-1 text-xs text-muted-foreground">km</span>
                                </>
                              ) : (
                                <span className="text-muted-foreground">Não informada</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1.5">
                                <VehicleStatusBadge status={veiculo.status} lookupStatus={veiculo.consulta_status} />
                                {veiculo.status === "processing" || veiculo.status === "consult_error" ? (
                                  <p className="max-w-[260px] text-xs text-muted-foreground" title={veiculo.consulta_mensagem ?? undefined}>
                                    {veiculo.consulta_mensagem ?? (veiculo.consulta_status === "success" ? "Dados recebidos. Confira e finalize o cadastro." : "Aguardando retorno da Plexi.")}
                                  </p>
                                ) : null}
                              </div>
                            </TableCell>
                            <TableCell>
                              <VehicleDebtStatus summary={debtSummaries[veiculo.id]} vehicleId={veiculo.id} />
                            </TableCell>
                            <TableCell>
                              <VehicleDebtLastUpdate summary={debtSummaries[veiculo.id]} />
                            </TableCell>
                            <TableCell>
                              <div className="flex justify-end gap-1">

                                <Tooltip>
                                  <TooltipTrigger
                                    render={
                                      <Link
                                        href={`/frotas/veiculos/${veiculo.id}`}
                                        className={buttonVariants({
                                          variant: "ghost",
                                          size: "icon-sm",
                                        })}
                                        aria-label="Gestão do veículo"
                                      >
                                        <Settings className="size-4" />
                                      </Link>
                                    }
                                  />
                                  <TooltipContent>Gestão do veículo</TooltipContent>
                                </Tooltip>

                                {access.canUpdateVeiculos ? (
                                  <Dialog>
                                    <Tooltip>
                                      <TooltipTrigger
                                        render={
                                          <DialogTrigger
                                            className={buttonVariants({
                                              variant: "ghost",
                                              size: "icon-sm",
                                            })}
                                            aria-label={veiculo.status === "consult_error" ? "Conferir cadastro" : "Editar veículo"}
                                            disabled={veiculo.status === "processing"}
                                          >
                                            <Pencil className="size-4" />
                                          </DialogTrigger>
                                        }
                                      />
                                      <TooltipContent>{veiculo.status === "processing" ? "Aguarde o resultado da consulta" : veiculo.status === "consult_error" ? "Conferir e finalizar cadastro" : "Editar veículo"}</TooltipContent>
                                    </Tooltip>
                                    <DialogContent className="sm:max-w-5xl">
                                      <DialogHeader>
                                        <DialogTitle>{veiculo.status === "consult_error" ? "Conferir cadastro do veículo" : "Editar veículo"}</DialogTitle>
                                      </DialogHeader>
                                      <VeiculoForm
                                        prefeituras={data.prefeituras}
                                        selectedPrefeituraId={
                                          data.selectedPrefeituraId
                                        }
                                        showPrefeituraField={
                                          profile.role === "bdl_admin"
                                        }
                                        veiculo={veiculo}
                                      />
                                    </DialogContent>
                                  </Dialog>
                                ) : null}

                                {access.canDeleteVeiculos ? (
                                  <Dialog>
                                    <Tooltip>
                                      <TooltipTrigger
                                        render={
                                          <DialogTrigger
                                            render={<ListDeleteButton />}
                                            aria-label="Excluir veículo"
                                          >
                                            <Trash2 className="size-4" />
                                          </DialogTrigger>
                                        }
                                      />
                                      <TooltipContent>Excluir veículo</TooltipContent>
                                    </Tooltip>
                                    <DialogContent className="sm:max-w-md">
                                      <DialogHeader>
                                        <DialogTitle>Excluir veículo</DialogTitle>
                                        <DialogDescription>
                                          Esta ação remove o veículo {veiculo.placa}
                                          e todos os dados vinculados a ele.
                                        </DialogDescription>
                                      </DialogHeader>
                                      <DeleteVeiculoForm id={veiculo.id} />
                                    </DialogContent>
                                  </Dialog>
                                ) : null}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <EmptyFleetState
                    canCreate={access.canCreateVeiculos}
                    prefeituras={data.prefeituras}
                    showPrefeituraField={profile.role === "bdl_admin"}
                    selectedPrefeituraId={data.selectedPrefeituraId}
                  />
                )}
                {!loading && <ListPagination page={vehiclePage.page} pageCount={vehiclePage.pageCount} pathname="/frotas/veiculos" params={{ size: params.size, prefeitura: data.selectedPrefeituraId, q: params.q, status: params.status }} />}
              </CardContent>
            </Card>
        </main>
    </FrotasShell>
  );
}

function VehicleDebtStatus({ summary, vehicleId }: { summary?: VehicleDebtSummary; vehicleId: string }) {
  if (!summary?.atualizadoEm) {
    return <span className="whitespace-nowrap text-xs text-muted-foreground">Sem dados</span>;
  }

  const overdue = summary.vencidos > 0;
  const soon = summary.proximos > 0;
  const recorded = summary.debitosConsulta > 0;
  const Icon = overdue ? AlertTriangle : soon ? Clock3 : CircleCheck;
  const label = overdue ? "Vencido" : soon ? "Próximo do vencimento" : recorded ? "Débito registrado" : "Sem pendências";
  const className = overdue
    ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-50 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
    : soon
      ? "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
      : recorded
        ? "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-50 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300"
        : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300";

  return <Link href={`/frotas/veiculos/${vehicleId}/debitos`} aria-label={`${label}. Ver débitos do veículo.`}>
    <Badge variant="outline" className={`whitespace-nowrap ${className}`}>
      <Icon className="size-3.5" aria-hidden="true" />
      {label}
    </Badge>
  </Link>;
}

function VehicleDebtLastUpdate({ summary }: { summary?: VehicleDebtSummary }) {
  if (!summary?.atualizadoEm) {
    return <span className="whitespace-nowrap text-xs text-muted-foreground">Sem atualização</span>;
  }
  const date = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Sao_Paulo",
  }).format(new Date(summary.atualizadoEm));
  return <div className="whitespace-nowrap">
    <div className="font-medium tabular-nums">{date}</div>
    <div className="text-xs text-muted-foreground">{summary.origemAtualizacao === "plexi" ? "Consulta Plexi" : "Atualização manual"}</div>
  </div>;
}

function VeiculosToolbar({
  access,
  buildFilterHref,
  data,
  params,
  showPrefeituraField,
}: {
  access: Awaited<ReturnType<typeof getFrotasPermissionAccess>>;
  buildFilterHref: (values: {
    prefeitura?: string | null;
    status?: string | null;
  }) => string;
  data: Awaited<ReturnType<typeof getFrotasData>>;
  params: Awaited<PageProps["searchParams"]>;
  showPrefeituraField: boolean;
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
            placeholder="Buscar veículo"
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
            href="/frotas/veiculos"
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

      {access.canCreateVeiculos ? <HeaderSeparator className="hidden xl:block" /> : null}



      {access.canCreateVeiculos ? (
        <VeiculoCadastroDialog
          prefeituras={data.prefeituras}
          selectedPrefeituraId={data.selectedPrefeituraId}
          showPrefeituraField={showPrefeituraField}
        />
      ) : null}
    </div>
  );
}

function EmptyFleetState({
  canCreate,
  prefeituras,
  showPrefeituraField,
  selectedPrefeituraId,
}: {
  canCreate: boolean;
  prefeituras: Awaited<ReturnType<typeof getFrotasData>>["prefeituras"];
  showPrefeituraField: boolean;
  selectedPrefeituraId?: string;
}) {
  return (
    <FrotasEmptyState icon={Car} title="Nenhum veículo encontrado" description="Cadastre o primeiro veículo da empresa selecionada ou ajuste os filtros para visualizar outros registros." action={canCreate ? (
        <VeiculoCadastroDialog
          prefeituras={prefeituras}
          selectedPrefeituraId={selectedPrefeituraId}
          showPrefeituraField={showPrefeituraField}
          triggerLabel="Cadastrar veículo"
        />
      ) : null} />
  );
}

function VehicleStatusBadge({ status, lookupStatus }: { status: VeiculoStatus; lookupStatus?: string | null }) {
  const styles: Record<VeiculoStatus, string> = {
    active:
      "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50",
    inactive:
      "border-zinc-200 bg-zinc-100 text-zinc-700 hover:bg-zinc-100",
    maintenance:
      "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50",
    consult_error: lookupStatus === "error" ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-50" : "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50",
    processing: "border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-50",
  };
  const icons = {
    active: CircleCheck,
    consult_error: lookupStatus === "error" ? CircleX : ClipboardCheck,
    inactive: CircleX,
    maintenance: Wrench,
    processing: LoaderCircle,
  } satisfies Record<VeiculoStatus, typeof CircleCheck>;
  const Icon = icons[status];

  return (
    <Badge variant="outline" className={styles[status]}>
      <Icon className={status === "processing" ? "size-3.5 animate-spin" : "size-3.5"} />
      {status === "consult_error" && lookupStatus === "error" ? "Falha na consulta" : formatVeiculoStatus(status)}
    </Badge>
  );
}
