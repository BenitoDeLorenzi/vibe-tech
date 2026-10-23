"use server";

import { redirect } from "next/navigation";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { UsuarioRole } from "@/lib/usuarios-data";

export type LoginState = {
  error?: string;
};

type PerfilLoginRow = {
  ativo: boolean | null;
  primeiro_acesso_concluido_em: string | null;
  role: UsuarioRole;
};

const AUTH_DOMAIN = "usuarios.bdltech.com.br";

export async function loginAction(
  _previousState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const identifier = String(formData.get("identifier") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const cpf = identifier.replace(/\D/g, "");

  if (!cpf || !password) {
    return { error: "Informe o CPF e a senha para entrar." };
  }

  if (cpf.length !== 11) {
    return { error: "Informe um CPF com 11 dígitos." };
  }

  const supabase = createSupabaseServerClient();
  const { data: registeredUser, error: lookupError } = await supabase
    .from("perfis")
    .select("id")
    .eq("cpf", cpf)
    .is("excluido_em", null)
    .limit(1)
    .maybeSingle();

  if (lookupError) {
    return { error: "Não foi possível verificar seu acesso. Tente novamente." };
  }
  if (!registeredUser) {
    return { error: "Não há usuário cadastrado com este CPF" };
  }

  const email = `${cpf}@${AUTH_DOMAIN}`;

  const authClient = await createSupabaseAuthServerClient();
  const { data, error } = await authClient.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    return {
      error: error?.code === "invalid_credentials"
        ? "Senha incorreta. Confira e tente novamente."
        : "Não foi possível entrar agora. Tente novamente em instantes.",
    };
  }

  const { data: perfil, error: perfilError } = await supabase
    .from("perfis")
    .select("role,ativo,primeiro_acesso_concluido_em")
    .eq("id", data.user.id)
    .is("excluido_em", null)
    .maybeSingle();

  if (perfilError || !perfil) {
    await authClient.auth.signOut();
    return { error: "Usuário sem perfil de acesso configurado." };
  }

  const perfilLogin = perfil as PerfilLoginRow;

  if (perfilLogin.ativo === false) {
    await authClient.auth.signOut();
    return { error: "Este usuário está inativo. Fale com a Vibe Tech." };
  }

  redirect(perfilLogin.primeiro_acesso_concluido_em ? "/portal" : "/primeiro-acesso");
}

export async function logoutAction() {
  const authClient = await createSupabaseAuthServerClient();
  await authClient.auth.signOut();
  redirect("/login");
}
