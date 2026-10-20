import { ListPanelHeader } from "@/components/list-panel-header";
import { ListMetrics } from "@/components/list-metrics";
import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";
import { EmpresaFilterCombobox } from "@/components/empresa-filter-combobox";
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
  formatUsuarioStatus,
  formatCpf,
  getUsuarioFormOptions,
  getUsuariosAccessMap,
  getUsuarios,
  type UsuarioRole,
} from "@/lib/usuarios-data";
import { requireRole } from "@/lib/auth-data";
import { DeleteUsuarioForm } from "./delete-usuario-form";
import { UsuarioAcessosForm } from "./usuario-acessos-form";
import { UsuarioForm } from "./usuario-form";
import { UsuariosToasts } from "./usuarios-toasts";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{
    deleted?: string;
    error?: string;
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
  const activeCount = usuarios.filter((usuario) => usuario.ativo).length;
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
      }
    >
      <UsuariosToasts deleted={params.deleted} error={params.error} />
      <main className="flex flex-1 flex-col gap-3 p-4 md:p-4">
        <Card>
          <ListPanelHeader
              title="Usuários cadastrados"
              icon={Users}
              metrics={<ListMetrics items={[
                { label: "Ativos", value: activeCount, tone: "success" },
                { label: "Total", value: usuarios.length },
              ]} />}
            />
          <CardContent>
            {usuarios.length ? (
              <div className="overflow-hidden rounded-lg border">
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
                          <UsuarioStatusBadge ativo={usuario.ativo} />
                        </TableCell>
                        <TableCell>
                          {new Intl.DateTimeFormat("pt-BR").format(
                            new Date(usuario.created_at),
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Dialog>
                              <DialogTrigger
                                className={buttonVariants({
                                  variant: "ghost",
                                  size: "icon-sm",
                                })}
                                title="Editar usuário"
                              >
                                <Pencil className="size-4" />
                              </DialogTrigger>
                              <DialogContent className="sm:max-w-lg">
                                <DialogHeader>
                                  <DialogTitle>Editar usuário</DialogTitle>
                                </DialogHeader>
                                <UsuarioForm
                                  prefeituras={formOptions.prefeituras}
                                  usuario={usuario}
                                />
                              </DialogContent>
                            </Dialog>

                            <Dialog>
                              <DialogTrigger
                                className={buttonVariants({
                                  variant: "ghost",
                                  size: "icon-sm",
                                })}
                                title="Gerenciar permissões"
                              >
                                <ShieldCheck className="size-4" />
                              </DialogTrigger>
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
                                  acessos={accessMap[usuario.id] ?? []}
                                  usuario={usuario}
                                />
                              </DialogContent>
                            </Dialog>

                            <Dialog>
                              <DialogTrigger
                                className={buttonVariants({
                                  variant: "destructive",
                                  size: "icon-sm",
                                })}
                                title="Excluir usuário"
                              >
                                <Trash2 className="size-4" />
                              </DialogTrigger>
                              <DialogContent className="sm:max-w-md">
                                <DialogHeader>
                                  <DialogTitle>Excluir usuário</DialogTitle>
                                  <DialogDescription>
                                    Esta ação remove o acesso de {usuario.nome}
                                    do portal.
                                  </DialogDescription>
                                </DialogHeader>
                                <DeleteUsuarioForm id={usuario.id} />
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

function UsuarioStatusBadge({ ativo }: { ativo: boolean }) {
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
      {formatUsuarioStatus(ativo)}
    </Badge>
  );
}
