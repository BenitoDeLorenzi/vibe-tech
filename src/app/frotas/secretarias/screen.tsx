import { getFrotaListPage, orderPageItems } from "@/lib/frotas-list-page";
import { FrotasEmptyState } from "@/components/frotas-empty-state";
import Link from "next/link";
import { forbidden, notFound, redirect } from "next/navigation";
import { Building2, Search, X } from "lucide-react";
import { requireUserProfile } from "@/lib/auth-data";
import { getModuleLicensedEmpresas } from "@/lib/empresa-access";
import { getFrotasPermissionAccess } from "@/lib/frotas-permissions";
import { getSecretarias } from "@/lib/secretarias-data";
import { ListPanelHeader } from "@/components/list-panel-header";
import { ListPagination } from "@/components/list-pagination";
import { ListMetrics } from "@/components/list-metrics";
import { Card, CardContent } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FrotasShell } from "../frotas-shell";
import { SecretariaDialog } from "./secretaria-dialog";

export default async function SecretariasPage({
  searchParams,
}: {
  searchParams: Promise<{ prefeitura?: string; q?: string; size?: string; page?: string }>;
}) {
  const profile = await requireUserProfile();
  const [params, empresas, access] = await Promise.all([
    searchParams,
    getModuleLicensedEmpresas("frotas-publicas"),
    getFrotasPermissionAccess(profile),
  ]);
  const prefeituras =
    profile.role === "bdl_admin"
      ? empresas
      : empresas.filter((e) => e.id === profile.prefeitura_id);
  const id =
    profile.role === "bdl_admin"
      ? (params.prefeitura ?? prefeituras[0]?.id)
      : profile.prefeitura_id;
  const empresa = prefeituras.find((e) => e.id === id);
  if (!empresa) notFound();
  if (!empresa.is_prefeitura)
    redirect(`/frotas/veiculos?prefeitura=${empresa.id}`);
  const manage =
    access.isFullAccess || access.keys.includes("departments.manage");
  if (!manage && !access.keys.includes("departments.read")) forbidden();
  const databasePage = await getFrotaListPage(profile, "secretarias", { ...params, prefeitura: empresa.id });
  const rows = await getSecretarias(empresa.id, databasePage.ids);
  const secretariaPage = { ...databasePage, items: orderPageItems(rows, databasePage) };
  return (
    <FrotasShell
      active="secretarias"
      title="Secretarias"
      icon={Building2}
      profile={profile}
      prefeituras={prefeituras}
      selectedPrefeituraId={empresa.id}
      actions={
        <div className="flex min-w-0 items-center justify-end gap-2">
          <form className="hidden items-center gap-2 xl:flex">
            <input type="hidden" name="prefeitura" value={empresa.id} />
            <div className="relative w-[320px]">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                name="q"
                defaultValue={params.q}
                aria-label="Buscar secretaria"
                placeholder="Buscar secretaria"
                className="h-9 pl-9"
              />
            </div>
            {params.q ? (
              <Link
                href={`/frotas/secretarias?prefeitura=${empresa.id}`}
                className={buttonVariants({
                  variant: "outline",
                  className: "h-9",
                })}
              >
                <X />
                Limpar
              </Link>
            ) : (
              <Button type="submit" variant="outline" className="h-9">
                <Search />
                Filtrar
              </Button>
            )}
          </form>
          {manage && <SecretariaDialog empresaId={empresa.id} />}
        </div>
      }
    >
      <main className="flex min-h-full flex-col gap-3 p-4">
        <Card className="flex flex-1 flex-col">
          <ListPanelHeader
            title="Secretarias cadastradas"
            icon={Building2}
            metrics={
              <ListMetrics
                items={[{ label: "Total", value: databasePage.total }]}
              />
            }
          />
          <CardContent className="flex flex-1 flex-col">
            {rows.length ? (
              <div className="overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Secretaria</TableHead>
                      {manage && (
                        <TableHead className="w-[92px] text-right">
                          Ações
                        </TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {secretariaPage.items.map((secretaria) => (
                      <TableRow key={secretaria.id}>
                        <TableCell className="font-medium">
                          {secretaria.nome}
                        </TableCell>
                        {manage && (
                          <TableCell>
                            <div className="flex justify-end gap-1">
                              <SecretariaDialog
                                empresaId={empresa.id}
                                secretaria={secretaria}
                              />
                              {profile.role === "bdl_admin" && (
                                <SecretariaDialog
                                  empresaId={empresa.id}
                                  secretaria={secretaria}
                                  deleting
                                />
                              )}
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <FrotasEmptyState icon={Building2}
                title={params.q ? "Nenhuma secretaria encontrada" : "Nenhuma secretaria cadastrada"}
                description={params.q ? "Ajuste os termos da busca." : "Cadastre as secretarias desta prefeitura para vinculá-las aos veículos."}
                action={manage && !params.q ? <SecretariaDialog empresaId={empresa.id} /> : null} />
            )}
            {rows.length > 0 && <ListPagination page={secretariaPage.page} pageCount={secretariaPage.pageCount} pathname="/frotas/secretarias" params={{ size: params.size, prefeitura: empresa.id, q: params.q }} />}
          </CardContent>
        </Card>
      </main>
    </FrotasShell>
  );
}
