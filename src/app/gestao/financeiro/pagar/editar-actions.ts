"use server";

import { revalidatePath } from "next/cache";
import { getGestaoContext } from "@/lib/gestao-data";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function listarPagamentosContaPagar(id: string) {
  const { profile, unidade } = await getGestaoContext();
  if (profile.role !== "bdl_admin" || !unidade || !/^[0-9a-f-]{36}$/i.test(id))
    return { error: "Conta inválida.", pagamentos: [] };
  const { data, error } = await createSupabaseServerClient()
    .from("gestao_fin_movimentos")
    .select("id,conta_id,valor,data,tipo,fechamento_id")
    .eq("unidade_id", unidade.id)
    .eq("pagar_id", id)
    .eq("estornado", false)
    .order("data")
    .order("id");
  if (error) return { error: "Não foi possível carregar os pagamentos.", pagamentos: [] };
  return { pagamentos: data ?? [] };
}

export async function editarContaPagar(dados: {
  id: string;
  escopo: "uma" | "todas";
  descricao: string;
  categoria: string;
  fornecedor: string;
  observacoes: string;
  valor: string;
  vencimento: string;
  paga?: boolean;
  origens?: { id: string; conta_id: string }[];
}) {
  const { profile, unidade } = await getGestaoContext();
  if (profile.role !== "bdl_admin" || !unidade)
    return { error: "O financeiro é exclusivo do usuário Master." };
  if (!/^[0-9a-f-]{36}$/i.test(dados.id) || !["uma", "todas"].includes(dados.escopo))
    return { error: "Conta inválida." };
  if (JSON.stringify(dados).length > 5000)
    return { error: "Dados da conta muito longos." };

  const { error } = await createSupabaseServerClient().rpc(dados.paga ? "gestao_fin_editar_conta_paga" : "gestao_fin_editar_conta_pagar", {
    p_ator: profile.id,
    p_unidade: unidade.id,
    p_conta: dados.id,
    p_escopo: dados.escopo,
    p_dados: dados,
  });
  if (error) return { error: error.code === "P0001" ? error.message : "Não foi possível editar a conta. Confira os dados e tente novamente." };
  revalidatePath("/gestao", "layout");
  return { success: dados.escopo === "todas" ? "Todas as parcelas foram atualizadas." : "Despesa atualizada." };
}

export async function editarCategoriaContaPaga(dados: {
  id: string;
  escopo: "uma" | "todas";
  categoria: string;
}) {
  const { profile, unidade } = await getGestaoContext();
  if (profile.role !== "bdl_admin" || !unidade)
    return { error: "O financeiro é exclusivo do usuário Master." };
  if (!/^[0-9a-f-]{36}$/i.test(dados.id) || !["uma", "todas"].includes(dados.escopo) || dados.categoria.length > 120)
    return { error: "Dados inválidos." };

  const { error } = await createSupabaseServerClient().rpc("gestao_fin_editar_categoria_conta_paga", {
    p_ator: profile.id,
    p_unidade: unidade.id,
    p_conta: dados.id,
    p_escopo: dados.escopo,
    p_categoria: dados.categoria,
  });
  if (error) return { error: error.code === "P0001" ? error.message : "Não foi possível alterar a categoria." };
  revalidatePath("/gestao", "layout");
  return { success: dados.escopo === "todas" ? "Categoria das parcelas atualizada." : "Categoria atualizada." };
}
