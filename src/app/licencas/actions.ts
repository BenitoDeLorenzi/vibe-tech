"use server";
import { requireRole } from "@/lib/auth-data";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { billingSchedule, validDate } from "@/lib/license-schedule";
export type LicencaActionState = { error?: string; success?: string };
const value = (data: FormData, key: string) =>
  String(data.get(key) ?? "").trim();
function refresh() {
  for (const path of ["/", "/licencas", "/cobrancas", "/empresas"])
    revalidatePath(path);
  revalidatePath("/empresas/[id]", "page");
}
async function save(
  data: FormData,
  mode: "create" | "edit" | "renew",
): Promise<LicencaActionState> {
  const actor = await requireRole(["bdl_admin"]);
  const inicio = value(data, "inicio"),
    fim = value(data, "fim");
  const mensal = Number(value(data, "valor_mensal")),
    dia = Number(value(data, "dia_vencimento"));
  if (!billingSchedule(inicio, fim, mensal, dia).length)
    return {
      error:
        "Informe período válido (até 120 mensalidades), valor mensal e dia de vencimento de 1 a 31.",
    };
  if (mode !== "create" && !value(data, "id"))
    return { error: "Licença não encontrada." };
  const { error } = await createSupabaseServerClient().rpc(
    "license_save_contract",
    {
      p_actor: actor.id,
      p_id: mode === "create" ? null : value(data, "id"),
      p_empresa: value(data, "prefeitura_id") || null,
      p_modulo: value(data, "modulo_id") || null,
      p_inicio: inicio,
      p_fim: fim,
      p_mensal: mensal,
      p_dia: dia,
      p_status: mode === "renew" ? "active" : value(data, "status"),
      p_renew: mode === "renew",
    },
  );
  if (error)
    return {
      error: error.message.includes("duplicate key")
        ? "Já existe uma licença para essa empresa e módulo ou para esse período."
        : error.message,
    };
  refresh();
  return {
    success:
      mode === "renew"
        ? "Licença renovada. Histórico preservado."
        : "Licença salva com sucesso.",
  };
}
export async function createLicenca(_: LicencaActionState, data: FormData) {
  return save(data, "create");
}
export async function updateLicenca(_: LicencaActionState, data: FormData) {
  return save(data, "edit");
}
export async function renewLicenca(_: LicencaActionState, data: FormData) {
  return save(data, "renew");
}
export async function deleteLicenca() {
  await requireRole(["bdl_admin"]);
  redirect(
    "/licencas?error=" +
      encodeURIComponent(
        "Licenças com histórico financeiro não podem ser excluídas. Altere o status para Cancelada.",
      ),
  );
}
async function operate(
  data: FormData,
  action: string,
  values: Record<string, string>,
): Promise<LicencaActionState> {
  const actor = await requireRole(["bdl_admin"]);
  const { error } = await createSupabaseServerClient().rpc(
    "license_payment_operation",
    {
      p_actor: actor.id,
      p_id: value(data, "id"),
      p_action: action,
      p_values: values,
    },
  );
  if (error) return { error: error.message };
  refresh();
  return { success: "Cobrança atualizada com sucesso." };
}
export async function registerLicencaPagamento(
  _: LicencaActionState,
  data: FormData,
) {
  await requireRole(["bdl_admin"]);
  if (!validDate(value(data, "pago_em")))
    return { error: "Informe uma data de pagamento válida." };
  return operate(
    data,
    "receive",
    Object.fromEntries(
      [
        "valor_pago",
        "pago_em",
        "forma_pagamento",
        "documento",
        "observacoes",
        "request_id",
      ].map((key) => [key, value(data, key)]),
    ),
  );
}
export async function updateLicencaPagamento(
  _: LicencaActionState,
  data: FormData,
) {
  await requireRole(["bdl_admin"]);
  if (!validDate(value(data, "vencimento")))
    return { error: "Informe um vencimento válido." };
  return operate(
    data,
    "edit",
    Object.fromEntries(
      ["valor", "vencimento", "observacoes"].map((key) => [
        key,
        value(data, key),
      ]),
    ),
  );
}
export async function changeBillingStatus(
  _: LicencaActionState,
  data: FormData,
) {
  const action = value(data, "acao");
  if (!["cancel", "reverse"].includes(action)) {
    await requireRole(["bdl_admin"]);
    return { error: "Operação inválida." };
  }
  return operate(data, action, {
    motivo: value(data, "motivo"),
    recebimento_id: value(data, "recebimento_id"),
  });
}
// Legacy forms may still be open in another tab. Never silently erase their receipts.
export async function reopenLicencaPagamento() {
  await requireRole(["bdl_admin"]);
  redirect(
    "/cobrancas?error=" +
      encodeURIComponent(
        "Abra o histórico da cobrança e estorne o recebimento com justificativa.",
      ),
  );
}
export async function cancelLicencaPagamento() {
  await requireRole(["bdl_admin"]);
  redirect(
    "/cobrancas?error=" +
      encodeURIComponent("Abra a cobrança para cancelar com justificativa."),
  );
}
