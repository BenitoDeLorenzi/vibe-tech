import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export type FrotaOficina = {
  id: string;
  prefeitura_id: string;
  nome: string;
  documento: string | null;
  telefone: string | null;
  responsavel: string | null;
  endereco: string | null;
  especialidades: string | null;
  observacoes: string | null;
  status: "active" | "inactive";
};

// Callers must first resolve an authorized company through getFrotasData.
export async function getOficinasForEmpresa(empresaId: string | undefined, ids?: string[]) {
  if (!empresaId) return [] as FrotaOficina[];
  let query = createSupabaseServerClient()
    .from("frota_oficinas")
    .select(
      "id,prefeitura_id,nome,documento,telefone,responsavel,endereco,especialidades,observacoes,status",
    )
    .eq("prefeitura_id", empresaId)
    .order("nome");
  if (ids) query = query.in("id", ids);
  const { data, error } = await query;
  if (error) throw new Error("Não foi possível carregar as oficinas.");
  return (data ?? []) as FrotaOficina[];
}
