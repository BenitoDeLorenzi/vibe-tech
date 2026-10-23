"use server";
import { createHmac, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import nodemailer from "nodemailer";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { requireAuthenticatedProfile, requireUserProfile } from "@/lib/auth-data";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";
import { buildProfileVerificationOtpEmail } from "@/lib/otp-email";

function emailCodeHash(userId: string, email: string, code: string) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Supabase service role key is not configured.");
  return createHmac("sha256", secret).update(`${userId}:${email}:${code}`).digest("hex");
}

export async function consultarCodigoVerificacaoPerfil() {
  const profile = await requireUserProfile();
  const db = createSupabaseServerClient();
  const { data: current, error: profileError } = await db.from("perfis")
    .select("email_contato,email_contato_verificado_em")
    .eq("id", profile.id).eq("ativo", true).is("excluido_em", null).single();
  if (profileError) throw new Error("Não foi possível consultar a verificação do e-mail.");
  if (!current?.email_contato || current.email_contato_verificado_em)
    return { pending: false };

  const { data: confirmation, error } = await db.from("perfil_email_confirmacoes")
    .select("email,expira_em,tentativas").eq("usuario_id", profile.id)
    .order("criado_em", { ascending: false }).limit(1).maybeSingle();
  if (error) throw new Error("Não foi possível consultar o código.");
  return {
    pending: Boolean(
      confirmation &&
      confirmation.email === current.email_contato &&
      new Date(confirmation.expira_em).getTime() > Date.now() &&
      confirmation.tentativas < 5,
    ),
  };
}

export async function enviarCodigoVerificacaoPerfil() {
  const profile = await requireUserProfile();
  const db = createSupabaseServerClient();
  const { data: current, error: profileError } = await db.from("perfis")
    .select("nome,email_contato,email_contato_verificado_em")
    .eq("id", profile.id).eq("ativo", true).is("excluido_em", null).single();
  if (profileError || !current?.email_contato) return { error: "Seu e-mail não está cadastrado. Fale com o Master." };
  if (current.email_contato_verificado_em) return { error: "Este e-mail já está verificado." };
  const appPassword = process.env.VIBE_GMAIL_APP_PASSWORD;
  if (!appPassword) return { error: "O envio de e-mail não está configurado. Fale com a Vibe Tech." };

  const { data: lastSend, error: lastSendError } = await db.from("perfil_email_confirmacoes")
    .select("criado_em").eq("usuario_id", profile.id)
    .order("criado_em", { ascending: false }).limit(1).maybeSingle();
  if (lastSendError) return { error: "Não foi possível preparar o código. Tente novamente." };
  if (lastSend && Date.now() - new Date(lastSend.criado_em).getTime() < 60_000)
    return { error: "Aguarde um minuto antes de solicitar outro código." };

  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  const tokenHash = emailCodeHash(profile.id, current.email_contato, code);
  const { error: deleteError } = await db.from("perfil_email_confirmacoes").delete().eq("usuario_id", profile.id);
  if (deleteError) return { error: "Não foi possível preparar o código. Tente novamente." };
  const { error: insertError } = await db.from("perfil_email_confirmacoes").insert({
    token_hash: tokenHash,
    usuario_id: profile.id,
    email: current.email_contato,
    expira_em: new Date(Date.now() + 10 * 60_000).toISOString(),
  });
  if (insertError) return { error: "Não foi possível preparar o código. Tente novamente." };

  try {
    await nodemailer.createTransport({
      host: "smtp.gmail.com", port: 465, secure: true,
      auth: { user: "vibe.tech.gestao@gmail.com", pass: appPassword },
    }).sendMail({
      from: 'Vibe Tech <vibe.tech.gestao@gmail.com>',
      to: current.email_contato,
      subject: "Confirme seu e-mail de recuperação — Vibe Tech",
      ...buildProfileVerificationOtpEmail(current.nome, code),
    });
  } catch {
    await db.from("perfil_email_confirmacoes").delete().eq("token_hash", tokenHash);
    return { error: "Não foi possível enviar o e-mail. Tente novamente mais tarde." };
  }
  return { success: "Código enviado. Confira sua caixa de entrada e o spam." };
}

export async function confirmarCodigoVerificacaoPerfil(code: string) {
  const profile = await requireUserProfile();
  if (!/^\d{6}$/.test(code)) return { error: "Informe os seis dígitos do código." };
  const db = createSupabaseServerClient();
  const { data: current, error: profileError } = await db.from("perfis")
    .select("email_contato,email_contato_verificado_em")
    .eq("id", profile.id).eq("ativo", true).is("excluido_em", null).single();
  if (profileError || !current?.email_contato) return { error: "Seu e-mail não está cadastrado. Fale com o Master." };
  if (current.email_contato_verificado_em) return { error: "Este e-mail já está verificado." };

  const { data: confirmation, error } = await db.from("perfil_email_confirmacoes")
    .select("token_hash,email,expira_em,tentativas").eq("usuario_id", profile.id)
    .order("criado_em", { ascending: false }).limit(1).maybeSingle();
  if (error || !confirmation || confirmation.email !== current.email_contato || new Date(confirmation.expira_em).getTime() < Date.now())
    return { error: "Código expirado ou inválido. Solicite outro código." };
  if (confirmation.tentativas >= 5) return { error: "Limite de tentativas atingido. Solicite outro código." };

  const received = Buffer.from(emailCodeHash(profile.id, confirmation.email, code), "hex");
  const expected = Buffer.from(confirmation.token_hash, "hex");
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    await db.from("perfil_email_confirmacoes")
      .update({ tentativas: confirmation.tentativas + 1 })
      .eq("token_hash", confirmation.token_hash).eq("tentativas", confirmation.tentativas);
    return { error: "Código incorreto. Confira o e-mail e tente novamente." };
  }

  const { data: updated, error: updateError } = await db.from("perfis")
    .update({ email_contato_verificado_em: new Date().toISOString() })
    .eq("id", profile.id).eq("email_contato", confirmation.email).eq("ativo", true)
    .is("email_contato_verificado_em", null).is("excluido_em", null)
    .select("id").maybeSingle();
  if (updateError || !updated) return { error: "Não foi possível confirmar o e-mail. Tente novamente." };
  await db.from("perfil_email_confirmacoes").delete().eq("usuario_id", profile.id);
  revalidatePath("/", "layout");
  return { success: "E-mail verificado com sucesso." };
}

export async function salvarDadosPerfil(values: {
  nome: string;
  telefone: string;
}) {
  const profile = await requireUserProfile();
  const nome = String(values.nome ?? "").trim();
  const telefone = String(values.telefone ?? "").trim();
  if (nome.length < 2 || nome.length > 120 || telefone.length > 30)
    return {
      error:
        "Confira o nome (2 a 120 caracteres) e o telefone (até 30 caracteres).",
    };
  const { error } = await createSupabaseServerClient()
    .from("perfis")
    .update({
      nome,
      telefone: telefone || null,
    })
    .eq("id", profile.id);
  if (error) return { error: "Não foi possível salvar seus dados." };
  revalidatePath("/", "layout");
  return { success: "Dados atualizados." };
}

export async function salvarFotoPerfil(form: FormData) {
  const profile = await requireAuthenticatedProfile();
  const db = createSupabaseServerClient();
  const { data: current, error: readError } = await db
    .from("perfis")
    .select("avatar_path")
    .eq("id", profile.id)
    .single();
  if (readError) return { error: "Não foi possível carregar a foto atual." };
  const remover = form.get("remover") === "true";
  let path: string | null = null;
  if (!remover) {
    const file = form.get("foto");
    if (
      !(file instanceof File) ||
      !file.size ||
      file.size > 3 * 1024 * 1024 ||
      !["image/jpeg", "image/png", "image/webp"].includes(file.type)
    )
      return { error: "Escolha uma foto JPG, PNG ou WebP de até 3 MB." };
    let buffer: Buffer;
    try {
      const source = sharp(Buffer.from(await file.arrayBuffer()), {
        limitInputPixels: 25000000,
      });
      const metadata = await source.metadata();
      if (!["jpeg", "png", "webp"].includes(metadata.format ?? ""))
        return { error: "Formato de imagem inválido." };
      buffer = await source
        .rotate()
        .resize(512, 512, { fit: "cover", withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer();
    } catch {
      return { error: "Não foi possível ler a imagem. Escolha outra foto." };
    }
    path = `${profile.id}/${randomUUID()}.webp`;
    const { error } = await db.storage
      .from("profile-photos")
      .upload(path, buffer, { contentType: "image/webp", upsert: false });
    if (error) return { error: "Não foi possível enviar a foto." };
  }
  let query = db
    .from("perfis")
    .update({ avatar_path: path })
    .eq("id", profile.id);
  query = current.avatar_path
    ? query.eq("avatar_path", current.avatar_path)
    : query.is("avatar_path", null);
  const { data, error } = await query.select("id");
  if (error || !data?.length) {
    if (path) await db.storage.from("profile-photos").remove([path]);
    return {
      error: "A foto não foi atualizada. Atualize a página e tente novamente.",
    };
  }
  if (current.avatar_path?.startsWith(`${profile.id}/`))
    await db.storage.from("profile-photos").remove([current.avatar_path]);
  revalidatePath("/", "layout");
  return { success: remover ? "Foto removida." : "Foto atualizada." };
}

export async function alterarSenhaPerfil(values: {
  atual: string;
  nova: string;
  confirmacao: string;
  encerrar: boolean;
}) {
  await requireAuthenticatedProfile();
  if (
    !values.atual ||
    values.atual.length > 128 ||
    values.nova.length < 8 ||
    values.nova.length > 128 ||
    values.nova !== values.confirmacao ||
    values.nova === values.atual
  )
    return {
      error:
        "Confira a senha atual e informe uma nova senha diferente, de 8 a 128 caracteres, com a confirmação igual.",
    };
  const db = await createSupabaseAuthServerClient();
  const { data: identity } = await db.auth.getUser();
  if (!identity.user?.email)
    return { error: "Entre novamente para alterar sua senha." };
  const verifier = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
  const verification = await verifier.auth.signInWithPassword({
    email: identity.user.email,
    password: values.atual,
  });
  if (verification.error || verification.data.user?.id !== identity.user.id)
    return {
      error: "A senha atual está incorreta. Confira e tente novamente.",
    };
  await verifier.auth.signOut({ scope: "local" });
  const { error } = await db.auth.updateUser({
    password: values.nova,
    current_password: values.atual,
  });
  if (error)
    return {
      error:
        "Não foi possível alterar a senha. Confira a senha atual e use uma nova senha forte. Se sua sessão expirou, entre novamente.",
    };
  if (values.encerrar) {
    const { error: signOutError } = await db.auth.signOut({ scope: "others" });
    if (signOutError)
      return {
        success:
          "Senha alterada. Não foi possível encerrar as outras sessões; tente novamente mais tarde.",
      };
  }
  return {
    success: values.encerrar
      ? "Senha alterada e renovação das outras sessões revogada."
      : "Senha alterada.",
  };
}

export async function getPerfilAcessos() {
  const profile = await requireUserProfile();
  const { getPortalModules } = await import("@/lib/portal-data");
  return getPortalModules(profile);
}
