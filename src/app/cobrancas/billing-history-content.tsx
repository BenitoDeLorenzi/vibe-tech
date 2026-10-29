import { ChevronDown, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency, formatDate, type LicencaPagamento } from "@/lib/licencas-data";
import { BillingReasonForm } from "./billing-reason-form";
import { InterEmailRetry } from "./inter-email-retry";

const dateTime = (value: string) => new Date(value).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
const billLabels: Record<string, string> = { A_RECEBER: "A receber", RECEBIDO: "Recebido", ATRASADO: "Vencido", CANCELADO: "Baixado", EXPIRADO: "Expirado", FALHA_EMISSAO: "Falha na emissão", EM_PROCESSAMENTO: "Em processamento", PROTESTO: "Em protesto", MARCADO_RECEBIDO: "Marcado como recebido" };
const eventLabels: Record<string, string> = { emissao_iniciada: "Emissão iniciada", emissao_solicitada: "Solicitação enviada ao Inter", cancelamento_solicitado: "Baixa solicitada ao Inter", emissao_pendente: "Emissão pendente de conferência" };
const actionLabels: Record<string, string> = { receive: "Recebimento registrado", reverse: "Recebimento estornado", edit: "Cobrança ajustada", cancel: "Cobrança cancelada", inter_receive: "Recebimento confirmado pelo Inter" };

function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">{children}</div>;
}

export function BillingHistoryContent({ pagamento: p, balance }: { pagamento: LicencaPagamento; balance: number }) {
  const bills = p.inter_cobrancas ?? [];
  const receipts = p.recebimentos ?? [];
  const changes = p.eventos ?? [];
  const defaultTab = bills.length ? "boletos" : receipts.length ? "recebimentos" : "alteracoes";

  return <div className="flex min-h-0 flex-1 flex-col">
    <div className="grid shrink-0 grid-cols-3 gap-3 border-b px-5 py-4">
      {([
        ["Cobrado", formatCurrency(p.valor)],
        ["Recebido", formatCurrency(p.valor_pago ?? 0)],
        ["Saldo", formatCurrency(balance)],
      ] as const).map(([label, value]) => <div key={label} className="min-w-0"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 truncate text-sm font-semibold sm:text-base" title={value}>{value}</p></div>)}
    </div>
    <Tabs defaultValue={defaultTab} className="min-h-0 flex-1 gap-0">
      <div className="shrink-0 border-b px-5 py-3">
        <TabsList className="grid h-9 w-full grid-cols-3 gap-1">
          <TabsTrigger value="boletos" className="h-7 min-w-0 px-1 sm:px-3">Boletos</TabsTrigger>
          <TabsTrigger value="recebimentos" className="h-7 min-w-0 px-1 sm:px-3">Recebimentos</TabsTrigger>
          <TabsTrigger value="alteracoes" className="h-7 min-w-0 px-1 sm:px-3">Alterações</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="boletos" className="min-h-0 space-y-3 overflow-y-auto overscroll-contain px-5 py-4">
        {!bills.length && <EmptyState>Nenhum boleto emitido para esta cobrança.</EmptyState>}
        {bills.map((bill, index) => <section key={bill.id} className="overflow-hidden rounded-xl border">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b bg-muted/25 p-4">
            <div><p className="text-xs text-muted-foreground">Boleto {bills.length - index}</p><p className="mt-0.5 font-semibold">{formatCurrency(bill.valor)}</p><p className="mt-1 text-xs text-muted-foreground">Vencimento {formatDate(bill.vencimento)}</p></div>
            <Badge variant={bill.situacao === "RECEBIDO" ? "default" : bill.situacao === "ATRASADO" || bill.situacao === "FALHA_EMISSAO" ? "destructive" : "secondary"}>{billLabels[bill.situacao ?? ""] ?? bill.situacao ?? "Aguardando registro"}</Badge>
          </div>
          <div className="space-y-4 p-4 text-sm">
            {(bill.nosso_numero || bill.codigo_solicitacao) && <div className="grid gap-2 text-xs sm:grid-cols-2">{bill.nosso_numero && <p><span className="text-muted-foreground">Nosso número</span><br/><span className="font-medium">{bill.nosso_numero}</span></p>}{bill.codigo_solicitacao && <p className="min-w-0"><span className="text-muted-foreground">Protocolo Inter</span><br/><span className="break-all font-medium">{bill.codigo_solicitacao}</span></p>}</div>}
            {!!bill.eventos?.length && <details className="group rounded-lg border"><summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-sm font-medium marker:content-none [&::-webkit-details-marker]:hidden">Andamento no Inter <span className="flex items-center gap-2 text-xs font-normal text-muted-foreground">{bill.eventos.length} {bill.eventos.length === 1 ? "evento" : "eventos"}<ChevronDown className="size-4 transition-transform group-open:rotate-180" /></span></summary><ol className="mx-4 mb-4 ml-5 space-y-3 border-l pl-4 pt-2">{[...bill.eventos].sort((a,b) => b.created_at.localeCompare(a.created_at)).map(event => <li key={event.id} className="relative before:absolute before:-left-[21px] before:top-1.5 before:size-2 before:rounded-full before:bg-primary"><p className="font-medium">{eventLabels[event.tipo] ?? billLabels[event.situacao ?? ""] ?? event.situacao ?? "Situação atualizada"}</p><p className="text-xs text-muted-foreground">{dateTime(event.created_at)}</p>{event.tipo === "cancelamento_solicitado" && event.detalhes.motivo && <p className="mt-1 text-xs">Justificativa: {event.detalhes.motivo}</p>}</li>)}</ol></details>}
            {!!bill.emails?.length && <div className="border-t pt-3"><h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Comunicações</h4><div className="space-y-2">{bill.emails.map(email => <div key={email.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/40 p-3 text-xs"><div className="min-w-0"><p className="font-medium">{email.tipo === "boleto_empresa" ? "Boleto para a empresa" : "Aviso de pagamento para a Vibe Tech"}</p><p className="break-all text-muted-foreground">{email.status === "sent" ? `Enviado ao servidor${email.enviado_em ? ` em ${dateTime(email.enviado_em)}` : ""}` : email.status === "failed" ? "Falha no envio" : email.status === "skipped" ? "Envio dispensado" : email.status === "sending" ? "Enviando" : "Aguardando envio"}{email.destinatario ? ` · ${email.destinatario}` : ""}</p>{email.ultimo_erro && <p className="mt-1 text-destructive">{email.ultimo_erro}</p>}</div>{email.status === "failed" && <InterEmailRetry id={email.id} />}</div>)}</div></div>}
          </div>
        </section>)}
      </TabsContent>
      <TabsContent value="recebimentos" className="min-h-0 space-y-3 overflow-y-auto overscroll-contain px-5 py-4">
        {!receipts.length && <EmptyState>Nenhum recebimento registrado.</EmptyState>}
        {receipts.map(r => <div key={r.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border p-4 text-sm"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><strong>{formatCurrency(r.valor)}</strong><Badge variant={r.estornado_em ? "destructive" : "secondary"}>{r.estornado_em ? "Estornado" : r.forma_pagamento === "Inter" ? "Confirmado pelo Inter" : "Registrado"}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{formatDate(r.pago_em)} · {r.autor_nome} · {r.forma_pagamento ?? "Forma não informada"}</p>{r.documento && <p className="mt-2 text-xs">Documento: {r.documento}</p>}{r.observacoes && <p className="mt-2 text-xs">{r.observacoes}</p>}{r.motivo_estorno && <p className="mt-2 text-xs text-destructive">Motivo do estorno: {r.motivo_estorno}</p>}</div>{!r.estornado_em && r.forma_pagamento !== "Inter" && <Dialog><DialogTrigger className={buttonVariants({ variant: "outline", size: "sm" })}><RotateCcw className="size-3"/> Estornar</DialogTrigger><DialogContent><DialogHeader><DialogTitle>Estornar {formatCurrency(r.valor)}</DialogTitle></DialogHeader><BillingReasonForm id={p.id} receipt={r.id}/></DialogContent></Dialog>}</div>)}
      </TabsContent>
      <TabsContent value="alteracoes" className="min-h-0 overflow-y-auto overscroll-contain px-5 py-4">
        {!changes.length && <EmptyState>Nenhuma alteração registrada.</EmptyState>}
        {!!changes.length && <ol className="ml-2 space-y-4 border-l pl-5">{[...changes].sort((a,b) => b.created_at.localeCompare(a.created_at)).map(e => <li key={e.id} className="relative rounded-lg border p-3 text-sm before:absolute before:-left-[26px] before:top-4 before:size-2 before:rounded-full before:bg-primary"><p className="font-medium">{actionLabels[e.acao] ?? e.acao}</p><p className="mt-1 text-xs text-muted-foreground">{dateTime(e.created_at)} · {e.autor_nome}</p>{e.detalhes.dados?.motivo && <p className="mt-2 text-xs">Motivo: {e.detalhes.dados.motivo}</p>}{e.acao === "edit" && <div className="mt-2 space-y-1 rounded-md bg-muted/50 p-2 text-xs"><p>Valor: {formatCurrency(Number(e.detalhes.antes?.valor ?? 0))} → {formatCurrency(Number(e.detalhes.dados?.valor ?? 0))}</p><p>Vencimento: {e.detalhes.antes?.vencimento ?? "—"} → {e.detalhes.dados?.vencimento ?? "—"}</p></div>}</li>)}</ol>}
      </TabsContent>
    </Tabs>
  </div>;
}
