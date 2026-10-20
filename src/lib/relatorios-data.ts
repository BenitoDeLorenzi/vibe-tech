import {
  getAbastecimentosData,
  getFrotasData,
  getManutencoesData,
  type AbastecimentoStatus,
  type FrotaAbastecimento,
  type FrotaManutencao,
  type FrotaVeiculo,
  type FrotaVencimento,
  type ManutencaoStatus,
  type VeiculoStatus,
  type VencimentoTipo,
} from "@/lib/frotas-data";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export type RelatorioStatus = "archived" | "cancelled" | "generated";
export type RelatorioTipo = "expirations" | "fuel" | "maintenance" | "vehicles";

export type RelatorioFiltros = {
  combustivel?: string | null;
  posto_id?: string | null;
  /** Somente para reproduzir filtros de relatórios históricos; novos relatórios não usam secretaria. */
  secretaria?: string | null;
  status?: string | null;
  veiculo_id?: string | null;
  vencimento_tipo?: VencimentoTipo | "all" | null;
};

export type FrotaRelatorio = {
  created_at: string;
  criado_por: string | null;
  filtros: RelatorioFiltros;
  id: string;
  periodo_fim: string | null;
  periodo_inicio: string | null;
  prefeitura_brasao_url: string | null;
  prefeitura_id: string;
  prefeitura_nome: string;
  status: RelatorioStatus;
  tipo: RelatorioTipo;
  titulo: string;
  total_registros: number;
  valor_total: number;
};

export type RelatorioDataSet =
  | { items: FrotaAbastecimento[]; tipo: "fuel"; valorTotal: number }
  | { items: FrotaManutencao[]; tipo: "maintenance"; valorTotal: number }
  | { items: FrotaVeiculo[]; tipo: "vehicles"; valorTotal: number }
  | { items: FrotaVencimento[]; tipo: "expirations"; valorTotal: number };

type RelatorioRow = {
  created_at: string;
  filtros: RelatorioFiltros | null;
  id: string;
  periodo_fim: string | null;
  periodo_inicio: string | null;
  prefeitura_id: string;
  prefeituras: {
    brasao_url: string | null;
    nome: string;
  } | null;
  perfis: {
    nome: string;
  } | null;
  status: RelatorioStatus;
  tipo: RelatorioTipo;
  titulo: string;
  total_registros: number;
  valor_total: number;
};

export async function getRelatorios(params?: {
  ids?: string[];
  prefeituraId?: string;
  query?: string;
  status?: string;
  tipo?: string;
}) {
  const supabase = createSupabaseServerClient();
  let query = supabase
    .from("frota_relatorios")
    .select(
      "id,prefeitura_id,tipo,titulo,periodo_inicio,periodo_fim,filtros,total_registros,valor_total,status,created_at,prefeituras:empresas(nome,brasao_url),perfis(nome)"
    )
    .order("created_at", { ascending: false });

  if (params?.prefeituraId) {
    query = query.eq("prefeitura_id", params.prefeituraId);
  }

  if (params?.tipo && params.tipo !== "all") {
    query = query.eq("tipo", params.tipo);
  }

  if (params?.status && params.status !== "all") {
    query = query.eq("status", params.status);
  }

  if (params?.ids) query = query.in("id", params.ids);
  const { data, error } = await query;

  if (error) {
    if (isMissingRelatoriosTableError(error.message)) {
      return [];
    }

    throw new Error(error.message);
  }

  let rows = ((data ?? []) as unknown as RelatorioRow[]).map(mapRelatorioRow);

  if (params?.query && !params.ids) {
    const normalized = normalize(params.query);
    rows = rows.filter((relatorio) =>
      normalize(
        [
          relatorio.titulo,
          relatorio.prefeitura_nome,
          formatRelatorioTipo(relatorio.tipo),
          relatorio.criado_por,
        ].join(" ")
      ).includes(normalized)
    );
  }

  return rows;
}

export async function getRelatorio(id: string) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("frota_relatorios")
    .select(
      "id,prefeitura_id,tipo,titulo,periodo_inicio,periodo_fim,filtros,total_registros,valor_total,status,created_at,prefeituras:empresas(nome,brasao_url),perfis(nome)"
    )
    .eq("id", id)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Relatório não encontrado.");
  }

  return mapRelatorioRow(data as unknown as RelatorioRow);
}

export async function buildRelatorioDataSet(relatorio: FrotaRelatorio) {
  const filters = relatorio.filtros ?? {};
  const range = {
    end: relatorio.periodo_fim,
    start: relatorio.periodo_inicio,
  };

  if (relatorio.tipo === "fuel") {
    const data = await getAbastecimentosData({
      prefeituraId: relatorio.prefeitura_id,
    });
    const items = data.abastecimentos
      .filter((item) => isDateInRange(item.data_abastecimento, range))
      .filter((item) => matchesCommonFilters(item, filters))
      .filter((item) =>
        filters.status && filters.status !== "all"
          ? item.status === filters.status
          : true
      );

    return {
      items,
      tipo: "fuel",
      valorTotal: items.reduce((total, item) => total + getFuelOrderTotal(item), 0),
    } satisfies RelatorioDataSet;
  }

  if (relatorio.tipo === "maintenance") {
    const data = await getManutencoesData({
      prefeituraId: relatorio.prefeitura_id,
    });
    const vehicleById = new Map(
      data.veiculos.map((veiculo) => [veiculo.id, veiculo])
    );
    const items = data.manutencoes
      .filter((item) => isDateInRange(item.data_entrada, range))
      .filter((item) => matchesMaintenanceFilters(item, filters, vehicleById))
      .filter((item) =>
        filters.status && filters.status !== "all"
          ? item.status === filters.status
          : true
      );

    return {
      items,
      tipo: "maintenance",
      valorTotal: items.reduce(
        (total, item) => total + Number(item.valor ?? 0),
        0
      ),
    } satisfies RelatorioDataSet;
  }

  if (relatorio.tipo === "expirations") {
    const data = await getFrotasData({
      prefeituraId: relatorio.prefeitura_id,
    });
    const items = data.vencimentos
      .filter((item) => isDateInRange(item.data_vencimento, range))
      .filter((item) =>
        filters.vencimento_tipo && filters.vencimento_tipo !== "all"
          ? item.tipo === filters.vencimento_tipo
          : true
      )
      .filter((item) =>
        filters.status && filters.status !== "all"
          ? item.status === filters.status
          : true
      );

    return {
      items,
      tipo: "expirations",
      valorTotal: 0,
    } satisfies RelatorioDataSet;
  }

  const data = await getFrotasData({
    prefeituraId: relatorio.prefeitura_id,
  });
  const items = data.veiculos
    .filter((item) => matchesVehicleFilters(item, filters))
    .filter((item) =>
      filters.status && filters.status !== "all"
        ? item.status === filters.status
        : true
    );

  return {
    items,
    tipo: "vehicles",
    valorTotal: 0,
  } satisfies RelatorioDataSet;
}

export async function previewRelatorioSnapshot(params: {
  filtros: RelatorioFiltros;
  periodoFim: string | null;
  periodoInicio: string | null;
  prefeituraId: string;
  tipo: RelatorioTipo;
}) {
  const relatorio: FrotaRelatorio = {
    created_at: new Date().toISOString(),
    criado_por: null,
    filtros: params.filtros,
    id: "preview",
    periodo_fim: params.periodoFim,
    periodo_inicio: params.periodoInicio,
    prefeitura_brasao_url: null,
    prefeitura_id: params.prefeituraId,
    prefeitura_nome: "",
    status: "generated",
    tipo: params.tipo,
    titulo: "",
    total_registros: 0,
    valor_total: 0,
  };
  const dataSet = await buildRelatorioDataSet(relatorio);

  return {
    totalRegistros: dataSet.items.length,
    valorTotal: dataSet.valorTotal,
  };
}

export function formatRelatorioTipo(tipo: RelatorioTipo) {
  const labels: Record<RelatorioTipo, string> = {
    expirations: "Débitos",
    fuel: "Abastecimentos",
    maintenance: "Manutenções",
    vehicles: "Veículos",
  };

  return labels[tipo];
}

export function formatRelatorioStatus(status: RelatorioStatus) {
  const labels: Record<RelatorioStatus, string> = {
    archived: "Arquivado",
    cancelled: "Cancelado",
    generated: "Gerado",
  };

  return labels[status];
}

function mapRelatorioRow(row: RelatorioRow): FrotaRelatorio {
  return {
    created_at: row.created_at,
    criado_por: row.perfis?.nome ?? null,
    filtros: row.filtros ?? {},
    id: row.id,
    periodo_fim: row.periodo_fim,
    periodo_inicio: row.periodo_inicio,
    prefeitura_brasao_url: row.prefeituras?.brasao_url ?? null,
    prefeitura_id: row.prefeitura_id,
    prefeitura_nome: row.prefeituras?.nome ?? "-",
    status: row.status,
    tipo: row.tipo,
    titulo: row.titulo,
    total_registros: row.total_registros,
    valor_total: Number(row.valor_total ?? 0),
  };
}

function matchesCommonFilters(
  item: FrotaAbastecimento,
  filters: RelatorioFiltros
) {
  if (filters.veiculo_id && item.veiculo_id !== filters.veiculo_id) {
    return false;
  }

  if (filters.posto_id && item.posto_id !== filters.posto_id) {
    return false;
  }

  if (filters.secretaria && item.secretaria !== filters.secretaria) {
    return false;
  }

  return true;
}

function matchesMaintenanceFilters(
  item: FrotaManutencao,
  filters: RelatorioFiltros,
  vehicleById: Map<string, FrotaVeiculo>
) {
  if (filters.veiculo_id && item.veiculo_id !== filters.veiculo_id) {
    return false;
  }

  if (
    filters.secretaria &&
    vehicleById.get(item.veiculo_id)?.secretaria !== filters.secretaria
  ) {
    return false;
  }

  return true;
}

function matchesVehicleFilters(item: FrotaVeiculo, filters: RelatorioFiltros) {
  if (filters.secretaria && item.secretaria !== filters.secretaria) {
    return false;
  }

  if (filters.combustivel && item.combustivel !== filters.combustivel) {
    return false;
  }

  return true;
}

function isDateInRange(
  value: string,
  range: { end: string | null; start: string | null }
) {
  if (range.start && value < range.start) {
    return false;
  }

  if (range.end && value > range.end) {
    return false;
  }

  return true;
}

function getFuelOrderTotal(item: FrotaAbastecimento) {
  return (item.valor_total ?? 0) + (item.arla_valor_total ?? 0);
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function isMissingRelatoriosTableError(message: string) {
  return message.includes("frota_relatorios");
}

export const reportStatusOptions: Array<{
  label: string;
  value: RelatorioStatus | "all";
}> = [
  { label: "Todos", value: "all" },
  { label: "Gerados", value: "generated" },
  { label: "Arquivados", value: "archived" },
  { label: "Cancelados", value: "cancelled" },
];

export const reportTypeOptions: Array<{
  label: string;
  value: RelatorioTipo | "all";
}> = [
  { label: "Todos", value: "all" },
  { label: "Veículos", value: "vehicles" },
  { label: "Abastecimentos", value: "fuel" },
  { label: "Manutenções", value: "maintenance" },
  { label: "Débitos", value: "expirations" },
];

export const fuelStatusOptions: Array<{
  label: string;
  value: AbastecimentoStatus | "all";
}> = [
  { label: "Todos", value: "all" },
  { label: "Concluídas", value: "completed" },
  { label: "Pendentes", value: "issued" },
  { label: "Vencidas", value: "expired" },
  { label: "Canceladas", value: "cancelled" },
];

export const maintenanceStatusOptions: Array<{
  label: string;
  value: ManutencaoStatus | "all";
}> = [
  { label: "Todos", value: "all" },
  { label: "Em manutenção", value: "open" },
  { label: "Concluídas", value: "completed" },
  { label: "Canceladas", value: "cancelled" },
];

export const vehicleStatusOptions: Array<{
  label: string;
  value: VeiculoStatus | "all";
}> = [
  { label: "Todos", value: "all" },
  { label: "Ativos", value: "active" },
  { label: "Em manutenção", value: "maintenance" },
  { label: "Processando", value: "processing" },
  { label: "Falha na consulta", value: "consult_error" },
  { label: "Inativos", value: "inactive" },
];
