import { validateVehicleSecretaria } from "@/lib/secretarias-data";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { after, NextResponse } from "next/server";
import { getCurrentUserProfile } from "@/lib/auth-data";
import { getModuleLicensedEmpresas } from "@/lib/empresa-access";
import { hasFrotasPermission } from "@/lib/frotas-permissions";
import {
  followVehicleLookup,
  processVehicleLookup,
} from "@/lib/plexi-vehicle-lookups";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  const profile = await getCurrentUserProfile();
  if (!profile)
    return json({ error: "Sua sessão expirou. Entre novamente." }, 401);
  let body: {
    secretariaId?: string;
    action?: string;
    placa?: string;
    renavam?: string;
    prefeituraId?: string;
    vehicleIds?: string[];
    legacyToken?: string;
  };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Solicitação inválida." }, 400);
  }
  if (!body || typeof body !== "object")
    return json({ error: "Solicitação inválida." }, 400);
  const syncing = body.action === "sync";
  if (
    !(await hasFrotasPermission(
      profile,
      syncing ? "vehicles.view" : "vehicles.create",
    ))
  ) {
    return json({ error: "Você não tem permissão para esta operação." }, 403);
  }
  const companyId =
    profile.role === "bdl_admin" ? body.prefeituraId : profile.prefeitura_id;
  if (
    !companyId ||
    !(await getModuleLicensedEmpresas("frotas-publicas")).some(
      (company) => company.id === companyId,
    )
  ) {
    return json(
      { error: "Selecione uma empresa com licença ativa para Vibe Frotas." },
      403,
    );
  }
  const db = createSupabaseServerClient();
  try {
    if (syncing) {
      const ids = Array.isArray(body.vehicleIds)
        ? body.vehicleIds
            .filter(
              (id) => typeof id === "string" && /^[a-f0-9-]{36}$/i.test(id),
            )
            .slice(0, 10)
        : [];
      if (!ids.length) return json({ changed: false });
      const vehicles = await db
        .from("frota_veiculos")
        .select("id,status")
        .eq("prefeitura_id", companyId)
        .in("id", ids);
      if (vehicles.error) throw new Error(vehicles.error.message);
      const results = await Promise.all(
        (vehicles.data ?? [])
          .filter((v) => v.status === "processing")
          .map((v) => processVehicleLookup(v.id)),
      );
      return json({ changed: results.some(Boolean), refreshed: true });
    }
    const placa =
      typeof body.placa === "string"
        ? body.placa.toUpperCase().replace(/[^A-Z0-9]/g, "")
        : "";
    const renavam =
      typeof body.renavam === "string" ? body.renavam.replace(/\D/g, "") : "";
    if (
      !/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(placa) ||
      !/^\d{11}$/.test(renavam)
    ) {
      return json(
        { error: "Informe uma placa válida e o Renavam com 11 dígitos." },
        400,
      );
    }
    const existing = await db
      .from("frota_veiculos")
      .select("id,status,renavam")
      .eq("prefeitura_id", companyId)
      .eq("placa", placa)
      .maybeSingle();
    if (existing.error) throw new Error(existing.error.message);
    if (existing.data) {
      const existingVehicle = existing.data;
      if (
        ["processing", "consult_error"].includes(existingVehicle.status) &&
        existingVehicle.renavam === renavam
      ) {
        if (existingVehicle.status === "processing")
          after(() => followVehicleLookup(existingVehicle.id));
        return json(
          { vehicleId: existingVehicle.id, status: existingVehicle.status },
          202,
        );
      }
      return json(
        {
          error:
            "Esta placa já está cadastrada nesta empresa. Abra o veículo na lista.",
        },
        409,
      );
    }
    const secretaria = await validateVehicleSecretaria(
      profile,
      companyId,
      body.secretariaId,
    );
    if ("error" in secretaria) return json({ error: secretaria.error }, 400);
    const vehicleId = randomUUID();
    const created = await db.from("frota_veiculos").insert({
      ...secretaria,
      id: vehicleId,
      prefeitura_id: companyId,
      placa,
      renavam,
      marca: "",
      modelo: "",
      tipo: "",
      ano: 0,
      status: "processing",
      origem_dados: "Plexi / Detran SC",
    });
    if (created.error)
      return json(
        {
          error:
            created.error.code === "23505"
              ? "Esta placa já está cadastrada nesta empresa."
              : "Não foi possível criar o cadastro pendente do veículo.",
        },
        created.error.code === "23505" ? 409 : 500,
      );
    const requestId =
      typeof body.legacyToken === "string"
        ? legacyRequestId(body.legacyToken, profile.id)
        : null;
    const saved = await db.from("frota_debito_consultas").insert({
      veiculo_id: vehicleId,
      prefeitura_id: companyId,
      provider: "plexi",
      client_request_id: `registration:${vehicleId}`,
      license_plate: placa,
      renavam,
      state: "SC",
      id_consult: requestId,
      status: requestId ? "processing" : "pending",
      request_payload: { purpose: "registration", placa, renavam },
      updated_at: new Date(Date.now() - 60_000).toISOString(),
    });
    if (saved.error) {
      await db
        .from("frota_veiculos")
        .delete()
        .eq("id", vehicleId)
        .eq("status", "processing");
      throw new Error(saved.error.message);
    }
    after(() => followVehicleLookup(vehicleId));
    return json({ vehicleId, status: "processing" }, 202);
  } catch (error) {
    console.error(
      "[Plexi] Falha ao gerenciar consulta",
      error instanceof Error ? error.message : error,
    );
    return json(
      { error: "Não foi possível atualizar a consulta. Tente novamente." },
      500,
    );
  }
}

// Recover a protocol started by the previous modal flow without paying for a new query.
function legacyRequestId(value: string, userId: string): string | null {
  const secret = process.env.PLEXI_API_TOKEN;
  const [payload, signature] = value.split(".");
  if (!secret || !payload || !signature) return null;
  try {
    const expected = createHmac("sha256", secret).update(payload).digest();
    const supplied = Buffer.from(signature, "base64url");
    if (
      supplied.length !== expected.length ||
      !timingSafeEqual(supplied, expected)
    )
      return null;
    const claims = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    );
    return claims.userId === userId &&
      claims.expiresAt > Date.now() &&
      typeof claims.requestId === "string"
      ? claims.requestId
      : null;
  } catch {
    return null;
  }
}
function json(body: object, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
