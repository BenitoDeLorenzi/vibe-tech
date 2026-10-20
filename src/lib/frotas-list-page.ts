import "server-only";
import { notFound } from "next/navigation";
import type { CurrentUserProfile } from "@/lib/auth-data";
import { getModuleLicensedEmpresas } from "@/lib/empresa-access";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type ListKind = "veiculos" | "uso-veiculo" | "manutencao" | "abastecimento" | "secretarias" | "oficinas" | "postos" | "motoristas" | "relatorios";
type ListParams = { prefeitura?: string; q?: string; status?: string; tipo?: string; registro?: string; page?: string; size?: string };
export type FleetPage = { ids: string[]; page: number; pageCount: number; total: number; statuses: Record<string, number>; inUse: number; empresaId?: string };
export const emptyFleetPage: FleetPage = { ids: [], page: 1, pageCount: 1, total: 0, statuses: {}, inUse: 0 };

export async function getFrotaListPage(profile: CurrentUserProfile, kind: ListKind, params: ListParams): Promise<FleetPage> {
  const companies = await getModuleLicensedEmpresas("frotas-publicas");
  const empresaId = profile.role === "bdl_admin" ? params.prefeitura ?? companies[0]?.id : profile.prefeitura_id;
  if (!empresaId) return emptyFleetPage;
  if (!companies.some(company => company.id === empresaId)) notFound();
  const page = Number(params.page ?? 1);
  const size = Number(params.size ?? 10);
  const { data, error } = await createSupabaseServerClient().rpc("frota_lista_pagina", {
    p_lista: kind, p_empresa: empresaId, p_busca: params.q?.slice(0, 200) ?? "",
    p_status: params.status ?? "", p_tipo: params.tipo ?? "", p_registro: params.registro ?? "",
    p_page: Number.isSafeInteger(page) && page > 0 ? Math.min(page, 2147483647) : 1,
    p_size: Number.isInteger(size) && size >= 1 && size <= 50 ? size : 10,
  });
  if (error) throw new Error("Não foi possível carregar a página da lista.", { cause: error });
  return { ...(data as FleetPage), empresaId };
}

// Hydration queries may return rows in a different order; keep the database page order.
export function orderPageItems<T extends { id: string }>(items: T[], page: FleetPage) {
  const byId = new Map(items.map(item => [item.id, item]));
  return page.ids.flatMap(id => { const item = byId.get(id); return item ? [item] : []; });
}
