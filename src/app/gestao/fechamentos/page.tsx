import { getFinanceiroData } from "@/lib/gestao-contas-data";
import { getEquipeData } from "@/lib/gestao-equipe-data";
import { saldoColaborador } from "@/lib/gestao-equipe";
import Link from "next/link";
import { randomUUID } from "node:crypto";
import {
  ClipboardCheck,
  Eye,
  Pencil,
  CircleCheck,
  FilePenLine,
} from "lucide-react";
import { recebimentoLiquido } from "@/lib/gestao-fechamento";
import {
  getGestaoContext,
  getFechamentos,
  getProdutos,
  getTaxasRecebimento,
} from "@/lib/gestao-data";
import { dataBR, dinheiro } from "@/lib/gestao-types";
import { buttonVariants } from "@/components/ui/button";
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
import { GestaoShell } from "../gestao-shell";
import { GestaoShowMore } from "../gestao-show-more";
import { gestaoListLimit } from "@/lib/gestao-list-limit";
import { FechamentoForm } from "./fechamento-form";
import { ExcluirFechamentoButton } from "./excluir-rascunho-button";
import {
  Empty,
  Panel,
  Status,
  GestaoDialog,
  MetricBadge,
  SearchToolbar,
} from "../ui";
export default async function FechamentosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; novo?: string; limite?: string }>;
}) {
  const params = await searchParams;
  const [{ unidade, gestor, profile }, fechamentos, produtos, taxas] =
    await Promise.all([
      getGestaoContext(),
      getFechamentos(),
      getProdutos(),
      getTaxasRecebimento(),
    ]);
  const financeiro =
    profile.role === "bdl_admin" ? await getFinanceiroData() : undefined;
  const equipe = gestor
    ? await getEquipeData()
    : { colaboradores: [], extrato: [] };
  const filtrados = fechamentos.filter(
    (f) =>
      (!params.status || f.status === params.status) &&
      (!params.q ||
        [f.origem, f.turno, dataBR(f.data)]
          .join(" ")
          .toLocaleLowerCase("pt-BR")
          .includes(params.q.trim().toLocaleLowerCase("pt-BR"))),
  );
  const novo = unidade ? (
    <GestaoDialog
      title="Novo fechamento"
      label="Novo fechamento"
      titleBadge={<Status status="rascunho" />}
      wide
      defaultOpen={params.novo === "1"}
    >
      <FechamentoForm
        emDialogo
        id={randomUUID()}
        unidadeId={unidade.id}
        financeiro={financeiro}
        produtos={produtos}
        taxasPadrao={Object.fromEntries(
          taxas.map((t) => [t.forma, Number(t.percentual)]),
        )}
        colaboradores={equipe.colaboradores.map((c) => ({
          ...c,
          saldo: saldoColaborador(equipe.extrato, c.id),
        }))}
        gestor={gestor}
        master={profile.role === "bdl_admin"}
      />
    </GestaoDialog>
  ) : null;
  return (
    <GestaoShell
      title="Fechamentos"
      icon={ClipboardCheck}
      actions={
        <SearchToolbar
          placeholder="Buscar fechamento"
          query={params.q}
          clearHref="/gestao/fechamentos"
          hidden={params.status ? { status: params.status } : undefined}
        >
          <div className="hidden shrink-0 gap-1 rounded-lg bg-muted p-1 lg:flex">
            {[
              ["Todos", ""],
              ["Rascunhos", "rascunho"],
              ["Conferidos", "conferido"],
            ].map(([label, status]) => (
              <Link
                key={label}
                href={
                  "/gestao/fechamentos?" +
                  new URLSearchParams({
                    ...(params.q ? { q: params.q } : {}),
                    ...(status ? { status } : {}),
                  })
                }
                className={buttonVariants({
                  variant:
                    (params.status ?? "") === status ? "default" : "ghost",
                  size: "sm",
                  className: "h-7 shrink-0 px-2 text-xs",
                })}
              >
                {label}
              </Link>
            ))}
          </div>
          {novo}
        </SearchToolbar>
      }
    >
      <Panel
        title="Fechamentos registrados"
        description="Consulte os resumos e acompanhe a conferência dos últimos 100 fechamentos."
        icon={ClipboardCheck}
        metrics={
          <>
            <MetricBadge
              label="Rascunhos"
              icon={FilePenLine}
              tone="warning"
              value={fechamentos.filter((f) => f.status === "rascunho").length}
            />
            <MetricBadge
              label="Conferidos"
              icon={CircleCheck}
              tone="success"
              value={fechamentos.filter((f) => f.status === "conferido").length}
            />
          </>
        }
      >
        {!filtrados.length ? (
          <Empty
            title="Nenhum fechamento encontrado"
            description={
              produtos.length
                ? "Use Novo fechamento para informar os produtos vendidos e os pagamentos."
                : "Cadastre os produtos antes de iniciar o fechamento."
            }
            href={!produtos.length ? "/gestao/produtos" : undefined}
            action="Cadastrar produtos"
          />
        ) : (
          <>
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Data / turno</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead className="text-right">Total vendido</TableHead>
                  <TableHead className="text-right">
                    Recebimentos brutos
                  </TableHead>
                  <TableHead className="text-right">Despesas</TableHead>
                  <TableHead className="text-right">Diferença</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead className="w-[128px] text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrados.slice(0, gestaoListLimit(params.limite)).map((f) => {
                  const recebido = f.pagamentos.reduce(
                    (s, p) => s + Math.round(Number(p.valor) * 100),
                    0,
                  );
                  const diferenca =
                    Math.round(Number(f.total) * 100) - recebido;
                  const despesas = f.despesas ?? [];
                  const totalDespesas = despesas.reduce(
                    (s, d) => s + Math.round(Number(d.valor) * 100),
                    0,
                  );
                  const taxas = f.pagamentos.reduce(
                    (s, p) =>
                      s +
                      recebimentoLiquido(
                        Number(p.valor),
                        Number(p.taxa_percentual ?? 0),
                      ).taxa,
                    0,
                  );
                  return (
                    <TableRow key={f.id}>
                      <TableCell>
                        <Link
                          href={`/gestao/fechamentos/${f.id}`}
                          className="font-medium hover:underline"
                        >
                          {dataBR(f.data)}
                        </Link>
                        <div className="text-xs capitalize text-muted-foreground">
                          {f.turno}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="first-letter:uppercase">{f.origem}</div>
                        <div className="text-xs text-muted-foreground">
                          {f.itens.length}{" "}
                          {f.itens.length === 1 ? "produto" : "produtos"}
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {dinheiro(f.total)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {dinheiro(recebido / 100)}
                        <div className="text-xs text-muted-foreground">
                          Taxas: {dinheiro(taxas / 100)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {dinheiro(totalDespesas / 100)}
                        <div className="text-xs text-muted-foreground">
                          {despesas.length}{" "}
                          {despesas.length === 1 ? "despesa" : "despesas"}
                        </div>
                      </TableCell>
                      <TableCell
                        className={`text-right tabular-nums ${diferenca !== 0 ? "font-medium text-destructive" : "text-muted-foreground"}`}
                      >
                        {dinheiro(diferenca / 100)}
                      </TableCell>
                      <TableCell>
                        <Status status={f.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Tooltip>
                            <TooltipTrigger
                              render={
                                <Link
                                  href={"/gestao/fechamentos/" + f.id}
                                  aria-label="Ver resumo do fechamento"
                                  className={buttonVariants({
                                    variant: "ghost",
                                    size: "icon-sm",
                                  })}
                                >
                                  <Eye className="size-4" />
                                </Link>
                              }
                            />
                            <TooltipContent>Ver resumo</TooltipContent>
                          </Tooltip>
                          {f.status === "rascunho" && (
                            <Tooltip>
                              <TooltipTrigger
                                render={
                                  <Link
                                    href={`/gestao/fechamentos/${f.id}?editar=1`}
                                    aria-label="Editar rascunho"
                                    className={buttonVariants({
                                      variant: "ghost",
                                      size: "icon-sm",
                                    })}
                                  >
                                    <Pencil className="size-4" />
                                  </Link>
                                }
                              />
                              <TooltipContent>Editar rascunho</TooltipContent>
                            </Tooltip>
                          )}
                          {profile.role === "bdl_admin" && unidade && (
                            <ExcluirFechamentoButton
                              unidadeId={unidade.id}
                              id={f.id}
                              versao={f.versao}
                              identificacao={`${dataBR(f.data)} · ${f.turno} · ${f.origem}`}
                            />
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <GestaoShowMore shown={Math.min(gestaoListLimit(params.limite), filtrados.length)} total={filtrados.length} />
          </>
        )}
      </Panel>
    </GestaoShell>
  );
}
