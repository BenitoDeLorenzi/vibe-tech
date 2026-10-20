import {
  getFrotasData,
  type FrotaPrefeituraOption,
  type FrotaVeiculo,
} from "@/lib/frotas-data";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export type MotoristaOption = { id: string; nome: string; cpf: string | null };

export type UsoVeiculoStatus = "in_use" | "returned" | "cancelled";

export type FrotaUsoVeiculo = {
  cancelled_at: string | null;
  motivo_cancelamento: string | null;
  created_at: string;
  data_retorno: string | null;
  data_saida: string;
  destino: string | null;
  finalidade: string | null;
  funcionario_cpf: string | null;
  funcionario_nome: string;
  id: string;
  km_retorno: number | null;
  km_saida: number;
  marca: string;
  modelo: string;
  motorista_id: string | null;
  observacoes_retorno: string | null;
  observacoes_saida: string | null;
  placa: string;
  prefeitura_id: string;
  prefeitura_nome: string;
  status: UsoVeiculoStatus;
  veiculo_id: string;
};

type UsoVeiculoRow = Omit<
  FrotaUsoVeiculo,
  "marca" | "modelo" | "placa" | "prefeitura_nome"
> & {
  frota_veiculos: {
    marca: string;
    modelo: string;
    placa: string;
  } | null;
  prefeituras: {
    nome: string;
  } | null;
};

export async function getUsoVeiculosData(params?: {
  ids?: string[];
  lightweight?: boolean;
  registroId?: string;
  prefeituraId?: string;
  query?: string;
  status?: string;
}) {
  const supabase = createSupabaseServerClient();
  const frotasData = await getFrotasData({
    prefeituraId: params?.prefeituraId,
    lightweight: params?.lightweight,
  });
  const selectedPrefeituraId =
    params?.prefeituraId ?? frotasData.selectedPrefeituraId;

  let usosQuery = supabase
    .from("frota_uso_veiculos")
    .select(
      "id,prefeitura_id,veiculo_id,motorista_id,funcionario_nome,funcionario_cpf,data_saida,km_saida,destino,finalidade,observacoes_saida,data_retorno,km_retorno,observacoes_retorno,status,cancelled_at,motivo_cancelamento,created_at,frota_veiculos(marca,modelo,placa),prefeituras:empresas(nome)",
    )
    .order("data_saida", { ascending: false })
    .order("created_at", { ascending: false });

  {
    usosQuery = usosQuery.eq(
      "prefeitura_id",
      selectedPrefeituraId ?? "00000000-0000-0000-0000-000000000000",
    );
  }

  if (params?.status && params.status !== "all") {
    usosQuery = usosQuery.eq("status", params.status);
  }

  if (params?.registroId) usosQuery = usosQuery.eq("id", /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.registroId) ? params.registroId : "00000000-0000-0000-0000-000000000000");
  if (params?.ids) usosQuery = usosQuery.in("id", params.ids);
  const { data, error } = await usosQuery;

  if (error) {
    if (isMissingUsoVeiculoTableError(error.message)) {
      return emptyUsoVeiculosData(
        frotasData.prefeituras,
        selectedPrefeituraId,
        frotasData.veiculos,
      );
    }

    throw new Error(error.message);
  }

  const { data: motoristas, error: motoristasError } = await supabase
    .from("frota_motoristas")
    .select("id,nome,cpf")
    .eq("prefeitura_id", selectedPrefeituraId ?? "00000000-0000-0000-0000-000000000000")
    .eq("status", "active")
    .order("nome");
  if (motoristasError) throw new Error(motoristasError.message);

  let usos = ((data ?? []) as unknown as UsoVeiculoRow[]).map((uso) => ({
    ...uso,
    marca: uso.frota_veiculos?.marca ?? "-",
    modelo: uso.frota_veiculos?.modelo ?? "-",
    placa: uso.frota_veiculos?.placa ?? "-",
    prefeitura_nome: uso.prefeituras?.nome ?? "-",
  }));

  if (params?.query && !params.ids) {
    const normalizedQuery = normalizeSearch(params.query);
    usos = usos.filter((uso) =>
      normalizeSearch(
        [
          uso.placa,
          uso.modelo,
          uso.marca,

          uso.funcionario_nome,
          uso.funcionario_cpf,
          formatCpf(uso.funcionario_cpf),
          uso.destino,
          uso.finalidade,
        ]
          .filter(Boolean)
          .join(" "),
      ).includes(normalizedQuery),
    );
  }

  return {
    motoristas: (motoristas ?? []) as MotoristaOption[],
    metricas: {
      cancelados: usos.filter((uso) => uso.status === "cancelled").length,
      devolvidos: usos.filter((uso) => uso.status === "returned").length,
      emUso: usos.filter((uso) => uso.status === "in_use").length,
      total: usos.length,
    },
    prefeituras: frotasData.prefeituras,
    selectedPrefeituraId,
    usos,
    veiculos: frotasData.veiculos,
  };
}

export function formatUsoVeiculoStatus(status: UsoVeiculoStatus) {
  const labels: Record<UsoVeiculoStatus, string> = {
    cancelled: "Cancelado",
    in_use: "Em uso",
    returned: "Devolvido",
  };

  return labels[status];
}

export function formatCpf(value: string | null) {
  const digits = value?.replace(/\D/g, "") ?? "";

  if (digits.length !== 11) {
    return value ?? "-";
  }

  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

export function formatUsoDateTime(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function emptyUsoVeiculosData(
  prefeituras: FrotaPrefeituraOption[],
  selectedPrefeituraId: string | undefined,
  veiculos: FrotaVeiculo[],
) {
  return {
    motoristas: [] as MotoristaOption[],
    metricas: {
      cancelados: 0,
      devolvidos: 0,
      emUso: 0,
      total: 0,
    },
    prefeituras,
    selectedPrefeituraId,
    usos: [],
    veiculos,
  };
}

function isMissingUsoVeiculoTableError(message: string) {
  return (
    message.includes("frota_uso_veiculos") ||
    message.includes("frota_motoristas")
  );
}

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}
