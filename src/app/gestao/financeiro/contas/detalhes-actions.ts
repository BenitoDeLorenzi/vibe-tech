"use server";

import { getGestaoContext } from "@/lib/gestao-data";
import { centavosFin } from "@/lib/gestao-contas";
import { dinheiro } from "@/lib/gestao-types";

export type DetalheFinanceiro = {
  id: string;
  data: string;
  descricao: string;
  valor: number;
  detalhe: string;
  estornado?: boolean;
};

export async function listarDetalhesFinanceiros(tipo: "conta" | "cartao", id: string, pagina = 0): Promise<{
  itens: DetalheFinanceiro[];
  total: number;
  erro?: string;
}> {
  const { db, profile, unidade } = await getGestaoContext();
  if (profile.role !== "bdl_admin" || !unidade || !/^[0-9a-f-]{36}$/i.test(id) ||
    !["conta", "cartao"].includes(tipo) || !Number.isInteger(pagina) || pagina < 0 || pagina > 1000) {
    return { itens: [], total: 0, erro: "Consulta inválida." };
  }

  const tabela = tipo === "conta" ? "gestao_contas" : "gestao_cartoes_credito";
  const { data: origem, error: origemErro } = await db.from(tabela)
    .select("id").eq("id", id).eq("unidade_id", unidade.id).maybeSingle();
  if (origemErro || !origem) return { itens: [], total: 0, erro: "Conta ou cartão não encontrado." };

  const inicio = pagina * 20;
  if (tipo === "conta") {
    const { data, count, error } = await db.from("gestao_fin_movimentos")
      .select("id,data,descricao,valor,tipo,estornado", { count: "exact" })
      .eq("unidade_id", unidade.id).eq("conta_id", id)
      .order("data", { ascending: false }).order("id", { ascending: false })
      .range(inicio, inicio + 19);
    if (error) return { itens: [], total: 0, erro: "Não foi possível carregar o extrato." };
    return { itens: (data ?? []).map((item) => ({
      id: item.id, data: item.data, descricao: item.descricao,
      valor: Number(item.valor), detalhe: item.tipo === "inicial" ? "Saldo inicial" : item.estornado ? "Estornado" : "Registrado",
      estornado: item.estornado,
    })), total: count ?? 0 };
  }

  const { data, count, error } = await db.from("gestao_pagar_saldos")
    .select("id,vencimento,descricao,valor,pago,cancelada", { count: "exact" })
    .eq("unidade_id", unidade.id).eq("cartao_id", id)
    .order("vencimento", { ascending: false }).order("id", { ascending: false })
    .range(inicio, inicio + 19);
  if (error) return { itens: [], total: 0, erro: "Não foi possível carregar as parcelas." };
  return { itens: (data ?? []).map((item) => {
    const saldo = item.cancelada ? 0 : Math.max(0, centavosFin(item.valor) - centavosFin(item.pago)) / 100;
    return {
      id: item.id, data: item.vencimento, descricao: item.descricao,
      valor: item.cancelada || saldo === 0 ? 0 : -saldo,
      detalhe: item.cancelada ? "Cancelada" : saldo === 0 ? "Paga" : `Pago ${dinheiro(Number(item.pago))}`,
    };
  }), total: count ?? 0 };
}
