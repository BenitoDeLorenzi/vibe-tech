import "server-only";

import nodemailer from "nodemailer";
import { retrieveInterBillingPdf } from "@/lib/inter-client";
import { buildInterBillEmail, buildInterPaymentEmail } from "@/lib/inter-billing-email-template";
import { createSupabaseServerClient } from "@/lib/supabase-server";

const sender = "vibe.tech.gestao@gmail.com";
type EmailRow = { id: string; inter_cobranca_id: string; tipo: "boleto_empresa" | "pagamento_vibe"; status: string };

async function processEmail(row: EmailRow) {
  const db = createSupabaseServerClient();
  const { data: bill } = await db.from("inter_cobrancas")
    .select("id,pagamento_id,status,situacao,codigo_solicitacao,linha_digitavel,pix_copia_e_cola,valor,vencimento,valor_recebido,recebido_em,origem_recebimento,email_automatico")
    .eq("id", row.inter_cobranca_id).single();
  if (!bill?.email_automatico || !bill.codigo_solicitacao) return;
  if (row.tipo === "boleto_empresa" && ["cancelled", "failed", "expired", "cancelling"].includes(bill.status)) {
    await db.from("inter_cobranca_emails").update({ status: "skipped", ultimo_erro: "Boleto cancelado antes do envio." }).eq("id", row.id);
    return;
  }
  if (row.tipo === "boleto_empresa" && bill.situacao === "RECEBIDO") {
    await db.from("inter_cobranca_emails").update({ status: "skipped", ultimo_erro: "Boleto pago antes do envio." }).eq("id", row.id);
    return;
  }
  if (row.tipo === "boleto_empresa" && (!["A_RECEBER", "ATRASADO"].includes(bill.situacao ?? "") || !bill.linha_digitavel || !bill.pix_copia_e_cola)) return;
  if (row.tipo === "pagamento_vibe" && (bill.situacao !== "RECEBIDO" || !bill.valor_recebido || !bill.recebido_em)) return;

  const { data: payment } = await db.from("licenca_pagamentos")
    .select("prefeitura_id,modulo_id,competencia")
    .eq("id", bill.pagamento_id).single();
  if (!payment) return;
  const [{ data: company }, { data: module }] = await Promise.all([
    db.from("empresas").select("nome,email_cobranca").eq("id", payment.prefeitura_id).single(),
    db.from("modulos").select("nome").eq("id", payment.modulo_id).single(),
  ]);
  if (!company || !module) return;
  const recipient = row.tipo === "boleto_empresa" ? company.email_cobranca?.trim() : sender;
  if (!recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
    await db.from("inter_cobranca_emails").update({ ultimo_erro: "E-mail de cobrança inválido ou ausente." }).eq("id", row.id);
    return;
  }

  let pdf: Buffer | undefined;
  if (row.tipo === "boleto_empresa") {
    for (let attempt = 0; attempt < 3 && !pdf; attempt++) {
      try { pdf = await retrieveInterBillingPdf(bill.codigo_solicitacao); }
      catch { if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 2000)); }
    }
    if (!pdf) {
      await db.from("inter_cobranca_emails").update({ ultimo_erro: "PDF ainda não disponível no Inter." }).eq("id", row.id);
      return;
    }
  }
  const { data: previous } = row.tipo === "boleto_empresa"
    ? await db.from("inter_cobrancas").select("id").eq("pagamento_id", bill.pagamento_id).neq("id", bill.id).eq("status", "cancelled").limit(1)
    : { data: [] as { id: string }[] };
  const message = row.tipo === "boleto_empresa"
    ? buildInterBillEmail({
      empresa: company.nome, modulo: module.nome, competencia: payment.competencia,
      valor: Number(bill.valor), vencimento: bill.vencimento,
      linhaDigitavel: bill.linha_digitavel!, pix: bill.pix_copia_e_cola!,
      substituiAnterior: Boolean(previous?.length),
    })
    : buildInterPaymentEmail({
      empresa: company.nome, modulo: module.nome, competencia: payment.competencia,
      valor: Number(bill.valor_recebido), recebidoEm: bill.recebido_em!,
      origem: bill.origem_recebimento === "PIX" ? "Pix" : bill.origem_recebimento === "BOLETO" ? "Boleto" : "Inter",
      protocolo: bill.codigo_solicitacao, diferente: Number(bill.valor_recebido) !== Number(bill.valor),
    });

  const { data: claimed, error: claimError } = await db.rpc("claim_inter_billing_email", { p_id: row.id });
  if (claimError || !claimed) return;
  try {
    const password = process.env.VIBE_GMAIL_APP_PASSWORD;
    if (!password) throw new Error("Envio de e-mail não configurado na Vercel.");
    const result = await nodemailer.createTransport({
      host: "smtp.gmail.com", port: 465, secure: true,
      auth: { user: sender, pass: password },
    }).sendMail({
      from: `Vibe Tech LTDA <${sender}>`, to: recipient,
      subject: message.subject, html: message.html, text: message.text,
      ...(pdf ? { attachments: [{ filename: `boleto-vibe-tech-${payment.competencia.slice(0, 7)}.pdf`, content: pdf, contentType: "application/pdf" }] } : {}),
    });
    if (!result.accepted?.some(address => address.toLowerCase() === recipient.toLowerCase()))
      throw new Error("O servidor de e-mail não confirmou o destinatário.");
    const { error: saveError } = await db.from("inter_cobranca_emails").update({
      status: "sent", destinatario: recipient, enviado_em: new Date().toISOString(),
      ultimo_erro: null, updated_at: new Date().toISOString(),
    }).eq("id", row.id).eq("status", "sending");
    if (saveError) throw new Error("E-mail aceito pelo servidor, mas o app não conseguiu registrar o envio.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha no envio de e-mail.";
    await db.from("inter_cobranca_emails").update({
      status: message.includes("aceito pelo servidor") ? "sending" : "failed",
      destinatario: recipient, ultimo_erro: message.slice(0, 500), updated_at: new Date().toISOString(),
    }).eq("id", row.id).eq("status", "sending");
  }
}

export async function processInterBillingEmailsForBill(id: string) {
  const { data, error } = await createSupabaseServerClient().from("inter_cobranca_emails")
    .select("id,inter_cobranca_id,tipo,status")
    .eq("inter_cobranca_id", id).in("status", ["pending", "failed"]);
  if (error) throw new Error("Não foi possível consultar a fila de e-mails do boleto.");
  for (const row of data ?? []) await processEmail(row as EmailRow);
}

export async function processPendingInterBillingEmails(limit = 20) {
  const { data, error } = await createSupabaseServerClient().from("inter_cobranca_emails")
    .select("id,inter_cobranca_id,tipo,status")
    .in("status", ["pending", "failed"]).lt("tentativas", 5)
    .order("created_at", { ascending: true }).limit(limit);
  if (error) throw new Error("Não foi possível consultar a fila de e-mails do Inter.");
  for (const row of data ?? []) await processEmail(row as EmailRow);
  return data?.length ?? 0;
}
