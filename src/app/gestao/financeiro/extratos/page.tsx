import Link from "next/link";
import { notFound } from "next/navigation";
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
import { Panel, ListBadge, Empty } from "../../ui";
import { FinanceiroForm } from "../financeiro-form";
import { ContaFilter } from "./conta-filter";
export default async function ExtratosPage({
  searchParams,
}: {
  searchParams: Promise<{ conta?: string; pagar?: string; pagina?: string }>;
}) {
  const { profile } = await getGestaoContext();
  if (profile.role !== "bdl_admin") notFound();
  const params = await searchParams;
  const pagina = Math.max(
    1,
    Math.min(100000, Math.floor(Number(params.pagina) || 1)),
  );
  const [fin, extrato] = await Promise.all([
    getFinanceiroData(),
    getExtratoFinanceiro(params.conta, pagina, params.pagar),
  ]);
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
                    colSpan={6}
                    className="py-8 text-center text-muted-foreground"
                  >
                    Nenhuma movimentação nesta conta.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          </div>
          <div className="mt-4 flex items-center justify-end gap-3 text-sm">
            <span>
              {extrato.total} lançamento(s) · Página {pagina}
            </span>
            {pagina > 1 && (
              <Link
                href={`?conta=${params.conta ?? ""}&pagar=${params.pagar ?? ""}&pagina=${pagina - 1}`}
              >
                Anterior
              </Link>
            )}
            {pagina * 50 < extrato.total && (
              <Link
                href={`?conta=${params.conta ?? ""}&pagar=${params.pagar ?? ""}&pagina=${pagina + 1}`}
              >
                Próxima
              </Link>
            )}
          </div>
        </Panel>
      )}
    </GestaoShell>
  );
}
