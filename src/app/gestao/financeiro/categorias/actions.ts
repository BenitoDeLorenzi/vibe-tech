"use server";

import { revalidatePath } from "next/cache";
import { getGestaoContext } from "@/lib/gestao-data";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function operarCategoriaFinanceira(
  acao: "criar" | "editar" | "situacao" | "excluir",
  dados: { nome?: string; id?: string; ativo?: boolean; substituta_id?: string },
) {
  const { profile, unidade } = await getGestaoContext();
  if (profile.role !== "bdl_admin" || !unidade)
    return { error: "O financeiro é exclusivo do usuário Master." };
  if (["criar", "editar"].includes(acao) && (!dados.nome || dados.nome.trim().length < 2 || dados.nome.trim().length > 100))
    return { error: "Informe um nome de 2 a 100 caracteres." };
  if (acao !== "criar" && (!dados.id || !/^[0-9a-f-]{36}$/i.test(dados.id)))
    return { error: "Categoria inválida." };
  if (acao === "situacao" && typeof dados.ativo !== "boolean")
    return { error: "Situação inválida." };
  if (acao === "excluir" && dados.substituta_id && !/^[0-9a-f-]{36}$/i.test(dados.substituta_id))
    return { error: "Escolha uma categoria de destino válida." };

  const { error } = await createSupabaseServerClient().rpc("gestao_fin_categoria_operar", {
    p_ator: profile.id,
    p_unidade: unidade.id,
    p_acao: acao,
    p_dados: dados,
  });
  if (error) return { error: error.code === "23505" ? "Já existe uma categoria com este nome nesta unidade, mesmo sem acentos." : error.code === "P0001" ? error.message : "Não foi possível salvar a categoria." };
  revalidatePath("/gestao", "layout");
  return { success: acao === "criar" ? "Categoria cadastrada." : acao === "editar" ? "Categoria e despesas atualizadas." : acao === "excluir" ? "Categoria excluída e despesas atualizadas." : dados.ativo ? "Categoria ativada." : "Categoria inativada." };
}
