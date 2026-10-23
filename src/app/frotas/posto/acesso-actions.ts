"use server";

import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import nodemailer from "nodemailer";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getPostoSession, hashPostoPassword } from "@/lib/posto-auth";
import { buildFirstAccessOtpEmail, buildPasswordRecoveryOtpEmail } from "@/lib/otp-email";

const invalidCode = "Código expirado, inválido ou limite de tentativas atingido. Solicite outro código.";
const normalizeCnpj = (value: string) => value.replace(/\D/g, "");
const validEmail = (value: string) => value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const validPhone = (value: string) => !value || /^\d{10,11}$/.test(value.replace(/\D/g, ""));
const hashToken = (value: string) => createHash("sha256").update(value).digest("hex");

function codeHash(postoId: string, purpose: string, email: string, code: string) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Supabase service role key is not configured.");
  return createHmac("sha256", secret).update(`posto:${postoId}:${purpose}:${email}:${code}`).digest("hex");
}

async function sendCode(posto: { id: string; nome: string }, email: string, purpose: "primeiro_acesso" | "recuperacao") {
  const password = process.env.VIBE_GMAIL_APP_PASSWORD;
  if (!password) return { error: "O envio de e-mail não está configurado. Fale com a Vibe Tech." };
  const db = createSupabaseServerClient();
  const { data: previous, error: previousError } = await db.from("frota_posto_codigos")
    .select("criado_em").eq("posto_id", posto.id).maybeSingle();
  if (previousError) return { error: "Não foi possível preparar o código. Tente novamente." };
  if (previous && Date.now() - Date.parse(previous.criado_em) < 60_000)
    return { error: "Aguarde um minuto antes de solicitar outro código." };

  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  const digest = codeHash(posto.id, purpose, email, code);
  const { error } = await db.from("frota_posto_codigos").upsert({
    posto_id: posto.id, finalidade: purpose, email, codigo_hash: digest,
    criado_em: new Date().toISOString(), expira_em: new Date(Date.now() + 600_000).toISOString(),
    tentativas: 0, verificado_em: null, reset_token_hash: null, reset_expira_em: null,
  }, { onConflict: "posto_id" });
  if (error) return { error: "Não foi possível preparar o código. Tente novamente." };

  try {
    await nodemailer.createTransport({
      host: "smtp.gmail.com", port: 465, secure: true,
      auth: { user: "vibe.tech.gestao@gmail.com", pass: password },
    }).sendMail({
      from: 'Vibe Tech <vibe.tech.gestao@gmail.com>', to: email,
      subject: purpose === "primeiro_acesso" ? "Confirme o acesso do posto — Vibe Tech" : "Recuperação de senha do posto — Vibe Tech",
      ...(purpose === "primeiro_acesso" ? buildFirstAccessOtpEmail(posto.nome, code) : buildPasswordRecoveryOtpEmail(posto.nome, code)),
    });
  } catch {
    await db.from("frota_posto_codigos").delete().eq("posto_id", posto.id).eq("codigo_hash", digest);
    return { error: "Não foi possível enviar o código. Tente novamente mais tarde." };
  }
  return { success: "Enviamos um código de seis dígitos para o e-mail informado." };
}

async function reserveAttempt(postoId: string, purpose: "primeiro_acesso" | "recuperacao", code: string) {
  if (!/^\d{6}$/.test(code)) return null;
  const db = createSupabaseServerClient();
  const { data, error } = await db.rpc("registrar_tentativa_codigo_posto", {
    p_posto_id: postoId, p_finalidade: purpose,
  });
  const row = data?.[0];
  if (error || !row) return null;
  const actual = Buffer.from(codeHash(postoId, purpose, row.email, code), "hex");
  const expected = Buffer.from(row.codigo_hash, "hex");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  return row as { codigo_hash: string; email: string; tentativas: number };
}

export async function prepararPrimeiroAcessoPosto(input: {
  email: string; endereco: string; telefone: string; novaSenha: string; confirmacao: string;
}) {
  const session = await getPostoSession();
  if (!session) return { error: "Entre com o CNPJ e a senha do posto para continuar." };
  const db = createSupabaseServerClient();
  const { data: posto } = await db.from("frota_postos_credenciados")
    .select("id,nome,primeiro_acesso_concluido_em").eq("id", session.id).eq("status", "active").maybeSingle();
  if (!posto || posto.primeiro_acesso_concluido_em) return { error: "Este primeiro acesso já foi concluído." };
  const email = String(input.email ?? "").trim().toLowerCase();
  const endereco = String(input.endereco ?? "").trim();
  const telefone = String(input.telefone ?? "").trim();
  const senha = String(input.novaSenha ?? "");
  if (!validEmail(email)) return { error: "Informe um e-mail válido para o posto." };
  if (!endereco) return { error: "Informe o endereço do posto." };
  if (!validPhone(telefone)) return { error: "Informe um telefone com DDD válido." };
  if (senha.length < 8 || senha.length > 128) return { error: "A nova senha deve ter entre 8 e 128 caracteres." };
  if (senha !== input.confirmacao) return { error: "As senhas não coincidem." };
  const { data: lastCode, error: lastCodeError } = await db.from("frota_posto_codigos")
    .select("criado_em").eq("posto_id", posto.id).maybeSingle();
  if (lastCodeError) return { error: "Não foi possível consultar o código. Tente novamente." };
  if (lastCode && Date.now() - Date.parse(lastCode.criado_em) < 60_000)
    return { error: "Aguarde um minuto antes de solicitar outro código." };
  const { error } = await db.from("frota_postos_credenciados").update({
    email_contato: email, email_verificado_em: null, endereco,
    telefone: telefone || null, senha_hash: hashPostoPassword(senha), updated_at: new Date().toISOString(),
  }).eq("id", posto.id).is("primeiro_acesso_concluido_em", null);
  if (error) return { error: error.code === "23505" ? "Este e-mail já está em uso por outro posto." : "Não foi possível salvar os dados. Tente novamente." };
  return sendCode(posto, email, "primeiro_acesso");
}

export async function reenviarPrimeiroAcessoPosto() {
  const session = await getPostoSession();
  if (!session) return { error: "Entre novamente para continuar." };
  const db = createSupabaseServerClient();
  const { data: posto } = await db.from("frota_postos_credenciados")
    .select("id,nome,email_contato,primeiro_acesso_concluido_em")
    .eq("id", session.id).eq("status", "active").maybeSingle();
  if (!posto?.email_contato || posto.primeiro_acesso_concluido_em) return { error: "Informe seus dados antes de solicitar o código." };
  return sendCode(posto, posto.email_contato, "primeiro_acesso");
}

export async function confirmarPrimeiroAcessoPosto(code: string) {
  const session = await getPostoSession();
  if (!session) return { error: "Entre novamente para continuar." };
  const attempt = await reserveAttempt(session.id, "primeiro_acesso", code);
  if (!attempt) return { error: invalidCode };
  const db = createSupabaseServerClient();
  const { data: consumed } = await db.from("frota_posto_codigos").delete()
    .eq("posto_id", session.id).eq("finalidade", "primeiro_acesso")
    .eq("codigo_hash", attempt.codigo_hash).eq("tentativas", attempt.tentativas)
    .gt("expira_em", new Date().toISOString()).select("posto_id").maybeSingle();
  if (!consumed) return { error: invalidCode };
  const now = new Date().toISOString();
  const { data: updated, error } = await db.from("frota_postos_credenciados").update({
    email_verificado_em: now, primeiro_acesso_concluido_em: now, updated_at: now,
  }).eq("id", session.id).eq("email_contato", attempt.email).eq("status", "active")
    .is("primeiro_acesso_concluido_em", null).select("id").maybeSingle();
  if (error || !updated) return { error: "Não foi possível concluir o acesso. Solicite outro código." };
  redirect("/frotas/posto");
}

export async function solicitarRecuperacaoPosto(cnpjInput: string) {
  const cnpj = normalizeCnpj(cnpjInput);
  if (!/^\d{14}$/.test(cnpj)) return { error: "Informe um CNPJ com 14 dígitos." };
  const db = createSupabaseServerClient();
  const { data: posto, error } = await db.from("frota_postos_credenciados")
    .select("id,nome,email_contato,email_verificado_em,primeiro_acesso_concluido_em")
    .in("cnpj", [cnpj, cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")])
    .eq("status", "active").maybeSingle();
  if (error) return { error: "Não foi possível consultar o posto. Tente novamente." };
  if (!posto) return { error: "Não há posto cadastrado com este CNPJ." };
  if (!posto.email_contato || !posto.email_verificado_em || !posto.primeiro_acesso_concluido_em)
    return { error: "Este posto ainda não possui e-mail verificado. Fale com o responsável pelo cadastro." };
  return sendCode(posto, posto.email_contato, "recuperacao");
}

export async function verificarRecuperacaoPosto(cnpjInput: string, code: string) {
  const cnpj = normalizeCnpj(cnpjInput);
  if (!/^\d{14}$/.test(cnpj)) return { error: "Confira o CNPJ e o código." };
  const db = createSupabaseServerClient();
  const { data: posto } = await db.from("frota_postos_credenciados")
    .select("id,email_contato,email_verificado_em,primeiro_acesso_concluido_em")
    .in("cnpj", [cnpj, cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")])
    .eq("status", "active").maybeSingle();
  if (!posto?.email_contato || !posto.email_verificado_em || !posto.primeiro_acesso_concluido_em)
    return { error: invalidCode };
  const attempt = await reserveAttempt(posto.id, "recuperacao", code);
  if (!attempt || attempt.email !== posto.email_contato) return { error: invalidCode };
  const token = randomBytes(32).toString("hex");
  const { data: verified, error } = await db.from("frota_posto_codigos").update({
    verificado_em: new Date().toISOString(), reset_token_hash: hashToken(token),
    reset_expira_em: new Date(Date.now() + 600_000).toISOString(),
  }).eq("posto_id", posto.id).eq("finalidade", "recuperacao")
    .eq("codigo_hash", attempt.codigo_hash).eq("tentativas", attempt.tentativas)
    .is("verificado_em", null).gt("expira_em", new Date().toISOString())
    .select("posto_id").maybeSingle();
  if (error || !verified) return { error: invalidCode };
  return { resetToken: token };
}

export async function redefinirSenhaPosto(input: { resetToken: string; novaSenha: string; confirmacao: string }) {
  const token = String(input.resetToken ?? "");
  const senha = String(input.novaSenha ?? "");
  if (!/^[a-f0-9]{64}$/.test(token)) return { error: "Sua verificação expirou. Solicite outro código." };
  if (senha.length < 8 || senha.length > 128) return { error: "A nova senha deve ter entre 8 e 128 caracteres." };
  if (senha !== input.confirmacao) return { error: "As senhas não coincidem." };
  const db = createSupabaseServerClient();
  const { data: consumed, error } = await db.from("frota_posto_codigos").delete()
    .eq("finalidade", "recuperacao").eq("reset_token_hash", hashToken(token))
    .gt("reset_expira_em", new Date().toISOString()).select("posto_id,email").maybeSingle();
  if (error || !consumed) return { error: "Sua verificação expirou ou já foi usada. Solicite outro código." };
  const { data: updated, error: updateError } = await db.from("frota_postos_credenciados")
    .update({ senha_hash: hashPostoPassword(senha), sessao_revogada_em: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", consumed.posto_id).eq("email_contato", consumed.email)
    .eq("status", "active").not("email_verificado_em", "is", null)
    .select("id").maybeSingle();
  if (updateError || !updated) return { error: "O e-mail do posto mudou. Solicite outro código." };
  return { success: "Senha redefinida. Entre com a nova senha." };
}
