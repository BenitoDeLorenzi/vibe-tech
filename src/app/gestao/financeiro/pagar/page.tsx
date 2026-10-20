import Link from "next/link";
import { notFound } from "next/navigation";
import { Receipt, Clock, CheckCheck, CircleAlert, Ban } from "lucide-react";
import { getGestaoContext } from "@/lib/gestao-data";
import { getFinanceiroData } from "@/lib/gestao-contas-data";
import {
  hojeFinanceiro,
  pendentePagar,
  valorReservado,
} from "@/lib/gestao-contas";
import { dataBR, dinheiro } from "@/lib/gestao-types";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { GestaoShell } from "../../gestao-shell";
import { Panel, ListBadge, Empty, MetricBadge, SearchToolbar } from "../../ui";
import { FinanceiroForm } from "../financeiro-form";
import { ContaActions } from "./conta-actions";
export default async function PagarPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { profile } = await getGestaoContext();
  if (profile.role !== "bdl_admin") notFound();
  const [fin, params] = await Promise.all([getFinanceiroData(), searchParams]);
  const hoje = hojeFinanceiro();
  const rows = fin.pagar
    .filter(
      (p) =>
        (!params.q ||
          [p.descricao, p.fornecedor, p.categoria]
            .join(" ")
            .toLocaleLowerCase("pt-BR")
            .includes(params.q.toLocaleLowerCase("pt-BR"))) &&
        (!params.status ||
          (params.status === "pendentes"
            ? pendentePagar(p) > 0
            : params.status === "pagas"
              ? !p.cancelada && pendentePagar(p) === 0
              : p.cancelada)),
    )
    .sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  return (
    <GestaoShell
      title="Contas a pagar"
      icon={Receipt}
      actions={
        fin.inicio ? (
          <SearchToolbar
            placeholder="Buscar descrição ou fornecedor"
            query={params.q}
            clearHref="/gestao/financeiro/pagar"
            hidden={params.status ? { status: params.status } : undefined}
          >
            <div className="hidden shrink-0 gap-1 rounded-lg bg-muted p-1 lg:flex">
              {[
                ["Todas", ""],
                ["Em aberto", "pendentes"],
                ["Pagas", "pagas"],
                ["Canceladas", "canceladas"],
              ].map(([label, status]) => (
                <Link
                  key={label}
                  href={
                    "/gestao/financeiro/pagar?" +
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
            <FinanceiroForm acao="pagar_cadastrar" label="Nova conta a pagar" />
          </SearchToolbar>
        ) : null
      }
    >
      {!fin.inicio ? (
        <Empty
          title="Ative o financeiro"
          description="Configure as contas e os saldos iniciais antes de registrar compromissos."
          href="/gestao/financeiro/contas"
          action="Contas e saldos"
        />
      ) : (
        <Panel
          title="Compromissos da empresa"
          description="O saldo só é movimentado quando o pagamento é registrado. Os saldos da equipe continuam no cadastro dos colaboradores."
          icon={Receipt}
          metrics={
            <>
              <MetricBadge
                label="em aberto"
                value={dinheiro(
                  fin.pagar.reduce(
                    (s, p) => s + Math.round(pendentePagar(p) * 100),
                    0,
                  ) / 100,
                )}
                icon={Clock}
                tone="warning"
              />
              <MetricBadge
                label="vencidas"
                value={
                  fin.pagar.filter(
                    (p) => p.vencimento < hoje && pendentePagar(p) > 0,
                  ).length
                }
                icon={CircleAlert}
                tone="danger"
              />
            </>
          }
        >
          <div className="overflow-hidden rounded-lg border">
            <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Descrição</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-right">Pago</TableHead>
                <TableHead className="text-right">Pendente</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p) => {
                const saldo = pendentePagar(p);
                const solicitado = valorReservado(
                  fin.solicitacoes,
                  undefined,
                  p.id,
                );
                const livre =
                  Math.max(0, Math.round((saldo - solicitado) * 100)) / 100;
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="font-medium">{p.descricao}</div>
                      <div className="text-xs text-muted-foreground">
                        {p.categoria}
                        {p.fornecedor && ` · ${p.fornecedor}`}
                      </div>
                      {p.observacoes && (
                        <p
                          className="max-w-xs truncate text-xs text-muted-foreground"
                          title={p.observacoes}
                        >
                          {p.observacoes}
                        </p>
                      )}
                      {p.fechamento_id && (
                        <Link
                          className="text-xs text-primary hover:underline"
                          href={`/gestao/fechamentos/${p.fechamento_id}`}
                        >
                          Ver fechamento
                        </Link>
                      )}
                    </TableCell>
                    <TableCell>{dataBR(p.vencimento)}</TableCell>
                    <TableCell>
                      <ListBadge
                        tone={
                          p.cancelada
                            ? "neutral"
                            : !saldo
                              ? "success"
                              : p.vencimento < hoje
                                ? "danger"
                                : "warning"
                        }
                        icon={
                          p.cancelada
                            ? Ban
                            : !saldo
                              ? CheckCheck
                              : p.vencimento < hoje
                                ? CircleAlert
                                : Clock
                        }
                      >
                        {p.cancelada
                          ? "Cancelada"
                          : !saldo
                            ? "Paga"
                            : Number(p.pago) > 0
                              ? "Parcialmente paga"
                              : p.vencimento < hoje
                                ? "Vencida"
                                : "Em aberto"}
                      </ListBadge>
                      {solicitado > 0 && (
                        <Link
                          href="/gestao/financeiro/contas"
                          className="mt-1 block text-xs text-primary hover:underline"
                        >
                          {dinheiro(solicitado)} solicitados ao sistema
                        </Link>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {dinheiro(Number(p.valor))}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {dinheiro(Number(p.pago))}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {dinheiro(saldo)}
                    </TableCell>
                    <TableCell className="text-right">
                      <ContaActions
                        conta={p}
                        contas={fin.contas}
                        livre={livre}
                        solicitado={solicitado}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
              {!rows.length && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-8 text-center text-muted-foreground"
                  >
                    Nenhuma conta encontrada.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Consulte os pagamentos e estorne lançamentos em{" "}
            <Link className="underline" href="/gestao/financeiro/extratos">
              Financeiro → Extratos
            </Link>
            .
          </p>
        </Panel>
      )}
    </GestaoShell>
  );
}
