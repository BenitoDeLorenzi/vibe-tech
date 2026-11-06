import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { processMonthlyVehicleLookup } from "@/lib/plexi-vehicle-lookups";

export function currentCompetencia() {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit" }).formatToParts(new Date());
  return `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}-01`;
}

export async function getVehicleUpdateRuns(companyId: string) {
  const db = createSupabaseServerClient();
  const { data, error } = await db.from("frota_atualizacoes_veiculos")
    .select("id,prefeitura_id,competencia,status,created_at,completed_at,frota_atualizacao_veiculos_itens(status)")
    .eq("prefeitura_id", companyId).order("created_at", { ascending: false }).limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []).map((run) => {
    const statuses = (run.frota_atualizacao_veiculos_itens ?? []) as { status: string }[];
    return { id: run.id, competencia: run.competencia, status: run.status, createdAt: run.created_at, completedAt: run.completed_at,
      total: statuses.length, success: statuses.filter((item) => item.status === "success").length,
      error: statuses.filter((item) => item.status === "error").length,
      pending: statuses.filter((item) => item.status === "pending" || item.status === "processing").length };
  });
}

export async function getVehicleUpdateItems(companyId: string, runId: string) {
  const db = createSupabaseServerClient();
  const { data: run, error: runError } = await db.from("frota_atualizacoes_veiculos")
    .select("id").eq("id", runId).eq("prefeitura_id", companyId).maybeSingle();
  if (runError) throw new Error(runError.message);
  if (!run) return null;
  const { data, error } = await db.from("frota_atualizacao_veiculos_itens")
    .select("id,veiculo_id,placa,renavam,status,error_message,completed_at")
    .eq("atualizacao_id", runId).eq("prefeitura_id", companyId).order("placa");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function startVehicleUpdate(companyId: string, userId: string) {
  const db = createSupabaseServerClient();
  const { data, error } = await db.rpc("iniciar_frota_atualizacao_veiculos", {
    p_prefeitura: companyId, p_competencia: currentCompetencia(), p_usuario: userId,
  });
  if (error) throw new Error(error.message);
  return data as string | null;
}

export async function retryVehicleUpdateErrors(companyId: string, runId: string) {
  const db = createSupabaseServerClient();
  const { data: run, error } = await db.from("frota_atualizacoes_veiculos")
    .select("id").eq("id", runId).eq("prefeitura_id", companyId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!run) return false;
  const { data: failed, error: failedError } = await db.from("frota_atualizacao_veiculos_itens")
    .select("id,attempt,consulta_id").eq("atualizacao_id", runId).eq("status", "error");
  if (failedError) throw new Error(failedError.message);
  if (!failed?.length) return false;
  const lookupIds = failed.map((item) => item.consulta_id).filter((id): id is string => Boolean(id));
  const { data: lookups, error: lookupError } = lookupIds.length
    ? await db.from("frota_debito_consultas").select("id,status").in("id", lookupIds)
    : { data: [], error: null };
  if (lookupError) throw new Error(lookupError.message);
  const completedLookups = new Set((lookups ?? []).filter((lookup) => lookup.status === "success").map((lookup) => lookup.id));
  const reopened = await db.from("frota_atualizacoes_veiculos")
    .update({ status: "processing", completed_at: null }).eq("id", runId);
  if (reopened.error) throw new Error(reopened.error.message);
  for (const item of failed) {
    const replay = Boolean(item.consulta_id && completedLookups.has(item.consulta_id));
    const reset = await db.from("frota_atualizacao_veiculos_itens")
      .update({ status: "pending", attempt: replay ? item.attempt : item.attempt + 1, consulta_id: replay ? item.consulta_id : null, error_message: null, claimed_at: null, completed_at: null })
      .eq("id", item.id).eq("status", "error");
    if (reset.error) throw new Error(reset.error.message);
  }
  return true;
}

export async function processVehicleUpdateRun(runId: string, deadlineMs = 210_000) {
  const until = Date.now() + deadlineMs;
  const db = createSupabaseServerClient();
  while (Date.now() < until) {
    const { data: run, error: runError } = await db.from("frota_atualizacoes_veiculos")
      .select("id,prefeitura_id,status").eq("id", runId).maybeSingle();
    if (runError) throw new Error(runError.message);
    if (!run || run.status !== "processing") return;
    const stale = new Date(Date.now() - 35_000).toISOString();
    const { data: rows, error } = await db.from("frota_atualizacao_veiculos_itens")
      .select("id,veiculo_id,placa,renavam,consulta_id,attempt,status,claimed_at")
      .eq("atualizacao_id", runId).in("status", ["pending", "processing"])
      .order("created_at").limit(150);
    if (error) throw new Error(error.message);
    if (!rows?.length) {
      await db.from("frota_atualizacoes_veiculos").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", runId).eq("status", "processing");
      return;
    }
    const ready = rows.filter((row) => row.status === "pending" || !row.claimed_at || row.claimed_at < stale).slice(0, 3);
    if (!ready.length) {
      await new Promise((resolve) => setTimeout(resolve, 5_000));
      continue;
    }
    await Promise.all(ready.map(async (row) => {
      try { await processUpdateItem(runId, run.prefeitura_id, row); }
      catch (failure) { console.error("Falha na atualização mensal do veículo", row.id, failure); }
    }));
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
}

type UpdateItem = { id: string; veiculo_id: string | null; placa: string; renavam: string | null; consulta_id: string | null; attempt: number; status: string; claimed_at: string | null };

async function processUpdateItem(runId: string, companyId: string, item: UpdateItem) {
  const db = createSupabaseServerClient();
  let claimQuery = db.from("frota_atualizacao_veiculos_itens")
    .update({ status: "processing", claimed_at: new Date().toISOString() })
    .eq("id", item.id).eq("status", item.status);
  claimQuery = item.claimed_at ? claimQuery.eq("claimed_at", item.claimed_at) : claimQuery.is("claimed_at", null);
  const claimed = await claimQuery.select("id").maybeSingle();
  if (claimed.error || !claimed.data) return;
  if (!item.veiculo_id) return finishItem(item.id, "error", "Veículo removido do cadastro.");
  const { data: vehicle, error: vehicleError } = await db.from("frota_veiculos")
    .select("id,placa,renavam,status").eq("id", item.veiculo_id).eq("prefeitura_id", companyId).maybeSingle();
  if (vehicleError) throw new Error(vehicleError.message);
  if (!vehicle) return finishItem(item.id, "error", "Veículo removido do cadastro.");
  if (vehicle.status === "processing") return finishItem(item.id, "error", "Cadastro do veículo ainda em processamento.");
  if (!/^\d{11}$/.test(vehicle.renavam ?? "")) return finishItem(item.id, "error", "Renavam ausente ou inválido.");
  const clientRequestId = `monthly:${runId}:${item.veiculo_id}:${item.attempt}`;
  if (!item.consulta_id) {
    const { error: insertError } = await db.from("frota_debito_consultas").insert({
      veiculo_id: item.veiculo_id, prefeitura_id: companyId, provider: "plexi", client_request_id: clientRequestId,
      license_plate: vehicle.placa, renavam: vehicle.renavam, state: "SC", status: "pending",
      request_payload: { purpose: "monthly", runId }, updated_at: new Date(Date.now() - 60_000).toISOString(),
    });
    if (insertError && insertError.code !== "23505") throw new Error(insertError.message);
  }
  const { data: lookup, error: lookupError } = await db.from("frota_debito_consultas")
    .select("id,status,error_message").eq("client_request_id", clientRequestId).single();
  if (lookupError) throw new Error(lookupError.message);
  if (!item.consulta_id) {
    const linked = await db.from("frota_atualizacao_veiculos_itens").update({ consulta_id: lookup.id }).eq("id", item.id);
    if (linked.error) throw new Error(linked.error.message);
  }
  const imported = lookup.status === "pending" || lookup.status === "processing" || lookup.status === "success"
    ? await processMonthlyVehicleLookup(lookup.id) : false;
  const { data: result, error: resultError } = await db.from("frota_debito_consultas")
    .select("status,error_message").eq("id", lookup.id).single();
  if (resultError) throw new Error(resultError.message);
  if (result.status === "success" && imported) return finishItem(item.id, "success", null);
  if (result.status === "success") return finishItem(item.id, "error", "A consulta foi concluída, mas não foi possível importar os dados. Tente novamente sem uma nova cobrança.");
  if (result.status === "error") return finishItem(item.id, "error", result.error_message ?? "Consulta não concluída.");
}

async function finishItem(itemId: string, status: "success" | "error", message: string | null) {
  const { error } = await createSupabaseServerClient().from("frota_atualizacao_veiculos_itens")
    .update({ status, error_message: message, completed_at: new Date().toISOString(), claimed_at: null }).eq("id", itemId);
  if (error) throw new Error(error.message);
}

export async function resumePendingVehicleUpdates() {
  const { data, error } = await createSupabaseServerClient().from("frota_atualizacoes_veiculos")
    .select("id").eq("status", "processing").order("created_at").limit(10);
  if (error) throw new Error(error.message);
  const until = Date.now() + 220_000;
  for (const run of data ?? []) {
    const remaining = until - Date.now();
    if (remaining < 10_000) break;
    await processVehicleUpdateRun(run.id, remaining);
  }
  return data?.length ?? 0;
}
