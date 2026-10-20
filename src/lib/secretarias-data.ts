import "server-only";
import type { CurrentUserProfile } from "@/lib/auth-data";
import { getModuleLicensedEmpresas } from "@/lib/empresa-access";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export type Secretaria = { id: string; prefeitura_id: string; nome: string };

export async function getFrotasEmpresa(
  profile: CurrentUserProfile,
  empresaId: string,
) {
  if (profile.role !== "bdl_admin" && profile.prefeitura_id !== empresaId)
    return null;
  return (
    (await getModuleLicensedEmpresas("frotas-publicas")).find(
      (empresa) => empresa.id === empresaId,
    ) ?? null
  );
}

export async function getSecretarias(empresaId: string, ids?: string[]): Promise<Secretaria[]> {
  let query = createSupabaseServerClient()
    .from("frota_secretarias")
    .select("id,prefeitura_id,nome")
    .eq("prefeitura_id", empresaId)
    .order("nome");
  if (ids) query = query.in("id", ids);
  const { data, error } = await query;
  if (error) throw new Error("Não foi possível carregar as secretarias.");
  return data ?? [];
}

export async function validateVehicleSecretaria(
  profile: CurrentUserProfile,
  empresaId: string,
  value: unknown,
) {
  const empresa = await getFrotasEmpresa(profile, empresaId);
  if (!empresa)
    return {
      error: "Selecione uma empresa com licença ativa para Vibe Frotas.",
    };
  if (value !== null && value !== undefined && typeof value !== "string")
    return { error: "Secretaria inválida." };
  const id = typeof value === "string" ? value.trim() : "";
  if (!id) {
    if (empresa.is_prefeitura)
      return { error: "Selecione uma secretaria para cadastrar o veículo." };
    return { secretaria_id: null, secretaria: null };
  }
  if (!empresa.is_prefeitura)
    return {
      error: "Somente prefeituras podem vincular veículos a secretarias.",
    };
  const { data, error } = await createSupabaseServerClient()
    .from("frota_secretarias")
    .select("id,nome")
    .eq("id", id)
    .eq("prefeitura_id", empresaId)
    .maybeSingle();
  if (error || !data)
    return { error: "Selecione uma secretaria cadastrada nesta prefeitura." };
  return { secretaria_id: data.id as string, secretaria: data.nome as string };
}
