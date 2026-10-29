import "server-only";

import { findInterBillingByYourNumber, retrieveInterBilling } from "@/lib/inter-client";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { processInterBillingEmailsForBill } from "@/lib/inter-billing-email";

export async function syncInterBilling(id: string) {
  const db = createSupabaseServerClient();
  const { data: bill, error } = await db.from("inter_cobrancas")
    .select("id,codigo_solicitacao,seu_numero,created_at,status,situacao")
    .eq("id", id).single();
  if (error || !bill) throw new Error("Boleto não encontrado.");
  if (!bill.codigo_solicitacao) {
    const code = await findInterBillingByYourNumber(bill.seu_numero, bill.created_at.slice(0, 10), new Date().toISOString().slice(0, 10));
    if (!code) throw new Error("Emissão não localizada no Inter. Aguarde ou confira no portal do banco antes de tentar novamente.");
    const { error: linkError } = await db.from("inter_cobrancas").update({ codigo_solicitacao: code, status: "submitted", updated_at: new Date().toISOString() }).eq("id", id).is("codigo_solicitacao", null);
    if (linkError) throw new Error("Boleto encontrado no Inter, mas não foi possível salvar o protocolo.");
    bill.codigo_solicitacao = code;
  }
  if (bill.status === "cancelled") return bill.situacao;

  const detail = await retrieveInterBilling(bill.codigo_solicitacao);
  const situacao = detail.cobranca?.situacao;
  if (!situacao) throw new Error("O Inter ainda não informou a situação do boleto.");
  if (situacao === "RECEBIDO" && (
    !Number(detail.cobranca?.valorTotalRecebido) ||
    !/^\d{4}-\d{2}-\d{2}/.test(detail.cobranca?.dataSituacao ?? "")
  )) throw new Error("O Inter marcou como recebido, mas ainda não informou valor e data para conciliação.");
  const { error: applyError } = await db.rpc("inter_apply_billing_status", {
    p_id: id,
    p_situacao: situacao,
    p_details: {
      ...detail.cobranca,
      ...detail.boleto,
      ...detail.pix,
      valorTotalRecebido: detail.cobranca?.valorTotalRecebido == null ? null : String(detail.cobranca.valorTotalRecebido),
    },
  });
  if (applyError) throw new Error(`Não foi possível conciliar o boleto: ${applyError.message}`);
  try { await processInterBillingEmailsForBill(id); }
  catch (error) { console.error("Falha ao processar e-mails da cobrança Inter:", error); }
  return situacao;
}
