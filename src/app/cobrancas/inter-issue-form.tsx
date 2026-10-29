"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { FormDialogCancel } from "@/components/form-dialog-cancel";
import { formatCurrency, formatDate, type Licenca, type LicencaPagamento } from "@/lib/licencas-data";
import { issueInterBillingAction } from "./inter-actions";

export function InterIssueForm({ pagamento, empresa, pagador }: {
  pagamento: LicencaPagamento;
  empresa: string;
  pagador: Licenca["prefeitura_pagador"];
}) {
  const [state, action, pending] = useActionState(issueInterBillingAction, {});
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);
  const complete = Boolean(pagador?.cnpj && pagador?.endereco && pagador?.endereco_numero && pagador?.bairro && pagador?.cidade && pagador?.uf && pagador?.cep && pagador?.email_cobranca);
  useEffect(() => {
    if (state.success) {
      toast.success(state.success);
      router.refresh();
      ref.current?.closest('[data-slot="dialog-content"]')?.querySelector<HTMLElement>('[data-slot="dialog-close"]')?.click();
    }
  }, [state.success, router]);

  return <form ref={ref} action={action} className="space-y-4">
    <input type="hidden" name="pagamento_id" value={pagamento.id} />
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-lg border p-4 text-sm">
      <dt className="text-muted-foreground">Empresa</dt><dd className="font-medium">{empresa}</dd>
      <dt className="text-muted-foreground">CNPJ</dt><dd>{pagador?.cnpj || "Não informado"}</dd>
      <dt className="text-muted-foreground">Endereço</dt><dd>{pagador?.endereco ? `${pagador.endereco}, ${pagador.endereco_numero ?? "s/n"} · ${pagador.bairro ?? ""} · ${pagador.cidade ?? ""}/${pagador.uf ?? ""} · ${pagador.cep ?? ""}` : "Não informado"}</dd>
      <dt className="text-muted-foreground">E-mail</dt><dd className="break-all">{pagador?.email_cobranca || "Não informado"}</dd>
      <dt className="text-muted-foreground">Competência</dt><dd>{pagamento.competencia.slice(0, 7).split("-").reverse().join("/")}</dd>
      <dt className="text-muted-foreground">Vencimento</dt><dd>{formatDate(pagamento.vencimento)}</dd>
      <dt className="text-muted-foreground">Valor</dt><dd className="font-semibold">{formatCurrency(pagamento.valor)}</dd>
    </dl>
    {!complete && <p className="text-sm text-destructive">Complete o endereço e o e-mail de cobrança no cadastro da empresa para emitir.</p>}
    {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
    <DialogFooter><FormDialogCancel disabled={pending} /><Button type="submit" disabled={pending || !complete}>{pending ? "Enviando..." : "Emitir boleto no Inter"}</Button></DialogFooter>
  </form>;
}
