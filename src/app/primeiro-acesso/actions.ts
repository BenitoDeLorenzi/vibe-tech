"use server";

import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import nodemailer from "nodemailer";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuthenticatedProfile } from "@/lib/auth-data";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { buildFirstAccessOtpEmail } from "@/lib/otp-email";
import { CONTACT_EMAIL_IN_USE, isContactEmailInUse, isContactEmailUniqueViolation } from "@/lib/contact-email";

export type FirstAccessState = { error?: string; success?: string; senhaAlterada?: boolean };
export type CodeState = { error?: string };

function codeHash(userId: string, email: string, code: string) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Supabase service role key is not configured.");
  return createHmac("sha256", secret).update(`${userId}:${email}:${code}`).digest("hex");
}

export async function salvarPrimeiroAcesso(
  _previousState: FirstAccessState,
  formData: FormData,
): Promise<FirstAccessState> {
  const profile = await requireAuthenticatedProfile();
  if (profile.primeiro_acesso_concluido_em) return { error: "Seu primeiro acesso já foi concluído." };
  const email = String(profile.senha_inicial_alterada_em ? profile.email_contato : formData.get("email") ?? "").trim().toLowerCase();
  const telefone = String(profile.senha_inicial_alterada_em ? profile.telefone ?? "" : formData.get("telefone") ?? "").trim();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Informe um e-mail válido." };
  if (telefone && !/^(?:\(\d{2}\) \d{4,5}-\d{4}|\d{10,11})$/.test(telefone)) return { error: "Informe um telefone com DDD válido." };
  const appPassword = process.env.VIBE_GMAIL_APP_PASSWORD;
  if (!appPassword) return { error: "O envio de e-mail ainda não está configurado. Fale com a Vibe Tech." };

  try {
    if (await isContactEmailInUse(email, profile.id)) return { error: CONTACT_EMAIL_IN_USE };
  } catch {
    return { error: "Não foi possível verificar o e-mail. Tente novamente." };
  }

  const db = createSupabaseServerClient();
  const { data: lastSend } = await db.from("perfil_email_confirmacoes")
    .select("criado_em").eq("usuario_id", profile.id).order("criado_em", { ascending: false }).limit(1).maybeSingle();
  if (lastSend && Date.now() - new Date(lastSend.criado_em).getTime() < 60_000) {
    return { error: "Aguarde um minuto antes de solicitar outro código." };
  }

  if (!profile.senha_inicial_alterada_em) {
    const nova = String(formData.get("nova_senha") ?? "");
    const confirmacao = String(formData.get("confirmacao") ?? "");
    if (nova.length < 8 || nova.length > 128) return { error: "A nova senha deve ter entre 8 e 128 caracteres." };
    if (nova !== confirmacao) return { error: "As senhas não coincidem." };
    const auth = await createSupabaseAuthServerClient();
    const { error } = await auth.auth.updateUser({ password: nova });
    if (error) return { error: "Não foi possível alterar a senha. Tente novamente." };
  }

  const emailChanged = profile.email_contato !== email;
  const { error: profileError } = await db.from("perfis").update({
    telefone: telefone || null,
    email_contato: email,
    ...(emailChanged ? { email_contato_verificado_em: null } : {}),
    senha_inicial_alterada_em: profile.senha_inicial_alterada_em ?? new Date().toISOString(),
  }).eq("id", profile.id).is("primeiro_acesso_concluido_em", null);
  if (profileError) return { error: isContactEmailUniqueViolation(profileError) ? CONTACT_EMAIL_IN_USE : "Não foi possível salvar seus dados. Tente novamente.", senhaAlterada: true };

  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  const tokenHash = codeHash(profile.id, email, code);
  await db.from("perfil_email_confirmacoes").delete().eq("usuario_id", profile.id);
  const { error: tokenError } = await db.from("perfil_email_confirmacoes").insert({
    token_hash: tokenHash, usuario_id: profile.id, email,
    expira_em: new Date(Date.now() + 10 * 60_000).toISOString(),
  });
  if (tokenError) return { error: "Dados salvos, mas não foi possível preparar o código. Tente reenviar.", senhaAlterada: true };

  try {
    const emailContent = buildFirstAccessOtpEmail(profile.nome, code);
    await nodemailer.createTransport({
      host: "smtp.gmail.com", port: 465, secure: true,
      auth: { user: "vibe.tech.gestao@gmail.com", pass: appPassword },
    }).sendMail({
      from: 'Vibe Tech <vibe.tech.gestao@gmail.com>', to: email,
      subject: "Código de verificação — Vibe Tech",
      ...emailContent,
    });
  } catch {
    await db.from("perfil_email_confirmacoes").delete().eq("token_hash", tokenHash);
    return { error: "Dados salvos, mas o e-mail não pôde ser enviado. Tente novamente mais tarde.", senhaAlterada: true };
  }
  revalidatePath("/primeiro-acesso");
  return { success: "Enviamos um código de seis dígitos. Verifique também a pasta de spam.", senhaAlterada: true };
}

export async function reenviarCodigoPrimeiroAcesso(_previousState: FirstAccessState): Promise<FirstAccessState> {
  void _previousState;
  return salvarPrimeiroAcesso({}, new FormData());
}

export async function confirmarCodigoPrimeiroAcesso(_previousState: CodeState, formData: FormData): Promise<CodeState> {
  const profile = await requireAuthenticatedProfile();
  if (profile.primeiro_acesso_concluido_em) redirect("/portal");
  const code = String(formData.get("codigo") ?? "").trim();
  if (!/^\d{6}$/.test(code)) return { error: "Informe os seis dígitos do código." };
  if (!profile.email_contato || !profile.senha_inicial_alterada_em) return { error: "Salve seus dados antes de confirmar o código." };

  const db = createSupabaseServerClient();
  const { data: confirmation, error } = await db.from("perfil_email_confirmacoes")
    .select("token_hash,email,expira_em,tentativas").eq("usuario_id", profile.id)
    .order("criado_em", { ascending: false }).limit(1).maybeSingle();
  if (error || !confirmation || confirmation.email !== profile.email_contato || new Date(confirmation.expira_em).getTime() < Date.now()) {
    return { error: "Código expirado ou inválido. Solicite um novo código." };
  }
  if (confirmation.tentativas >= 5) return { error: "Limite de tentativas atingido. Solicite um novo código." };
  const received = Buffer.from(codeHash(profile.id, confirmation.email, code), "hex");
  const expected = Buffer.from(confirmation.token_hash, "hex");
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    await db.from("perfil_email_confirmacoes").update({ tentativas: confirmation.tentativas + 1 })
      .eq("token_hash", confirmation.token_hash).eq("tentativas", confirmation.tentativas);
    return { error: "Código incorreto. Confira o e-mail e tente novamente." };
  }

  const { data: updated, error: updateError } = await db.from("perfis")
    .update({ email_contato_verificado_em: new Date().toISOString(), primeiro_acesso_concluido_em: new Date().toISOString() })
    .eq("id", profile.id).eq("email_contato", confirmation.email).eq("ativo", true)
    .is("primeiro_acesso_concluido_em", null).not("senha_inicial_alterada_em", "is", null)
    .select("id").maybeSingle();
  if (updateError || !updated) return { error: "Não foi possível concluir o primeiro acesso. Tente novamente." };
  await db.from("perfil_email_confirmacoes").delete().eq("usuario_id", profile.id);
  revalidatePath("/portal");
  redirect("/portal");
}
