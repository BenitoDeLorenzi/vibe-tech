import { after, NextResponse } from "next/server";
import { send } from "@vercel/queue";
import { getCurrentUserProfile } from "@/lib/auth-data";
import { getModuleLicensedEmpresas } from "@/lib/empresa-access";
import { hasFrotasPermission } from "@/lib/frotas-permissions";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import {
  getVehicleUpdateItems, getVehicleUpdateRuns, processVehicleUpdateRun,
  retryVehicleUpdateErrors, startVehicleUpdate,
} from "@/lib/frota-monthly-updates";

export const runtime = "nodejs";
export const maxDuration = 300;

async function authorize(companyId: string | null, write: boolean) {
  const profile = await getCurrentUserProfile();
  if (!profile?.primeiro_acesso_concluido_em) return null;
  if (!(await hasFrotasPermission(profile, write ? "vehicles.manage" : "vehicles.view"))) return null;
  const selected = profile.role === "bdl_admin" ? companyId : profile.prefeitura_id;
  if (!selected || !(await getModuleLicensedEmpresas("frotas-publicas")).some((company) => company.id === selected)) return null;
  return { profile, companyId: selected };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const access = await authorize(url.searchParams.get("prefeitura"), false);
  if (!access) return NextResponse.json({ error: "Acesso não autorizado." }, { status: 403 });
  try {
    const runs = await getVehicleUpdateRuns(access.companyId);
    const runId = url.searchParams.get("runId");
    const items = runId ? await getVehicleUpdateItems(access.companyId, runId) : undefined;
    if (runId && !items) return NextResponse.json({ error: "Atualização não encontrada." }, { status: 404 });
    return NextResponse.json({ runs, items });
  } catch (error) {
    console.error("Falha ao listar atualizações de veículos", error);
    return NextResponse.json({ error: "Não foi possível carregar as atualizações." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let body: { prefeitura?: string; action?: string; runId?: string };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Solicitação inválida." }, { status: 400 }); }
  const access = await authorize(body.prefeitura ?? null, true);
  if (!access) return NextResponse.json({ error: "Acesso não autorizado." }, { status: 403 });
  if (process.env.PLEXI_API_ENABLED !== "true" || !process.env.PLEXI_API_TOKEN || !process.env.PLEXI_CERTIFICATE_ID)
    return NextResponse.json({ error: "A consulta automática não está configurada." }, { status: 503 });
  try {
    if (body.action === "start") {
      const { count, error } = await createSupabaseServerClient().from("frota_veiculos")
        .select("id", { count: "exact", head: true }).eq("prefeitura_id", access.companyId);
      if (error) throw new Error(error.message);
      if (!count) return NextResponse.json({ error: "Cadastre ao menos um veículo antes de iniciar." }, { status: 400 });
      const runId = await startVehicleUpdate(access.companyId, access.profile.id);
      if (!runId) return NextResponse.json({ error: "Esta empresa já possui uma atualização para o mês atual." }, { status: 409 });
      await enqueueOrProcess(runId);
      return NextResponse.json({ runId }, { status: 202 });
    }
    if (body.action === "retry" && body.runId) {
      const retried = await retryVehicleUpdateErrors(access.companyId, body.runId);
      if (!retried) return NextResponse.json({ error: "Não há consultas com falha para tentar novamente." }, { status: 409 });
      await enqueueOrProcess(body.runId);
      return NextResponse.json({ runId: body.runId }, { status: 202 });
    }
    if (body.action === "resume" && body.runId) {
      const items = await getVehicleUpdateItems(access.companyId, body.runId);
      if (!items) return NextResponse.json({ error: "Atualização não encontrada." }, { status: 404 });
      await enqueueOrProcess(body.runId);
      return NextResponse.json({ runId: body.runId }, { status: 202 });
    }
    return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  } catch (error) {
    console.error("Falha ao iniciar atualização de veículos", error);
    return NextResponse.json({ error: "Não foi possível iniciar a atualização. Tente novamente." }, { status: 500 });
  }
}

async function enqueueOrProcess(runId: string) {
  if (process.env.VERCEL) {
    try {
      await send("vehicle-monthly-updates", { runId }, { retentionSeconds: 604800 });
      return;
    } catch (error) {
      console.error("Falha ao enviar atualização de veículos para a fila; usando processamento direto.", error);
    }
  }
  after(() => processVehicleUpdateRun(runId));
}
