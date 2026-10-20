import type { FrotaOficina } from "@/lib/oficinas-data";
import { listarEmpresasLicenciadas } from "@/lib/module-licensed-empresas";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export type VeiculoStatus =
  "active" | "maintenance" | "inactive" | "processing" | "consult_error";
export type VencimentoStatus = "pending" | "paid" | "expired";
export type VencimentoTipo = "seguro" | "ipva" | "licenciamento";
export type PagamentoStatus = "pending" | "partial" | "paid";
export type AbastecimentoStatus =
  "issued" | "completed" | "cancelled" | "expired";

export type FrotaPrefeituraOption = {
  is_prefeitura?: boolean;
  nome_fantasia?: string | null;
  brasao_url: string | null;
  id: string;
  nome: string;
};

export type FrotaPostoCredenciado = {
  cnpj: string | null;
  created_at?: string;
  endereco: string | null;
  id: string;
  nome: string;
  prefeitura_id: string;
  prefeitura_nome?: string;
  status: "active" | "inactive";
  telefone: string | null;
};

export type FrotaVeiculo = {
  consulta_status?: string | null;
  consulta_mensagem?: string | null;
  abastecimentos: FrotaVeiculoAbastecimento[];
  anexos: FrotaVeiculoAnexo[];
  ano: number;
  ano_fabricacao: number | null;
  ano_modelo: number | null;
  capacidade: string | null;
  carroceria: string | null;
  categoria: string | null;
  chassi: string | null;
  cilindrada: string | null;
  cmt: string | null;
  created_at: string;
  cor: string | null;
  data_aquisicao: string | null;
  data_documento: string | null;
  eixos: string | null;
  exercicio: number | null;
  id: string;
  licenciado: string | null;
  local_registro: string | null;
  lotacao: string | null;
  lugares: string | null;
  marca: string;
  modelo: string;
  motor: string | null;
  municipio_emplacamento: string | null;
  observacoes: string | null;
  placa: string;
  placa_anterior: string | null;
  potencia: string | null;
  prefeitura_id: string;
  prefeitura_nome: string;
  prefixo: string;
  principal_condutor: string | null;
  proprietario_anterior: string | null;
  proprietario_atual: string | null;
  proprietario_documento: string | null;
  quilometragem: number | null;
  renavam: string | null;
  restricao_venda: string | null;
  restricoes: string | null;
  /** Valor legado usado somente na reprodução de relatórios históricos. */
  secretaria: string | null;
  secretaria_id?: string | null;
  situacao_veicular: string | null;
  status: VeiculoStatus;
  tipo: string;
  versao: string | null;
  combustivel: string | null;
  especie: string | null;
  foto_path: string | null;
  foto_url: string | null;
  manutencoes: FrotaVeiculoManutencao[];
  origem_dados: string | null;
  vencimentos: Partial<Record<VencimentoTipo, string>>;
};

export type FrotaVencimento = {
  ano: number | null;
  data_vencimento: string;
  descricao: string | null;
  dias_restantes: number;
  external_ref: string | null;
  id: string;
  marca: string;
  modelo: string;
  origem: string;
  placa: string;
  prefixo: string;
  prefeitura_id: string;
  proximo_vencimento_pago: string | null;
  status: VencimentoStatus;
  tipo: VencimentoTipo;
  total_pagamentos: number;
  ultimo_pagamento: string | null;
  ultimo_pagamento_status: PagamentoStatus | null;
  ultimo_pagamento_valor: number | null;
  valor: number | null;
  veiculo_id: string;
};

export type FrotaDebitoVeicular = {
  provider?: string;
  amount: number;
  created_at: string;
  description: string | null;
  due_date: string | null;
  expiration_date: string | null;
  id: string;
  is_expired: boolean;
  required: boolean;
  title: string | null;
  type: string | null;
  year: number | null;
};

export type FrotaDebitoConsulta = {
  client_request_id: string;
  created_at: string;
  error_message: string | null;
  id: string;
  id_consult: string | null;
  status: "pending" | "processing" | "success" | "error" | "disabled";
};

export type FrotaMultaVeicular = {
  data_infracao: string | null;
  descricao: string | null;
  hora: string | null;
  id: string;
  local_complemento: string | null;
  numero_auto: string;
  origem: "historico" | "manual" | "pagar";
  situacao: string | null;
  valor: number;
};

export type FrotaRecursoInfracao = {
  detalhamento_infracao: string | null;
  id: string;
  numero_auto: string | null;
  processo: string | null;
  resultado_processo: string | null;
};

export type FrotaProcessoVeicular = {
  final_em: string | null;
  id: string;
  inicio_em: string | null;
  interessado: string | null;
  processo: string | null;
  servicos: Array<{
    data?: string;
    hora?: string;
    nome?: string;
  }>;
  situacao: string | null;
};

export type FrotaAbastecimento = {
  anexos: FrotaAbastecimentoAnexo[];
  ano: number | null;
  arla_incluso: boolean;
  arla_litros: number | null;
  arla_valor_litro: number | null;
  arla_valor_total: number | null;
  completed_at: string | null;
  combustivel: string;
  created_at: string;
  data_abastecimento: string;
  consumo_medio_km_l: number | null;
  cancelled_at: string | null;
  concluido_por: string | null;
  emitido_por: string | null;
  expires_at: string | null;
  fornecedor: string | null;
  id: string;
  litros: number | null;
  marca: string;
  modelo: string;
  motorista: string;
  motivo_cancelamento: string | null;
  numero_ordem: string;
  numero_nota_fiscal: string | null;
  observacoes: string | null;
  placa: string;
  posto_id: string | null;
  posto_nome: string | null;
  prefeitura_id: string;
  prefeitura_brasao_url: string | null;
  prefeitura_nome: string;
  print_count: number;
  last_printed_at: string | null;
  quilometragem: number | null;
  renavam: string | null;
  /** Valor legado usado somente na reprodução de relatórios históricos. */
  secretaria: string | null;
  secretaria_id?: string | null;
  status: AbastecimentoStatus;
  valor_litro: number | null;
  valor_total: number | null;
  veiculo_id: string;
};

export type FrotaVeiculoAbastecimento = Pick<
  FrotaAbastecimento,
  | "arla_incluso"
  | "arla_litros"
  | "arla_valor_litro"
  | "arla_valor_total"
  | "completed_at"
  | "combustivel"
  | "created_at"
  | "data_abastecimento"
  | "concluido_por"
  | "emitido_por"
  | "expires_at"
  | "id"
  | "litros"
  | "motorista"
  | "numero_nota_fiscal"
  | "numero_ordem"
  | "posto_id"
  | "posto_nome"
  | "print_count"
  | "quilometragem"
  | "status"
  | "valor_litro"
  | "valor_total"
  | "veiculo_id"
>;

export type ManutencaoStatus = "open" | "completed" | "cancelled";

export type FrotaAnexo = {
  created_at?: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  file_type: string | null;
  id: string;
  signed_url?: string | null;
};

export type FrotaVeiculoAnexo = FrotaAnexo;
export type FrotaManutencaoAnexo = FrotaAnexo;
export type FrotaAbastecimentoAnexo = FrotaAnexo;

export type FrotaManutencao = {
  cancelled_at: string | null;
  motivo_cancelamento: string | null;
  anexos: FrotaManutencaoAnexo[];
  created_at: string;
  data_entrada: string;
  data_saida: string | null;
  descricao: string;
  id: string;
  marca: string;
  modelo: string;
  observacoes: string | null;
  oficina: string | null;
  oficina_id: string | null;
  placa: string;
  prefeitura_id: string;
  quilometragem: number | null;
  responsavel: string | null;
  status: ManutencaoStatus;
  tipo: string;
  valor: number | null;
  veiculo_id: string;
};

export type FrotaVeiculoManutencao = Pick<
  FrotaManutencao,
  | "created_at"
  | "data_entrada"
  | "data_saida"
  | "descricao"
  | "id"
  | "observacoes"
  | "oficina"
  | "quilometragem"
  | "responsavel"
  | "status"
  | "tipo"
  | "valor"
  | "veiculo_id"
>;

type VeiculoRow = Omit<FrotaVeiculo, "prefeitura_nome"> & {
  frota_debito_consultas?: Array<{
    status: string;
    error_message: string | null;
    created_at: string;
    request_payload: { purpose?: string } | null;
  }>;
  prefeituras: {
    nome: string;
  } | null;
};

function registrationLookupSummary(
  consultas: VeiculoRow["frota_debito_consultas"],
) {
  const latest = consultas
    ?.filter((consulta) => consulta.request_payload?.purpose === "registration")
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  return {
    consulta_status: latest?.status ?? null,
    consulta_mensagem: latest?.error_message ?? null,
  };
}

type VencimentoRow = {
  data_vencimento: string;
  descricao: string | null;
  external_ref: string | null;
  id: string;
  origem: string | null;
  status: VencimentoStatus;
  tipo: VencimentoTipo;
  valor: number | null;
  veiculo_id: string;
  frota_veiculos: {
    ano: number;
    marca: string;
    modelo: string;
    placa: string;
    prefeitura_id: string;
    prefixo: string;
  } | null;
};

type PagamentoRow = {
  data_pagamento: string;
  proximo_vencimento: string;
  status: PagamentoStatus | null;
  valor_total: number | null;
  vencimento_id: string;
};

type ManutencaoRow = Omit<
  FrotaManutencao,
  "anexos" | "marca" | "modelo" | "placa"
> & {
  frota_veiculos: {
    marca: string;
    modelo: string;
    placa: string;
  } | null;
};

type AbastecimentoRow = Omit<
  FrotaAbastecimento,
  | "ano"
  | "marca"
  | "modelo"
  | "placa"
  | "prefeitura_brasao_url"
  | "prefeitura_nome"
  | "renavam"
  | "secretaria"
> & {
  frota_veiculos: {
    ano: number;
    marca: string;
    modelo: string;
    placa: string;
    renavam: string | null;
    /** Valor legado usado somente na reprodução de relatórios históricos. */
    secretaria: string | null;
    secretaria_id?: string | null;
    prefeituras: {
      brasao_url: string | null;
      nome: string;
    } | null;
  } | null;
  frota_postos_credenciados: {
    nome: string;
  } | null;
};

type AbastecimentoAnexoRow = FrotaAbastecimentoAnexo & {
  abastecimento_id: string;
};

type VeiculoAbastecimentoRow = Omit<FrotaVeiculoAbastecimento, "posto_nome"> & {
  frota_postos_credenciados: {
    nome: string;
  } | null;
};

export async function getFrotasData(params?: {
  ids?: string[];
  lightweight?: boolean;
  contextOnly?: boolean;
  prefeituraId?: string;
  query?: string;
  status?: string;
  veiculoId?: string;
  vencimentoStatus?: string;
  vencimentoTipo?: string;
}) {
  const supabase = createSupabaseServerClient();
  const prefeituras = await listarEmpresasLicenciadas(
    supabase,
    "frotas-publicas",
    new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(
      new Date(),
    ),
  );
  if (
    params?.prefeituraId &&
    !prefeituras.some((e) => e.id === params.prefeituraId)
  )
    notFound();
  const selectedPrefeituraId = params?.prefeituraId ?? prefeituras[0]?.id;
  if (!selectedPrefeituraId) return emptyFrotasData(prefeituras);

  let veiculosQuery = supabase
    .from("frota_veiculos")
    .select(
      "id,prefeitura_id,placa,placa_anterior,prefixo,marca,modelo,ano,exercicio,ano_fabricacao,ano_modelo,lugares,lotacao,tipo,cor,combustivel,carroceria,categoria,capacidade,potencia,cilindrada,motor,cmt,eixos,chassi,data_aquisicao,data_documento,municipio_emplacamento,local_registro,situacao_veicular,proprietario_atual,proprietario_documento,proprietario_anterior,restricao_venda,restricoes,licenciado,origem_dados,principal_condutor,especie,versao,secretaria,secretaria_id,quilometragem,renavam,status,observacoes,foto_url,foto_path,created_at,prefeituras:empresas(nome),frota_debito_consultas(status,error_message,created_at,request_payload)",
    )
    .order("created_at", { ascending: false });

  let vencimentosQuery = supabase
    .from("frota_vencimentos")
    .select(
      "id,veiculo_id,tipo,data_vencimento,status,descricao,valor,origem,external_ref,frota_veiculos(prefeitura_id,placa,prefixo,marca,modelo,ano)",
    )
    .order("data_vencimento", { ascending: true });

  if (selectedPrefeituraId && !params?.veiculoId) {
    veiculosQuery = veiculosQuery.eq(
      "prefeitura_id",
      selectedPrefeituraId ?? "00000000-0000-0000-0000-000000000000",
    );
    vencimentosQuery = vencimentosQuery.eq(
      "prefeitura_id",
      selectedPrefeituraId ?? "00000000-0000-0000-0000-000000000000",
    );
  }

  if (params?.veiculoId) {
    veiculosQuery = veiculosQuery.in(
      "prefeitura_id",
      prefeituras.map((e) => e.id),
    );
    vencimentosQuery = vencimentosQuery.in(
      "prefeitura_id",
      prefeituras.map((e) => e.id),
    );
    veiculosQuery = veiculosQuery.eq("id", params.veiculoId);
    vencimentosQuery = vencimentosQuery.eq("veiculo_id", params.veiculoId);
  }

  if (params?.status && params.status !== "all") {
    veiculosQuery = veiculosQuery.eq("status", params.status);
  }

  if (params?.ids) veiculosQuery = veiculosQuery.in("id", params.ids);
  if (params?.contextOnly) veiculosQuery = veiculosQuery.limit(0);
  if (params?.lightweight) vencimentosQuery = vencimentosQuery.limit(0);
  const [veiculosResult, vencimentosResult] = await Promise.all([
    veiculosQuery,
    vencimentosQuery,
  ]);

  if (veiculosResult.error) {
    if (isMissingFrotasTableError(veiculosResult.error.message)) {
      return emptyFrotasData(prefeituras, selectedPrefeituraId);
    }

    throw new Error(veiculosResult.error.message);
  }

  if (vencimentosResult.error) {
    if (isMissingFrotasTableError(vencimentosResult.error.message)) {
      return emptyFrotasData(prefeituras, selectedPrefeituraId);
    }

    throw new Error(vencimentosResult.error.message);
  }

  const vencimentoDatesByVeiculo = new Map<
    string,
    Partial<Record<VencimentoTipo, string>>
  >();
  ((vencimentosResult.data ?? []) as unknown as VencimentoRow[]).forEach(
    (vencimento) => {
      const current = vencimentoDatesByVeiculo.get(vencimento.veiculo_id) ?? {};
      current[vencimento.tipo] = vencimento.data_vencimento;
      vencimentoDatesByVeiculo.set(vencimento.veiculo_id, current);
    },
  );

  const vencimentoIds = (
    (vencimentosResult.data ?? []) as unknown as VencimentoRow[]
  ).map((vencimento) => vencimento.id);
  const pagamentosByVencimento = new Map<
    string,
    {
      proximo_vencimento_pago: string | null;
      total_pagamentos: number;
      ultimo_pagamento: string | null;
      ultimo_pagamento_status: PagamentoStatus | null;
      ultimo_pagamento_valor: number | null;
    }
  >();

  if (vencimentoIds.length) {
    const pagamentosResult = await supabase
      .from("frota_vencimento_pagamentos")
      .select(
        "vencimento_id,data_pagamento,proximo_vencimento,valor_total,status",
      )
      .in("vencimento_id", vencimentoIds)
      .order("data_pagamento", { ascending: false });

    if (!pagamentosResult.error) {
      ((pagamentosResult.data ?? []) as unknown as PagamentoRow[]).forEach(
        (pagamento) => {
          const current = pagamentosByVencimento.get(pagamento.vencimento_id);

          pagamentosByVencimento.set(pagamento.vencimento_id, {
            proximo_vencimento_pago:
              current?.proximo_vencimento_pago ?? pagamento.proximo_vencimento,
            total_pagamentos: (current?.total_pagamentos ?? 0) + 1,
            ultimo_pagamento:
              current?.ultimo_pagamento ?? pagamento.data_pagamento,
            ultimo_pagamento_status:
              current?.ultimo_pagamento_status ?? pagamento.status,
            ultimo_pagamento_valor:
              current?.ultimo_pagamento_valor ?? pagamento.valor_total,
          });
        },
      );
    }
  }

  const veiculoIds = (
    (veiculosResult.data ?? []) as unknown as VeiculoRow[]
  ).map((veiculo) => veiculo.id);
  const abastecimentosByVeiculo = new Map<
    string,
    FrotaVeiculoAbastecimento[]
  >();
  const anexosByVeiculo = new Map<string, FrotaVeiculoAnexo[]>();
  const manutencoesByVeiculo = new Map<string, FrotaVeiculoManutencao[]>();

  if (veiculoIds.length && !params?.lightweight) {
    const [anexosResult, manutencoesResult, abastecimentosResult] =
      await Promise.all([
        supabase
          .from("frota_veiculo_anexos")
          .select(
            "id,veiculo_id,file_name,file_path,file_type,file_size,created_at",
          )
          .in("veiculo_id", veiculoIds)
          .order("created_at", { ascending: false }),
        supabase
          .from("frota_manutencoes")
          .select(
            "id,veiculo_id,tipo,descricao,oficina,oficina_id,responsavel,data_entrada,data_saida,valor,quilometragem,status,observacoes,created_at",
          )
          .in("veiculo_id", veiculoIds)
          .order("data_entrada", { ascending: false })
          .order("created_at", { ascending: false }),
        supabase
          .from("frota_abastecimentos")
          .select(
            "id,veiculo_id,posto_id,numero_ordem,data_abastecimento,motorista,combustivel,quilometragem,litros,valor_litro,valor_total,arla_incluso,arla_litros,arla_valor_litro,arla_valor_total,status,emitido_por,concluido_por,numero_nota_fiscal,completed_at,created_at,expires_at,print_count,frota_postos_credenciados(nome)",
          )
          .in("veiculo_id", veiculoIds)
          .order("data_abastecimento", { ascending: false })
          .order("created_at", { ascending: false }),
      ]);

    if (!anexosResult.error) {
      const anexos = await withSignedUrls(
        supabase,
        "frota-veiculo-anexos",
        (anexosResult.data ?? []) as Array<
          FrotaVeiculoAnexo & { veiculo_id: string }
        >,
      );

      anexos.forEach((anexo) => {
        const current = anexosByVeiculo.get(anexo.veiculo_id) ?? [];
        current.push({
          created_at: anexo.created_at,
          file_name: anexo.file_name,
          file_path: anexo.file_path,
          file_size: anexo.file_size,
          file_type: anexo.file_type,
          id: anexo.id,
          signed_url: anexo.signed_url,
        });
        anexosByVeiculo.set(anexo.veiculo_id, current);
      });
    }

    if (!manutencoesResult.error) {
      ((manutencoesResult.data ?? []) as FrotaVeiculoManutencao[]).forEach(
        (manutencao) => {
          const current = manutencoesByVeiculo.get(manutencao.veiculo_id) ?? [];
          current.push(manutencao);
          manutencoesByVeiculo.set(manutencao.veiculo_id, current);
        },
      );
    }

    if (!abastecimentosResult.error) {
      (
        (abastecimentosResult.data ??
          []) as unknown as VeiculoAbastecimentoRow[]
      ).forEach((abastecimento) => {
        const current =
          abastecimentosByVeiculo.get(abastecimento.veiculo_id) ?? [];
        const { frota_postos_credenciados, ...baseAbastecimento } =
          abastecimento;

        current.push({
          ...baseAbastecimento,
          posto_nome: frota_postos_credenciados?.nome ?? null,
        });
        abastecimentosByVeiculo.set(abastecimento.veiculo_id, current);
      });
    }
  }

  let veiculos = ((veiculosResult.data ?? []) as unknown as VeiculoRow[]).map(
    (veiculo) => ({
      ...registrationLookupSummary(veiculo.frota_debito_consultas),
      abastecimentos: abastecimentosByVeiculo.get(veiculo.id) ?? [],
      anexos: anexosByVeiculo.get(veiculo.id) ?? [],
      ano: veiculo.ano,
      ano_fabricacao: veiculo.ano_fabricacao,
      ano_modelo: veiculo.ano_modelo,
      capacidade: veiculo.capacidade,
      carroceria: veiculo.carroceria,
      categoria: veiculo.categoria,
      chassi: veiculo.chassi,
      cilindrada: veiculo.cilindrada,
      cmt: veiculo.cmt,
      created_at: veiculo.created_at,
      cor: veiculo.cor,
      data_aquisicao: veiculo.data_aquisicao,
      data_documento: veiculo.data_documento,
      eixos: veiculo.eixos,
      exercicio: veiculo.exercicio,
      id: veiculo.id,
      licenciado: veiculo.licenciado,
      local_registro: veiculo.local_registro,
      lotacao: veiculo.lotacao,
      lugares: veiculo.lugares,
      marca: veiculo.marca,
      modelo: veiculo.modelo,
      motor: veiculo.motor,
      municipio_emplacamento: veiculo.municipio_emplacamento,
      observacoes: veiculo.observacoes,
      placa: veiculo.placa,
      placa_anterior: veiculo.placa_anterior,
      potencia: veiculo.potencia,
      prefeitura_id: veiculo.prefeitura_id,
      prefeitura_nome: veiculo.prefeituras?.nome ?? "-",
      prefixo: veiculo.prefixo,
      principal_condutor: veiculo.principal_condutor,
      proprietario_anterior: veiculo.proprietario_anterior,
      proprietario_atual: veiculo.proprietario_atual,
      proprietario_documento: veiculo.proprietario_documento,
      quilometragem: veiculo.quilometragem,
      renavam: veiculo.renavam,
      restricao_venda: veiculo.restricao_venda,
      restricoes: veiculo.restricoes,
      secretaria: veiculo.secretaria,
      secretaria_id: veiculo.secretaria_id,
      situacao_veicular: veiculo.situacao_veicular,
      status: veiculo.status,
      tipo: veiculo.tipo,
      versao: veiculo.versao,
      combustivel: veiculo.combustivel,
      especie: veiculo.especie,
      foto_path: veiculo.foto_path,
      foto_url: veiculo.foto_url,
      manutencoes: manutencoesByVeiculo.get(veiculo.id) ?? [],
      origem_dados: veiculo.origem_dados,
      vencimentos: vencimentoDatesByVeiculo.get(veiculo.id) ?? {},
    }),
  );

  if (params?.query && !params.ids) {
    const normalizedQuery = params.query.toLowerCase();
    veiculos = veiculos.filter((veiculo) =>
      [
        veiculo.placa,
        veiculo.prefixo,
        veiculo.marca,
        veiculo.modelo,
        veiculo.tipo,
        veiculo.versao,
        veiculo.combustivel,
        veiculo.cor,
        veiculo.categoria,
        veiculo.chassi,
        veiculo.placa_anterior,
        veiculo.municipio_emplacamento,
        veiculo.local_registro,
        veiculo.situacao_veicular,
        veiculo.licenciado,
        veiculo.proprietario_atual,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }

  const vencimentos = (
    (vencimentosResult.data ?? []) as unknown as VencimentoRow[]
  )
    .map((vencimento) => ({
      ano: vencimento.frota_veiculos?.ano ?? null,
      data_vencimento: vencimento.data_vencimento,
      descricao: vencimento.descricao,
      dias_restantes: getDaysUntil(vencimento.data_vencimento),
      external_ref: vencimento.external_ref,
      id: vencimento.id,
      marca: vencimento.frota_veiculos?.marca ?? "-",
      modelo: vencimento.frota_veiculos?.modelo ?? "-",
      origem: vencimento.origem ?? "manual",
      placa: vencimento.frota_veiculos?.placa ?? "-",
      prefeitura_id: vencimento.frota_veiculos?.prefeitura_id ?? "",
      prefixo: vencimento.frota_veiculos?.prefixo ?? "-",
      proximo_vencimento_pago:
        pagamentosByVencimento.get(vencimento.id)?.proximo_vencimento_pago ??
        null,
      status: vencimento.status,
      tipo: vencimento.tipo,
      total_pagamentos:
        pagamentosByVencimento.get(vencimento.id)?.total_pagamentos ?? 0,
      ultimo_pagamento:
        pagamentosByVencimento.get(vencimento.id)?.ultimo_pagamento ?? null,
      ultimo_pagamento_status:
        pagamentosByVencimento.get(vencimento.id)?.ultimo_pagamento_status ??
        null,
      ultimo_pagamento_valor:
        pagamentosByVencimento.get(vencimento.id)?.ultimo_pagamento_valor ??
        null,
      valor: vencimento.valor,
      veiculo_id: vencimento.veiculo_id,
    }))
    .filter((vencimento) =>
      params?.vencimentoStatus === "paid"
        ? vencimento.total_pagamentos > 0
        : vencimento.status !== "paid",
    )
    .filter((vencimento) =>
      params?.vencimentoTipo && params.vencimentoTipo !== "all"
        ? vencimento.tipo === params.vencimentoTipo
        : true,
    )
    .filter((vencimento) => {
      if (!params?.vencimentoStatus || params.vencimentoStatus === "all") {
        return true;
      }

      if (params.vencimentoStatus === "expired") {
        return vencimento.dias_restantes < 0 && vencimento.status !== "paid";
      }

      if (params.vencimentoStatus === "due-soon") {
        return (
          vencimento.dias_restantes >= 0 &&
          vencimento.dias_restantes <= 30 &&
          vencimento.status !== "paid"
        );
      }

      return true;
    });

  return {
    metricas: {
      ativos: veiculos.filter((veiculo) => veiculo.status === "active").length,
      emManutencao: veiculos.filter(
        (veiculo) => veiculo.status === "maintenance",
      ).length,
      total: veiculos.length,
      vencidos: vencimentos.filter(
        (vencimento) => vencimento.dias_restantes < 0,
      ).length,
      vencendo: vencimentos.filter(
        (vencimento) =>
          vencimento.dias_restantes >= 0 && vencimento.dias_restantes <= 30,
      ).length,
    },
    prefeituras,
    selectedPrefeituraId,
    veiculos,
    vencimentos,
  };
}

export async function getVeiculoDebitosData(veiculoId: string) {
  const supabase = createSupabaseServerClient();
  const consultasResult = await supabase
    .from("frota_debito_consultas")
    .select("id,client_request_id,id_consult,status,error_message,created_at")
    .eq("veiculo_id", veiculoId)
    .order("created_at", { ascending: false })
    .limit(5);

  if (consultasResult.error) {
    if (isMissingFrotasTableError(consultasResult.error.message)) {
      return { consultas: [], debitos: [] };
    }

    throw new Error(consultasResult.error.message);
  }

  // Preserve debts from the last successful historical import.
  const latestSuccessful = await supabase
    .from("frota_debito_consultas")
    .select("id")
    .eq("veiculo_id", veiculoId)
    .eq("status", "success")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestSuccessful.error) {
    throw new Error(latestSuccessful.error.message);
  }
  const latestConsultaId = latestSuccessful.data?.id;

  if (!latestConsultaId) {
    return {
      consultas: (consultasResult.data ?? []) as FrotaDebitoConsulta[],
      debitos: [],
    };
  }

  const debitosResult = await supabase
    .from("frota_debitos_veiculares")
    .select(
      "id,provider,type,title,description,amount,due_date,expiration_date,is_expired,required,year,created_at",
    )
    .eq("consulta_id", latestConsultaId)
    .order("amount", { ascending: false });

  if (debitosResult.error) {
    throw new Error(debitosResult.error.message);
  }

  return {
    consultas: (consultasResult.data ?? []) as FrotaDebitoConsulta[],
    debitos: (debitosResult.data ?? []) as FrotaDebitoVeicular[],
  };
}

export async function getVeiculoConsultaVeicularData(veiculoId: string) {
  const supabase = createSupabaseServerClient();
  const latest = await supabase
    .from("frota_debito_consultas")
    .select("id")
    .eq("veiculo_id", veiculoId)
    .eq("provider", "plexi")
    .eq("status", "success")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latest.error) throw new Error(latest.error.message);
  let finesQuery = supabase
    .from("frota_multas_veiculares")
    .select(
      "id,origem,numero_auto,situacao,descricao,data_infracao,hora,local_complemento,valor",
    )
    .eq("veiculo_id", veiculoId)
    .order("data_infracao", { ascending: false });
  if (latest.data)
    finesQuery = finesQuery.or(
      `origem.eq.manual,consulta_id.eq.${latest.data.id}`,
    );
  const multasResult = await finesQuery;

  if (multasResult.error) {
    if (isMissingFrotasTableError(multasResult.error.message)) {
      return { multas: [], processos: [], recursos: [] };
    }

    throw new Error(multasResult.error.message);
  }

  let resourcesQuery = supabase
    .from("frota_recursos_infracao")
    .select("id,processo,numero_auto,detalhamento_infracao,resultado_processo")
    .eq("veiculo_id", veiculoId)
    .order("created_at", { ascending: false });
  if (latest.data)
    resourcesQuery = resourcesQuery.eq("consulta_id", latest.data.id);
  const recursosResult = await resourcesQuery;

  if (recursosResult.error) {
    throw new Error(recursosResult.error.message);
  }

  let processesQuery = supabase
    .from("frota_processos_veiculares")
    .select("id,processo,inicio_em,final_em,interessado,situacao,servicos")
    .eq("veiculo_id", veiculoId)
    .order("created_at", { ascending: false });
  if (latest.data)
    processesQuery = processesQuery.eq("consulta_id", latest.data.id);
  const processosResult = await processesQuery;

  if (processosResult.error) {
    throw new Error(processosResult.error.message);
  }

  return {
    multas: (multasResult.data ?? []) as FrotaMultaVeicular[],
    processos: (processosResult.data ?? []) as FrotaProcessoVeicular[],
    recursos: (recursosResult.data ?? []) as FrotaRecursoInfracao[],
  };
}

export async function getVeiculoPlexiResumo(veiculoId: string) {
  const { data, error } = await createSupabaseServerClient()
    .from("frota_debito_consultas")
    .select("created_at,response_payload")
    .eq("veiculo_id", veiculoId)
    .eq("provider", "plexi")
    .eq("status", "success")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.response_payload) return null;
  let result = data.response_payload as Record<string, unknown>;
  for (const key of ["data", "result", "body", "payload"]) {
    if (
      result[key] &&
      typeof result[key] === "object" &&
      !Array.isArray(result[key])
    )
      result = result[key] as Record<string, unknown>;
  }
  const pendingFines = Array.isArray(result.multasPagar)
    ? (result.multasPagar as Array<{ valor?: number }>)
    : [];
  return {
    consultadoEm: data.created_at as string,
    temPdf: typeof result.pdf === "string" && Boolean(result.pdf),
    totalMultasPagar: pendingFines.reduce(
      (sum, fine) => sum + (Number(fine.valor) || 0),
      0,
    ),
    multasPagar: pendingFines.length,
    historicoMultas: Array.isArray(result.historicoMultas)
      ? result.historicoMultas.length
      : 0,
    dividaAtiva: Array.isArray(result.ipvaDividaAtiva)
      ? (result.ipvaDividaAtiva as Array<Record<string, unknown>>)
      : [],
  };
}

export async function getManutencoesData(params?: {
  ids?: string[];
  lightweight?: boolean;
  contextOnly?: boolean;
  registroId?: string;
  prefeituraId?: string;
  query?: string;
  status?: string;
}) {
  const supabase = createSupabaseServerClient();
  const frotasData = await getFrotasData({
    prefeituraId: params?.prefeituraId,
    lightweight: params?.lightweight,
    contextOnly: params?.contextOnly,
  });
  const selectedPrefeituraId =
    params?.prefeituraId ?? frotasData.selectedPrefeituraId;

  const { data: oficinaRows, error: oficinaError } = await supabase
    .from("frota_oficinas")
    .select(
      "id,prefeitura_id,nome,documento,telefone,responsavel,endereco,especialidades,observacoes,status",
    )
    .eq(
      "prefeitura_id",
      frotasData.selectedPrefeituraId ?? "00000000-0000-0000-0000-000000000000",
    )
    .order("nome");
  if (oficinaError) throw new Error("Não foi possível carregar as oficinas.");
  const oficinas = (oficinaRows ?? []) as FrotaOficina[];

  let manutencoesQuery = supabase
    .from("frota_manutencoes")
    .select(
      "id,prefeitura_id,veiculo_id,tipo,descricao,oficina,oficina_id,responsavel,data_entrada,data_saida,valor,quilometragem,status,observacoes,cancelled_at,motivo_cancelamento,created_at,frota_veiculos(marca,modelo,placa)",
    )
    .order("data_entrada", { ascending: false })
    .order("created_at", { ascending: false });

  {
    manutencoesQuery = manutencoesQuery.eq(
      "prefeitura_id",
      selectedPrefeituraId ?? "00000000-0000-0000-0000-000000000000",
    );
  }

  if (params?.status && params.status !== "all") {
    manutencoesQuery = manutencoesQuery.eq("status", params.status);
  }

  if (params?.registroId)
    manutencoesQuery = manutencoesQuery.eq(
      "id",
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        params.registroId,
      )
        ? params.registroId
        : "00000000-0000-0000-0000-000000000000",
    );
  if (params?.ids) manutencoesQuery = manutencoesQuery.in("id", params.ids);
  const manutencoesResult = await manutencoesQuery;

  if (manutencoesResult.error) {
    if (isMissingFrotasTableError(manutencoesResult.error.message)) {
      return {
        ...frotasData,
        oficinas,
        manutencoes: [],
      };
    }

    throw new Error(manutencoesResult.error.message);
  }

  const manutencaoIds = (
    (manutencoesResult.data ?? []) as unknown as ManutencaoRow[]
  ).map((manutencao) => manutencao.id);
  const anexosByManutencao = new Map<string, FrotaManutencaoAnexo[]>();

  if (manutencaoIds.length) {
    const anexosResult = await supabase
      .from("frota_manutencao_anexos")
      .select(
        "id,manutencao_id,file_name,file_path,file_type,file_size,created_at",
      )
      .in("manutencao_id", manutencaoIds)
      .order("created_at", { ascending: false });

    if (!anexosResult.error) {
      const anexos = await withSignedUrls(
        supabase,
        "frota-manutencao",
        (anexosResult.data ?? []) as Array<
          FrotaManutencaoAnexo & { manutencao_id: string }
        >,
      );

      anexos.forEach((anexo) => {
        const current = anexosByManutencao.get(anexo.manutencao_id) ?? [];
        current.push({
          created_at: anexo.created_at,
          file_name: anexo.file_name,
          file_path: anexo.file_path,
          file_size: anexo.file_size,
          file_type: anexo.file_type,
          id: anexo.id,
          signed_url: anexo.signed_url,
        });
        anexosByManutencao.set(anexo.manutencao_id, current);
      });
    }
  }

  let manutencoes = (
    (manutencoesResult.data ?? []) as unknown as ManutencaoRow[]
  ).map((manutencao) => ({
    ...manutencao,
    anexos: anexosByManutencao.get(manutencao.id) ?? [],
    marca: manutencao.frota_veiculos?.marca ?? "-",
    modelo: manutencao.frota_veiculos?.modelo ?? "-",
    placa: manutencao.frota_veiculos?.placa ?? "-",
  }));

  if (params?.query && !params.ids) {
    const normalizedQuery = params.query.toLowerCase();
    manutencoes = manutencoes.filter((manutencao) =>
      [
        manutencao.placa,
        manutencao.marca,
        manutencao.modelo,
        manutencao.tipo,
        manutencao.descricao,
        manutencao.oficina,
        manutencao.responsavel,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }

  return {
    ...frotasData,
    oficinas,
    manutencoes,
  };
}

export async function getAbastecimentosData(params?: {
  ids?: string[];
  lightweight?: boolean;
  contextOnly?: boolean;
  orderId?: string;
  completedFrom?: string;
  completedTo?: string;
  postoId?: string;
  prefeituraId?: string;
  query?: string;
  status?: string;
}) {
  const supabase = createSupabaseServerClient();
  const frotasData = await getFrotasData({
    prefeituraId: params?.prefeituraId,
    lightweight: params?.lightweight,
    contextOnly: params?.contextOnly,
  });
  const selectedPrefeituraId =
    params?.prefeituraId ?? frotasData.selectedPrefeituraId;

  const { data: motoristaRows, error: motoristaError } = await supabase
    .from("frota_motoristas")
    .select("id,nome,cpf")
    .eq(
      "prefeitura_id",
      selectedPrefeituraId ?? "00000000-0000-0000-0000-000000000000",
    )
    .eq("status", "active")
    .order("nome");
  if (motoristaError) throw new Error(motoristaError.message);
  const motoristas = (motoristaRows ?? []) as {
    id: string;
    nome: string;
    cpf: string | null;
  }[];

  let postosQuery = supabase
    .from("frota_postos_credenciados")
    .select("id,prefeitura_id,nome,cnpj,endereco,telefone,status")
    .eq("status", "active")
    .order("nome");

  let abastecimentosQuery = supabase
    .from("frota_abastecimentos")
    .select(
      "id,prefeitura_id,veiculo_id,posto_id,numero_ordem,data_abastecimento,motorista,fornecedor,combustivel,quilometragem,litros,valor_litro,valor_total,arla_incluso,arla_litros,arla_valor_litro,arla_valor_total,status,observacoes,emitido_por,expires_at,concluido_por,numero_nota_fiscal,completed_at,created_at,print_count,last_printed_at,motivo_cancelamento,cancelled_at,frota_veiculos(placa,marca,modelo,ano,renavam,secretaria,prefeituras:empresas(nome,brasao_url)),frota_postos_credenciados(nome)",
    )
    .order("data_abastecimento", { ascending: false })
    .order("created_at", { ascending: false });

  {
    postosQuery = postosQuery.eq(
      "prefeitura_id",
      selectedPrefeituraId ?? "00000000-0000-0000-0000-000000000000",
    );
    abastecimentosQuery = abastecimentosQuery.eq(
      "prefeitura_id",
      selectedPrefeituraId ?? "00000000-0000-0000-0000-000000000000",
    );
  }

  const nowIso = new Date().toISOString();
  if (params?.status === "expired") {
    abastecimentosQuery = abastecimentosQuery.or(
      `status.eq.expired,and(status.eq.issued,expires_at.lte.${nowIso})`,
    );
  } else if (params?.status === "issued") {
    abastecimentosQuery = abastecimentosQuery
      .eq("status", "issued")
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`);
  } else if (params?.status && params.status !== "all") {
    abastecimentosQuery = abastecimentosQuery.eq("status", params.status);
  }

  if (params?.postoId) {
    abastecimentosQuery = abastecimentosQuery.eq("posto_id", params.postoId);
  }

  if (params?.orderId)
    abastecimentosQuery = abastecimentosQuery.eq("id", params.orderId);

  if (params?.completedFrom)
    abastecimentosQuery = abastecimentosQuery.gte(
      "completed_at",
      `${params.completedFrom}T00:00:00-03:00`,
    );
  if (params?.completedTo) {
    const end = new Date(`${params.completedTo}T00:00:00-03:00`);
    end.setUTCDate(end.getUTCDate() + 1);
    abastecimentosQuery = abastecimentosQuery.lt(
      "completed_at",
      end.toISOString(),
    );
  }
  if (params?.ids) abastecimentosQuery = abastecimentosQuery.in("id", params.ids);
  // Station history totals must include every matching record, beyond the API page limit.
  const loadOrders = async () => {
    const first = await abastecimentosQuery.range(0, 999);
    if (
      !params?.postoId ||
      params.status !== "completed" ||
      first.error ||
      !first.data
    )
      return first;
    const rows = [...first.data];
    let batchSize = first.data.length;
    while (batchSize === 1000) {
      const next = await abastecimentosQuery.range(
        rows.length,
        rows.length + 999,
      );
      if (next.error) return next;
      rows.push(...(next.data ?? []));
      batchSize = next.data?.length ?? 0;
    }
    return { ...first, data: rows };
  };

  const [postosResult, abastecimentosResult] = await Promise.all([
    postosQuery,
    loadOrders(),
  ]);

  if (postosResult.error) {
    if (isMissingFrotasTableError(postosResult.error.message)) {
      return {
        ...frotasData,
        motoristas,
        abastecimentos: [],
        postos: [],
      };
    }

    throw new Error(postosResult.error.message);
  }

  if (abastecimentosResult.error) {
    if (isMissingFrotasTableError(abastecimentosResult.error.message)) {
      return {
        ...frotasData,
        motoristas,
        abastecimentos: [],
        postos: (postosResult.data ?? []) as FrotaPostoCredenciado[],
      };
    }

    throw new Error(abastecimentosResult.error.message);
  }

  const rawAbastecimentos = (abastecimentosResult.data ??
    []) as unknown as AbastecimentoRow[];
  const expiredIssuedIds = rawAbastecimentos
    .filter(
      (order) =>
        order.status === "issued" &&
        order.expires_at !== null &&
        new Date(order.expires_at).getTime() <= Date.now(),
    )
    .map((order) => order.id);
  if (expiredIssuedIds.length) {
    await supabase
      .from("frota_abastecimentos")
      .update({ status: "expired", updated_at: nowIso })
      .in("id", expiredIssuedIds)
      .eq("status", "issued");
  }
  const abastecimentoIds = rawAbastecimentos.map(
    (abastecimento) => abastecimento.id,
  );
  const anexosByAbastecimento = new Map<string, FrotaAbastecimentoAnexo[]>();

  if (abastecimentoIds.length) {
    const anexosResult = await supabase
      .from("frota_abastecimento_anexos")
      .select(
        "id,abastecimento_id,file_name,file_path,file_type,file_size,created_at",
      )
      .in("abastecimento_id", abastecimentoIds)
      .order("created_at", { ascending: false });

    if (!anexosResult.error) {
      const anexos = await withSignedUrls(
        supabase,
        "frota-abastecimento",
        (anexosResult.data ?? []) as AbastecimentoAnexoRow[],
      );

      anexos.forEach((anexo) => {
        const current = anexosByAbastecimento.get(anexo.abastecimento_id) ?? [];
        current.push({
          created_at: anexo.created_at,
          file_name: anexo.file_name,
          file_path: anexo.file_path,
          file_size: anexo.file_size,
          file_type: anexo.file_type,
          id: anexo.id,
          signed_url: anexo.signed_url,
        });
        anexosByAbastecimento.set(anexo.abastecimento_id, current);
      });
    }
  }

  let abastecimentos: FrotaAbastecimento[] = rawAbastecimentos.map(
    (abastecimento) => {
      const {
        frota_postos_credenciados,
        frota_veiculos,
        ...baseAbastecimento
      } = abastecimento;

      return {
        ...baseAbastecimento,
        status: expiredIssuedIds.includes(abastecimento.id)
          ? "expired"
          : baseAbastecimento.status,
        anexos: anexosByAbastecimento.get(abastecimento.id) ?? [],
        ano: frota_veiculos?.ano ?? null,
        consumo_medio_km_l: null,
        marca: frota_veiculos?.marca ?? "-",
        modelo: frota_veiculos?.modelo ?? "-",
        placa: frota_veiculos?.placa ?? "-",
        posto_nome: frota_postos_credenciados?.nome ?? null,
        prefeitura_brasao_url: frota_veiculos?.prefeituras?.brasao_url ?? null,
        prefeitura_nome: frota_veiculos?.prefeituras?.nome ?? "-",
        renavam: frota_veiculos?.renavam ?? null,
        secretaria: frota_veiculos?.secretaria ?? "-",
      };
    },
  );

  if (params?.ids && abastecimentos.length) {
    const { data: consumption, error } = await supabase.rpc("frota_consumo_pagina", { p_ids: params.ids });
    if (error) throw new Error(error.message);
    abastecimentos = abastecimentos.map(item => ({ ...item, consumo_medio_km_l: consumption[item.id] ?? null }));
  } else {
    abastecimentos = withFuelConsumption(abastecimentos);
  }

  if (params?.status === "expired") {
    abastecimentos = abastecimentos.filter(
      (order) => order.status === "expired" || expiredIssuedIds.includes(order.id),
    );
  } else if (params?.status === "issued") {
    abastecimentos = abastecimentos.filter(
      (order) =>
        order.status === "issued" &&
        (!order.expires_at || new Date(order.expires_at).getTime() > Date.now()),
    );
  }

  if (params?.query && !params.ids) {
    const normalizedQuery = params.query.toLowerCase();
    abastecimentos = abastecimentos.filter((abastecimento) =>
      [
        abastecimento.numero_ordem,
        abastecimento.placa,
        abastecimento.marca,
        abastecimento.modelo,
        abastecimento.motorista,
        abastecimento.fornecedor,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }

  return {
    ...frotasData,
    motoristas,
    abastecimentos,
    postos: (postosResult.data ?? []) as FrotaPostoCredenciado[],
  };
}

export async function getPostosCredenciadosData(params?: {
  ids?: string[];
  lightweight?: boolean;
  contextOnly?: boolean;
  prefeituraId?: string;
  query?: string;
}) {
  const supabase = createSupabaseServerClient();
  const frotasData = await getFrotasData({
    prefeituraId: params?.prefeituraId,
    lightweight: params?.lightweight,
    contextOnly: params?.contextOnly,
  });
  const selectedPrefeituraId =
    params?.prefeituraId ?? frotasData.selectedPrefeituraId;

  let postosQuery = supabase
    .from("frota_postos_credenciados")
    .select(
      "id,prefeitura_id,nome,cnpj,endereco,telefone,status,created_at,prefeituras:empresas(nome)",
    )
    .order("created_at", { ascending: false });

  {
    postosQuery = postosQuery.eq(
      "prefeitura_id",
      selectedPrefeituraId ?? "00000000-0000-0000-0000-000000000000",
    );
  }

  if (params?.ids) postosQuery = postosQuery.in("id", params.ids);
  const { data, error } = await postosQuery;

  if (error) {
    if (isMissingFrotasTableError(error.message)) {
      return {
        ...frotasData,
        postos: [],
      };
    }

    throw new Error(error.message);
  }

  let postos = (
    (data ?? []) as unknown as Array<
      FrotaPostoCredenciado & { prefeituras: { nome: string } | null }
    >
  ).map(({ prefeituras, ...posto }) => ({
    ...posto,
    prefeitura_nome: prefeituras?.nome ?? "-",
  }));

  if (params?.query && !params.ids) {
    const normalizedQuery = params.query.toLowerCase();
    postos = postos.filter((posto) =>
      [
        posto.nome,
        posto.cnpj,
        posto.telefone,
        posto.endereco,
        posto.prefeitura_nome,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }

  return {
    ...frotasData,
    postos,
  };
}

function withFuelConsumption(abastecimentos: FrotaAbastecimento[]) {
  const byVehicle = new Map<string, FrotaAbastecimento[]>();

  abastecimentos.forEach((abastecimento) => {
    if (
      abastecimento.status !== "completed" ||
      !abastecimento.quilometragem ||
      !abastecimento.litros
    ) {
      return;
    }

    const current = byVehicle.get(abastecimento.veiculo_id) ?? [];
    current.push(abastecimento);
    byVehicle.set(abastecimento.veiculo_id, current);
  });

  const consumptionByOrder = new Map<string, number | null>();

  byVehicle.forEach((orders) => {
    orders
      .sort((a, b) => {
        const aTime = new Date(a.completed_at ?? a.created_at).getTime();
        const bTime = new Date(b.completed_at ?? b.created_at).getTime();
        return aTime - bTime;
      })
      .forEach((order, index, sortedOrders) => {
        const previous = sortedOrders[index - 1];

        if (!previous?.quilometragem || !order.quilometragem || !order.litros) {
          consumptionByOrder.set(order.id, null);
          return;
        }

        const distance = order.quilometragem - previous.quilometragem;

        if (distance <= 0) {
          consumptionByOrder.set(order.id, null);
          return;
        }

        consumptionByOrder.set(
          order.id,
          Math.round((distance / order.litros) * 100) / 100,
        );
      });
  });

  return abastecimentos.map((abastecimento) => ({
    ...abastecimento,
    consumo_medio_km_l: consumptionByOrder.get(abastecimento.id) ?? null,
  }));
}

export function formatVeiculoStatus(status: VeiculoStatus) {
  const labels: Record<VeiculoStatus, string> = {
    active: "Ativo",
    inactive: "Inativo",
    maintenance: "Em manutenção",
    consult_error: "Aguardando conferência",
    processing: "Consultando",
  };

  return labels[status];
}

export function formatManutencaoStatus(status: ManutencaoStatus) {
  const labels: Record<ManutencaoStatus, string> = {
    cancelled: "Cancelada",
    completed: "Concluída",
    open: "Em manutenção",
  };

  return labels[status];
}

export function formatAbastecimentoStatus(status: AbastecimentoStatus) {
  const labels: Record<AbastecimentoStatus, string> = {
    cancelled: "Cancelada",
    completed: "Concluída",
    expired: "Vencida",
    issued: "Pendente",
  };

  return labels[status];
}

export function formatVencimentoTipo(tipo: VencimentoTipo) {
  const labels: Record<VencimentoTipo, string> = {
    ipva: "IPVA",
    licenciamento: "Licenciamento",
    seguro: "Seguro",
  };

  return labels[tipo];
}

export function formatFrotaDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

export function formatFrotaDaysRemaining(days: number) {
  if (days < 0) {
    return `Vencido há ${Math.abs(days)} dia(s)`;
  }

  if (days === 0) {
    return "Vence hoje";
  }

  return `Vence em ${days} dia(s)`;
}

function emptyFrotasData(
  prefeituras: FrotaPrefeituraOption[],
  selectedPrefeituraId?: string,
) {
  return {
    metricas: {
      ativos: 0,
      emManutencao: 0,
      total: 0,
      vencendo: 0,
      vencidos: 0,
    },
    prefeituras,
    selectedPrefeituraId,
    veiculos: [],
    vencimentos: [],
  };
}

function getDaysUntil(value: string) {
  const today = new Date();
  const todayUtc = Date.UTC(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const [year, month, day] = value.split("-").map(Number);
  const targetUtc = Date.UTC(year, month - 1, day);

  return Math.ceil((targetUtc - todayUtc) / 86_400_000);
}

function isMissingFrotasTableError(message: string) {
  return (
    message.includes("frota_debito_consultas") ||
    message.includes("frota_debitos_veiculares") ||
    message.includes("frota_abastecimento_anexos") ||
    message.includes("frota_manutencao_anexos") ||
    message.includes("frota_manutencoes") ||
    message.includes("frota_abastecimentos") ||
    message.includes("frota_multas_veiculares") ||
    message.includes("frota_processos_veiculares") ||
    message.includes("frota_postos_credenciados") ||
    message.includes("frota_recursos_infracao") ||
    message.includes("frota_veiculo_anexos") ||
    message.includes("frota_veiculos") ||
    message.includes("frota_vencimentos")
  );
}

async function withSignedUrls<T extends FrotaAnexo>(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  bucket: string,
  anexos: T[],
) {
  return Promise.all(
    anexos.map(async (anexo) => {
      const { data } = await supabase.storage
        .from(bucket)
        .createSignedUrl(anexo.file_path, 60 * 10);

      return {
        ...anexo,
        signed_url: data?.signedUrl ?? null,
      };
    }),
  );
}
