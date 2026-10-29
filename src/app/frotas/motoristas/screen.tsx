import { emptyFleetPage, getFrotaListPage, orderPageItems } from "@/lib/frotas-list-page";
import { FrotasEmptyState } from "@/components/frotas-empty-state";
import { getFrotasLoadingData } from "@/app/frotas/frotas-loading-data";
import { TableLoadingRows } from "@/components/table-loading";
import { DeleteCadastroButton } from "@/components/delete-cadastro-button";
import { deleteMotorista } from "../cadastro-actions";
import { ListMetrics } from "@/components/list-metrics";
import { ListPagination } from "@/components/list-pagination";
import Link from "next/link";
import { forbidden } from "next/navigation";
import {
  CalendarClock,
  CircleCheck,
  CircleX,
  Eye,
  Pencil,
  Plus,
  Search,
  UserRoundCog,
  X,
} from "lucide-react";

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
import { requireUserProfile } from "@/lib/auth-data";
import { getFrotasPermissionAccess } from "@/lib/frotas-permissions";
import {
  formatCpf,
  formatMotoristaDate,
  formatMotoristaStatus,
  getMotoristasData,
  type FrotaMotorista,
  type MotoristaStatus,
} from "@/lib/motoristas-data";
import { MotoristaForm } from "./motorista-form";
import { CadastroStatusButton } from "@/components/cadastro-status-button";
import { updateMotoristaStatus } from "./actions";

export const dynamic = "force-dynamic";

type PageProps = {
  loading?: boolean;
  searchParams: Promise<{
    prefeitura?: string;
    q?: string;
    status?: string;
    size?: string; page?: string;
  }>;
};

const statusFilters = [
  { label: "Todos", status: undefined },
  { label: "Ativos", status: "active" },
  { label: "Inativos", status: "inactive" },
];

export default async function MotoristasPage({ searchParams, loading = false }: PageProps) {
  const profile = await requireUserProfile();
  const access = await getFrotasPermissionAccess(profile);

  if (!access.canViewMotoristas) {
    forbidden();
  }

  const params = await searchParams;
  const prefeituraId =
    profile.role === "bdl_admin"
      ? params.prefeitura
      : profile.prefeitura_id ?? undefined;
  const databasePage = loading ? emptyFleetPage : await getFrotaListPage(profile, "motoristas", params);
  const data = loading ? await getFrotasLoadingData(profile, prefeituraId) : await getMotoristasData({
    ids: databasePage.ids,
    lightweight: true,
    prefeituraId: databasePage.empresaId ?? prefeituraId,
    query: params.q,
    status: params.status,
  });
  const searchTerm = params.q?.trim();
  const driverPage = { ...databasePage, items: orderPageItems(data.motoristas, databasePage) };
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
    return `/frotas/motoristas${queryString ? `?${queryString}` : ""}`;
  };

  return (
    <FrotasShell
      loading={loading}
      active="motoristas"
      actions={
        <MotoristasToolbar
          access={access}
          buildFilterHref={buildFilterHref}
          data={data}
          params={params}
          showPrefeituraField={profile.role === "bdl_admin"}
        />
      }
      icon={UserRoundCog}
      prefeituras={data.prefeituras}
      profile={profile}
      selectedPrefeituraId={data.selectedPrefeituraId}
      title="Motoristas"
    >
      <main className="flex min-h-full flex-col gap-3 p-4">
        <Card className="flex flex-1 flex-col">
          <CardHeader>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg border bg-muted/40">
                  <UserRoundCog className="size-5 text-muted-foreground" />
                </div>
                <div>
                  <CardTitle>Motoristas cadastrados</CardTitle>
                </div>
              </div>
              <ListMetrics
                loading={loading}
                items={[
                  { label: "Ativos", value: (databasePage.statuses.active ?? 0), tone: "success" },
                  { label: "Em uso", value: databasePage.inUse, tone: "inUse" },
                  { label: "Total", value: databasePage.total },
                ]}
              />
            </div>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col">
            {loading || data.motoristas.length ? (
              <div className="overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Motorista</TableHead>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Histórico</TableHead>
                      <TableHead>Situação</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[120px] text-right">
                        Ações
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? <TableLoadingRows columns={6} /> : driverPage.items.map((motorista) => (
                      <TableRow key={motorista.id}>
                        <TableCell>
                          <div className="min-w-[190px]">
                            <div className="font-medium">{motorista.nome}</div>
                            <div className="text-xs text-muted-foreground">
                              {formatCpf(motorista.cpf)}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">
                            {motorista.prefeitura_nome}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="min-w-[170px]">
                            <div className="text-sm font-medium">
                              {motorista.total_usos} uso(s)
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Último: {formatMotoristaDate(motorista.ultimo_uso)}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {motorista.em_uso ? (
                            <Badge
                              variant="outline"
                              className="border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50"
                            >
                              <CalendarClock className="size-3.5" />
                              {motorista.veiculo_atual ?? "Em uso"}
                            </Badge>
                          ) : (
                            <Badge variant="outline">Disponível</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <MotoristaStatusBadge status={motorista.status} />
                        </TableCell>
                        <TableCell>
                          <MotoristaActions
                            canDelete={profile.role === "bdl_admin"}
                            access={access}
                            motorista={motorista}
                            prefeituras={data.prefeituras}
                            selectedPrefeituraId={data.selectedPrefeituraId}
                            showPrefeituraField={profile.role === "bdl_admin"}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <EmptyMotoristasState
                canCreate={access.canManageMotoristas}
                prefeituras={data.prefeituras}
                selectedPrefeituraId={data.selectedPrefeituraId}
                showPrefeituraField={profile.role === "bdl_admin"}
              />
            )}
            {!loading && <ListPagination page={driverPage.page} pageCount={driverPage.pageCount} pathname="/frotas/motoristas" params={{ size: params.size, prefeitura: data.selectedPrefeituraId, q: params.q, status: params.status }} />}
          </CardContent>
        </Card>
      </main>
    </FrotasShell>
  );
}

function MotoristasToolbar({
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
  data: Awaited<ReturnType<typeof getMotoristasData>>;
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
            placeholder="Buscar motorista"
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
            href="/frotas/motoristas"
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

      {access.canManageMotoristas ? <HeaderSeparator className="hidden xl:block" /> : null}

      {access.canManageMotoristas ? (
        <Dialog>
          <DialogTrigger
            className={buttonVariants({
              className: "h-9 shrink-0 gap-2",
            })}
          >
            <Plus className="size-4" />
            Novo motorista
          </DialogTrigger>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Novo motorista</DialogTitle>
            </DialogHeader>
            <MotoristaForm
              prefeituras={data.prefeituras}
              selectedPrefeituraId={data.selectedPrefeituraId}
              showPrefeituraField={showPrefeituraField}
            />
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}

function MotoristaActions({
  canDelete,
  access,
  motorista,
  prefeituras,
  selectedPrefeituraId,
  showPrefeituraField,
}: {
  canDelete: boolean;
  access: Awaited<ReturnType<typeof getFrotasPermissionAccess>>;
  motorista: FrotaMotorista;
  prefeituras: Awaited<ReturnType<typeof getMotoristasData>>["prefeituras"];
  selectedPrefeituraId?: string;
  showPrefeituraField: boolean;
}) {
  return (
    <div className="flex justify-end gap-1">
      <Dialog>
        <Tooltip>
          <TooltipTrigger
            render={
              <DialogTrigger
                className={buttonVariants({
                  variant: "ghost",
                  size: "icon-sm",
                })}
                aria-label="Ver motorista"
              >
                <Eye className="size-4" />
              </DialogTrigger>
            }
          />
          <TooltipContent>Ver motorista</TooltipContent>
        </Tooltip>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes do motorista</DialogTitle>
            <DialogDescription>{formatCpf(motorista.cpf)}</DialogDescription>
          </DialogHeader>
          <MotoristaDetails motorista={motorista} />
        </DialogContent>
      </Dialog>

      {access.canManageMotoristas ? (
        <>
          <Dialog>
            <Tooltip>
              <TooltipTrigger
                render={
                  <DialogTrigger
                    className={buttonVariants({
                      variant: "ghost",
                      size: "icon-sm",
                    })}
                    aria-label="Editar motorista"
                  >
                    <Pencil className="size-4" />
                  </DialogTrigger>
                }
              />
              <TooltipContent>Editar motorista</TooltipContent>
            </Tooltip>
            <DialogContent className="sm:max-w-xl">
              <DialogHeader>
                <DialogTitle>Editar motorista</DialogTitle>
              </DialogHeader>
              <MotoristaForm
                motorista={motorista}
                prefeituras={prefeituras}
                selectedPrefeituraId={selectedPrefeituraId}
                showPrefeituraField={showPrefeituraField}
              />
            </DialogContent>
          </Dialog>

          <CadastroStatusButton id={motorista.id} status={motorista.status} entity="motorista" action={updateMotoristaStatus} />
        </>
      ) : null}
      {canDelete ? <DeleteCadastroButton id={motorista.id} nome={motorista.nome} entity="motorista" action={deleteMotorista} /> : null}
    </div>
  );
}

function MotoristaDetails({ motorista }: { motorista: FrotaMotorista }) {
  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-muted/20 p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-lg font-semibold leading-none">
                {motorista.nome}
              </h3>
              <MotoristaStatusBadge status={motorista.status} />
            </div>
            <div className="text-xs text-muted-foreground">
              {formatCpf(motorista.cpf)} · {motorista.prefeitura_nome}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:min-w-72">
            <MetricTile label="Usos" value={String(motorista.total_usos)} />
            <MetricTile
              label="Situação"
              value={motorista.em_uso ? "Em uso" : "Disponível"}
            />
            <MetricTile
              label="Último"
              value={formatMotoristaDate(motorista.ultimo_uso)}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border p-2.5">
          <div className="flex items-center gap-2 text-xs font-medium">
            <UserRoundCog className="size-3.5 text-muted-foreground" />
            Cadastro
          </div>
          <div className="mt-2 grid gap-1.5">
            <CompactDetail label="Nome" value={motorista.nome} />
            <CompactDetail label="CPF" value={formatCpf(motorista.cpf)} />
            <CompactDetail
              label="Empresa"
              value={motorista.prefeitura_nome}
            />
            <CompactDetail
              label="Status"
              value={formatMotoristaStatus(motorista.status)}
            />
          </div>
        </div>

        <div className="rounded-lg border p-2.5">
          <div className="flex items-center gap-2 text-xs font-medium">
            <CalendarClock className="size-3.5 text-muted-foreground" />
            Uso da frota
          </div>
          <div className="mt-2 grid gap-1.5">
            <CompactDetail
              label="Total de usos"
              value={String(motorista.total_usos)}
            />
            <CompactDetail
              label="Último uso"
              value={formatMotoristaDate(motorista.ultimo_uso)}
            />
            <CompactDetail
              label="Veículo atual"
              value={motorista.veiculo_atual ?? "-"}
            />
            <CompactDetail
              label="Situação"
              value={motorista.em_uso ? "Em uso" : "Disponível"}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyMotoristasState({
  canCreate,
  prefeituras,
  selectedPrefeituraId,
  showPrefeituraField,
}: {
  canCreate: boolean;
  prefeituras: Awaited<ReturnType<typeof getMotoristasData>>["prefeituras"];
  selectedPrefeituraId?: string;
  showPrefeituraField: boolean;
}) {
  return (
    <FrotasEmptyState icon={UserRoundCog} title="Nenhum motorista cadastrado" description="Motoristas só são consolidados quando possuem CPF. Retiradas sem CPF continuam no histórico, mas não viram cadastro." action={canCreate ? (
        <Dialog>
          <DialogTrigger
              className={buttonVariants({
              className: "gap-2",
            })}
          >
            <Plus className="size-4" />
            Cadastrar motorista
          </DialogTrigger>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Novo motorista</DialogTitle>
            </DialogHeader>
            <MotoristaForm
              prefeituras={prefeituras}
              selectedPrefeituraId={selectedPrefeituraId}
              showPrefeituraField={showPrefeituraField}
            />
          </DialogContent>
        </Dialog>
      ) : null} />
  );
}

function MotoristaStatusBadge({ status }: { status: MotoristaStatus }) {
  return (
    <Badge
      variant="outline"
      className={
        status === "active"
          ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50"
          : "border-zinc-200 bg-zinc-100 text-zinc-700 hover:bg-zinc-100"
      }
    >
      {status === "active" ? (
        <CircleCheck className="size-3.5" />
      ) : (
        <CircleX className="size-3.5" />
      )}
      {formatMotoristaStatus(status)}
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
