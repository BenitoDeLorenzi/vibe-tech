import { emptyFleetPage, getFrotaListPage, orderPageItems } from "@/lib/frotas-list-page";
import { FrotasEmptyState } from "@/components/frotas-empty-state";
import { getFrotasLoadingData } from "@/app/frotas/frotas-loading-data";
import { TableLoadingRows } from "@/components/table-loading";
import { CadastroStatusButton } from "@/components/cadastro-status-button";
import { updateOficinaStatus } from "../cadastro-actions";
import { forbidden } from "next/navigation";
import { Search, Wrench } from "lucide-react";
import { requireUserProfile } from "@/lib/auth-data";
import { getFrotasPermissionAccess } from "@/lib/frotas-permissions";
import { getFrotasData } from "@/lib/frotas-data";
import { getOficinasForEmpresa } from "@/lib/oficinas-data";
import { FrotasShell } from "../frotas-shell";
import { ListMetrics } from "@/components/list-metrics";
import { ListPagination } from "@/components/list-pagination";
import { FrotasResponsiveTable } from "@/components/frotas-responsive-table";
import { HeaderSeparator } from "@/components/header-separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { DeleteOficinaButton } from "./delete-oficina-button";
import { OficinaDialog } from "./oficina-dialog";

export const dynamic = "force-dynamic";
export default async function OficinasPage({
  searchParams,
  loading = false,
}: {
  loading?: boolean;
  searchParams: Promise<{ prefeitura?: string; q?: string; size?: string; page?: string }>;
}) {
  const profile = await requireUserProfile();
  const access = await getFrotasPermissionAccess(profile);
  const canManage =
    access.isFullAccess || access.keys.includes("workshops.manage");
  if (!canManage && !access.keys.includes("workshops.read"))
    forbidden();
  const params = await searchParams;
  const data = loading ? await getFrotasLoadingData(profile, params.prefeitura) : await getFrotasData({
    contextOnly: true, lightweight: true,
    prefeituraId:
      profile.role === "bdl_admin"
        ? params.prefeitura
        : (profile.prefeitura_id ?? undefined),
  });
  const query = params.q?.trim();
  const databasePage = loading ? emptyFleetPage : await getFrotaListPage(profile, "oficinas", { ...params, prefeitura: data.selectedPrefeituraId });
  const oficinas = loading ? [] : await getOficinasForEmpresa(data.selectedPrefeituraId, databasePage.ids);
  const oficinaPage = { ...databasePage, items: orderPageItems(oficinas, databasePage) };
  return (
    <FrotasShell
      loading={loading}
      mobileList
      active="oficinas"
      title="Oficinas"
      icon={Wrench}
      profile={profile}
      prefeituras={data.prefeituras}
      selectedPrefeituraId={data.selectedPrefeituraId}
      actions={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <form className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                name="q"
                aria-label="Buscar oficina"
                placeholder="Buscar oficina"
                defaultValue={params.q}
                className="h-9 pl-9"
              />
            </div>
            <input
              type="hidden"
              name="prefeitura"
              value={data.selectedPrefeituraId ?? ""}
            />
            <Button variant="outline" type="submit">
              Filtrar
            </Button>
          </form>
          {canManage && data.selectedPrefeituraId ? (
            <>
              <HeaderSeparator />
              <OficinaDialog empresaId={data.selectedPrefeituraId} />
            </>
          ) : null}
        </div>
      }
    >
      <main className="flex min-h-full flex-col gap-3 p-4">
        <Card className="frotas-list-card flex flex-1 flex-col">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg border bg-muted/40">
                  <Wrench className="size-5 text-muted-foreground" />
                </div>
                <CardTitle>Oficinas cadastradas</CardTitle>
              </div>
              <ListMetrics
                loading={loading}
                items={[
                  { label: "Total", value: databasePage.total },
                  {
                    label: "Ativas",
                    value: databasePage.statuses.active ?? 0,
                    tone: "success",
                  },
                ]}
              />
            </div>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col">
            {loading || oficinas.length ? (
              <FrotasResponsiveTable page={oficinaPage.page} pageCount={oficinaPage.pageCount} total={oficinaPage.total} count={oficinaPage.items.length} pathname="/frotas/oficinas" params={{ prefeitura: data.selectedPrefeituraId, q: params.q }} loading={loading}><div className="frotas-mobile-table overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Oficinas</TableHead>
                      <TableHead>Contato</TableHead>
                      <TableHead>Endereço</TableHead>
                      <TableHead>Especialidades</TableHead>
                      <TableHead>Status</TableHead>
                      {canManage ? (
                        <TableHead className="text-right">Ações</TableHead>
                      ) : null}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? <TableLoadingRows columns={6} /> : oficinaPage.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="font-medium">{item.nome}</div>
                          <div className="text-xs text-muted-foreground">
                            {item.documento
                              ?.replace(
                                /^(\d{3})(\d{3})(\d{3})(\d{2})$/,
                                "$1.$2.$3-$4",
                              )
                              .replace(
                                /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
                                "$1.$2.$3/$4-$5",
                              ) ?? "—"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>{item.telefone ?? "—"}</div>
                          <div className="text-xs text-muted-foreground">
                            {item.responsavel}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-64 whitespace-normal">
                          {item.endereco ?? "—"}
                        </TableCell>
                        <TableCell className="max-w-52 whitespace-normal">
                          {item.especialidades ?? "—"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              item.status === "active"
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/25 dark:text-emerald-400"
                                : "text-muted-foreground"
                            }
                          >
                            {item.status === "active" ? "Ativa" : "Inativa"}
                          </Badge>
                        </TableCell>
                        {canManage ? (
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                            <OficinaDialog
                              empresaId={item.prefeitura_id}
                              oficina={item}
                            />
                            <CadastroStatusButton id={item.id} status={item.status} entity="oficina" action={updateOficinaStatus} />
                            {profile.role === "bdl_admin" ? <DeleteOficinaButton id={item.id} nome={item.nome} /> : null}
                            </div>
                          </TableCell>
                        ) : null}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div></FrotasResponsiveTable>
            ) : (
              <FrotasEmptyState icon={Wrench}
                title={query ? "Nenhuma oficina encontrada" : "Nenhuma oficina cadastrada"}
                description={query ? "Ajuste os termos da busca para encontrar outra oficina." : "Cadastre uma oficina para organizar os serviços de manutenção da frota."}
                action={!query && canManage && data.selectedPrefeituraId ? <OficinaDialog empresaId={data.selectedPrefeituraId} /> : null} />
            )}
            {oficinas.length > 0 && <ListPagination page={oficinaPage.page} pageCount={oficinaPage.pageCount} pathname="/frotas/oficinas" params={{ size: params.size, prefeitura: data.selectedPrefeituraId, q: params.q }} />}
          </CardContent>
        </Card>
      </main>
    </FrotasShell>
  );
}
