"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUserProfile } from "@/lib/auth-data";
import { hasFrotasPermission } from "@/lib/frotas-permissions";
import {
  previewRelatorioSnapshot,
  type RelatorioFiltros,
  type RelatorioTipo,
} from "@/lib/relatorios-data";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export type RelatorioActionState = {
  error?: string;
  relatorioId?: string;
  success?: string;
};

const allowedReportTypes = new Set<RelatorioTipo>([
  "expirations",
  "fuel",
  "maintenance",
  "vehicles",
]);

export async function createRelatorio(
  _previousState: RelatorioActionState,
  formData: FormData
): Promise<RelatorioActionState> {
  const profile = await requireUserProfile();
  const allowed = await hasFrotasPermission(profile, "reports.create");

  if (!allowed) {
    return { error: "Você não tem permissão para gerar relatórios." };
  }

  const tipo = getRequiredValue(formData, "tipo") as RelatorioTipo;
  const titulo = getRequiredValue(formData, "titulo");
  const periodoInicio = getOptionalValue(formData, "periodo_inicio");
  const periodoFim = getOptionalValue(formData, "periodo_fim");
  const prefeituraId =
    profile.role === "bdl_admin"
      ? getRequiredValue(formData, "prefeitura_id")
      : profile.prefeitura_id ?? "";

  if (!allowedReportTypes.has(tipo)) {
    return { error: "Selecione um tipo de relatório válido." };
  }

  if (!titulo) {
    return { error: "Informe o título do relatório." };
  }

  if (!prefeituraId) {
    return { error: "Selecione uma empresa para gerar o relatório." };
  }

  if (tipo !== "vehicles" && (!periodoInicio || !periodoFim)) {
    return { error: "Informe o período do relatório." };
  }

  if (periodoInicio && periodoFim && periodoInicio > periodoFim) {
    return { error: "A data inicial não pode ser maior que a data final." };
  }

  const filtros: RelatorioFiltros = {
    combustivel: getOptionalValue(formData, "combustivel"),
    posto_id: getOptionalValue(formData, "posto_id"),
    status: getOptionalValue(formData, "status") ?? "all",
    veiculo_id: getOptionalValue(formData, "veiculo_id"),
    vencimento_tipo: getOptionalValue(formData, "vencimento_tipo") as
      | RelatorioFiltros["vencimento_tipo"]
      | null,
  };

  const snapshot = await previewRelatorioSnapshot({
    filtros,
    periodoFim: tipo === "vehicles" ? null : periodoFim,
    periodoInicio: tipo === "vehicles" ? null : periodoInicio,
    prefeituraId,
    tipo,
  });
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("frota_relatorios")
    .insert({
      criado_por: profile.id,
      filtros,
      periodo_fim: tipo === "vehicles" ? null : periodoFim,
      periodo_inicio: tipo === "vehicles" ? null : periodoInicio,
      prefeitura_id: prefeituraId,
      tipo,
      titulo,
      total_registros: snapshot.totalRegistros,
      valor_total: snapshot.valorTotal,
    })
    .select("id")
    .single();

  if (error || !data) {
    return {
      error: formatSupabaseError(error?.message ?? "Relatório não criado."),
    };
  }

  revalidatePath("/frotas/relatorios");
  return {
    relatorioId: data.id,
    success: "Relatório gerado com sucesso.",
  };
}

export async function deleteRelatorio(formData: FormData) {
  const profile = await requireUserProfile();
  if (profile.role !== "bdl_admin") {
    redirect(`/frotas/relatorios?error=${encodeURIComponent("Somente o usuário Master pode excluir relatórios.")}`);
  }
  const allowed = await hasFrotasPermission(profile, "reports.read");

  if (!allowed) {
    redirect(
      `/frotas/relatorios?error=${encodeURIComponent(
        "Você não tem permissão para remover relatórios."
      )}`
    );
  }

  const id = getRequiredValue(formData, "id");

  if (!id) {
    redirect(
      `/frotas/relatorios?error=${encodeURIComponent(
        "Relatório não encontrado."
      )}`
    );
  }

  const supabase = createSupabaseServerClient();
  const query = supabase.from("frota_relatorios").delete().eq("id", id);

  const { error } = await query;

  if (error) {
    redirect(
      `/frotas/relatorios?error=${encodeURIComponent(
        formatSupabaseError(error.message)
      )}`
    );
  }

  revalidatePath("/frotas/relatorios");
  redirect("/frotas/relatorios?deleted=1");
}

function getRequiredValue(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string" || !value.trim()) {
    return "";
  }

  return value.trim();
}

function getOptionalValue(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string" || !value.trim() || value === "all") {
    return null;
  }

  return value.trim();
}

function formatSupabaseError(message: string) {
  if (message.includes("frota_relatorios")) {
    return "Rode a migration de relatórios no Supabase antes de gerar relatórios.";
  }

  return message;
}
