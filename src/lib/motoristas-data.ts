import { getFrotasData } from "@/lib/frotas-data";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export type MotoristaStatus = "active" | "inactive";

export type FrotaMotorista = {
  cpf: string;
  created_at: string;
  em_uso: boolean;
  id: string;
  nome: string;
  prefeitura_id: string;
  prefeitura_nome: string;
  status: MotoristaStatus;
  total_usos: number;
  ultimo_uso: string | null;
  veiculo_atual: string | null;
};

type MotoristaRow = {
  cpf: string;
  created_at: string;
  id: string;
  nome: string;
  prefeitura_id: string;
  prefeituras: {
    nome: string;
  } | null;
  status: MotoristaStatus;
};

type UsoMotoristaRow = {
  data_saida: string;
  motorista_id: string | null;
  status: "in_use" | "returned" | "cancelled";
  frota_veiculos: {
    modelo: string;
    placa: string;
  } | null;
};

export async function getMotoristasData(params?: {
  ids?: string[];
  lightweight?: boolean;
  prefeituraId?: string;
  query?: string;
  status?: string;
}) {
  const supabase = createSupabaseServerClient();
  const frotasData = await getFrotasData({
    prefeituraId: params?.prefeituraId,
    lightweight: params?.lightweight,
    contextOnly: params?.lightweight,
  });
  const selectedPrefeituraId =
    params?.prefeituraId ?? frotasData.selectedPrefeituraId;

  let motoristasQuery = supabase
    .from("frota_motoristas")
    .select(
      "id,prefeitura_id,nome,cpf,status,created_at,prefeituras:empresas(nome)",
    )
    .not("cpf", "is", null)
    .neq("cpf", "")
    .order("created_at", { ascending: false });

  {
    motoristasQuery = motoristasQuery.eq(
      "prefeitura_id",
      selectedPrefeituraId ?? "00000000-0000-0000-0000-000000000000",
    );
  }

  if (params?.status && params.status !== "all") {
    motoristasQuery = motoristasQuery.eq("status", params.status);
  }

  if (params?.ids) motoristasQuery = motoristasQuery.in("id", params.ids);
  const { data, error } = await motoristasQuery;

  if (error) {
    if (isMissingMotoristasTableError(error.message)) {
      return {
        metricas: { ativos: 0, emUso: 0, inativos: 0, total: 0 },
        motoristas: [],
        prefeituras: frotasData.prefeituras,
        selectedPrefeituraId,
      };
    }

    throw new Error(error.message);
  }

  const rows = (data ?? []) as unknown as MotoristaRow[];
  const motoristaIds = rows.map((motorista) => motorista.id);
  const usageByMotorista = new Map<
    string,
    {
      emUso: boolean;
      total: number;
      ultimoUso: string | null;
      veiculoAtual: string | null;
    }
  >();

  if (motoristaIds.length && params?.ids) {
    const { data: summaries, error } = await supabase.rpc("frota_motoristas_resumo", { p_ids: motoristaIds });
    if (error) throw new Error(error.message);
    for (const id of motoristaIds) if (summaries[id]) usageByMotorista.set(id, summaries[id]);
  }
  if (motoristaIds.length && !params?.ids) {
    const usosResult = await supabase
      .from("frota_uso_veiculos")
      .select("motorista_id,status,data_saida,frota_veiculos(modelo,placa)")
      .in("motorista_id", motoristaIds)
      .order("data_saida", { ascending: false });

    if (!usosResult.error) {
      ((usosResult.data ?? []) as unknown as UsoMotoristaRow[]).forEach(
        (uso) => {
          if (!uso.motorista_id) {
            return;
          }

          const current = usageByMotorista.get(uso.motorista_id) ?? {
            emUso: false,
            total: 0,
            ultimoUso: null,
            veiculoAtual: null,
          };

          current.total += 1;
          current.ultimoUso = current.ultimoUso ?? uso.data_saida;

          if (uso.status === "in_use") {
            current.emUso = true;
            current.veiculoAtual =
              current.veiculoAtual ??
              [uso.frota_veiculos?.modelo, uso.frota_veiculos?.placa]
                .filter(Boolean)
                .join(" · ");
          }

          usageByMotorista.set(uso.motorista_id, current);
        },
      );
    }
  }

  let motoristas: FrotaMotorista[] = rows.map((motorista) => {
    const usage = usageByMotorista.get(motorista.id);

    return {
      cpf: motorista.cpf,
      created_at: motorista.created_at,
      em_uso: usage?.emUso ?? false,
      id: motorista.id,
      nome: motorista.nome,
      prefeitura_id: motorista.prefeitura_id,
      prefeitura_nome: motorista.prefeituras?.nome ?? "-",
      status: motorista.status,
      total_usos: usage?.total ?? 0,
      ultimo_uso: usage?.ultimoUso ?? null,
      veiculo_atual: usage?.veiculoAtual ?? null,
    };
  });

  if (params?.query && !params.ids) {
    const normalizedQuery = normalizeSearch(params.query);
    motoristas = motoristas.filter((motorista) =>
      normalizeSearch(
        [
          motorista.nome,
          motorista.cpf,
          formatCpf(motorista.cpf),
          motorista.prefeitura_nome,
          motorista.veiculo_atual,
        ]
          .filter(Boolean)
          .join(" "),
      ).includes(normalizedQuery),
    );
  }

  return {
    metricas: {
      ativos: motoristas.filter((motorista) => motorista.status === "active")
        .length,
      emUso: motoristas.filter((motorista) => motorista.em_uso).length,
      inativos: motoristas.filter(
        (motorista) => motorista.status === "inactive",
      ).length,
      total: motoristas.length,
    },
    motoristas,
    prefeituras: frotasData.prefeituras,
    selectedPrefeituraId,
  };
}

export function formatMotoristaStatus(status: MotoristaStatus) {
  return status === "active" ? "Ativo" : "Inativo";
}

export function formatCpf(value: string | null) {
  const digits = value?.replace(/\D/g, "") ?? "";

  if (digits.length !== 11) {
    return value ?? "-";
  }

  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

export function formatMotoristaDate(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function isMissingMotoristasTableError(message: string) {
  return (
    message.includes("frota_motoristas") ||
    message.includes("frota_uso_veiculos")
  );
}

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}
