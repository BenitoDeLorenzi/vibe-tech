import {
  CircleDollarSign,
  History,
  Pencil,
  Ban,
  RotateCcw,
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
  formatDate,
  type LicencaPagamento,
  type Licenca,
} from "@/lib/licencas-data";
import { InterIssueForm } from "./inter-issue-form";
import { InterCancelForm } from "./inter-cancel-form";
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
                ) : r.forma_pagamento === "Inter" ? (
                  <span className="text-muted-foreground">Confirmado pelo banco</span>
                ) : (
                  <Dialog>
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <DialogTrigger aria-label="Estornar recebimento"
                            className={buttonVariants({
                              variant: "outline",
                              size: "sm",
                            })}
                          >
                            <RotateCcw className="size-3" />
                            Estornar
                          </DialogTrigger>
                        }
                      />
                      <TooltipContent>Estornar recebimento</TooltipContent>
                    </Tooltip>
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
          {!!p.inter_cobrancas?.length && <div className="space-y-3 border-t pt-4">
            <p className="text-sm font-medium">Boletos emitidos</p>
            {p.inter_cobrancas.map((bill) => <div key={bill.id} className="space-y-2 rounded-lg border p-3 text-sm">
              <p className="font-medium">{formatCurrency(bill.valor)} · vencimento {formatDate(bill.vencimento)} · {bill.nosso_numero ? `nosso número ${bill.nosso_numero}` : "registro em processamento"}</p>
              {bill.codigo_solicitacao && <p className="break-all text-xs text-muted-foreground">Protocolo: {bill.codigo_solicitacao}</p>}
              <ol className="space-y-2 border-l pl-4">
                {bill.eventos?.map(event => <li key={event.id} className="relative text-xs before:absolute before:-left-[21px] before:top-1 before:size-2 before:rounded-full before:bg-primary">
                  <span className="text-muted-foreground">{new Date(event.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} · </span>
                  {event.tipo === "emissao_iniciada" ? "Emissão iniciada" : event.tipo === "emissao_solicitada" ? "Solicitação enviada ao Inter" : event.tipo === "cancelamento_solicitado" ? "Baixa solicitada ao Inter" : event.tipo === "emissao_pendente" ? "Emissão pendente de conferência" : ({ A_RECEBER: "Boleto registrado · a receber", RECEBIDO: "Pagamento confirmado pelo Inter", ATRASADO: "Boleto vencido", CANCELADO: "Baixa confirmada pelo Inter", EXPIRADO: "Boleto expirado", FALHA_EMISSAO: "Falha na emissão", EM_PROCESSAMENTO: "Em processamento", PROTESTO: "Boleto em protesto", MARCADO_RECEBIDO: "Recebimento marcado no Inter" } as Record<string,string>)[event.situacao ?? ""] ?? event.situacao ?? "Situação atualizada"}
                  {event.tipo === "cancelamento_solicitado" && event.detalhes.motivo && <p>Justificativa: {event.detalhes.motivo}</p>}
                </li>)}
              </ol>
            </div>)}
          </div>}
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
                        inter_receive: "Recebimento pelo Inter",
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
