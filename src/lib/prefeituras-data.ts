import { createSupabaseServerClient } from "@/lib/supabase-server";

export type PrefeituraStatus = "active" | "suspended" | "expired" | "cancelled";

export type Prefeitura = {
  id: string;
  nome: string;
  nome_fantasia?: string | null;
  cnpj: string;
  is_prefeitura: boolean;
  brasao_path: string | null;
  brasao_url: string | null;
  cidade: string | null;
  uf: string | null;
  cep: string | null;
  endereco: string | null;
  status: PrefeituraStatus;
  created_at: string;
  licencas_ativas: number;
  modulos_contratados: string[];
  proximo_vencimento: string | null;
};

type PrefeituraRow = {
  id: string;
  nome: string;
  nome_fantasia?: string | null;
  cnpj: string;
  is_prefeitura: boolean;
  brasao_path: string | null;
  brasao_url: string | null;
  cidade: string | null;
  uf: string | null;
  cep: string | null;
  endereco: string | null;
  status: PrefeituraStatus;
  created_at: string;
  licencas: Array<{
    status: string;
    fim: string;
    modulos: {
      nome: string;
      nome_fantasia?: string | null;
    } | null;
  }> | null;
};

export async function getPrefeituras(params?: {
  query?: string;
  status?: string;
}) {
  const supabase = createSupabaseServerClient();
  let query = supabase
    .from("empresas")
    .select(
      "id,nome,nome_fantasia,cnpj,is_prefeitura,brasao_path,brasao_url,cidade,uf,cep,endereco,status,created_at,licencas(status,fim,modulos(nome))",
    )
    .order("created_at", { ascending: false });

  if (params?.query) {
    query = query.or(
      `nome.ilike.%${params.query}%,nome_fantasia.ilike.%${params.query}%,cnpj.ilike.%${params.query}%,cidade.ilike.%${params.query}%`,
    );
  }

  if (params?.status && params.status !== "all") {
    query = query.eq("status", params.status);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as unknown as PrefeituraRow[]).map((prefeitura) => {
    const activeLicencas = (prefeitura.licencas ?? []).filter(
      (licenca) => licenca.status === "active",
    );

    return {
      id: prefeitura.id,
      nome: prefeitura.nome,
      nome_fantasia: prefeitura.nome_fantasia,
      cnpj: prefeitura.cnpj ?? "",
      is_prefeitura: prefeitura.is_prefeitura,
      brasao_path: prefeitura.brasao_path,
      brasao_url: prefeitura.brasao_url,
      cidade: prefeitura.cidade,
      uf: prefeitura.uf,
      cep: prefeitura.cep,
      endereco: prefeitura.endereco,
      status: prefeitura.status,
      created_at: prefeitura.created_at,
      licencas_ativas: activeLicencas.length,
      modulos_contratados: activeLicencas
        .map((licenca) => licenca.modulos?.nome)
        .filter((nome): nome is string => Boolean(nome)),
      proximo_vencimento:
        activeLicencas
          .map((licenca) => licenca.fim)
          .sort()
          .at(0) ?? null,
    };
  });
}

export function formatPrefeituraStatus(status: PrefeituraStatus) {
  const labels: Record<PrefeituraStatus, string> = {
    active: "Ativa",
    suspended: "Suspensa",
    expired: "Vencida",
    cancelled: "Cancelada",
  };

  return labels[status];
}
