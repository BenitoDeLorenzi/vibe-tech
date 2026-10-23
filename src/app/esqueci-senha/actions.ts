"use server";

import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import nodemailer from "nodemailer";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { buildPasswordRecoveryOtpEmail } from "@/lib/otp-email";

function hashCode(userId: string, email: string, code: string) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Supabase service role key is not configured.");
  return createHmac("sha256", secret)
    .update(`password-recovery:${userId}:${email}:${code}`)
    .digest("hex");
}

function normalizeCpf(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}

function hashResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function solicitarCodigoRecuperacao(cpfInput: string) {
  const cpf = normalizeCpf(cpfInput);
  if (!/^\d{11}$/.test(cpf)) return { error: "Informe um CPF com 11 dígitos." };

  const db = createSupabaseServerClient();
  const { data: profile, error } = await db.from("perfis")
    .select("id,nome,email_contato,email_contato_verificado_em,primeiro_acesso_concluido_em")
    .eq("cpf", cpf).eq("ativo", true).is("excluido_em", null).maybeSingle();
  if (error) return { error: "Não foi possível consultar sua conta. Tente novamente." };
  if (!profile) return { error: "Não há usuário cadastrado com este CPF" };
  if (!profile.email_contato || !profile.email_contato_verificado_em || !profile.primeiro_acesso_concluido_em)
    return { error: "Esta conta não possui e-mail verificado. Fale com o Master para recuperar o acesso." };

  const appPassword = process.env.VIBE_GMAIL_APP_PASSWORD;
  if (!appPassword) return { error: "O envio de e-mail não está configurado. Fale com a Vibe Tech." };

  const { data: previous, error: previousError } = await db.from("perfil_senha_recuperacoes")
    .select("criado_em").eq("usuario_id", profile.id).maybeSingle();
  if (previousError) return { error: "Não foi possível preparar o código. Tente novamente." };
  if (previous && Date.now() - new Date(previous.criado_em).getTime() < 60_000)
    return { error: "Aguarde um minuto antes de solicitar outro código." };

  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  const tokenHash = hashCode(profile.id, profile.email_contato, code);
  const { error: tokenError } = await db.from("perfil_senha_recuperacoes").upsert({
    usuario_id: profile.id,
    email: profile.email_contato,
    token_hash: tokenHash,
    criado_em: new Date().toISOString(),
    expira_em: new Date(Date.now() + 10 * 60_000).toISOString(),
    tentativas: 0,
    verificado_em: null,
    reset_token_hash: null,
    reset_expira_em: null,
  }, { onConflict: "usuario_id" });
  if (tokenError) return { error: "Não foi possível preparar o código. Tente novamente." };

  try {
    await nodemailer.createTransport({
      host: "smtp.gmail.com", port: 465, secure: true,
      auth: { user: "vibe.tech.gestao@gmail.com", pass: appPassword },
    }).sendMail({
      from: 'Vibe Tech <vibe.tech.gestao@gmail.com>',
      to: profile.email_contato,
      subject: "Código para redefinir sua senha — Vibe Tech",
      ...buildPasswordRecoveryOtpEmail(profile.nome, code),
    });
  } catch {
    await db.from("perfil_senha_recuperacoes")
      .delete().eq("usuario_id", profile.id).eq("token_hash", tokenHash);
    return { error: "Não foi possível enviar o código. Tente novamente mais tarde." };
  }
  return { success: "Enviamos um código para o e-mail verificado da sua conta." };
}

export async function verificarCodigoRecuperacao(input: {
  cpf: string;
  codigo: string;
}) {
  const cpf = normalizeCpf(input?.cpf);
  const code = String(input?.codigo ?? "");
  if (!/^\d{11}$/.test(cpf) || !/^\d{6}$/.test(code))
    return { error: "Confira o CPF e o código de seis dígitos." };

  const db = createSupabaseServerClient();
  const { data: profile, error: profileError } = await db.from("perfis")
    .select("id,email_contato,email_contato_verificado_em,primeiro_acesso_concluido_em")
    .eq("cpf", cpf).eq("ativo", true).is("excluido_em", null).maybeSingle();
  if (profileError || !profile?.email_contato || !profile.email_contato_verificado_em || !profile.primeiro_acesso_concluido_em)
    return { error: "Não foi possível validar esta conta. Fale com o Master." };

  const { data: attempts, error: tokenError } = await db.rpc("registrar_tentativa_recuperacao", {
    p_usuario_id: profile.id,
  });
  const token = attempts?.[0];
  if (tokenError) return { error: "Não foi possível validar o código. Tente novamente." };
  if (!token || token.email !== profile.email_contato)
    return { error: "Código expirado, inválido ou limite de tentativas atingido. Solicite outro código." };

  const received = Buffer.from(hashCode(profile.id, token.email, code), "hex");
  const expected = Buffer.from(token.token_hash, "hex");
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return { error: "Código incorreto. Confira o e-mail e tente novamente." };
  }

  const resetToken = randomBytes(32).toString("hex");
  const now = new Date();
  const { data: verified, error: verifyError } = await db.from("perfil_senha_recuperacoes")
    .update({
      verificado_em: now.toISOString(),
      reset_token_hash: hashResetToken(resetToken),
      reset_expira_em: new Date(now.getTime() + 10 * 60_000).toISOString(),
    })
    .eq("usuario_id", profile.id).eq("token_hash", token.token_hash)
    .eq("email", profile.email_contato).eq("tentativas", token.tentativas)
    .is("verificado_em", null).gt("expira_em", now.toISOString())
    .select("usuario_id").maybeSingle();
  if (verifyError || !verified) return { error: "Este código já foi usado. Solicite outro código." };

  return { resetToken };
}

export async function redefinirSenhaVerificada(input: {
  resetToken: string;
  novaSenha: string;
  confirmacao: string;
}) {
  const resetToken = String(input?.resetToken ?? "");
  const newPassword = String(input?.novaSenha ?? "");
  const confirmation = String(input?.confirmacao ?? "");
  if (!/^[a-f0-9]{64}$/.test(resetToken))
    return { error: "Sua verificação expirou. Solicite outro código." };
  if (newPassword.length < 8 || newPassword.length > 128)
    return { error: "A nova senha deve ter entre 8 e 128 caracteres." };
  if (newPassword !== confirmation)
    return { error: "As senhas não coincidem." };

  const db = createSupabaseServerClient();
  const { data: consumed, error: consumeError } = await db.from("perfil_senha_recuperacoes")
    .delete().eq("reset_token_hash", hashResetToken(resetToken))
    .gt("reset_expira_em", new Date().toISOString())
    .select("usuario_id,email").maybeSingle();
  if (consumeError || !consumed) return { error: "Sua verificação expirou ou já foi usada. Solicite outro código." };

  const { data: current, error: currentError } = await db.from("perfis")
    .select("email_contato,email_contato_verificado_em")
    .eq("id", consumed.usuario_id).eq("ativo", true).is("excluido_em", null).maybeSingle();
  if (currentError || !current || current.email_contato !== consumed.email || !current.email_contato_verificado_em)
    return { error: "O e-mail da conta mudou. Solicite outro código." };

  const { error: updateError } = await db.auth.admin.updateUserById(consumed.usuario_id, {
    password: newPassword,
  });
  if (updateError) return { error: "Não foi possível redefinir a senha. Solicite outro código e tente novamente." };
  return { success: "Senha redefinida com sucesso. Entre com a nova senha." };
}
