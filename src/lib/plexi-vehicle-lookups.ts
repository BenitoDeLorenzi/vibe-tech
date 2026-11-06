import "server-only";
import { createHash } from "node:crypto";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type RecordValue = Record<string, unknown>;
type Lookup = {
  id: string; veiculo_id: string; prefeitura_id: string; license_plate: string;
  renavam: string; id_consult: string | null; status: string; updated_at: string;
  response_payload: unknown;
};

export async function processVehicleLookup(vehicleId: string) {
  const db = createSupabaseServerClient();
  const { data, error } = await db.from("frota_debito_consultas")
    .select("id,veiculo_id,prefeitura_id,license_plate,renavam,id_consult,status,updated_at,response_payload")
    .eq("veiculo_id", vehicleId).eq("provider", "plexi")
    .eq("request_payload->>purpose", "registration")
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return false;
  const lookup = data as Lookup;
  const vehicle = await db.from("frota_veiculos").select("status").eq("id", vehicleId).maybeSingle();
  if (vehicle.error) throw new Error(vehicle.error.message);
  if (!vehicle.data || vehicle.data.status !== "processing") return false;
  return processLookup(lookup, true);
}

export async function processMonthlyVehicleLookup(lookupId: string) {
  const db = createSupabaseServerClient();
  const { data, error } = await db.from("frota_debito_consultas")
    .select("id,veiculo_id,prefeitura_id,license_plate,renavam,id_consult,status,updated_at,response_payload")
    .eq("id", lookupId).eq("provider", "plexi").eq("request_payload->>purpose", "monthly")
    .single();
  if (error || !data) throw new Error("Consulta mensal não encontrada.");
  return processLookup(data as Lookup, false);
}

async function processLookup(lookup: Lookup, updateVehicleStatus: boolean) {
  const db = createSupabaseServerClient();
  const vehicleId = lookup.veiculo_id;
  // Replay a saved result if a previous request stopped between the history and vehicle updates.
  if (["success", "error"].includes(lookup.status)) return applyLookupOutcome(lookup, updateVehicleStatus);
  // A database lease prevents multiple browser tabs and the background worker from submitting twice.
  if (Date.now() - Date.parse(lookup.updated_at) < 30_000) return false;
  const claimed = await db.from("frota_debito_consultas")
    .update({ updated_at: new Date().toISOString() }).eq("id", lookup.id)
    .eq("updated_at", lookup.updated_at).in("status", ["pending", "processing"]).select("id").maybeSingle();
  if (claimed.error) throw new Error(claimed.error.message);
  if (!claimed.data) return false;

  const apiToken = process.env.PLEXI_API_TOKEN;
  const certificate = process.env.PLEXI_CERTIFICATE_ID;
  if (!apiToken || !certificate || process.env.PLEXI_API_ENABLED !== "true") {
    return failLookup(lookup, "A consulta automática está indisponível.", null, updateVehicleStatus);
  }
  const headers = { Accept: "application/json", Authorization: `Bearer ${apiToken}`, "Content-Type": "application/json" };
  try {
    if (!lookup.id_consult) {
      const response = await fetch(`${baseUrl()}/api/maestro/detran-sc/veiculos/consulta-completa-veiculo`, {
        method: "POST", headers, cache: "no-store", signal: AbortSignal.timeout(20_000),
        body: JSON.stringify({ placa: lookup.license_plate, renavam: lookup.renavam, certificate }),
      });
      const payload = await readPayload(response);
      const record = asRecord(payload);
      const requestId = record.requestId ?? asRecord(record.body).requestId;
      if (!response.ok && !(response.status === 409 && typeof requestId === "string")) {
        if (response.status === 429 || (response.status >= 500 && response.status !== 520)) {
          await recordWaiting(lookup, `Plexi indisponível (HTTP ${response.status}). A solicitação será verificada novamente.`);
          return false;
        }
        return failLookup(lookup, `Plexi: HTTP ${response.status}. ${apiMessage(payload) || "A solicitação foi recusada."}`, payload, updateVehicleStatus);
      }
      if (typeof requestId !== "string") {
        return failLookup(lookup, "A Plexi não retornou um protocolo válido para acompanhar a consulta.", payload, updateVehicleStatus);
      }
      lookup.id_consult = requestId;
      const saved = await db.from("frota_debito_consultas").update({ id_consult: requestId, status: "processing", error_message: null }).eq("id", lookup.id);
      if (saved.error) throw new Error(saved.error.message);
    }
    const response = await fetch(`${baseUrl()}/api/maestro/result/${encodeURIComponent(lookup.id_consult)}`, {
      method: "GET", headers, cache: "no-store", signal: AbortSignal.timeout(20_000),
    });
    if (response.status === 202) {
      await recordWaiting(lookup, "O Detran/SC ainda está processando a consulta.");
      return false;
    }
    if (response.status === 404) {
      return failLookup(lookup, "Plexi: protocolo não encontrado ou expirado (HTTP 404).", null, updateVehicleStatus);
    }
    if ([500, 502, 503, 504, 429].includes(response.status)) {
      await recordWaiting(lookup, `Aguardando conexão com a Plexi (HTTP ${response.status}). Nova verificação automática em instantes.`);
      return false;
    }
    const payload = await readPayload(response);
    if (!response.ok) return failLookup(lookup, `Plexi: HTTP ${response.status}. ${apiMessage(payload) || "A consulta foi encerrada sem sucesso."}`, payload, updateVehicleStatus);
    const result = unwrap(payload);
    if (result.status === "erro" || result.error === true || typeof result.error === "string") {
      return failLookup(lookup, apiMessage(result) || "A Plexi encerrou a consulta sem sucesso.", payload, updateVehicleStatus);
    }
    if (!string(result.marca) || !string(result.modelo)) {
      return failLookup(lookup, apiMessage(result) || "A Plexi retornou uma resposta sem os dados cadastrais do veículo.", payload, updateVehicleStatus);
    }
    if ((string(result.placa) && string(result.placa).replace(/[^a-z0-9]/gi, "").toUpperCase() !== lookup.license_plate)
      || (string(result.renavam) && string(result.renavam).replace(/\D/g, "").padStart(11, "0") !== lookup.renavam)) {
      return failLookup(lookup, "A placa ou o Renavam retornado pela Plexi não corresponde ao veículo solicitado.", payload, updateVehicleStatus);
    }
    const finished = await db.from("frota_debito_consultas").update({ status: "success", response_payload: payload, error_message: null, updated_at: new Date().toISOString() }).eq("id", lookup.id);
    if (finished.error) throw new Error(finished.error.message);
    return applyLookupOutcome({ ...lookup, status: "success", response_payload: payload }, updateVehicleStatus);
  } catch (error) {
    console.error("[Plexi] Consulta temporariamente indisponível", { vehicleId, message: error instanceof Error ? error.message : "Falha de conexão" });
    await recordWaiting(lookup, "Sem resposta da Plexi na última verificação. A consulta permanece pendente e será verificada novamente.");
    return false;
  }
}

async function recordWaiting(lookup: Lookup, message: string) {
  const { error } = await createSupabaseServerClient().from("frota_debito_consultas")
    .update({ error_message: message }).eq("id", lookup.id).in("status", ["pending", "processing"]);
  if (error) throw new Error(error.message);
}

async function failLookup(lookup: Lookup, message: string, payload: unknown = null, updateVehicleStatus = true) {
  const db = createSupabaseServerClient();
  const saved = await db.from("frota_debito_consultas").update({ status: "error", error_message: message, response_payload: payload, updated_at: new Date().toISOString() }).eq("id", lookup.id);
  if (saved.error) throw new Error(saved.error.message);
  return applyLookupOutcome({ ...lookup, status: "error", response_payload: payload }, updateVehicleStatus);
}

async function applyLookupOutcome(lookup: Lookup, updateVehicleStatus = true) {
  if (lookup.status === "success") await importLookupDetails(lookup);
  if (!updateVehicleStatus) return lookup.status === "success";
  const updated = await createSupabaseServerClient().from("frota_veiculos").update({
    ...(lookup.status === "success" ? vehicleFields(unwrap(lookup.response_payload)) : {}),
    status: lookup.status === "success" ? "active" : "consult_error", consulta_raw: lookup.response_payload,
  }).eq("id", lookup.veiculo_id).eq("prefeitura_id", lookup.prefeitura_id).eq("status", "processing").select("id").maybeSingle();
  if (updated.error) throw new Error(updated.error.message);
  return Boolean(updated.data);
}

// Reimport an already saved result without submitting another paid consultation.
export async function importSavedVehicleLookup(lookupId: string) {
  const { data, error } = await createSupabaseServerClient().from("frota_debito_consultas")
    .select("id,veiculo_id,prefeitura_id,license_plate,renavam,id_consult,status,updated_at,response_payload")
    .eq("id", lookupId).eq("provider", "plexi").eq("status", "success").single();
  if (error || !data) throw new Error(error?.message ?? "Consulta não encontrada.");
  await importLookupDetails(data as Lookup);
}

async function importLookupDetails(lookup: Lookup) {
  const result = unwrap(lookup.response_payload);
  const db = createSupabaseServerClient();
  const common = { consulta_id: lookup.id, prefeitura_id: lookup.prefeitura_id, veiculo_id: lookup.veiculo_id };
  const fines = (["historicoMultas", "multasPagar"] as const).flatMap((key) => records(result[key]).map((fine, index) => {
    const origem = key === "multasPagar" ? "pagar" : "historico";
    const auto = string(fine.numeroAuto);
    const amount = money(fine.valor);
    if (!auto || amount === null || amount < 0) throw new Error(`Multa inválida na lista ${key}, posição ${index + 1}.`);
    return { ...common, id: importedId(lookup.id, `${origem}:${auto}`), origem, numero_auto: auto,
      situacao: string(fine.situacao), descricao: string(fine.descricao), data_infracao: date(fine.data),
      hora: string(fine.hora), local_complemento: string(fine.localComplemento), valor: amount, raw_payload: fine };
  }));
  const resources = records(result.recursoInfracao).map((resource, index) => ({
    ...common, id: importedId(lookup.id, `recurso:${index}`), processo: string(resource.processo),
    numero_auto: string(resource.numeroAuto), detalhamento_infracao: string(resource.detalhamentoInfracao),
    resultado_processo: string(resource.resultadoProcesso), raw_payload: resource,
  }));
  const processes = records(result.processos);
  const last = asRecord(result.ultimoProcesso);
  if (Object.keys(last).length && !processes.some((p) => string(p.processo) === string(last.processo))) processes.push(last);
  const processRows = processes.map((process, index) => ({
    ...common, id: importedId(lookup.id, `processo:${string(process.processo) || index}`), processo: string(process.processo),
    inicio_em: string(process.inicioEm), final_em: string(process.finalEm), interessado: string(process.interessado),
    situacao: string(process.situacao), servicos: records(process.servicos), raw_payload: process,
  }));
  // Deterministic IDs allow retries while keeping manual records untouched.
  const imports: Array<[string, RecordValue[]]> = [["frota_multas_veiculares", fines], ["frota_recursos_infracao", resources], ["frota_processos_veiculares", processRows]];
  for (const [table, rows] of imports) {
    if (!rows.length) continue;
    const { error } = await db.from(table).upsert(rows, { onConflict: "id" });
    if (error) throw new Error(error.message);
  }
  await saveVehicleDebts(lookup, result);
}

function records(value: unknown): RecordValue[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new Error("Formato inesperado na lista retornada pela Plexi.");
  return value.map(asRecord);
}
function importedId(lookupId: string, key: string) {
  const hex = createHash("sha256").update(`${lookupId}:${key}`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

async function saveVehicleDebts(lookup: Lookup, result: RecordValue) {
  if (result.debitos !== undefined && !Array.isArray(result.debitos)) {
    throw new Error("A Plexi retornou os débitos em um formato inesperado.");
  }
  const debts = (Array.isArray(result.debitos) ? result.debitos : []).map((value, index) => {
    const debt = asRecord(value);
    const title = string(debt.classe) || "Débito veicular";
    const linkedFine = records(result.multasPagar).find((fine) => {
      const auto = string(fine.numeroAuto).replace(/[^A-Z0-9]/gi, "").toUpperCase();
      return auto && title.replace(/[^A-Z0-9]/gi, "").toUpperCase().includes(auto);
    });
    const dueDate = date(debt.vencimento);
    const amount = money(debt.valorAtual);
    if (amount === null || amount < 0) throw new Error(`Valor inválido no débito ${index + 1} retornado pela Plexi.`);
    return {
      consulta_id: lookup.id, veiculo_id: lookup.veiculo_id, prefeitura_id: lookup.prefeitura_id,
      provider: "plexi", provider_debit_id: `debitos:${string(debt.numeroDetranNET) || "sem-numero"}:${index}`,
      type: linkedFine ? "ticket" : /ipva/i.test(title) ? "ipva" : /licenciamento/i.test(title) ? "licensing" : /dpvat|seguro/i.test(title) ? "dpvat" : "other",
      title: linkedFine ? `Multa ${string(linkedFine.numeroAuto)}` : title,
      description: [linkedFine ? string(linkedFine.descricao) : "", string(debt.numeroDetranNET) ? `Detran/SC: ${string(debt.numeroDetranNET)}` : ""].filter(Boolean).join(" · ") || null,
      amount, due_date: dueDate ? `${dueDate}T12:00:00Z` : null, expiration_date: null,
      year: year(debt.exercicio), required: false,
      is_expired: dueDate ? dueDate < new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date()) : false,
      raw_payload: { ...debt, multa_numero_auto: linkedFine ? string(linkedFine.numeroAuto) : null },
    };
  });
  if (!debts.length) return;
  // Replaying a saved result is safe: the consultation and provider ID uniquely identify each debt.
  const { error } = await createSupabaseServerClient().from("frota_debitos_veiculares")
    .upsert(debts, { onConflict: "consulta_id,provider_debit_id" });
  if (error) throw new Error(error.message);
}

function money(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || !value.trim()) return null;
  const cleaned = value.replace(/R\$|\s/g, "");
  const normalized = cleaned.includes(",") ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned;
  if (!/^-?\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : null;
}

export async function followVehicleLookup(vehicleId: string) {
  const until = Date.now() + 240_000;
  while (Date.now() < until) {
    await processVehicleLookup(vehicleId);
    const { data, error } = await createSupabaseServerClient().from("frota_veiculos").select("status").eq("id", vehicleId).maybeSingle();
    if (error || !data || data.status !== "processing") return;
    await new Promise((resolve) => setTimeout(resolve, 10_000));
  }
}

function vehicleFields(result: RecordValue) {
  return {
    marca: string(result.marca), modelo: string(result.modelo), tipo: string(result.tipo),
    ano: year(result.anoModelo) ?? year(result.anoFabricacao) ?? 0,
    ano_modelo: year(result.anoModelo), ano_fabricacao: year(result.anoFabricacao),
    lugares: string(result.lugares), carroceria: string(result.carroceria), categoria: string(result.categoria),
    combustivel: string(result.combustivel), cor: string(result.cor), especie: string(result.especie),
    licenciado: string(result.licenciado), municipio_emplacamento: string(result.municipioEmplacamento),
    principal_condutor: string(result.principalCondutor), proprietario_anterior: string(result.proprietarioAnterior),
    proprietario_atual: string(result.proprietarioAtual), restricao_venda: string(result.restricaoVenda),
    restricoes: string(result.restricoes), situacao_veicular: string(result.situacao), origem_dados: "Plexi / Detran SC",
    data_aquisicao: date(result.dataAquisicao),
  };
}
function year(value: unknown) { const parsed = Number(value); return Number.isInteger(parsed) && parsed >= 1886 && parsed <= 2100 ? parsed : null; }
function date(value: unknown) {
  const text = string(value);
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  const iso = match ? `${match[3]}-${match[2]}-${match[1]}` : text;
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) && !Number.isNaN(Date.parse(iso)) ? iso : null;
}
function string(value: unknown) { return typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : ""; }
function asRecord(value: unknown): RecordValue { return value && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : {}; }
function unwrap(value: unknown) { let result = asRecord(value); for (const key of ["data", "result", "body", "payload"]) { const nested = asRecord(result[key]); if (Object.keys(nested).length) result = nested; } return result; }
function apiMessage(value: unknown): string {
  const record = asRecord(value);
  if (!Object.keys(record).length) return "";
  for (const key of ["message", "mensagem", "detail", "error"]) { if (typeof record[key] === "string") return string(record[key]); }
  const errors = Object.values(asRecord(record.errors)).flat().filter((item) => typeof item === "string");
  if (errors.length) return errors.join(" ");
  for (const key of ["data", "body", "result"]) { if (!record[key] || typeof record[key] !== "object") continue; const message = apiMessage(record[key]); if (message) return message; }
  return "";
}
async function readPayload(response: Response): Promise<unknown> { const text = await response.text(); try { return JSON.parse(text); } catch { return text ? { message: text.slice(0, 500) } : null; } }
function baseUrl() { const value = process.env.PLEXI_BASE_URL; return (value?.match(/^\[(https?:\/\/[^\]]+)\]/)?.[1] ?? value ?? "https://api.plexi.com.br").replace(/\/$/, ""); }
