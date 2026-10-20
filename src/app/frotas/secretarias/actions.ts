"use server";

import { revalidatePath } from "next/cache";
import { requireUserProfile } from "@/lib/auth-data";
import { hasFrotasPermission } from "@/lib/frotas-permissions";
import { getFrotasEmpresa, getSecretarias } from "@/lib/secretarias-data";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type State = { error?: string; success?: string };
const value = (form: FormData, key: string) =>
  typeof form.get(key) === "string" ? String(form.get(key)).trim() : "";

export async function vehicleSecretariaOptions(empresaId: string) {
  const profile = await requireUserProfile();
  const allowed = await Promise.all(
    ["vehicles.create", "vehicles.update"].map((key) =>
      hasFrotasPermission(profile, key),
    ),
  );
  if (!allowed.some(Boolean))
    return { error: "Sem permissão para consultar secretarias." };
  const empresa = await getFrotasEmpresa(profile, empresaId);
  if (!empresa?.is_prefeitura)
    return { error: "Selecione uma prefeitura com licença ativa." };
  try {
    return { items: await getSecretarias(empresaId) };
  } catch {
    return {
      error: "Não foi possível carregar as secretarias. Tente novamente.",
    };
  }
}

export async function saveSecretaria(
  _previous: State,
  form: FormData,
): Promise<State> {
  const profile = await requireUserProfile();
  if (!(await hasFrotasPermission(profile, "departments.manage")))
    return { error: "Você não tem permissão para gerenciar secretarias." };
  const empresaId = value(form, "prefeitura_id");
  if (!(await getFrotasEmpresa(profile, empresaId))?.is_prefeitura)
    return {
      error:
        "Este cadastro está disponível somente para prefeituras com licença ativa.",
    };
  const nome = value(form, "nome").replace(/\s+/g, " ");
  if (nome.length < 2 || nome.length > 120)
    return { error: "Informe um nome de 2 a 120 caracteres." };
  const id = value(form, "id");
  const db = createSupabaseServerClient();
  const query = id
    ? db
        .from("frota_secretarias")
        .update({ nome, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("prefeitura_id", empresaId)
    : db.from("frota_secretarias").insert({ nome, prefeitura_id: empresaId });
  const { data, error } = await query.select("id").maybeSingle();
  if (error)
    return {
      error:
        error.code === "23505"
          ? "Já existe uma secretaria com este nome nesta prefeitura."
          : "Não foi possível salvar a secretaria.",
    };
  if (!data) return { error: "Secretaria não encontrada nesta prefeitura." };
  revalidatePath("/frotas", "layout");
  return { success: id ? "Secretaria atualizada." : "Secretaria cadastrada." };
}

export async function deleteSecretaria(
  _previous: State,
  form: FormData,
): Promise<State> {
  const profile = await requireUserProfile();
  if (
    profile.role !== "bdl_admin" ||
    !(await hasFrotasPermission(profile, "departments.manage"))
  )
    return { error: "Somente o Master pode excluir secretarias." };
  const empresaId = value(form, "prefeitura_id");
  if (!(await getFrotasEmpresa(profile, empresaId))?.is_prefeitura)
    return { error: "Selecione uma prefeitura com licença ativa." };
  const { data, error } = await createSupabaseServerClient()
    .from("frota_secretarias")
    .delete()
    .eq("id", value(form, "id"))
    .eq("prefeitura_id", empresaId)
    .select("id")
    .maybeSingle();
  if (error)
    return {
      error:
        error.code === "23503"
          ? "Esta secretaria possui veículos vinculados. Desvincule-os antes de excluir."
          : "Não foi possível excluir a secretaria.",
    };
  if (!data) return { error: "Secretaria não encontrada nesta prefeitura." };
  revalidatePath("/frotas", "layout");
  return { success: "Secretaria excluída." };
}
