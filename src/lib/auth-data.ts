import { cache } from "react";
import { redirect } from "next/navigation";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { UsuarioRole } from "@/lib/usuarios-data";

export type CurrentUserProfile = {
  primeiro_acesso_concluido_em: string | null;
  senha_inicial_alterada_em: string | null;
  email_contato_verificado_em: string | null;
  email_contato?: string | null;
  prefeitura_nome_fantasia?: string | null;
  ativo: boolean;
  cpf: string | null;
  email: string | null;
  id: string;
  nome: string;
  prefeitura_brasao_url: string | null;
  prefeitura_id: string | null;
  prefeitura_nome: string | null;
  role: UsuarioRole;
  username: string | null;
  telefone?: string | null;
  avatar_url?: string | null;
};

type PerfilRow = {
  primeiro_acesso_concluido_em: string | null;
  senha_inicial_alterada_em: string | null;
  email_contato_verificado_em: string | null;
  email_contato: string | null;
  ativo: boolean | null;
  cpf: string | null;
  email: string | null;
  id: string;
  nome: string;
  prefeitura_id: string | null;
  prefeituras: {
    brasao_url: string | null;
    nome: string;
    nome_fantasia: string | null;
  } | null;
  role: UsuarioRole;
  username: string | null;
  telefone: string | null;
  avatar_path: string | null;
};

export const getCurrentUserProfile = cache(async function getCurrentUserProfile() {
  const authClient = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    return null;
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("perfis")
    .select(
      "id,nome,email,email_contato,email_contato_verificado_em,primeiro_acesso_concluido_em,senha_inicial_alterada_em,username,cpf,telefone,avatar_path,role,prefeitura_id,ativo,prefeituras:empresas!perfis_prefeitura_id_fkey(nome,nome_fantasia,brasao_url)",
    )
    .eq("id", user.id)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const perfil = data as unknown as PerfilRow;

  if (perfil.ativo === false) {
    return null;
  }

  const avatar = perfil.avatar_path?.startsWith(`${user.id}/`)
    ? await supabase.storage
        .from("profile-photos")
        .createSignedUrl(perfil.avatar_path, 3600)
    : null;
  return {
    primeiro_acesso_concluido_em: perfil.primeiro_acesso_concluido_em,
    senha_inicial_alterada_em: perfil.senha_inicial_alterada_em,
    email_contato_verificado_em: perfil.email_contato_verificado_em,
    telefone: perfil.telefone,
    email_contato: perfil.email_contato,
    prefeitura_nome_fantasia: perfil.prefeituras?.nome_fantasia ?? null,
    avatar_url: avatar?.data?.signedUrl ?? null,
    ativo: perfil.ativo ?? true,
    cpf: perfil.cpf,
    email: perfil.email,
    id: perfil.id,
    nome: perfil.nome,
    prefeitura_brasao_url: perfil.prefeituras?.brasao_url ?? null,
    prefeitura_id: perfil.prefeitura_id,
    prefeitura_nome: perfil.prefeituras?.nome ?? null,
    role: perfil.role,
    username: perfil.username,
  } satisfies CurrentUserProfile;
});

export async function requireAuthenticatedProfile() {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/login");
  }

  return profile;
}

export async function requireUserProfile() {
  const profile = await requireAuthenticatedProfile();

  if (!profile.primeiro_acesso_concluido_em) {
    redirect("/primeiro-acesso");
  }

  return profile;
}

export async function requireRole(roles: UsuarioRole[]) {
  const profile = await requireUserProfile();

  if (!roles.includes(profile.role)) {
    redirect("/portal");
  }

  return profile;
}
