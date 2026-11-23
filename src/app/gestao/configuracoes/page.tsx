import Link from "next/link";
import { Settings, Store } from "lucide-react";
import { getGestaoContext } from "@/lib/gestao-data";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { GestaoShell } from "../gestao-shell";
import { GestaoShowMore } from "../gestao-show-more";
import { gestaoListLimit } from "@/lib/gestao-list-limit";
import { Empty, Panel, MetricBadge } from "../ui";
export default async function ConfiguracoesPage({ searchParams }: { searchParams: Promise<{ limite?: string }> }) {
  const { limite } = await searchParams;
  const { unidade, empresas, unidades, gestor, profile } =
    await getGestaoContext();
  return (
    <GestaoShell
      title="Configurações"
      icon={Settings}
      actions={
        profile.role === "bdl_admin" ? (
          <div className="flex gap-2">
            <Link
              className={buttonVariants({ variant: "outline" })}
              href="/usuarios"
            >
              Usuários e acessos
            </Link>
            <Link className={buttonVariants()} href="/empresas">
              Empresas e módulos
            </Link>
          </div>
        ) : null
      }
    >
      <Panel
        title="Estabelecimentos cadastrados"
        description="Unidades das empresas com licença vigente para o Vibe Gestão."
        icon={Store}
        metrics={
          <>
            <MetricBadge label="Empresas" value={empresas.length} />
            <MetricBadge label="Unidades" value={unidades.length} />
          </>
        }
      >
        {unidades.length ? (
          <>
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Empresa</TableHead>
                  <TableHead>Unidade</TableHead>
                  <TableHead>Situação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unidades.slice(0, gestaoListLimit(limite)).map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">
                      {empresas.find((e) => e.id === u.empresa_id)?.nome}
                    </TableCell>
                    <TableCell>{u.nome}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {u.id === unidade?.id ? "Selecionada" : "Disponível"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <GestaoShowMore shown={Math.min(gestaoListLimit(limite), unidades.length)} total={unidades.length} />
          </>
        ) : (
          <Empty
            title="Nenhuma empresa disponível"
            description="Cadastre a empresa no painel e adicione uma licença do Vibe Gestão. A primeira unidade será criada automaticamente."
          />
        )}
        <p className="mt-4 text-sm text-muted-foreground">
          Seu perfil: {gestor ? "Gestor" : "Operador"}. Empresas, licenças e
          usuários são administrados no painel central. Operadores preenchem
          fechamentos; gestores também conferem, reabrem e movimentam estoque.
        </p>
      </Panel>
    </GestaoShell>
  );
}
