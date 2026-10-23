"use server";

import { redirect } from "next/navigation";

import {
  authenticatePosto,
  clearPostoSession,
  createPostoSession,
} from "@/lib/posto-auth";

export type PostoLoginState = {
  error?: string;
};

export async function loginPostoAction(
  _previousState: PostoLoginState,
  formData: FormData
): Promise<PostoLoginState> {
  const cnpj = String(formData.get("cnpj") ?? "").replace(/\D/g, "");
  const senha = String(formData.get("senha") ?? "");

  if (!cnpj || !senha) {
    return { error: "Informe o CNPJ e a senha do posto." };
  }

  if (cnpj.length !== 14) {
    return { error: "Informe um CNPJ válido." };
  }

  const posto = await authenticatePosto(cnpj, senha);

  if (!posto) {
    return { error: "CNPJ ou senha inválidos." };
  }

  await createPostoSession(posto);
  redirect(posto.primeiro_acesso_concluido_em ? "/frotas/posto" : "/frotas/posto/primeiro-acesso");
}

export async function logoutPostoAction() {
  await clearPostoSession();
  redirect("/frotas/posto/login");
}
