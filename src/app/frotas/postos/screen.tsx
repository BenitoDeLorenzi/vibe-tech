import { emptyFleetPage, getFrotaListPage, orderPageItems } from "@/lib/frotas-list-page";
import { FrotasEmptyState } from "@/components/frotas-empty-state";
import { getFrotasLoadingData } from "@/app/frotas/frotas-loading-data";
import { TableLoadingRows } from "@/components/table-loading";
import { DeleteCadastroButton } from "@/components/delete-cadastro-button";
import { deletePosto, updatePostoStatus } from "../cadastro-actions";
import { ListMetrics } from "@/components/list-metrics";
import { ListPagination } from "@/components/list-pagination";
import Link from "next/link";
import { forbidden } from "next/navigation";
import {
  ExternalLink,
  Fuel,
  KeyRound,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Search,
  X,
} from "lucide-react";

import { FrotasShell } from "@/app/frotas/frotas-shell";
import { PostoCredenciadoForm } from "@/app/frotas/posto-credenciado-form";
import { PostoSenhaForm } from "@/app/frotas/posto-senha-form";
import { CadastroStatusButton } from "@/components/cadastro-status-button";
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { requireUserProfile } from "@/lib/auth-data";
import { getFrotasPermissionAccess } from "@/lib/frotas-permissions";
import { getPostosCredenciadosData } from "@/lib/frotas-data";

export const dynamic = "force-dynamic";

type PageProps = {
  loading?: boolean;
  searchParams: Promise<{
    prefeitura?: string;
    q?: string;
    size?: string; page?: string;
  }>;
};

export default async function PostosPage({ searchParams, loading = false }: PageProps) {
  const profile = await requireUserProfile();
  const access = await getFrotasPermissionAccess(profile);
  if (!access.isFullAccess && !access.keys.includes("fuel_stations.read") && !access.keys.includes("fuel_stations.manage")) forbidden();
  const params = await searchParams;
  const prefeituraId =
    profile.role === "bdl_admin"
      ? params.prefeitura
      : profile.prefeitura_id ?? undefined;
  const databasePage = loading ? emptyFleetPage : await getFrotaListPage(profile, "postos", params);
  const data = loading ? await getFrotasLoadingData(profile, prefeituraId) : await getPostosCredenciadosData({
    ids: databasePage.ids,
    lightweight: true,
    contextOnly: true,
    prefeituraId: databasePage.empresaId ?? prefeituraId,
    query: params.q,
  });
  const hasActiveFilters = Boolean(params.q?.trim());
  const stationPage = { ...databasePage, items: orderPageItems(data.postos, databasePage) };

  return (
    <FrotasShell
      loading={loading}
      active="postos"
      actions={
        <div className="flex w-full min-w-0 items-center justify-end gap-2">
          <form className="hidden min-w-0 shrink-0 gap-2 xl:flex">
            <div className="relative min-w-0 w-[320px]">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-9 pl-9"
                name="q"
                placeholder="Buscar posto"
                defaultValue={params.q}
              />
            </div>
            {data.selectedPrefeituraId ? (
              <input
                type="hidden"
                name="prefeitura"
                value={data.selectedPrefeituraId}
              />
            ) : null}
            {hasActiveFilters ? (
              <Link
                href={
                  data.selectedPrefeituraId
                    ? `/frotas/postos?prefeitura=${data.selectedPrefeituraId}`
                    : "/frotas/postos"
                }
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

          <Dialog>
            <DialogTrigger
              className={buttonVariants({
                className: "h-9 shrink-0 gap-2",
              })}
            >
              <Plus className="size-4" />
              Novo posto
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl">
              <DialogHeader>
                <DialogTitle>Novo posto de combustível</DialogTitle>
              </DialogHeader>
              <PostoCredenciadoForm
                prefeituras={data.prefeituras}
                selectedPrefeituraId={data.selectedPrefeituraId}
                showPrefeituraField={profile.role === "bdl_admin"}
              />
            </DialogContent>
          </Dialog>
        </div>
      }
      icon={Fuel}
      prefeituras={data.prefeituras}
      profile={profile}
      selectedPrefeituraId={data.selectedPrefeituraId}
      title="Postos de Combustível"
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
                  <CardTitle>Postos cadastrados</CardTitle>
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
            {loading || data.postos.length ? (
              <div className="overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Posto</TableHead>
                      <TableHead>Contato</TableHead>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[160px] text-right">
                        Ações
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? <TableLoadingRows columns={5} /> : stationPage.items.map((posto) => (
                      <TableRow key={posto.id}>
                        <TableCell>
                          <div className="font-medium">{posto.nome}</div>
                          <div className="text-xs text-muted-foreground">
                            {posto.cnpj ?? "Sem CNPJ"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="grid gap-1 text-sm">
                            <div className="flex items-center gap-2">
                              <Phone className="size-4 text-muted-foreground" />
                              {posto.telefone ?? "-"}
                            </div>
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Mail className="size-4" />
                              {posto.email_contato ?? "E-mail pendente"}
                            </div>
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <MapPin className="size-4" />
                              {posto.endereco ?? "-"}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{posto.prefeitura_nome ?? "-"}</TableCell>
                        <TableCell>
                          <PostoStatusBadge status={posto.status} firstAccessCompleted={Boolean(posto.primeiro_acesso_concluido_em)} />
                        </TableCell>
                        <TableCell>
                          <PostoActions
                            canDelete={profile.role === "bdl_admin"}
                            posto={posto}
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
              <FrotasEmptyState icon={Fuel} title="Nenhum posto cadastrado" description="Cadastre os postos credenciados da empresa para permitir a conclusão das ordens de abastecimento." action={<Dialog>
                <DialogTrigger className={buttonVariants({ className: "gap-2" })}><Plus className="size-4" />Cadastrar posto</DialogTrigger>
                <DialogContent className="sm:max-w-xl"><DialogHeader><DialogTitle>Novo posto de combustível</DialogTitle></DialogHeader>
                  <PostoCredenciadoForm prefeituras={data.prefeituras} selectedPrefeituraId={data.selectedPrefeituraId} showPrefeituraField={profile.role === "bdl_admin"} />
                </DialogContent>
              </Dialog>} />
            )}
            {!loading && <ListPagination page={stationPage.page} pageCount={stationPage.pageCount} pathname="/frotas/postos" params={{ size: params.size, prefeitura: data.selectedPrefeituraId, q: params.q }} />}
          </CardContent>
        </Card>
      </main>
    </FrotasShell>
  );
}

function PostoActions({
  canDelete,
  posto,
  prefeituras,
  selectedPrefeituraId,
  showPrefeituraField,
}: {
  canDelete: boolean;
  posto: Awaited<ReturnType<typeof getPostosCredenciadosData>>["postos"][number];
  prefeituras: Awaited<ReturnType<typeof getPostosCredenciadosData>>["prefeituras"];
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
                aria-label="Editar posto"
              >
                <Pencil className="size-4" />
              </DialogTrigger>
            }
          />
          <TooltipContent>Editar posto</TooltipContent>
        </Tooltip>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Editar posto</DialogTitle>
          </DialogHeader>
          <PostoCredenciadoForm
            posto={posto}
            prefeituras={prefeituras}
            selectedPrefeituraId={selectedPrefeituraId}
            showPrefeituraField={showPrefeituraField}
          />
        </DialogContent>
      </Dialog>

      <Dialog>
        <Tooltip>
          <TooltipTrigger
            render={
              <DialogTrigger
                className={buttonVariants({
                  variant: "ghost",
                  size: "icon-sm",
                })}
                aria-label="Redefinir senha"
              >
                <KeyRound className="size-4" />
              </DialogTrigger>
            }
          />
          <TooltipContent>Redefinir senha</TooltipContent>
        </Tooltip>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Redefinir senha</DialogTitle>
          </DialogHeader>
          <PostoSenhaForm postoId={posto.id} postoNome={posto.nome} />
        </DialogContent>
      </Dialog>

      <Link
        href="/frotas/posto"
        className={buttonVariants({
          variant: "ghost",
          size: "icon-sm",
        })}
        aria-label="Abrir portal do posto"
        title="Abrir portal do posto"
        target="_blank"
        rel="noreferrer"
      >
        <ExternalLink className="size-4" />
      </Link>

      <CadastroStatusButton id={posto.id} status={posto.status} entity="posto" action={updatePostoStatus} />
      {canDelete ? <DeleteCadastroButton id={posto.id} nome={posto.nome} entity="posto" action={deletePosto} /> : null}
    </div>
  );
}

function PostoStatusBadge({
  status,
  firstAccessCompleted,
}: {
  status: "active" | "inactive";
  firstAccessCompleted: boolean;
}) {
  const pending = status === "active" && !firstAccessCompleted;
  return (
    <Badge
      variant="outline"
      className={
        pending ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50" : status === "active"
          ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50"
          : "border-zinc-200 bg-zinc-100 text-zinc-700 hover:bg-zinc-100"
      }
    >
      {pending ? "Primeiro acesso pendente" : status === "active" ? "Ativo" : "Inativo"}
    </Badge>
  );
}
