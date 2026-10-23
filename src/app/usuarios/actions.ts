"use server";
import { requireRole } from "@/lib/auth-data";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { type UsuarioRole } from "@/lib/usuarios-data";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { CONTACT_EMAIL_IN_USE, isContactEmailInUse, isContactEmailUniqueViolation } from "@/lib/contact-email";

export type UsuarioActionState = {
  error?: string;
  success?: string;
};

const allowedRoles = new Set<UsuarioRole>([
  "bdl_admin",
  "municipal_admin",
  "municipal_user",
]);

export async function createUsuario(
  _previousState: UsuarioActionState,
  formData: FormData,
): Promise<UsuarioActionState> {
  await requireRole(["bdl_admin"]);
  const payload = getUsuarioPayload(formData, "create");

  if ("error" in payload) {
    return payload;
  }
  if (!process.env.VIBE_GMAIL_APP_PASSWORD) {
    return { error: "Configure o envio de e-mail antes de cadastrar novos usuários." };
  }

  const supabase = createSupabaseServerClient();
  const authEmail = buildAuthEmail(payload.cpf);
  const { data: authData, error: authError } =
    await supabase.auth.admin.createUser({
      email: authEmail,
      email_confirm: true,
      password: payload.password,
      user_metadata: {
        cpf: payload.cpf,
        nome: payload.nome,
      },
    });

  if (authError || !authData.user) {
    return {
      error: formatSupabaseError(authError?.message ?? "Usuário não criado."),
    };
  }

  const { error } = await supabase.from("perfis").insert({
    ativo: payload.ativo,
    primeiro_acesso_concluido_em: null,
    cpf: payload.cpf,
    email: null,
    id: authData.user.id,
    nome: payload.nome,
    prefeitura_id: payload.prefeitura_id,
    role: payload.role,
    username: null,
  });

  if (error) {
    await supabase.auth.admin.deleteUser(authData.user.id);
    return { error: formatSupabaseError(error.message) };
  }

  revalidateUsersPaths();
  return { success: "Usuário cadastrado com sucesso." };
}

export async function updateUsuario(
  _previousState: UsuarioActionState,
  formData: FormData,
): Promise<UsuarioActionState> {
  const actor = await requireRole(["bdl_admin"]);
  const id = getRequiredValue(formData, "id");

  if (!id) {
    return { error: "Usuário não encontrado." };
  }

  const payload = getUsuarioPayload(formData, "update");

  if ("error" in payload) {
    return payload;
  }
  const emailContato = (getOptionalValue(formData, "email_contato") ?? "").toLowerCase();
  if (emailContato && (emailContato.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailContato))) {
    return { error: "Informe um e-mail de recuperação válido." };
  }
  if (id === actor.id && !payload.ativo) {
    return { error: "Você não pode inativar seu próprio acesso." };
  }

  const supabase = createSupabaseServerClient();
  const { data: currentUser, error: currentUserError } = await supabase
    .from("perfis")
    .select("id,email_contato")
    .eq("id", id)
    .is("excluido_em", null)
    .maybeSingle();
  if (currentUserError || !currentUser) {
    return { error: "Usuário não encontrado." };
  }
  if (currentUser.email_contato && !emailContato) {
    return { error: "O e-mail de recuperação não pode ser removido." };
  }
  if (emailContato && emailContato !== (currentUser.email_contato ?? "").toLowerCase()) {
    try {
      if (await isContactEmailInUse(emailContato, id)) return { error: CONTACT_EMAIL_IN_USE };
    } catch {
      return { error: "Não foi possível verificar o e-mail. Tente novamente." };
    }
  }
  const authEmail = buildAuthEmail(payload.cpf);
  const { error: authError } = await supabase.auth.admin.updateUserById(id, {
    email: authEmail,
    password: payload.password || undefined,
    user_metadata: {
      cpf: payload.cpf,
      nome: payload.nome,
    },
  });

  if (authError) {
    return { error: formatSupabaseError(authError.message) };
  }

  const { error } = await supabase
    .from("perfis")
    .update({
      ativo: payload.ativo,
      cpf: payload.cpf,
      email: null,
      email_contato: emailContato || null,
      ...(emailContato !== (currentUser.email_contato ?? "")
        ? { email_contato_verificado_em: null }
        : {}),
      nome: payload.nome,
      prefeitura_id: payload.prefeitura_id,
      role: payload.role,
      username: null,
    })
    .eq("id", id);

  if (error) {
    return { error: isContactEmailUniqueViolation(error) ? CONTACT_EMAIL_IN_USE : formatSupabaseError(error.message) };
  }

  if (emailContato !== (currentUser.email_contato ?? "")) {
    await supabase.from("perfil_email_confirmacoes").delete().eq("usuario_id", id);
  }

  revalidateUsersPaths();
  return { success: "Usuário atualizado com sucesso." };
}

export async function deleteUsuario(formData: FormData) {
  const actor = await requireRole(["bdl_admin"]);
  const id = getRequiredValue(formData, "id");
  if (!id || id === actor.id) {
    redirect(`/usuarios?error=${encodeURIComponent("Não é possível excluir este usuário.")}`);
  }

  const supabase = createSupabaseServerClient();
  const { data: usuario, error: lookupError } = await supabase
    .from("perfis")
    .select("ativo")
    .eq("id", id)
    .is("excluido_em", null)
    .maybeSingle();
  if (lookupError || !usuario) {
    redirect(`/usuarios?error=${encodeURIComponent("Usuário não encontrado.")}`);
  }
  if (usuario.ativo) {
    redirect(`/usuarios?error=${encodeURIComponent("Inative o usuário antes de excluí-lo.")}`);
  }

  // Mantém o perfil para não romper as referências históricas em outros módulos.
  const { data: archived, error } = await supabase
    .from("perfis")
    .update({
      ativo: false,
      excluido_em: new Date().toISOString(),
      cpf: null,
      email: null,
      email_contato: null,
      telefone: null,
      username: null,
    })
    .eq("id", id)
    .eq("ativo", false)
    .is("excluido_em", null)
    .select("id")
    .maybeSingle();

  if (error || !archived) {
    redirect(`/usuarios?error=${encodeURIComponent(error ? formatSupabaseError(error.message) : "Inative o usuário antes de excluí-lo.")}`);
  }

  const { error: authError } = await supabase.auth.admin.deleteUser(id);
  if (authError && !authError.message.includes("User not found")) {
    // Libera o CPF para um novo cadastro quando o Auth não permite remoção física.
    const { error: renameError } = await supabase.auth.admin.updateUserById(id, {
      email: `${id}@excluidos.vibetechsistemas.invalid`,
      user_metadata: {},
    });
    if (renameError) {
      revalidateUsersPaths();
      redirect(`/usuarios?error=${encodeURIComponent("Acesso removido, mas a credencial de autenticação precisa de revisão. Contate o suporte.")}`);
    }
  }

  revalidateUsersPaths();
  redirect("/usuarios?deleted=1");
}

export async function setUsuarioAtivo(formData: FormData) {
  const actor = await requireRole(["bdl_admin"]);
  const id = getRequiredValue(formData, "id");
  const ativo = getRequiredValue(formData, "ativo");
  if (!id || !["true", "false"].includes(ativo)) {
    redirect(`/usuarios?error=${encodeURIComponent("Dados de status inválidos.")}`);
  }
  if (id === actor.id && ativo === "false") {
    redirect(`/usuarios?error=${encodeURIComponent("Você não pode inativar seu próprio acesso.")}`);
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("perfis")
    .update({ ativo: ativo === "true" })
    .eq("id", id)
    .is("excluido_em", null)
    .select("id")
    .maybeSingle();
  if (error || !data) {
    redirect(`/usuarios?error=${encodeURIComponent(error ? formatSupabaseError(error.message) : "Usuário não encontrado.")}`);
  }

  revalidateUsersPaths();
  redirect(`/usuarios?status=${ativo === "true" ? "activated" : "deactivated"}`);
}

export async function updateUsuarioAcessos(
  _previousState: UsuarioActionState,
  formData: FormData,
): Promise<UsuarioActionState> {
  const actor = await requireRole(["bdl_admin"]);
  const { error } = await createSupabaseServerClient().rpc(
    "atualizar_usuario_acessos",
    {
      p_ator: actor.id,
      p_usuario: getRequiredValue(formData, "usuario_id"),
      p_empresa: getRequiredValue(formData, "prefeitura_id"),
      p_modulos: formData.getAll("modulo_id").filter(isStringValue),
      p_permissoes: formData.getAll("permissao_id").filter(isStringValue),
    },
  );
  if (error)
    return {
      error:
        error.code === "P0001"
          ? error.message
          : "Não foi possível atualizar os acessos.",
    };
  revalidateUsersPaths();
  return { success: "Permissões atualizadas com sucesso." };
}

function getUsuarioPayload(formData: FormData, mode: "create" | "update") {
  const nome = getRequiredValue(formData, "nome");
  const role = getRequiredValue(formData, "role") as UsuarioRole;
  const cpf = normalizeCpf(getOptionalValue(formData, "cpf") ?? "");
  const prefeitura_id = getOptionalValue(formData, "prefeitura_id");
  const password = getOptionalValue(formData, "password") ?? "";
  const ativo = getRequiredValue(formData, "ativo");

  if (!nome || !role || !ativo) {
    return { error: "Preencha todos os campos obrigatórios." };
  }

  if (!allowedRoles.has(role)) {
    return { error: "Perfil inválido." };
  }

  if (!["true", "false"].includes(ativo)) {
    return { error: "Status inválido." };
  }

  if (isMunicipalRole(role) && !prefeitura_id) {
    return { error: "Selecione a empresa do usuário da empresa." };
  }

  if (!cpf) {
    return { error: "Informe o CPF do usuário." };
  }

  if (!isValidCpf(cpf)) {
    return { error: "Informe um CPF válido." };
  }

  if (mode === "create" && password.length < 6) {
    return { error: "A senha deve ter pelo menos 6 caracteres." };
  }

  if (mode === "update" && password && password.length < 6) {
    return { error: "A nova senha deve ter pelo menos 6 caracteres." };
  }

  return {
    ativo: ativo === "true",
    cpf,
    nome,
    password,
    prefeitura_id: isMunicipalRole(role) ? prefeitura_id : null,
    role,
  };
}

function isMunicipalRole(role: UsuarioRole) {
  return role === "municipal_admin" || role === "municipal_user";
}

function getRequiredValue(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string" || !value.trim()) {
    return "";
  }

  return value.trim();
}

function getOptionalValue(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  return value.trim();
}

function isStringValue(value: FormDataEntryValue): value is string {
  return typeof value === "string" && Boolean(value.trim());
}

function normalizeCpf(value: string) {
  return value.replace(/\D/g, "");
}

function buildAuthEmail(cpf: string) {
  return `${cpf}@usuarios.bdltech.com.br`;
}

function isValidCpf(cpf: string) {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1+$/.test(cpf)) {
    return false;
  }

  const digits = cpf.split("").map(Number);
  const firstDigit = calculateCpfDigit(digits.slice(0, 9), 10);
  const secondDigit = calculateCpfDigit(
    [...digits.slice(0, 9), firstDigit],
    11,
  );

  return firstDigit === digits[9] && secondDigit === digits[10];
}

function calculateCpfDigit(numbers: number[], factor: number) {
  const total = numbers.reduce(
    (sum, number, index) => sum + number * (factor - index),
    0,
  );
  const remainder = (total * 10) % 11;

  return remainder === 10 ? 0 : remainder;
}

function revalidateUsersPaths() {
  revalidatePath("/");
  revalidatePath("/usuarios");
  revalidatePath("/empresas", "layout");
  revalidatePath("/portal");
  revalidatePath("/gestao", "layout");
}

function formatSupabaseError(message: string) {
  if (
    message.includes("perfis.email") ||
    message.includes("perfis.username") ||
    message.includes("perfis.cpf") ||
    message.includes("perfis.ativo")
  ) {
    return "Atualize a tabela perfis no Supabase antes de gerenciar usuários. Rode a migration de usuários.";
  }

  if (
    message.includes("invalid input value for enum app_role") ||
    message.includes("municipal_admin")
  ) {
    return "Atualize os perfis de acesso no Supabase antes de cadastrar Administrador da empresa. Rode a migration do modelo de permissões.";
  }

  if (
    message.includes("permissoes") ||
    message.includes("usuario_modulos") ||
    message.includes("usuario_permissoes")
  ) {
    return "Atualize o modelo de permissões no Supabase antes de gerenciar acessos. Rode a migration de permissões.";
  }

  if (message.includes("duplicate") || message.includes("already registered")) {
    return "Já existe um usuário cadastrado com estes dados.";
  }

  if (message.includes("User not found")) {
    return "Usuário não encontrado.";
  }

  if (message.includes("Auth session missing")) {
    return "Configure a chave SUPABASE_SERVICE_ROLE_KEY para gerenciar usuários.";
  }

  return message;
}
