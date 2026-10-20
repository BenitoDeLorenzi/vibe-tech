import {
  CircleDollarSign,
  History,
  Pencil,
  Ban,
  RotateCcw,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { buttonVariants } from "@/components/ui/button";
import { LicencaPagamentoForm } from "@/app/licencas/licenca-pagamento-form";
import { LicencaParcelaForm } from "@/app/licencas/licenca-parcela-form";
import { BillingReasonForm } from "./billing-reason-form";
import {
  formatCurrency,
  formatDate,
  type LicencaPagamento,
} from "@/lib/licencas-data";
export function BillingActions({
  pagamento: p,
}: {
  pagamento: LicencaPagamento;
}) {
  const balance =
    p.status === "cancelled"
      ? 0
      : Math.max(0, Number(p.valor) - Number(p.valor_pago ?? 0));
  return (
    <div className="flex justify-end gap-1">
      {p.status !== "cancelled" && balance > 0 && (
        <Dialog>
          <DialogTrigger
            aria-label="Registrar pagamento"
            title="Registrar pagamento"
            className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
          >
            <CircleDollarSign className="size-4" />
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Registrar pagamento</DialogTitle>
              <DialogDescription>
                Saldo pendente: {formatCurrency(balance)}. Recebimentos parciais
                mantêm o restante em aberto.
              </DialogDescription>
            </DialogHeader>
            <LicencaPagamentoForm pagamento={p} />
          </DialogContent>
        </Dialog>
      )}
      {p.status !== "cancelled" && !Number(p.valor_pago) && (
        <Dialog>
          <DialogTrigger
            aria-label="Ajustar cobrança"
            title="Ajustar cobrança"
            className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
          >
            <Pencil className="size-4" />
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ajustar cobrança</DialogTitle>
              <DialogDescription>
                O ajuste ficará registrado no histórico.
              </DialogDescription>
            </DialogHeader>
            <LicencaParcelaForm pagamento={p} />
          </DialogContent>
        </Dialog>
      )}
      <Dialog>
        <DialogTrigger
          aria-label="Histórico da cobrança"
          title="Histórico da cobrança"
          className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
        >
          <History className="size-4" />
        </DialogTrigger>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Histórico da cobrança</DialogTitle>
            <DialogDescription>
              Competência{" "}
              {p.competencia.slice(0, 7).split("-").reverse().join("/")} ·
              Cobrado {formatCurrency(p.valor)} · Saldo{" "}
              {formatCurrency(balance)}
            </DialogDescription>
          </DialogHeader>
          {!p.recebimentos?.length && (
            <p className="text-sm text-muted-foreground">
              Nenhum recebimento registrado.
            </p>
          )}
          {p.recebimentos?.map((r) => (
            <div key={r.id} className="space-y-1 rounded-lg border p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <strong>
                  {formatCurrency(r.valor)} · {formatDate(r.pago_em)}
                </strong>
                {r.estornado_em ? (
                  <span className="text-destructive">Estornado</span>
                ) : (
                  <Dialog>
                    <DialogTrigger
                      aria-label="Estornar recebimento"
                      className={buttonVariants({
                        variant: "outline",
                        size: "sm",
                      })}
                    >
                      <RotateCcw className="size-3" />
                      Estornar
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>
                          Estornar {formatCurrency(r.valor)}
                        </DialogTitle>
                      </DialogHeader>
                      <BillingReasonForm id={p.id} receipt={r.id} />
                    </DialogContent>
                  </Dialog>
                )}
              </div>
              <p className="text-muted-foreground">
                {r.autor_nome} · {r.forma_pagamento ?? "Não informado"}
                {r.documento ? ` · ${r.documento}` : ""}
              </p>
              {r.observacoes && <p>{r.observacoes}</p>}
              {r.motivo_estorno && <p>Motivo: {r.motivo_estorno}</p>}
            </div>
          ))}
          {p.eventos?.length ? (
            <div className="space-y-2 border-t pt-3">
              <p className="font-medium text-sm">Alterações</p>
              {p.eventos.map((e) => (
                <div key={e.id} className="text-xs text-muted-foreground">
                  <span>
                    {new Date(e.created_at).toLocaleString("pt-BR", {
                      timeZone: "America/Sao_Paulo",
                    })}{" "}
                    · {e.autor_nome} ·{" "}
                    {(
                      {
                        receive: "Recebimento",
                        reverse: "Estorno",
                        edit: "Ajuste",
                        cancel: "Cancelamento",
                      } as Record<string, string>
                    )[e.acao] ?? e.acao}
                  </span>
                  {e.detalhes.dados?.motivo && <p>{e.detalhes.dados.motivo}</p>}
                  {e.acao === "edit" && (
                    <p>
                      Valor:{" "}
                      {formatCurrency(Number(e.detalhes.antes?.valor ?? 0))} →{" "}
                      {formatCurrency(Number(e.detalhes.dados?.valor ?? 0))} ·
                      Vencimento: {e.detalhes.antes?.vencimento} →{" "}
                      {e.detalhes.dados?.vencimento}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
      {p.status !== "cancelled" && !Number(p.valor_pago) && (
        <Dialog>
          <DialogTrigger
            aria-label="Cancelar cobrança"
            title="Cancelar cobrança"
            className={buttonVariants({
              variant: "destructive",
              size: "icon-sm",
            })}
          >
            <Ban className="size-4" />
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cancelar cobrança</DialogTitle>
            </DialogHeader>
            <BillingReasonForm id={p.id} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
