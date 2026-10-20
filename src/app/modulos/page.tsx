import { ListPanelHeader } from "@/components/list-panel-header";
import { ListMetrics } from "@/components/list-metrics";
import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";
import {
  CircleCheck,
  CircleX,
  ClipboardList,
  ExternalLink,
  Pencil,
  Plus,
  Search,
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
  formatModuloCurrency,
  formatModuloStatus,
  getModulos,
} from "@/lib/modulos-data";
import { requireRole } from "@/lib/auth-data";
import { DeleteModuloForm } from "./delete-modulo-form";
import { ModuloForm } from "./modulo-form";
import { ModulosToasts } from "./modulos-toasts";

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
  { label: "Todos", status: undefined },
  { label: "Ativos", status: "active" },
  { label: "Inativos", status: "inactive" },
];

export default async function ModulosPage({ searchParams }: PageProps) {
  const profile = await requireRole(["bdl_admin"]);

  const params = await searchParams;
  const modulos = await getModulos({
    query: params.q,
    status: params.status,
  });
  const activeCount = modulos.filter((modulo) => modulo.ativo).length;
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
    return `/modulos${queryString ? `?${queryString}` : ""}`;
  };

  return (
    <AdminShell
      active="modulos"
      icon={ClipboardList}
      profile={profile}
      title="Módulos"
      actions={
        <div className="flex w-full min-w-0 items-center justify-end gap-2">
          <form className="flex min-w-0 shrink-0 justify-end gap-2">
            <div className="relative min-w-0 w-[320px]">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-9 pl-9"
                name="q"
                placeholder="Buscar módulo"
                defaultValue={params.q}
              />
            </div>
            {params.status ? (
              <input type="hidden" name="status" value={params.status} />
            ) : null}
            {hasActiveFilters ? (
              <Link
                href="/modulos"
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
              Novo módulo
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Novo módulo</DialogTitle>
              </DialogHeader>
              <ModuloForm />
            </DialogContent>
          </Dialog>
        </div>
      }
    >
      <ModulosToasts deleted={params.deleted} error={params.error} />
      <main className="flex flex-1 flex-col gap-3 p-4 md:p-4">
          <Card>
            <ListPanelHeader
              title="Módulos cadastrados"
              icon={ClipboardList}
              metrics={<ListMetrics items={[
                { label: "Ativos", value: activeCount, tone: "success" },
                { label: "Total", value: modulos.length },
              ]} />}
            />
            <CardContent>
              {modulos.length ? (
                <div className="overflow-hidden rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Módulo</TableHead>
                        <TableHead>Subdomínio</TableHead>
                        <TableHead>Clientes</TableHead>
                        <TableHead>Receita anual</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-[92px] text-right">
                          Ações
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {modulos.map((modulo) => (
                        <TableRow key={modulo.id}>
                          <TableCell>
                            <div className="font-medium">{modulo.nome}</div>
                            <div className="text-xs text-muted-foreground">
                              {modulo.slug}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 text-sm">
                              <ExternalLink className="size-4 text-muted-foreground" />
                              {modulo.subdominio}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <Badge
                                variant="outline"
                                className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50"
                              >
                                <CircleCheck className="size-3.5" />
                                {modulo.clientes_ativos} ativo(s)
                              </Badge>
                              <Badge
                                variant="outline"
                                className="border-zinc-200 bg-zinc-100 text-zinc-700 hover:bg-zinc-100"
                              >
                                {modulo.licencas_totais} total
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">
                              {formatModuloCurrency(modulo.receita_anual)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              por ano
                            </div>
                          </TableCell>
                          <TableCell>
                            <ModuloStatusBadge ativo={modulo.ativo} />
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-1">
                              <Dialog>
                                <DialogTrigger
                                  className={buttonVariants({
                                    variant: "ghost",
                                    size: "icon-sm",
                                  })}
                                  title="Editar módulo"
                                >
                                  <Pencil className="size-4" />
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-lg">
                                  <DialogHeader>
                                    <DialogTitle>Editar módulo</DialogTitle>
                                  </DialogHeader>
                                  <ModuloForm modulo={modulo} />
                                </DialogContent>
                              </Dialog>

                              <Dialog>
                                <DialogTrigger
                                  className={buttonVariants({
                                    variant: "destructive",
                                    size: "icon-sm",
                                  })}
                                  title="Excluir módulo"
                                >
                                  <Trash2 className="size-4" />
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-md">
                                  <DialogHeader>
                                    <DialogTitle>Excluir módulo</DialogTitle>
                                    <DialogDescription>
                                      Esta ação remove o módulo {modulo.nome}.
                                      Módulos com licenças vinculadas não podem
                                      ser excluídos.
                                    </DialogDescription>
                                  </DialogHeader>
                                  <DeleteModuloForm id={modulo.id} />
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
                    <ClipboardList className="size-6 text-muted-foreground" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold">
                    Nenhum módulo encontrado
                  </h3>
                  <p className="mt-1 max-w-md text-sm text-muted-foreground">
                    Cadastre o primeiro módulo para disponibilizar uma nova
                    solução no portal.
                  </p>
                  <Dialog>
                    <DialogTrigger
                      className={buttonVariants({
                        className: "mt-4 gap-2",
                      })}
                    >
                      <Plus className="size-4" />
                      Cadastrar módulo
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-lg">
                      <DialogHeader>
                        <DialogTitle>Novo módulo</DialogTitle>
                      </DialogHeader>
                      <ModuloForm />
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

function ModuloStatusBadge({ ativo }: { ativo: boolean }) {
  const Icon = ativo ? CircleCheck : CircleX;

  return (
    <Badge
      variant="outline"
      className={
        ativo
          ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50"
          : "border-zinc-200 bg-zinc-100 text-zinc-700 hover:bg-zinc-100"
      }
    >
      <Icon className="size-3.5" />
      {formatModuloStatus(ativo)}
    </Badge>
  );
}
