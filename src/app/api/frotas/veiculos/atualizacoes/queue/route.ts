import { handleCallback } from "@vercel/queue";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { processVehicleUpdateRun } from "@/lib/frota-monthly-updates";

export const runtime = "nodejs";
export const maxDuration = 300;

export const POST = handleCallback<{ runId: string }>(async (message) => {
  if (!message || typeof message.runId !== "string" || !/^[a-f0-9-]{36}$/i.test(message.runId))
    throw new Error("Identificador de atualização inválido.");
  await processVehicleUpdateRun(message.runId, 210_000);
  const { data, error } = await createSupabaseServerClient().from("frota_atualizacoes_veiculos")
    .select("status").eq("id", message.runId).maybeSingle();
  if (error) throw new Error(error.message);
  // A queue retry resumes unfinished work in another function invocation.
  if (data?.status === "processing") throw new Error("Atualização ainda em andamento.");
}, { retry: () => ({ afterSeconds: 15 }) });
