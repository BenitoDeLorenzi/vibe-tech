import type { Fechamento } from "./gestao-types";

export const periodosPainel = [
  { value: "hoje", label: "Hoje" },
  { value: "7dias", label: "Últimos 7 dias" },
  { value: "mes", label: "Este mês" },
  { value: "30dias", label: "Últimos 30 dias" },
  { value: "personalizado", label: "Personalizado" },
  { value: "todo", label: "Todo o período" },
];

function dataValida(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function intervaloPersonalizadoValido(inicio?: string, fim?: string, hoje?: string) {
  return dataValida(inicio) && dataValida(fim) && inicio! <= fim! && (!hoje || fim! <= hoje);
}

export function periodoPainel(value?: string, now = new Date(), inicio?: string, fimEscolhido?: string) {
  const periodo = periodosPainel.some((p) => p.value === value)
    ? value!
    : "mes";
  const hoje = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(now);
  if (periodo === "personalizado") {
    if (intervaloPersonalizadoValido(inicio, fimEscolhido, hoje))
      return { periodo, inicio: inicio!, fim: fimEscolhido! };
    return periodoPainel("mes", now);
  }
  if (periodo === "todo") return { periodo, inicio: "0001-01-01", fim: hoje };
  const start = new Date(`${hoje}T12:00:00Z`);
  if (periodo === "mes") start.setUTCDate(1);
  else if (periodo === "7dias") start.setUTCDate(start.getUTCDate() - 6);
  else if (periodo === "30dias") start.setUTCDate(start.getUTCDate() - 29);
  return { periodo, inicio: start.toISOString().slice(0, 10), fim: hoje };
}

export const centavos = (value: number) => Math.round(Number(value) * 100);
export const diferencaFechamento = (f: Fechamento) =>
  centavos(f.total) - f.pagamentos.reduce((s, p) => s + centavos(p.valor), 0);

export function resumirPainel(fechamentos: Fechamento[]) {
  const confirmados = fechamentos.filter((f) => f.status === "conferido");
  const pendentes = fechamentos.filter((f) => f.status === "rascunho");
  const divergentes = pendentes.filter((f) => diferencaFechamento(f) !== 0);
  const formas = new Map<string, number>();
  const produtos = new Map<
    string,
    { id: string; nome: string; total: number }
  >();
  let vendas = 0;
  for (const f of confirmados) {
    vendas += centavos(f.total);
    for (const p of f.pagamentos)
      formas.set(p.forma, (formas.get(p.forma) ?? 0) + centavos(p.valor));
    for (const item of f.itens) {
      if (Number(item.quantidade) <= 0) continue;
      const anterior = produtos.get(item.produto_id);
      produtos.set(item.produto_id, {
        id: item.produto_id,
        nome: anterior?.nome ?? item.nome,
        total: (anterior?.total ?? 0) + centavos(item.total),
      });
    }
  }
  const recebimentos = [...formas.values()].reduce((s, v) => s + v, 0);
  return {
    confirmados,
    pendentes,
    divergentes,
    vendas,
    recebimentos,
    valorPendente: pendentes.reduce((s, f) => s + centavos(f.total), 0),
    formas: [...formas]
      .map(([nome, total]) => ({ nome, total }))
      .sort((a, b) => b.total - a.total),
    produtos: [...produtos.values()]
      .sort((a, b) => b.total - a.total)
      .slice(0, 5),
  };
}
