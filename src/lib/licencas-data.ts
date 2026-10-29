import { createSupabaseServerClient } from "@/lib/supabase-server";

export type LicencaStatus = "active" | "suspended" | "expired" | "cancelled";
export type LicencaVigenciaStatus = "active" | "expiring" | "expired";
export type LicencaPagamentoStatus = "open" | "paid" | "partial" | "overdue" | "cancelled";

export type LicencaPagamento = {
  contrato_id: string;
  inter_cobrancas?: {
    id: string; status: "submitting" | "submitted" | "uncertain" | "cancelling" | "cancelled" | "failed" | "expired";
    situacao: string | null; codigo_solicitacao: string | null; seu_numero: string;
    valor: number; vencimento: string; nosso_numero: string | null;
    linha_digitavel: string | null; pix_copia_e_cola: string | null;
    valor_recebido: number | null; recebido_em: string | null;
    consultado_em: string | null; created_at: string; cancelamento_motivo: string | null;
    eventos?: { id: string; tipo: string; situacao: string | null; detalhes: Record<string, string | number | null>; created_at: string }[];
    emails?: { id: string; tipo: "boleto_empresa" | "pagamento_vibe"; status: string; destinatario: string | null; tentativas: number; ultimo_erro: string | null; enviado_em: string | null }[];
  }[];
  eventos?: {autor_id:string | null; autor_nome?:string; id:string; acao:string; created_at:string; detalhes:{ dados?:Record<string,string>; antes?:Record<string,string> }}[];
  recebimentos?: LicencaRecebimento[];
  competencia: string;
  created_at: string;
  documento: string | null;
  forma_pagamento: string | null;
  id: string;
  licenca_id: string;
  modulo_id: string;
  numero_parcela: number;
  observacoes: string | null;
  pago_em: string | null;
  prefeitura_id: string;
  status: LicencaPagamentoStatus;
  valor: number;
  valor_pago: number | null;
  vencimento: string;
};

export type LicencaRecebimento = { autor_nome?:string; id: string; pagamento_id: string; valor: number; pago_em: string; forma_pagamento: string | null; documento: string | null; observacoes: string | null; autor_id: string | null; estornado_em: string | null; motivo_estorno: string | null };
export type LicencaContrato = { id: string; inicio: string; fim: string; valor_mensal: number; dia_vencimento: number; legado: boolean };

export type Licenca = {
  contrato: LicencaContrato;
  contratos: LicencaContrato[];
  dia_vencimento: number;
  id: string;
  prefeitura_id: string;
  modulo_id: string;
  status: LicencaStatus;
  inicio: string;
  fim: string;
  valor_anual: number | null;
  created_at: string;
  prefeitura_nome: string;
  prefeitura_cnpj: string;
  prefeitura_pagador: {
    nome: string;
    cnpj: string;
    endereco: string | null;
    endereco_numero: string | null;
    endereco_complemento: string | null;
    bairro: string | null;
    cidade: string | null;
    uf: string | null;
    cep: string | null;
    email_cobranca: string | null;
    telefone_cobranca: string | null;
  } | null;
  modulo_nome: string;
  modulo_subdominio: string;
  dias_restantes: number;
  vigencia_status: LicencaVigenciaStatus;
  pagamentos: LicencaPagamento[];
  parcelas_abertas: number;
  parcelas_pagas: number;
  parcelas_vencidas: number;
  valor_mensal: number | null;
};

type LicencaRow = {
  valor_mensal: number;
  dia_vencimento: number;
  licenca_contratos: LicencaContrato[];
  id: string;
  prefeitura_id: string;
  modulo_id: string;
  status: LicencaStatus;
  inicio: string;
  fim: string;
  valor_anual: number | null;
  created_at: string;
  prefeituras: {
    nome: string;
    cnpj: string;
    endereco: string | null;
    endereco_numero: string | null;
    endereco_complemento: string | null;
    bairro: string | null;
    cidade: string | null;
    uf: string | null;
    cep: string | null;
    email_cobranca: string | null;
    telefone_cobranca: string | null;
  } | null;
  modulos: {
    nome: string;
    subdominio: string;
  } | null;
};

export type LicencaPrefeituraOption = {
  id: string;
  nome: string;
  cnpj: string;
};

export type LicencaModuloOption = {
  id: string;
  nome: string;
  subdominio: string;
};

export async function getLicencas(params?: { query?: string; status?: string }) {
  const supabase = createSupabaseServerClient();
  let query = supabase
    .from("licencas")
    .select(
      "id,prefeitura_id,modulo_id,status,inicio,fim,valor_anual,valor_mensal,dia_vencimento,created_at,licenca_contratos(id,inicio,fim,valor_mensal,dia_vencimento,legado),prefeituras:empresas(nome,cnpj,endereco,endereco_numero,endereco_complemento,bairro,cidade,uf,cep,email_cobranca,telefone_cobranca),modulos(nome,subdominio)"
    )
    .order("created_at", { ascending: false });

  if (params?.status && params.status !== "all") {
    query = query.eq("status", params.status);
  }

  const baseRows: LicencaRow[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await query.order("id").range(offset, offset + 499);
    if (error) throw new Error(error.message);
    baseRows.push(...(data ?? []) as unknown as LicencaRow[]);
    if (!data || data.length < 500) break;
  }
  const pagamentosMap = await getLicencaPagamentosMap(
    baseRows.map((licenca) => licenca.id)
  );

  const rows = baseRows.map((licenca) => {
    const dias_restantes = getDaysUntil(licenca.fim);
    const vigencia_status: LicencaVigenciaStatus =
      dias_restantes < 0
        ? "expired"
        : dias_restantes <= 30
          ? "expiring"
          : "active";
    const pagamentos = pagamentosMap.get(licenca.id) ?? [];

    return {
      contrato: [...licenca.licenca_contratos].sort((a,b)=>b.inicio.localeCompare(a.inicio))[0],
      contratos: licenca.licenca_contratos,
      dia_vencimento: licenca.dia_vencimento,
      id: licenca.id,
      prefeitura_id: licenca.prefeitura_id,
      modulo_id: licenca.modulo_id,
      status: licenca.status,
      inicio: licenca.inicio,
      fim: licenca.fim,
      valor_anual: licenca.valor_anual,
      created_at: licenca.created_at,
      prefeitura_nome: licenca.prefeituras?.nome ?? "-",
      prefeitura_cnpj: licenca.prefeituras?.cnpj ?? "-",
      prefeitura_pagador: licenca.prefeituras,
      modulo_nome: licenca.modulos?.nome ?? "-",
      modulo_subdominio: licenca.modulos?.subdominio ?? "-",
      dias_restantes,
      vigencia_status,
      pagamentos,
      parcelas_abertas: pagamentos.filter((pagamento) => (pagamento.status === "open" || pagamento.status === "partial"))
        .length,
      parcelas_pagas: pagamentos.filter((pagamento) => pagamento.status === "paid")
        .length,
      parcelas_vencidas: pagamentos.filter(
        (pagamento) => pagamento.status === "overdue" || (pagamento.status === "partial" && pagamento.vencimento < getTodayIsoDate())
      ).length,
      valor_mensal:
        licenca.valor_mensal,
    };
  });

  if (!params?.query) {
    return rows;
  }

  const normalizedQuery = params.query.toLowerCase();
  return rows.filter((licenca) =>
    [
      licenca.prefeitura_nome,
      licenca.prefeitura_cnpj,
      licenca.modulo_nome,
      licenca.modulo_subdominio,
    ]
      .join(" ")
      .toLowerCase()
      .includes(normalizedQuery)
  );
}

async function getLicencaPagamentosMap(licencaIds: string[]) {
  const pagamentosMap = new Map<string, LicencaPagamento[]>();

  if (!licencaIds.length) {
    return pagamentosMap;
  }

  const supabase = createSupabaseServerClient();
  const data: LicencaPagamento[] = [];
  for (let batch = 0; batch < licencaIds.length; batch += 100) {
    for (let offset = 0; ; offset += 500) {
      const result = await supabase.from("licenca_pagamentos")
        .select("id,contrato_id,licenca_id,prefeitura_id,modulo_id,numero_parcela,competencia,vencimento,valor,status,pago_em,valor_pago,forma_pagamento,documento,observacoes,created_at,recebimentos:licenca_recebimentos(*),eventos:licenca_cobranca_eventos(id,autor_id,acao,created_at,detalhes),inter_cobrancas(id,status,situacao,codigo_solicitacao,seu_numero,valor,vencimento,nosso_numero,linha_digitavel,pix_copia_e_cola,valor_recebido,recebido_em,consultado_em,created_at,cancelamento_motivo,eventos:inter_cobranca_eventos(id,tipo,situacao,detalhes,created_at),emails:inter_cobranca_emails(id,tipo,status,destinatario,tentativas,ultimo_erro,enviado_em))")
        .in("licenca_id", licencaIds.slice(batch, batch + 100)).order("id").range(offset, offset + 499);
      if (result.error) throw new Error(result.error.message);
      data.push(...(result.data ?? []) as LicencaPagamento[]);
      if (!result.data || result.data.length < 500) break;
    }
  }

  const actorIds = [...new Set(data.flatMap(p => [...(p.recebimentos ?? []).map(r => r.autor_id), ...(p.eventos ?? []).map(e => e.autor_id)]).filter((id): id is string => Boolean(id)))];
  const names = new Map<string,string>();
  for (let offset = 0; offset < actorIds.length; offset += 100) {
    const result = await supabase.from("perfis").select("id,nome").in("id", actorIds.slice(offset, offset + 100));
    if (result.error) throw new Error(result.error.message);
    for (const actor of result.data ?? []) names.set(actor.id, actor.nome);
  }
  for (const payment of data) {
    for (const receipt of payment.recebimentos ?? []) receipt.autor_nome = names.get(receipt.autor_id ?? "") ?? "Registro anterior";
    for (const event of payment.eventos ?? []) event.autor_nome = names.get(event.autor_id ?? "") ?? "Registro anterior";
    payment.eventos?.sort((a,b) => a.created_at.localeCompare(b.created_at));
    payment.inter_cobrancas?.sort((a,b) => b.created_at.localeCompare(a.created_at));
    for (const bill of payment.inter_cobrancas ?? []) bill.eventos?.sort((a,b) => a.created_at.localeCompare(b.created_at));
    payment.recebimentos?.sort((a,b) => a.pago_em.localeCompare(b.pago_em));
  }
  const today = getTodayIsoDate();

  ((data ?? []) as LicencaPagamento[]).forEach((pagamento) => {
    const normalizedPagamento = {
      ...pagamento,
      status:
        pagamento.status === "open" && pagamento.vencimento < today
          ? "overdue"
          : pagamento.status,
    } satisfies LicencaPagamento;
    const current = pagamentosMap.get(pagamento.licenca_id) ?? [];
    current.push(normalizedPagamento);
    pagamentosMap.set(pagamento.licenca_id, current);
  });

  return pagamentosMap;
}

export async function getLicencaFormOptions() {
  const supabase = createSupabaseServerClient();
  const [prefeiturasResult, modulosResult] = await Promise.all([
    supabase
      .from("empresas")
      .select("id,nome,cnpj")
      .eq("status", "active")
      .order("nome"),
    supabase
      .from("modulos")
      .select("id,nome,subdominio")
      .eq("ativo", true)
      .order("nome"),
  ]);

  if (prefeiturasResult.error) {
    throw new Error(prefeiturasResult.error.message);
  }

  if (modulosResult.error) {
    throw new Error(modulosResult.error.message);
  }

  return {
    prefeituras: (prefeiturasResult.data ?? []) as LicencaPrefeituraOption[],
    modulos: (modulosResult.data ?? []) as LicencaModuloOption[],
  };
}

export function formatLicencaStatus(status: LicencaStatus) {
  const labels: Record<LicencaStatus, string> = {
    active: "Ativa",
    suspended: "Suspensa",
    expired: "Vencida",
    cancelled: "Cancelada",
  };

  return labels[status];
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

export function formatCurrency(value: number | null) {
  if (value === null) {
    return "-";
  }

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function formatDaysRemaining(days: number) {
  if (days < 0) {
    return `Vencida há ${Math.abs(days)} dia(s)`;
  }

  if (days === 0) {
    return "Vence hoje";
  }

  return `Vence em ${days} dia(s)`;
}

export function formatLicencaPagamentoStatus(status: LicencaPagamentoStatus) {
  const labels: Record<LicencaPagamentoStatus, string> = {
    cancelled: "Cancelada",
    open: "Aberta",
    overdue: "Vencida",
    paid: "Paga",
    partial: "Parcial",
  };

  return labels[status];
}


function getTodayIsoDate() {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Sao_Paulo",
    year: "numeric",
  }).formatToParts(new Date());
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";

  return `${year}-${month}-${day}`;
}

function getDaysUntil(value: string) {
  const today = new Date();
  const todayUtc = Date.UTC(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );
  const [year, month, day] = value.split("-").map(Number);
  const targetUtc = Date.UTC(year, month - 1, day);

  return Math.ceil((targetUtc - todayUtc) / 86_400_000);
}
