import "server-only";
import { cache } from "react";
import { getGestaoContext } from "./gestao-data";
import type { FinanceiroData, MovimentoFinanceiro } from "./gestao-contas";

export const getFinanceiroData = cache(async (): Promise<FinanceiroData> => {
  const { db, unidade, profile } = await getGestaoContext();
  const empty = { inicio: null, contas: [], cartoes: [], categorias: [], pagar: [], solicitacoes: [] };
  if (!unidade || profile.role !== "bdl_admin") return empty;
  async function rows(table: string) {
    const all = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await db
        .from(table)
        .select("*")
        .eq("unidade_id", unidade!.id)
        .order("id")
        .range(offset, offset + 499);
      if (error) throw new Error("Não foi possível carregar o financeiro.");
      all.push(...data);
      if (data.length < 500) return all;
    }
  }
  const [config, contas, cartoes, categorias, pagar, solicitacoes] = await Promise.all([
    db
      .from("gestao_fin_config")
      .select("inicio")
      .eq("unidade_id", unidade.id)
      .maybeSingle(),
    rows("gestao_contas_saldos"),
    rows("gestao_cartoes_credito"),
    rows("gestao_fin_categorias"),
    rows("gestao_pagar_saldos"),
    rows("gestao_fin_solicitacoes"),
  ]);
  if (config.error)
    throw new Error("Não foi possível carregar a configuração financeira.");
  return { inicio: config.data?.inicio ?? null, contas, cartoes, categorias, pagar, solicitacoes };
});
export async function getExtratoFinanceiro(
  contaId?: string,
  limite = 10,
  pagarId?: string,
  pagarIdsCategoria?: string[],
  categoriaMovimentos?: string,
): Promise<{ movimentos: MovimentoFinanceiro[]; total: number }> {
  const { db, unidade, profile } = await getGestaoContext();
  if (!unidade || profile.role !== "bdl_admin")
    return { movimentos: [], total: 0 };
  let query = db
    .from("gestao_fin_movimentos")
    .select("*", { count: "exact" })
    .eq("unidade_id", unidade.id);
  if (contaId && /^[0-9a-f-]{36}$/i.test(contaId))
    query = query.eq("conta_id", contaId);
  if (pagarId && /^[0-9a-f-]{36}$/i.test(pagarId))
    query = query.eq("pagar_id", pagarId);
  if (pagarIdsCategoria) {
    if (!pagarIdsCategoria.length && !categoriaMovimentos) return { movimentos: [], total: 0 };
    if (categoriaMovimentos) {
      query = pagarIdsCategoria.length
        ? query.or(`categoria.eq.${categoriaMovimentos},pagar_id.in.(${pagarIdsCategoria.join(",")})`)
        : query.eq("categoria", categoriaMovimentos);
    } else query = query.in("pagar_id", pagarIdsCategoria);
  }
  const { data, error, count } = await query
    .order("data", { ascending: false })
    .order("created_at", { ascending: false })
    .order("id")
    .range(0, limite - 1);
  if (error) throw new Error("Não foi possível carregar o extrato.");
  return { movimentos: data, total: count ?? 0 };
}
