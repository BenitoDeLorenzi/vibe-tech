import Link from "next/link";
import {
  ArrowLeftRight,
  Warehouse,
  CircleCheck,
  Undo2,
  Eye,
} from "lucide-react";
import {
  getMovimentos,
  getProdutos,
  getGestaoContext,
} from "@/lib/gestao-data";
import { EstornoDialog } from "./estorno-dialog";
import { dataBR, quantidade, dinheiro } from "@/lib/gestao-types";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { GestaoShell } from "../../gestao-shell";
import { GestaoShowMore } from "../../gestao-show-more";
import { gestaoListLimit } from "@/lib/gestao-list-limit";
import { Empty, Panel, MetricBadge, ListBadge, SearchToolbar } from "../../ui";
export default async function MovimentacoesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; limite?: string }>;
}) {
  const { q, limite } = await searchParams;
  const [movimentos, produtos, { unidade, gestor }] = await Promise.all([
    getMovimentos(),
    getProdutos(),
    getGestaoContext(),
  ]);
  const nomes = new Map(produtos.map((p) => [p.id, p.nome]));
  const filtrados = movimentos.filter(
    (m) =>
      !q ||
      [nomes.get(m.produto_id), m.motivo, m.tipo]
        .join(" ")
        .toLocaleLowerCase("pt-BR")
        .includes(q.trim().toLocaleLowerCase("pt-BR")),
  );
  return (
    <GestaoShell
      title="Movimentações"
      icon={ArrowLeftRight}
      actions={
        <SearchToolbar
          placeholder="Buscar movimentação"
          query={q}
          clearHref="/gestao/estoque/movimentacoes"
        >
          <Link
            href="/gestao/estoque"
            className={buttonVariants({
              variant: "outline",
              className: "h-9 gap-2",
            })}
          >
            <Warehouse className="size-4" />
            <span className="hidden sm:inline">Estoque</span>
          </Link>
        </SearchToolbar>
      }
    >
      <Panel
        title="Histórico de movimentações"
        description="Últimos 100 registros de entrada, saída e estorno do estabelecimento."
        icon={ArrowLeftRight}
        metrics={
          <MetricBadge
            label="Registros"
            icon={ArrowLeftRight}
            tone="info"
            value={movimentos.length}
          />
        }
      >
        {!filtrados.length ? (
          <Empty
            title="Nenhuma movimentação encontrada"
            description="Registre o estoque inicial ou ajuste os termos da busca."
          />
        ) : (
          <>
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  {[
                    "Data",
                    "Produto",
                    "Tipo",
                    "Quantidade",
                    "Custo unitário",
                    "Custo total",
                    "Motivo",
                    "Situação",
                  ].map((t) => (
                    <TableHead
                      key={t}
                      className={
                        [
                          "Quantidade",
                          "Custo unitário",
                          "Custo total",
                        ].includes(t)
                          ? "text-right"
                          : undefined
                      }
                    >
                      {t}
                    </TableHead>
                  ))}
                  {gestor && (
                    <TableHead className="w-[128px] text-right">
                      Ações
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrados.slice(0, gestaoListLimit(limite)).map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>
                      {dataBR(m.created_at)}
                      <div className="text-xs text-muted-foreground">
                        {m.id.slice(0, 8)}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {nomes.get(m.produto_id)}
                    </TableCell>
                    <TableCell className="capitalize">{m.tipo}</TableCell>
                    <TableCell
                      className={
                        "text-right tabular-nums " +
                        (m.quantidade < 0
                          ? "text-destructive"
                          : "text-emerald-700 dark:text-emerald-300")
                      }
                    >
                      {m.quantidade > 0 ? "+" : ""}
                      {quantidade(m.quantidade)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {m.custo_unitario == null
                        ? m.tipo === "entrada"
                          ? "Não informado"
                          : "—"
                        : dinheiro(m.custo_unitario)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {m.custo_total == null ? "—" : dinheiro(m.custo_total)}
                    </TableCell>
                    <TableCell className="max-w-md whitespace-normal text-muted-foreground">
                      {m.motivo}
                      {m.estorno_de && (
                        <div className="mt-1 text-xs">
                          Estorno do registro {m.estorno_de.slice(0, 8)}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <ListBadge
                        icon={
                          m.estornado_em || m.tipo === "estorno"
                            ? Undo2
                            : CircleCheck
                        }
                        tone={
                          m.estornado_em
                            ? "warning"
                            : m.tipo === "estorno"
                              ? "info"
                              : "success"
                        }
                      >
                        {m.estornado_em
                          ? "Estornado"
                          : m.tipo === "estorno"
                            ? "Estorno"
                            : "Efetivado"}
                      </ListBadge>
                      {m.estornado_em && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          {dataBR(m.estornado_em)}
                        </div>
                      )}
                    </TableCell>
                    {gestor && (
                      <TableCell className="text-right">
                        {unidade &&
                        !m.estornado_em &&
                        !m.estorno_de &&
                        !m.fechamento_id &&
                        ["entrada", "perda", "consumo", "ajuste"].includes(
                          m.tipo,
                        ) ? (
                          <EstornoDialog
                            movimento={m}
                            unidadeId={unidade.id}
                            nome={nomes.get(m.produto_id) ?? "Produto"}
                            unidade={
                              produtos.find((p) => p.id === m.produto_id)
                                ?.unidade ?? ""
                            }
                          />
                        ) : m.fechamento_id ? (
                          <Tooltip>
                            <TooltipTrigger
                              render={
                                <Link
                                  className={buttonVariants({
                                    variant: "ghost",
                                    size: "icon-sm",
                                  })}
                                  aria-label="Ver fechamento"
                                  href={
                                    "/gestao/fechamentos/" + m.fechamento_id
                                  }
                                >
                                  <Eye className="size-4" />
                                </Link>
                              }
                            />
                            <TooltipContent>Ver fechamento</TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <GestaoShowMore shown={Math.min(gestaoListLimit(limite), filtrados.length)} total={filtrados.length} />
          </>
        )}
      </Panel>
    </GestaoShell>
  );
}
