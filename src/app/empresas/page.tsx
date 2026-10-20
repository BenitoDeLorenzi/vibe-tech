import { ListPanelHeader } from "@/components/list-panel-header";
import { ListMetrics } from "@/components/list-metrics";
import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";
import {
  Ban,
  Building2,
  CircleCheck,
  Clock3,
  MapPin,
  Pencil,
  Plus,
  Search,
  Settings,
  Trash2,
  X,
} from "lucide-react";

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
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatPrefeituraStatus,
  getPrefeituras,
  type PrefeituraStatus,
} from "@/lib/prefeituras-data";
import { requireRole } from "@/lib/auth-data";
import { DeletePrefeituraForm } from "./delete-prefeitura-form";
import { PrefeituraForm } from "./prefeitura-form";
import { PrefeiturasToasts } from "./prefeituras-toasts";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{
    created?: string;
    error?: string;
    deleted?: string;
    q?: string;
    status?: string;
    updated?: string;
  }>;
};

const filterOptions = [
  { label: "Todas", status: undefined },
  { label: "Ativas", status: "active" },
  { label: "Suspensas", status: "suspended" },
  { label: "Canceladas", status: "cancelled" },
];

export default async function PrefeiturasPage({ searchParams }: PageProps) {
  const profile = await requireRole(["bdl_admin"]);

  const params = await searchParams;
  const prefeituras = await getPrefeituras({
    query: params.q,
    status: params.status,
  });
  const activeCount = prefeituras.filter(
    (prefeitura) => prefeitura.status === "active",
  ).length;
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
    return `/empresas${queryString ? `?${queryString}` : ""}`;
  };

  return (
    <AdminShell
      active="empresas"
      icon={Building2}
      profile={profile}
      title="Empresas"
      actions={
        <div className="flex w-full min-w-0 items-center justify-end gap-2">
          <form className="flex min-w-0 shrink-0 justify-end gap-2">
            <div className="relative min-w-0 w-[320px]">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-9 pl-9"
                name="q"
                placeholder="Buscar empresa"
                defaultValue={params.q}
              />
            </div>
            {params.status ? (
              <input type="hidden" name="status" value={params.status} />
            ) : null}
            {hasActiveFilters ? (
              <Link
                href="/empresas"
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
              Nova empresa
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>Nova empresa</DialogTitle>
              </DialogHeader>
              <PrefeituraForm />
            </DialogContent>
          </Dialog>
        </div>
      }
    >
      <PrefeiturasToasts
        created={params.created}
        deleted={params.deleted}
        error={params.error}
        updated={params.updated}
      />
      <main className="flex flex-1 flex-col gap-3 p-4 md:p-4">
        <Card>
          <ListPanelHeader
              title="Empresas cadastradas"
              icon={Building2}
              metrics={<ListMetrics items={[
                { label: "Ativas", value: activeCount, tone: "success" },
                { label: "Total", value: prefeituras.length },
              ]} />}
            />
          <CardContent>
            {prefeituras.length ? (
              <div className="overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Empresa</TableHead>
                      <TableHead>Localização</TableHead>
                      <TableHead>Licenças</TableHead>
                      <TableHead>Módulos</TableHead>
                      <TableHead>Próximo vencimento</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[92px] text-right">
                        Ações
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {prefeituras.map((prefeitura) => (
                      <TableRow key={prefeitura.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted/40">
                              {prefeitura.brasao_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={prefeitura.brasao_url}
                                  alt={`Logotipo de ${prefeitura.nome}`}
                                  className="size-full object-contain p-1"
                                />
                              ) : (
                                <Building2 className="size-5 text-muted-foreground" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="truncate font-medium">
                                {prefeitura.nome}
                              </div>
                              {prefeitura.nome_fantasia && <div className="truncate text-xs text-muted-foreground">{prefeitura.nome_fantasia}</div>}
                              <div className="text-xs text-muted-foreground">
                                {prefeitura.cnpj}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm">
                            <MapPin className="size-4 text-muted-foreground" />
                            {prefeitura.cidade || prefeitura.uf
                              ? `${prefeitura.cidade ?? "-"} / ${prefeitura.uf ?? "-"}`
                              : "-"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              prefeitura.licencas_ativas
                                ? "secondary"
                                : "outline"
                            }
                          >
                            {prefeitura.licencas_ativas} ativa(s)
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {prefeitura.modulos_contratados.length ? (
                            <div className="flex max-w-[260px] flex-wrap gap-1">
                              {prefeitura.modulos_contratados.map((modulo) => (
                                <Badge
                                  key={modulo}
                                  variant="outline"
                                  className="font-normal"
                                >
                                  {modulo}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              Sem módulo ativo
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {prefeitura.proximo_vencimento ? (
                            new Intl.DateTimeFormat("pt-BR", {
                              timeZone: "UTC",
                            }).format(
                              new Date(
                                `${prefeitura.proximo_vencimento}T00:00:00.000Z`,
                              ),
                            )
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              -
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <PrefeituraStatusBadge status={prefeitura.status} />
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Link
                              href={`/empresas/${prefeitura.id}`}
                              className={buttonVariants({
                                variant: "ghost",
                                size: "icon-sm",
                              })}
                              title="Gerenciar empresa"
                            >
                              <Settings className="size-4" />
                            </Link>

                            <Dialog>
                              <DialogTrigger
                                className={buttonVariants({
                                  variant: "ghost",
                                  size: "icon-sm",
                                })}
                                title="Editar empresa"
                              >
                                <Pencil className="size-4" />
                              </DialogTrigger>
                              <DialogContent className="sm:max-w-2xl">
                                <DialogHeader>
                                  <DialogTitle>Editar empresa</DialogTitle>
                                </DialogHeader>
                                <PrefeituraForm prefeitura={prefeitura} />
                              </DialogContent>
                            </Dialog>

                            <Dialog>
                              <DialogTrigger
                                className={buttonVariants({
                                  variant: "destructive",
                                  size: "icon-sm",
                                })}
                                title="Excluir empresa"
                              >
                                <Trash2 className="size-4" />
                              </DialogTrigger>
                              <DialogContent className="sm:max-w-md">
                                <DialogHeader>
                                  <DialogTitle>Excluir empresa</DialogTitle>
                                  <DialogDescription>
                                    Esta ação remove o cadastro de{" "}
                                    {prefeitura.nome}. Verifique se não há
                                    licenças vinculadas antes de confirmar.
                                  </DialogDescription>
                                </DialogHeader>
                                <DeletePrefeituraForm id={prefeitura.id} />
                              </DialogContent>
                            </Dialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex min-h-[320px] flex-col items-center justify-center rounded-lg border bg-muted/20 p-8 text-center">
                <div className="flex size-12 items-center justify-center rounded-lg border bg-background">
                  <Building2 className="size-6 text-muted-foreground" />
                </div>
                <h3 className="mt-4 text-base font-semibold">
                  Nenhuma empresa encontrada
                </h3>
                <p className="mt-1 max-w-md text-sm text-muted-foreground">
                  Cadastre a primeira empresa ou ajuste os filtros para
                  visualizar outros registros.
                </p>
                <Dialog>
                  <DialogTrigger
                    className={buttonVariants({
                      className: "mt-4 gap-2",
                    })}
                  >
                    <Plus className="size-4" />
                    Cadastrar empresa
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Nova empresa</DialogTitle>
                    </DialogHeader>
                    <PrefeituraForm />
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

function PrefeituraStatusBadge({ status }: { status: PrefeituraStatus }) {
  const styles: Record<PrefeituraStatus, string> = {
    active:
      "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50",
    cancelled: "border-zinc-200 bg-zinc-100 text-zinc-700 hover:bg-zinc-100",
    expired: "border-red-200 bg-red-50 text-red-700 hover:bg-red-50",
    suspended: "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50",
  };
  const icons = {
    active: CircleCheck,
    cancelled: Ban,
    expired: Clock3,
    suspended: Clock3,
  } satisfies Record<PrefeituraStatus, typeof CircleCheck>;
  const Icon = icons[status];

  return (
    <Badge variant="outline" className={styles[status]}>
      <Icon className="size-3.5" />
      {formatPrefeituraStatus(status)}
    </Badge>
  );
}
