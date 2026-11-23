"use server";
import { getGestaoContext } from "@/lib/gestao-data";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";
const allowed = new Set([
  "ativar",
  "conta",
  "pagar_cadastrar",
  "pagar_parcelado",
  "cartao_cadastrar",
  "pagar_excluir",
  "pagar",
  "solicitar_repasse",
  "solicitar_pagamento",
  "concluir_solicitacao",
  "cancelar_solicitacao",
  "transferir",
  "aporte",
  "retirada",
  "ajuste_entrada",
  "ajuste_saida",
  "cancelar",
  "estornar",
]);
export async function operarFinanceiro(
  acao: string,
  dados: Record<string, unknown>,
) {
  const { profile, unidade } = await getGestaoContext();
  if (profile.role !== "bdl_admin" || !unidade)
    return { error: "O financeiro é exclusivo do usuário Master." };
  if (!allowed.has(acao) || JSON.stringify(dados).length > 10000)
    return { error: "Operação inválida." };
  const db = createSupabaseServerClient();
  const { error } = acao === "pagar_parcelado"
    ? await db.rpc("gestao_fin_criar_parcelas", { p_ator: profile.id, p_unidade: unidade.id, p_dados: dados })
    : acao === "cartao_cadastrar"
      ? await db.rpc("gestao_fin_criar_cartao", { p_ator: profile.id, p_unidade: unidade.id, p_dados: dados })
      : acao === "pagar_excluir"
        ? await db.rpc("gestao_fin_excluir_conta_pagar", { p_ator: profile.id, p_unidade: unidade.id, p_conta: dados.id })
      : await db.rpc("gestao_fin_operar", { p_ator: profile.id, p_unidade: unidade.id, p_acao: acao, p_dados: dados });
  if (error)
    return {
      error:
        error.code === "P0001"
          ? error.message
          : error.code === "23505"
            ? "Já existe um cadastro com este nome."
            : "Não foi possível registrar. Confira os dados e tente novamente.",
    };
  revalidatePath("/gestao", "layout");
  return { success: acao === "pagar_excluir" ? "Conta excluída da lista." : acao === "pagar_parcelado" ? "Parcelas criadas." : acao === "cartao_cadastrar" ? "Cartão cadastrado." : "Lançamento registrado." };
}
