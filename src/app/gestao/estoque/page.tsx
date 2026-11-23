import Link from "next/link";
import {
  Warehouse,
  History,
  Package,
  TriangleAlert,
  CircleAlert,
} from "lucide-react";
import { getGestaoContext, getProdutos } from "@/lib/gestao-data";
import { quantidade } from "@/lib/gestao-types";
import {
  alertaEstoque,
  ordenarAlertasEstoque,
} from "@/lib/gestao-estoque-alertas";
import { EstoqueStatus } from "./estoque-status";

import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MovimentoForm } from "./movimento-form";
import { GestaoShell } from "../gestao-shell";
import { GestaoShowMore } from "../gestao-show-more";
import { gestaoListLimit } from "@/lib/gestao-list-limit";
import { Empty, Panel, GestaoDialog, MetricBadge, SearchToolbar } from "../ui";

export default async function EstoquePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; limite?: string }>;
}) {
  const { unidade, gestor } = await getGestaoContext();
  const { q, limite } = await searchParams;
  const produtos = (await getProdutos()).filter((p) => p.controlar_estoque);
  const filtrados = produtos
    .filter(
      (p) =>
        !q ||
        p.nome
          .toLocaleLowerCase("pt-BR")
          .includes(q.trim().toLocaleLowerCase("pt-BR")),
    )
    .sort(ordenarAlertasEstoque);
  const novo =
    gestor && unidade && produtos.length ? (
      <GestaoDialog
        title="Nova movimentação"
        label="Nova movimentação"
        description="Registre entradas, perdas e ajustes com o motivo da operação."
      >
        <MovimentoForm unidadeId={unidade.id} produtos={produtos} />
      </GestaoDialog>
    ) : null;
  return (
    <GestaoShell
      title="Estoque"
      icon={Warehouse}
      actions={
        <SearchToolbar
          placeholder="Buscar produto"
          query={q}
          clearHref="/gestao/estoque"
        >
          <Link
            href="/gestao/estoque/movimentacoes"
            aria-label="Histórico de movimentações"
            className={buttonVariants({
              variant: "outline",
              className: "h-9 gap-2",
            })}
          >
            <History className="size-4" />
            <span className="hidden lg:inline">Histórico</span>
          </Link>
          {novo}
        </SearchToolbar>
      }
    >
      <Panel
        title="Posição de estoque"
        description="Saldos e reposição dos produtos da unidade, com prioridade para os alertas."
        icon={Warehouse}
        metrics={
          <>
            <MetricBadge
              label="Produtos"
              icon={Package}
              value={produtos.length}
            />
            <MetricBadge
              label="Atenção"
              icon={TriangleAlert}
              tone="warning"
              value={
                produtos.filter((p) => alertaEstoque(p).nivel === "atencao")
                  .length
              }
            />
            <MetricBadge
              label="Críticos"
              icon={CircleAlert}
              tone="danger"
              value={
                produtos.filter((p) => alertaEstoque(p).nivel === "critico")
                  .length
              }
            />
          </>
        }
      >
        {filtrados.length ? (
          <>
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-right">Saldo atual</TableHead>
                  <TableHead className="text-right">Estoque mínimo</TableHead>
                  <TableHead>Situação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrados.slice(0, gestaoListLimit(limite)).map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="min-w-[220px] font-medium">{p.nome}</div>
                      <div className="text-xs text-muted-foreground">
                        {p.categoria || "Sem categoria"}
                      </div>
                    </TableCell>
                    <TableCell
                      className={
                        "text-right tabular-nums " +
                        (p.saldo < 0 ? "text-destructive" : "")
                      }
                    >
                      {quantidade(p.saldo)} {p.unidade}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {quantidade(p.minimo)} {p.unidade}
                    </TableCell>
                    <TableCell>
                      <EstoqueStatus produto={p} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <GestaoShowMore shown={Math.min(gestaoListLimit(limite), filtrados.length)} total={filtrados.length} />
          </>
        ) : (
          <Empty
            title={q ? "Nenhum produto encontrado" : "Prepare seu estoque"}
            description={
              q
                ? "Ajuste os termos da busca."
                : "Cadastre os produtos antes de registrar entradas e saídas."
            }
            href={q ? undefined : "/gestao/produtos"}
            action="Ir para produtos"
          />
        )}
      </Panel>
    </GestaoShell>
  );
}
