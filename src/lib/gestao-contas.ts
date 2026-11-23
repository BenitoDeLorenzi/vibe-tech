export type ContaFinanceira = {
  id: string;
  nome: string;
  tipo: "caixa" | "banco" | "cobranca";
  ativo: boolean;
  saldo: number;
};
export type CartaoCredito = {
  id: string;
  nome: string;
  fechamento_dia: number | null;
  vencimento_dia: number | null;
  ativo: boolean;
};
export type CategoriaFinanceira = {
  id: string;
  nome: string;
  ativo: boolean;
  sistema: boolean;
};
export type ContaPagar = {
  id: string;
  descricao: string;
  categoria: string;
  fornecedor: string;
  observacoes: string;
  vencimento: string;
  valor: number;
  pago: number;
  cancelada: boolean;
  fechamento_id: string | null;
  parcelamento_id: string | null;
  parcela_numero: number | null;
  parcelas_total: number | null;
  forma_prevista: "cartao" | "outro" | null;
  cartao_id: string | null;
};
export type ContaReceber = {
  id: string;
  descricao: string;
  conta_id: string;
  data: string;
  previsao: string;
  valor: number;
  recebido: number;
  cancelada: boolean;
  fechamento_id: string | null;
};
export type MovimentoFinanceiro = {
  id: string;
  grupo: string;
  conta_id: string;
  data: string;
  valor: number;
  tipo: string;
  descricao: string;
  fechamento_id: string | null;
  pagar_id: string | null;
  receber_id: string | null;
  estornado: boolean;
  motivo_estorno: string | null;
  categoria?: string | null;
};
export type FinanceiroFechamento = {
  recebimentos?: { conta_id: string }[];
  despesas?: { conta_id: string; pagar_id: string; categoria?: string }[];
  equipe_conta_id?: string;
};
export type FinanceiroData = {
  inicio: string | null;
  contas: ContaFinanceira[];
  cartoes: CartaoCredito[];
  categorias: CategoriaFinanceira[];
  pagar: ContaPagar[];
  solicitacoes: SolicitacaoFinanceira[];
};
export type SolicitacaoFinanceira = {
  id: string;
  tipo: "repasse" | "pagamento";
  conta_id: string;
  destino_id: string | null;
  pagar_id: string | null;
  valor: number;
  status: "pendente" | "concluida" | "cancelada" | "estornada";
  data: string;
  concluida_em: string | null;
  observacoes: string;
  motivo_cancelamento: string | null;
};
export const valorReservado = (
  solicitacoes: SolicitacaoFinanceira[],
  contaId?: string,
  pagarId?: string,
) =>
  solicitacoes
    .filter(
      (s) =>
        s.status === "pendente" &&
        (!contaId || s.conta_id === contaId) &&
        (!pagarId || s.pagar_id === pagarId),
    )
    .reduce((total, s) => total + centavosFin(s.valor), 0) / 100;
export const centavosFin = (v: number | string) => Math.round(Number(v) * 100);
export const pendentePagar = (p: ContaPagar) =>
  p.cancelada
    ? 0
    : Math.max(0, centavosFin(p.valor) - centavosFin(p.pago)) / 100;
export const pendenteReceber = (r: ContaReceber) =>
  r.cancelada
    ? 0
    : Math.max(0, centavosFin(r.valor) - centavosFin(r.recebido)) / 100;
export const hojeFinanceiro = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(
    new Date(),
  );
export function resumoContas(d: FinanceiroData, hoje = hojeFinanceiro()) {
  const fim = new Date(hoje + "T12:00:00Z");
  fim.setUTCDate(fim.getUTCDate() + 7);
  const ate = fim.toISOString().slice(0, 10);
  const disponivel =
    d.contas
      .filter((c) => c.tipo !== "cobranca")
      .reduce((s, c) => s + centavosFin(c.saldo), 0) / 100;
  const retido =
    d.contas
      .filter((c) => c.tipo === "cobranca")
      .reduce((s, c) => s + centavosFin(c.saldo), 0) / 100;
  const reservado = valorReservado(d.solicitacoes);
  const pagar7 =
    d.pagar
      .filter((p) => p.vencimento <= ate)
      .reduce((s, p) => s + centavosFin(pendentePagar(p)), 0) / 100;
  return {
    disponivel,
    retido,
    reservado,
    livre: (centavosFin(retido) - centavosFin(reservado)) / 100,
    pagar7,
  };
}
