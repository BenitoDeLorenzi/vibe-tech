"use server";

import { createHash, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth-data";
import { cancelInterBilling, issueInterBilling, type InterPayer } from "@/lib/inter-client";
import { syncInterBilling } from "@/lib/inter-billing-sync";
import { ensureInterBillingWebhook } from "@/lib/inter-webhook";
import { todayInSaoPaulo } from "@/lib/license-schedule";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { processInterBillingEmailsForBill } from "@/lib/inter-billing-email";

export type InterIssueState = { error?: string; success?: string };

export async function issueInterBillingAction(
  _previous: InterIssueState,
  data: FormData,
): Promise<InterIssueState> {
  const actor = await requireRole(["bdl_admin"]);
  const id = String(data.get("pagamento_id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { error: "Mensalidade inválida." };

  const db = createSupabaseServerClient();
  const { data: payment, error: paymentError } = await db
    .from("licenca_pagamentos")
    .select("id,prefeitura_id,modulo_id,competencia,status,valor,valor_pago,vencimento")
    .eq("id", id)
    .single();
  if (paymentError || !payment) return { error: "Mensalidade não encontrada." };
  if (payment.status !== "open" || Number(payment.valor_pago ?? 0) !== 0)
    return { error: "Somente mensalidades em aberto e sem recebimentos podem ser emitidas." };
  if (payment.vencimento < todayInSaoPaulo())
    return { error: "O vencimento já passou. Ajuste a mensalidade antes de emitir." };

  const { data: empresa, error: empresaError } = await db
    .from("empresas")
    .select("nome,cnpj,status,endereco,endereco_numero,endereco_complemento,bairro,cidade,uf,cep,email_cobranca,telefone_cobranca")
    .eq("id", payment.prefeitura_id)
    .single();
  if (empresaError || !empresa || empresa.status !== "active")
    return { error: "A empresa pagadora está indisponível." };
  const { data: module } = await db.from("modulos").select("nome").eq("id", payment.modulo_id).single();
  if (!module?.nome) return { error: "O módulo da licença não foi encontrado." };

  const cpfCnpj = empresa.cnpj?.replace(/\D/g, "") ?? "";
  const cep = empresa.cep?.replace(/\D/g, "") ?? "";
  const telefone = empresa.telefone_cobranca?.replace(/\D/g, "") ?? "";
  if (
    cpfCnpj.length !== 14 || cep.length !== 8 ||
    !empresa.nome?.trim() || !empresa.endereco?.trim() ||
    !empresa.endereco_numero?.trim() || !empresa.bairro?.trim() ||
    !empresa.cidade?.trim() || !empresa.uf?.trim() || !empresa.email_cobranca?.trim()
  ) return { error: "Complete CNPJ, endereço e e-mail de cobrança da empresa antes de emitir." };

  const pagador: InterPayer = {
    cpfCnpj,
    tipoPessoa: "JURIDICA",
    nome: empresa.nome.trim(),
    endereco: empresa.endereco.trim(),
    numero: empresa.endereco_numero.trim(),
    ...(empresa.endereco_complemento ? { complemento: empresa.endereco_complemento.trim() } : {}),
    bairro: empresa.bairro.trim(),
    cidade: empresa.cidade.trim(),
    uf: empresa.uf.trim(),
    cep,
    email: empresa.email_cobranca.trim(),
    ...(telefone.length >= 10 ? { ddd: telefone.slice(0, 2), telefone: telefone.slice(2) } : {}),
  };
  const seuNumero = `VT${BigInt(`0x${createHash("sha256").update(randomUUID()).digest("hex").slice(0, 15)}`).toString(36).toUpperCase()}`;

  const { data: billId, error: reserveError } = await db.rpc("inter_reserve_billing", {
    p_actor: actor.id, p_pagamento: payment.id, p_seu_numero: seuNumero,
  });
  if (reserveError) {
    if (reserveError.code === "23505")
      return { error: "Esta mensalidade já tem uma emissão iniciada no Inter. Confira o status antes de tentar novamente." };
    return { error: "Não foi possível reservar a cobrança. Tente novamente." };
  }

  try {
    const codigo = await issueInterBilling({
      seuNumero,
      valor: Number(payment.valor),
      vencimento: payment.vencimento,
      pagador,
      descricao: `Licenca ${module.nome} - mensalidade ${payment.competencia.slice(5, 7)}/${payment.competencia.slice(0, 4)}`,
    });
    const { error: saveError } = await db.from("inter_cobrancas")
      .update({ status: "submitted", codigo_solicitacao: codigo, updated_at: new Date().toISOString() })
      .eq("id", billId).eq("status", "submitting");
    if (saveError) throw new Error("O Inter confirmou a emissão, mas o app não conseguiu gravar o protocolo.");
    try { await ensureInterBillingWebhook(); } catch (error) { console.error("Falha ao configurar notificações do Inter:", error); }
    revalidatePath("/cobrancas");
    return { success: "Solicitação enviada ao Inter. Aguarde a confirmação do registro do boleto." };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao emitir no Inter.";
    const definitelyRejected = /HTTP (400|401|403|404|422)\b/.test(message) || message.startsWith("Configure as credenciais");
    await db.from("inter_cobrancas")
      .update({ status: definitelyRejected ? "failed" : "uncertain", erro: message, updated_at: new Date().toISOString() })
      .eq("id", billId).eq("status", "submitting");
    revalidatePath("/cobrancas");
    return { error: definitelyRejected ? message : `${message} A emissão ficou pendente de conferência para evitar cobrança duplicada.` };
  }
}

export async function cancelInterBillingAction(_previous: InterIssueState, data: FormData): Promise<InterIssueState> {
  const actor = await requireRole(["bdl_admin"]);
  const id = String(data.get("inter_id") ?? "");
  const reason = String(data.get("motivo") ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { error: "Boleto inválido." };
  if (reason.length < 3) return { error: "Informe o motivo do cancelamento." };
  const db = createSupabaseServerClient();
  const { data: bill } = await db.from("inter_cobrancas")
    .select("codigo_solicitacao,status,situacao")
    .eq("id", id).single();
  if (!bill?.codigo_solicitacao || ["cancelled", "failed", "expired", "cancelling"].includes(bill.status))
    return { error: "Este boleto não pode ser cancelado." };
  try {
    const situation = await syncInterBilling(id);
    if (situation === "RECEBIDO" || situation === "CANCELADO") {
      revalidatePath("/cobrancas");
      return { error: situation === "RECEBIDO" ? "O boleto já foi pago." : "O boleto já está cancelado." };
    }
    await cancelInterBilling(bill.codigo_solicitacao, reason);
    const { error: updateError } = await db.from("inter_cobrancas").update({
      status: "cancelling", cancelamento_motivo: reason,
      cancelamento_solicitado_em: new Date().toISOString(), cancelado_por: actor.id, updated_at: new Date().toISOString(),
    }).eq("id", id).neq("status", "cancelled");
    if (updateError) throw new Error("O Inter recebeu o pedido, mas o app não conseguiu registrar o cancelamento. Confira o boleto antes de tentar novamente.");
    try { await syncInterBilling(id); } catch { /* a consulta periódica confirmará o resultado */ }
    revalidatePath("/cobrancas");
    revalidatePath("/empresas/[id]", "page");
    return { success: "Cancelamento solicitado. Aguarde a confirmação do Inter antes de ajustar a mensalidade." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Falha ao cancelar o boleto." };
  }
}

export async function refreshStaleInterBillingsAction(): Promise<boolean> {
  await requireRole(["bdl_admin"]);
  try { await ensureInterBillingWebhook(); } catch (error) { console.error("Falha ao configurar notificações do Inter:", error); }
  const db = createSupabaseServerClient();
  const staleBefore = new Date(Date.now() - 5 * 60_000).toISOString();
  const { data: bills, error } = await db.from("inter_cobrancas")
    .select("id")
    .in("status", ["submitted", "cancelling", "uncertain"])
    .or("situacao.is.null,situacao.neq.RECEBIDO")
    .or(`consultado_em.is.null,consultado_em.lt.${staleBefore}`)
    .order("consultado_em", { ascending: true, nullsFirst: true })
    .limit(5);
  if (error || !bills?.length) return false;
  let updated = false;
  for (const bill of bills) {
    try { await syncInterBilling(bill.id); updated = true; }
    catch { /* a próxima conciliação tenta novamente */ }
  }
  if (updated) {
    revalidatePath("/cobrancas");
    revalidatePath("/empresas/[id]", "page");
  }
  return updated;
}

export async function retryInterBillingEmailAction(_previous: InterIssueState, data: FormData): Promise<InterIssueState> {
  await requireRole(["bdl_admin"]);
  const id = String(data.get("email_id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { error: "E-mail inválido." };
  const db = createSupabaseServerClient();
  const { data: email } = await db.from("inter_cobranca_emails")
    .select("id,inter_cobranca_id,status").eq("id", id).single();
  if (!email || email.status !== "failed") return { error: "Este e-mail não está disponível para reenvio." };
  const { error: resetError } = await db.from("inter_cobranca_emails")
    .update({ status: "pending", tentativas: 0, updated_at: new Date().toISOString() })
    .eq("id", id).eq("status", "failed");
  if (resetError) return { error: "Não foi possível preparar o reenvio." };
  try { await processInterBillingEmailsForBill(email.inter_cobranca_id); }
  catch { return { error: "Não foi possível processar o reenvio. Tente novamente." }; }
  const { data: result } = await db.from("inter_cobranca_emails")
    .select("status,ultimo_erro").eq("id", id).single();
  revalidatePath("/cobrancas");
  revalidatePath("/empresas/[id]", "page");
  return result?.status === "sent"
    ? { success: "E-mail reenviado ao destinatário." }
    : { error: result?.ultimo_erro ?? "O e-mail ainda não pôde ser enviado." };
}
