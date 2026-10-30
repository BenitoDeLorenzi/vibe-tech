import { ListPanelHeader } from "@/components/list-panel-header";
import { ListMetrics } from "@/components/list-metrics";
import { AdminMobileFilters } from "@/components/admin-mobile-filters";
import { AdminMobileList } from "@/components/admin-mobile-list";
import { AdminMobileCard } from "@/components/admin-mobile-card";
import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";
import { EmpresaFilterCombobox } from "@/components/empresa-filter-combobox";
import { UsuarioStatusBadge } from "@/components/usuario-status-badge";
import {
  CircleCheck,
  CircleX,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  Users,
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
  formatUsuarioRole,
  formatCpf,
  getUsuarioFormOptions,
  getUsuarioStatus,
  getUsuariosAccessMap,
  getUsuarios,
  type UsuarioRole,
} from "@/lib/usuarios-data";
import { requireRole } from "@/lib/auth-data";
import { cn } from "@/lib/utils";
import { DeleteUsuarioForm } from "./delete-usuario-form";
import { UsuarioAcessosForm } from "./usuario-acessos-form";
import { UsuarioForm } from "./usuario-form";
import { UsuarioStatusForm } from "./usuario-status-form";
import { UsuariosToasts } from "./usuarios-toasts";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{
    deleted?: string;
    error?: string;
    status?: string;
    prefeitura?: string;
    empresa?: string;
    q?: string;
  }>;
};

export default async function UsuariosPage({ searchParams }: PageProps) {
  const profile = await requireRole(["bdl_admin"]);

  const params = await searchParams;
  const [usuarios, formOptions] = await Promise.all([
    getUsuarios({
      prefeituraId: params.empresa ?? params.prefeitura,
      query: params.q,
    }),
    getUsuarioFormOptions(),
  ]);
  const accessMap = await getUsuariosAccessMap(usuarios);
  const statuses = usuarios.map(getUsuarioStatus);
  const activeCount = statuses.filter((status) => status === "active").length;
  const pendingCount = statuses.filter((status) => status === "first_access" || status === "email_pending").length;
  const searchTerm = params.q?.trim();
  const hasActiveFilters = Boolean(
    searchTerm || (params.empresa ?? params.prefeitura),
  );

  return (
    <AdminShell
      active="usuarios"
      icon={Users}
      profile={profile}
      title="Usuários"
      actions={
        <div className="flex w-full min-w-0 items-center justify-end gap-2">
          <AdminMobileFilters key={`${params.q ?? ""}:${params.empresa ?? params.prefeitura ?? ""}`} pathname="/usuarios" title="Usuários" query={params.q} company={params.empresa ?? params.prefeitura} companyOptions={formOptions.prefeituras.map(empresa => ({ value: empresa.id, label: empresa.nome }))} />
          <Dialog><DialogTrigger aria-label="Novo usuário" className={buttonVariants({ size: "icon", className: "md:hidden" })}><Plus className="size-4" /></DialogTrigger><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Novo usuário</DialogTitle></DialogHeader><UsuarioForm prefeituras={formOptions.prefeituras} /></DialogContent></Dialog>
          <div className="hidden min-w-0 items-center justify-end gap-2 md:flex">
          <form className="flex min-w-0 shrink-0 justify-end gap-2">
            <div className="relative min-w-0 w-[320px]">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-9 pl-9"
                name="q"
                placeholder="Buscar usuário"
                defaultValue={params.q}
              />
            </div>
            {(params.empresa ?? params.prefeitura) ? (
              <input
                type="hidden"
                name="empresa"
                value={params.empresa ?? params.prefeitura}
              />
            ) : null}
            {hasActiveFilters ? (
              <Link
                href="/usuarios"
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

          <EmpresaFilterCombobox
            className="hidden w-[260px] shrink-0 xl:block"
            empresas={formOptions.prefeituras}
            selectedEmpresaId={params.empresa ?? params.prefeitura}
          />

          <Dialog>
            <DialogTrigger
              className={buttonVariants({
                className: "h-9 shrink-0 gap-2",
              })}
            >
              <Plus className="size-4" />
              Novo usuário
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Novo usuário</DialogTitle>
              </DialogHeader>
              <UsuarioForm prefeituras={formOptions.prefeituras} />
            </DialogContent>
          </Dialog>
          </div>
        </div>
      }
    >
      <UsuariosToasts deleted={params.deleted} error={params.error} status={params.status} />
      <main className="flex flex-1 flex-col gap-3 p-4 md:p-4">
        <Card className="gap-0 overflow-visible bg-transparent py-0 ring-0 md:gap-(--card-spacing) md:overflow-hidden md:bg-card md:py-(--card-spacing) md:ring-1">
          <ListPanelHeader mobileMetricsOnly
              title="Usuários cadastrados"
              icon={Users}
              metrics={<ListMetrics items={[
                { label: "Ativos", value: activeCount, tone: "success" },
                { label: "Pendentes", value: pendingCount, tone: "warning" },
                { label: "Total", value: usuarios.length },
              ]} />}
            />
          <CardContent className="px-0 md:px-(--card-spacing)">
            {usuarios.length ? (
              <>
              <AdminMobileList key={`${params.q ?? ""}:${params.empresa ?? params.prefeitura ?? ""}`} items={usuarios.map(usuario => <AdminMobileCard key={usuario.id}
                title={usuario.nome} subtitle={`CPF ${formatCpf(usuario.cpf)} · ${usuario.prefeitura_nome ?? "Vibe Tech"}`}
                badge={<UsuarioStatusBadge usuario={usuario} />}
                details={[{ label: "Acesso", value: <UsuarioRoleBadge role={usuario.role} /> }, { label: "Criado em", value: new Intl.DateTimeFormat("pt-BR").format(new Date(usuario.created_at)) }]}
                actions={<UsuarioActions usuario={usuario} currentUserId={profile.id} prefeituras={formOptions.prefeituras} acessos={accessMap[usuario.id] ?? []} />} />)} />
              <div className="hidden overflow-hidden rounded-lg border md:block">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Usuário</TableHead>
                      <TableHead>Acesso</TableHead>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Criado em</TableHead>
                      <TableHead className="w-[92px] text-right">
                        Ações
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usuarios.map((usuario) => (
                      <TableRow key={usuario.id}>
                        <TableCell>
                          <div className="font-medium">{usuario.nome}</div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            CPF {formatCpf(usuario.cpf)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <UsuarioRoleBadge role={usuario.role} />
                        </TableCell>
                        <TableCell>
                          {usuario.prefeitura_nome ?? "Vibe Tech"}
                        </TableCell>
                        <TableCell>
                          <UsuarioStatusBadge usuario={usuario} />
                        </TableCell>
                        <TableCell>
                          {new Intl.DateTimeFormat("pt-BR").format(
                            new Date(usuario.created_at),
                          )}
                        </TableCell>
                        <TableCell>
                          <UsuarioActions usuario={usuario} currentUserId={profile.id} prefeituras={formOptions.prefeituras} acessos={accessMap[usuario.id] ?? []} />
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
                  <Users className="size-6 text-muted-foreground" />
                </div>
                <h3 className="mt-4 text-base font-semibold">
                  Nenhum usuário encontrado
                </h3>
                <p className="mt-1 max-w-md text-sm text-muted-foreground">
                  Cadastre usuários Vibe Tech ou das empresas para controlar o
                  acesso ao portal.
                </p>
                <Dialog>
                  <DialogTrigger
                    className={buttonVariants({
                      className: "mt-4 gap-2",
                    })}
                  >
                    <Plus className="size-4" />
                    Cadastrar usuário
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                      <DialogTitle>Novo usuário</DialogTitle>
                    </DialogHeader>
                    <UsuarioForm prefeituras={formOptions.prefeituras} />
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
function UsuarioActions({ usuario, currentUserId, prefeituras, acessos }: { usuario: Awaited<ReturnType<typeof getUsuarios>>[number]; currentUserId: string; prefeituras: Awaited<ReturnType<typeof getUsuarioFormOptions>>["prefeituras"]; acessos: Awaited<ReturnType<typeof getUsuariosAccessMap>>[string] }) {
  return (
                          <div className="flex justify-end gap-1">
                            <Dialog>
                              <Tooltip>
                                <TooltipTrigger render={<DialogTrigger
                                  aria-label="Editar usuário"
                                  className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
                                ><Pencil className="size-4" /></DialogTrigger>} />
                                <TooltipContent>Editar usuário</TooltipContent>
                              </Tooltip>
                              <DialogContent className="sm:max-w-lg">
                                <DialogHeader>
                                  <DialogTitle>Editar usuário</DialogTitle>
                                </DialogHeader>
                                <UsuarioForm
                                  prefeituras={prefeituras}
                                  usuario={usuario}
                                />
                              </DialogContent>
                            </Dialog>

                            <Dialog>
                              <Tooltip>
                                <TooltipTrigger render={<DialogTrigger
                                  aria-label="Gerenciar permissões"
                                  className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
                                ><ShieldCheck className="size-4" /></DialogTrigger>} />
                                <TooltipContent>Gerenciar permissões</TooltipContent>
                              </Tooltip>
                              <DialogContent className="sm:max-w-3xl">
                                <DialogHeader>
                                  <DialogTitle>
                                    Permissões de {usuario.nome}
                                  </DialogTitle>
                                  <DialogDescription>
                                    Defina os módulos e permissões liberados
                                    para este acesso.
                                  </DialogDescription>
                                </DialogHeader>
                                <UsuarioAcessosForm
                                  acessos={acessos}
                                  usuario={usuario}
                                />
                              </DialogContent>
                            </Dialog>

                            {usuario.id !== currentUserId ? (
                              <Dialog>
                                <Tooltip>
                                  <TooltipTrigger render={<DialogTrigger
                                    aria-label={usuario.ativo ? "Inativar usuário" : "Ativar usuário"}
                                    className={cn(
                                      buttonVariants({ variant: "ghost", size: "icon-sm" }),
                                      usuario.ativo
                                        ? "bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300"
                                        : "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300",
                                    )}
                                  >{usuario.ativo ? <CircleX className="size-4" /> : <CircleCheck className="size-4" />}</DialogTrigger>} />
                                  <TooltipContent>{usuario.ativo ? "Inativar usuário" : "Ativar usuário"}</TooltipContent>
                                </Tooltip>
                                <DialogContent className="sm:max-w-md">
                                  <DialogHeader>
                                    <DialogTitle>{usuario.ativo ? "Inativar" : "Ativar"} usuário</DialogTitle>
                                    <DialogDescription>
                                      {usuario.ativo
                                        ? `O acesso de ${usuario.nome} será bloqueado. Você poderá reativá-lo depois.`
                                        : `O acesso de ${usuario.nome} será liberado novamente.`}
                                    </DialogDescription>
                                  </DialogHeader>
                                  <UsuarioStatusForm id={usuario.id} ativo={usuario.ativo} />
                                </DialogContent>
                              </Dialog>
                            ) : null}

                            {!usuario.ativo && usuario.id !== currentUserId ? (
                              <Dialog>
                                <Tooltip>
                                  <TooltipTrigger render={<DialogTrigger
                                    aria-label="Excluir usuário"
                                    className={cn(
                                      buttonVariants({ variant: "destructive", size: "icon-sm" }),
                                      "bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 dark:text-rose-400",
                                    )}
                                  ><Trash2 className="size-4" /></DialogTrigger>} />
                                  <TooltipContent>Excluir usuário</TooltipContent>
                                </Tooltip>
                                <DialogContent className="sm:max-w-md">
                                  <DialogHeader>
                                    <DialogTitle>Excluir usuário</DialogTitle>
                                    <DialogDescription>
                                      {usuario.nome} será removido da lista e não poderá acessar o portal. O histórico das operações será preservado.
                                    </DialogDescription>
                                  </DialogHeader>
                                  <DeleteUsuarioForm id={usuario.id} />
                                </DialogContent>
                              </Dialog>
                            ) : null}
                          </div>
  );
}

function UsuarioRoleBadge({ role }: { role: UsuarioRole }) {
  const styles: Record<UsuarioRole, string> = {
    bdl_admin: "border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-50",
    municipal_admin:
      "border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-50",
    municipal_user:
      "border-zinc-200 bg-zinc-100 text-zinc-700 hover:bg-zinc-100",
  };

  return (
    <Badge variant="outline" className={styles[role]}>
      {formatUsuarioRole(role)}
    </Badge>
  );
}
