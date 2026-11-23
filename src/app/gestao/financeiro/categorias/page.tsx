import { forbidden } from "next/navigation";
import { CircleCheck, CircleMinus, Tags } from "lucide-react";
import { getGestaoContext } from "@/lib/gestao-data";
import { getFinanceiroData } from "@/lib/gestao-contas-data";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { GestaoShell } from "../../gestao-shell";
import { GestaoShowMore } from "../../gestao-show-more";
import { gestaoListLimit } from "@/lib/gestao-list-limit";
import { Empty, ListBadge, MetricBadge, Panel, SearchToolbar } from "../../ui";
import { NovaCategoriaFinanceira, CategoriaFinanceiraActions } from "./categoria-controls";

export default async function CategoriasFinanceirasPage({ searchParams }: {
  searchParams: Promise<{ q?: string; limite?: string }>;
}) {
  const [{ profile }, fin, params] = await Promise.all([
    getGestaoContext(), getFinanceiroData(), searchParams,
  ]);
  if (profile.role !== "bdl_admin") forbidden();
  const categorias = fin.categorias
    .filter((c) => !params.q || c.nome.toLocaleLowerCase("pt-BR").includes(params.q.trim().toLocaleLowerCase("pt-BR")))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const limite = gestaoListLimit(params.limite);

  return <GestaoShell title="Categorias de despesas" icon={Tags} actions={fin.inicio ? <SearchToolbar placeholder="Buscar categoria" query={params.q} clearHref="/gestao/financeiro/categorias"><NovaCategoriaFinanceira categorias={fin.categorias} /></SearchToolbar> : null}>
    {!fin.inicio ? <Empty title="Ative o financeiro" description="Configure suas contas antes de organizar as categorias de despesas." href="/gestao/financeiro/contas" action="Contas e saldos" /> :
      <Panel title="Categorias cadastradas" description="Categorias disponíveis para as contas a pagar desta unidade." icon={Tags} metrics={<>
        <MetricBadge label="Categorias" value={fin.categorias.length} icon={Tags} />
        <MetricBadge label="Ativas" value={fin.categorias.filter((c) => c.ativo).length} icon={CircleCheck} tone="success" />
      </>}>
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader><TableRow className="bg-muted/50"><TableHead>Categoria</TableHead><TableHead>Situação</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
            <TableBody>
              {categorias.slice(0, limite).map((categoria) => <TableRow key={categoria.id}>
                <TableCell className="font-medium">{categoria.nome}{categoria.sistema && <span className="ml-2 text-xs font-normal text-muted-foreground">Sistema</span>}</TableCell>
                <TableCell><ListBadge tone={categoria.ativo ? "success" : "neutral"} icon={categoria.ativo ? CircleCheck : CircleMinus}>{categoria.ativo ? "Ativa" : "Inativa"}</ListBadge></TableCell>
                <TableCell className="text-right">{!categoria.sistema && <CategoriaFinanceiraActions categoria={categoria} categorias={fin.categorias} />}</TableCell>
              </TableRow>)}
              {!categorias.length && <TableRow><TableCell colSpan={3} className="py-8 text-center text-muted-foreground">Nenhuma categoria encontrada.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
        <GestaoShowMore shown={Math.min(limite, categorias.length)} total={categorias.length} />
      </Panel>}
  </GestaoShell>;
}
