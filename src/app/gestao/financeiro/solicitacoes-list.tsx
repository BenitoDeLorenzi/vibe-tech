import Link from "next/link";
import {
  ArrowRightLeft,
  Receipt,
  Clock,
  CheckCheck,
  Ban,
  RotateCcw,
} from "lucide-react";
import type { FinanceiroData } from "@/lib/gestao-contas";
import { dataBR, dinheiro } from "@/lib/gestao-types";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Panel, ListBadge, MetricBadge } from "../ui";
import { FinanceiroForm } from "./financeiro-form";

const estados = {
  pendente: { label: "Aguardando execução", tone: "warning", icon: Clock },
  concluida: { label: "Concluída", tone: "success", icon: CheckCheck },
  cancelada: { label: "Cancelada", tone: "neutral", icon: Ban },
  estornada: { label: "Estornada", tone: "neutral", icon: RotateCcw },
} as const;

export function SolicitacoesList({
  financeiro: fin,
}: {
  financeiro: FinanceiroData;
}) {
  const contas = new Map(fin.contas.map((c) => [c.id, c.nome]));
  const pagar = new Map(fin.pagar.map((p) => [p.id, p.descricao]));
  const rows = [...fin.solicitacoes].sort(
    (a, b) =>
      Number(b.status === "pendente") - Number(a.status === "pendente") ||
      b.data.localeCompare(a.data) ||
      a.id.localeCompare(b.id),
  );
  return (
    <Panel
      title="Solicitações ao sistema"
      icon={ArrowRightLeft}
      description="Registre os pedidos feitos à empresa e confirme quando forem executados."
      metrics={
        <MetricBadge
          label="pendentes"
          value={rows.filter((s) => s.status === "pendente").length}
          icon={Clock}
          tone="warning"
        />
      }
    >
      <div className="mb-4 flex justify-end">
        <FinanceiroForm
          acao="solicitar_repasse"
          label="Solicitar repasse"
          contas={fin.contas}
          defaults={{
            conta_id:
              fin.contas.find((c) => c.ativo && c.tipo === "cobranca")?.id ??
              "",
            destino_id:
              fin.contas.find((c) => c.ativo && c.tipo === "banco")?.id ?? "",
          }}
        />
      </div>
      <div className="overflow-hidden rounded-lg border">
            <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead>Solicitação</TableHead>
            <TableHead>Data</TableHead>
            <TableHead>Situação</TableHead>
            <TableHead className="text-right">Valor</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((s) => {
            const estado = estados[s.status];
            const destino =
              s.tipo === "repasse"
                ? contas.get(s.destino_id ?? "")
                : pagar.get(s.pagar_id ?? "");
            const Icon = s.tipo === "repasse" ? ArrowRightLeft : Receipt;
            return (
              <TableRow key={s.id}>
                <TableCell>
                  <div className="flex items-center gap-2 font-medium">
                    <Icon className="size-4 text-muted-foreground" />
                    {s.tipo === "repasse" ? "Repasse" : "Pagamento"} ·{" "}
                    {destino ?? "—"}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {contas.get(s.conta_id)}
                  </p>
                  {(s.observacoes || s.motivo_cancelamento) && (
                    <p
                      className="max-w-sm truncate text-xs text-muted-foreground"
                      title={s.motivo_cancelamento ?? s.observacoes}
                    >
                      {s.motivo_cancelamento ?? s.observacoes}
                    </p>
                  )}
                </TableCell>
                <TableCell>
                  {dataBR(s.data)}
                  {s.concluida_em && (
                    <p className="text-xs text-muted-foreground">
                      Executado em {dataBR(s.concluida_em)}
                    </p>
                  )}
                </TableCell>
                <TableCell>
                  <ListBadge tone={estado.tone} icon={estado.icon}>
                    {estado.label}
                  </ListBadge>
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {dinheiro(Number(s.valor))}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
                    {s.status === "pendente" ? (
                      <>
                        <FinanceiroForm
                          acao="concluir_solicitacao"
                          label="Concluir"
                          defaults={{ id: s.id }}
                          compact
                          description={`Confirme somente se a empresa já executou ${s.tipo === "repasse" ? "o repasse" : "o pagamento"} de ${dinheiro(Number(s.valor))} para ${destino ?? "o destino informado"}.`}
                        />
                        <FinanceiroForm
                          acao="cancelar_solicitacao"
                          label="Cancelar"
                          defaults={{ id: s.id }}
                          compact
                          description="O valor reservado será liberado. O pedido permanecerá no histórico."
                        />
                      </>
                    ) : (
                      s.status !== "cancelada" && (
                        <Link
                          className="text-xs font-medium hover:underline"
                          href={`/gestao/financeiro/extratos?${s.pagar_id ? `pagar=${s.pagar_id}` : `conta=${s.conta_id}`}`}
                        >
                          Ver extrato
                        </Link>
                      )
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
          {!rows.length && (
            <TableRow>
              <TableCell
                colSpan={5}
                className="py-8 text-center text-muted-foreground"
              >
                Nenhuma solicitação registrada. Pagamentos pelo sistema podem
                ser solicitados em Contas a pagar.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
          </div>
    </Panel>
  );
}
