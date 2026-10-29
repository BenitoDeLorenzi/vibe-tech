import {
  CircleDollarSign,
  History,
  Pencil,
  Ban,
  FilePlus2,
  FileText,
  CircleX,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { buttonVariants } from "@/components/ui/button";
import { LicencaPagamentoForm } from "@/app/licencas/licenca-pagamento-form";
import { LicencaParcelaForm } from "@/app/licencas/licenca-parcela-form";
import { BillingReasonForm } from "./billing-reason-form";
import {
  formatCurrency,
  type LicencaPagamento,
  type Licenca,
} from "@/lib/licencas-data";
import { InterIssueForm } from "./inter-issue-form";
import { InterCancelForm } from "./inter-cancel-form";
import { BillingHistoryContent } from "./billing-history-content";
export function BillingActions({
  pagamento: p,
  empresa,
  pagador,
}: {
  pagamento: LicencaPagamento;
  empresa: string;
  pagador: Licenca["prefeitura_pagador"];
}) {
  const balance =
    p.status === "cancelled"
      ? 0
      : Math.max(0, Number(p.valor) - Number(p.valor_pago ?? 0));
  const inter = p.inter_cobrancas?.find(b => !["cancelled", "failed", "expired"].includes(b.status));
  return (
    <div className="flex justify-end gap-1">
      {p.status === "open" && !Number(p.valor_pago) && !inter && (
        <Dialog>
          <Tooltip>
            <TooltipTrigger render={<DialogTrigger aria-label="Emitir boleto no Inter" className={buttonVariants({ variant: "ghost", size: "icon-sm" })}><FilePlus2 className="size-4" /></DialogTrigger>} />
            <TooltipContent>Emitir boleto no Inter</TooltipContent>
          </Tooltip>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Emitir boleto no Inter</DialogTitle>
              <DialogDescription>Confira os dados antes de enviar a cobrança ao banco.</DialogDescription>
            </DialogHeader>
            <InterIssueForm pagamento={p} empresa={empresa} pagador={pagador} />
          </DialogContent>
        </Dialog>
      )}
      {inter?.codigo_solicitacao && ["A_RECEBER", "ATRASADO", "RECEBIDO", "PROTESTO", "MARCADO_RECEBIDO"].includes(inter.situacao ?? "") && <Tooltip>
        <TooltipTrigger render={<a href={`/api/inter/cobrancas/${inter.id}/pdf`} target="_blank" rel="noopener noreferrer" aria-label="Visualizar PDF do boleto" className={buttonVariants({ variant: "ghost", size: "icon-sm" })}><FileText className="size-4" /></a>} />
        <TooltipContent>Visualizar PDF do boleto</TooltipContent>
      </Tooltip>}
      {inter?.codigo_solicitacao && !["RECEBIDO", "CANCELADO"].includes(inter.situacao ?? "") && inter.status !== "cancelling" && <Dialog>
        <Tooltip>
          <TooltipTrigger render={<DialogTrigger aria-label="Dar baixa no boleto" className={buttonVariants({ variant: "ghost", size: "icon-sm", className: "text-destructive hover:bg-destructive/10 hover:text-destructive" })}><CircleX className="size-4" /></DialogTrigger>} />
          <TooltipContent>Dar baixa no boleto</TooltipContent>
        </Tooltip>
        <DialogContent>
          <DialogHeader><DialogTitle>Dar baixa no boleto</DialogTitle><DialogDescription>O boleto será cancelado no Inter. A mensalidade continuará em aberto.</DialogDescription></DialogHeader>
          <InterCancelForm id={inter.id} />
        </DialogContent>
      </Dialog>}
      {p.status !== "cancelled" && balance > 0 && !inter && (
        <Dialog>
          <Tooltip>
            <TooltipTrigger
              render={
                <DialogTrigger aria-label="Registrar pagamento"
                  className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
                >
                  <CircleDollarSign className="size-4" />
                </DialogTrigger>
              }
            />
            <TooltipContent>Registrar pagamento</TooltipContent>
          </Tooltip>
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
      {p.status !== "cancelled" && !Number(p.valor_pago) && !inter && (
        <Dialog>
          <Tooltip>
            <TooltipTrigger
              render={
                <DialogTrigger aria-label="Ajustar cobrança"
                  className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
                >
                  <Pencil className="size-4" />
                </DialogTrigger>
              }
            />
            <TooltipContent>Ajustar cobrança</TooltipContent>
          </Tooltip>
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
        <Tooltip>
          <TooltipTrigger
            render={
              <DialogTrigger aria-label="Histórico da cobrança"
                className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
              >
                <History className="size-4" />
              </DialogTrigger>
            }
          />
          <TooltipContent>Histórico da cobrança</TooltipContent>
        </Tooltip>
        <DialogContent className="flex h-[min(720px,calc(100dvh-2rem))] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
          <DialogHeader className="shrink-0 border-b px-5 py-4 pr-12">
            <DialogTitle>Histórico da cobrança</DialogTitle>
            <DialogDescription>Competência {p.competencia.slice(0, 7).split("-").reverse().join("/")} · {empresa}</DialogDescription>
          </DialogHeader>
          <BillingHistoryContent pagamento={p} balance={balance} />
        </DialogContent>
      </Dialog>
      {p.status !== "cancelled" && !Number(p.valor_pago) && !inter && (
        <Dialog>
          <Tooltip>
            <TooltipTrigger
              render={
                <DialogTrigger aria-label="Cancelar cobrança"
                  className={buttonVariants({
                    variant: "destructive",
                    size: "icon-sm",
                  })}
                >
                  <Ban className="size-4" />
                </DialogTrigger>
              }
            />
            <TooltipContent>Cancelar cobrança</TooltipContent>
          </Tooltip>
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
