import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export type VehicleDebtSummary = {
  vencidos: number;
  proximos: number;
  debitosConsulta: number;
  vencimentosManuais: number;
  atualizadoEm: string | null;
  origemAtualizacao: "manual" | "plexi" | null;
};

export async function getVehicleDebtSummaries(empresaId: string | undefined, ids: string[]) {
  if (!empresaId || ids.length === 0) return {} as Record<string, VehicleDebtSummary>;
  const { data, error } = await createSupabaseServerClient().rpc("frota_veiculos_pendencias_resumo", {
    p_empresa: empresaId,
    p_ids: ids,
  });
  if (error) throw new Error("Não foi possível carregar a situação dos débitos.", { cause: error });
  return (data ?? {}) as Record<string, VehicleDebtSummary>;
}
