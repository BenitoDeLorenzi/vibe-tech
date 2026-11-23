import Link from "next/link";
import { forbidden } from "next/navigation";
import { ArrowLeftRight, CheckCheck, RotateCcw } from "lucide-react";
import { getGestaoContext } from "@/lib/gestao-data";
import {
  getFinanceiroData,
  getExtratoFinanceiro,
} from "@/lib/gestao-contas-data";
import { dataBR, dinheiro } from "@/lib/gestao-types";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { buttonVariants } from "@/components/ui/button";
import { GestaoShell } from "../../gestao-shell";
import { GestaoShowMore } from "../../gestao-show-more";
import { gestaoListLimit } from "@/lib/gestao-list-limit";
import { Panel, ListBadge, Empty } from "../../ui";
import { FinanceiroForm } from "../financeiro-form";
import { ContaFilter } from "./conta-filter";
export default async function ExtratosPage({
  searchParams,
}: {
  searchParams: Promise<{ conta?: string; pagar?: string; categoria?: string; limite?: string }>;
}) {
  const { profile } = await getGestaoContext();
  if (profile.role !== "bdl_admin") forbidden();
  const params = await searchParams;
  const limite = gestaoListLimit(params.limite);
  const fin = await getFinanceiroData();
  const categorias = [...new Set([...fin.categorias.filter((c) => c.nome !== "Fechamento").map((c) => c.nome), ...fin.pagar.map((p) => p.categoria)])].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const categoria = categorias.includes(params.categoria ?? "") ? params.categoria : undefined;
  const extrato = await getExtratoFinanceiro(params.conta, limite, params.pagar,
    categoria ? fin.pagar.filter((p) => p.categoria === categoria).map((p) => p.id) : undefined,
    categoria === "Pessoal" ? "Pessoal" : undefined);
  const categoriasPorConta = new Map(fin.pagar.map((p) => [p.id, p.categoria]));
  const selecionada = fin.contas.find((c) => c.id === params.conta);
  const compromisso = fin.pagar.find((p) => p.id === params.pagar);
  return (
    <GestaoShell
      title="Extratos"
      icon={ArrowLeftRight}
      actions={
        fin.inicio ? (
          <ContaFilter
            contas={fin.contas.map(({ id, nome }) => ({ id, nome }))}
            value={params.conta}
            categorias={categorias}
            categoria={categoria}
          />
        ) : null
      }
    >
      {!fin.inicio ? (
        <Empty
          title="Ative o financeiro"
          description="Configure as contas para acompanhar as movimentações."
          href="/gestao/financeiro/contas"
          action="Contas e saldos"
        />
      ) : (
        <Panel
          title={
            compromisso
              ? `Pagamentos · ${compromisso.descricao}`
              : selecionada
                ? `Extrato · ${selecionada.nome}`
                : "Extrato das contas"
          }
          icon={ArrowLeftRight}
          metrics={
            selecionada || compromisso ? (
              <Link
                href="/gestao/financeiro/extratos"
                className={buttonVariants({
                  variant: "outline",
                  size: "sm",
                })}
              >
                Todas as contas
              </Link>
            ) : null
          }
        >
          <div className="overflow-hidden rounded-lg border">
            <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Data</TableHead>
                <TableHead>Lançamento</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Conta</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {extrato.movimentos.map((m) => (
                <TableRow
                  key={m.id}
                  className={m.estornado ? "opacity-60" : ""}
                >
                  <TableCell>{dataBR(m.data)}</TableCell>
                  <TableCell>
                    <div className="font-medium">{m.descricao}</div>
                    {m.fechamento_id && (
                      <Link
                        className="text-xs text-muted-foreground hover:underline"
                        href={`/gestao/fechamentos/${m.fechamento_id}`}
                      >
                        Ver fechamento
                      </Link>
                    )}
                    {m.motivo_estorno && (
                      <p className="text-xs text-muted-foreground">
                        {m.motivo_estorno}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>{m.categoria ?? (m.pagar_id ? categoriasPorConta.get(m.pagar_id) : null) ?? "—"}</TableCell>
                  <TableCell>
                    {fin.contas.find((c) => c.id === m.conta_id)?.nome}
                  </TableCell>
                  <TableCell
                    className={`text-right tabular-nums ${Number(m.valor) < 0 ? "text-destructive" : ""}`}
                  >
                    {dinheiro(Number(m.valor))}
                  </TableCell>
                  <TableCell>
                    <ListBadge
                      tone={m.estornado ? "neutral" : "success"}
                      icon={m.estornado ? RotateCcw : CheckCheck}
                    >
                      {m.estornado ? "Estornado" : "Registrado"}
                    </ListBadge>
                  </TableCell>
                  <TableCell className="text-right">
                    {!m.estornado &&
                      !m.fechamento_id &&
                      m.tipo !== "inicial" && (
                        <FinanceiroForm
                          acao="estornar"
                          label="Estornar"
                          defaults={{ id: m.grupo }}
                          description="O grupo completo será estornado, incluindo as duas contas em uma transferência ou recebimento."
                          compact
                        />
                      )}
                  </TableCell>
                </TableRow>
              ))}
              {!extrato.movimentos.length && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-8 text-center text-muted-foreground"
                  >
                    Nenhuma movimentação nesta conta.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          </div>
          <GestaoShowMore shown={extrato.movimentos.length} total={extrato.total} />
        </Panel>
      )}
    </GestaoShell>
  );
}
