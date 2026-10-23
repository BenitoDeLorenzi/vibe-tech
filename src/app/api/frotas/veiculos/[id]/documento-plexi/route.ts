import { NextResponse } from "next/server";
import { getCurrentUserProfile } from "@/lib/auth-data";
import { getModuleLicensedEmpresas } from "@/lib/empresa-access";
import { getFrotasPermissionAccess } from "@/lib/frotas-permissions";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getCurrentUserProfile();
  if (!profile?.primeiro_acesso_concluido_em) return new NextResponse("Sessão expirada.", { status: 401 });
  if (!(await getFrotasPermissionAccess(profile)).canViewVeiculos) return new NextResponse("Acesso negado.", { status: 403 });
  const { id } = await params;
  const db = createSupabaseServerClient();
  const vehicle = await db.from("frota_veiculos").select("placa,prefeitura_id").eq("id", id).maybeSingle();
  if (vehicle.error) return new NextResponse("Não foi possível consultar o documento.", { status: 500 });
  if (!vehicle.data || (profile.role !== "bdl_admin" && vehicle.data.prefeitura_id !== profile.prefeitura_id)) {
    return new NextResponse("Veículo não encontrado.", { status: 404 });
  }
  const vehicleData = vehicle.data;
  if (!(await getModuleLicensedEmpresas("frotas-publicas")).some((company) => company.id === vehicleData.prefeitura_id)) {
    return new NextResponse("Acesso negado.", { status: 403 });
  }
  const { data, error } = await db.from("frota_debito_consultas").select("response_payload")
    .eq("veiculo_id", id).eq("provider", "plexi").eq("status", "success")
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error) return new NextResponse("Não foi possível carregar o documento.", { status: 500 });
  let result = data?.response_payload as Record<string, unknown> | undefined;
  for (const key of ["data", "result", "body", "payload"]) {
    if (result?.[key] && typeof result[key] === "object" && !Array.isArray(result[key])) result = result[key] as Record<string, unknown>;
  }
  if (typeof result?.pdf !== "string") return new NextResponse("PDF não disponível.", { status: 404 });
  const pdf = Buffer.from(result.pdf.replace(/^data:application\/pdf;base64,/, ""), "base64");
  if (pdf.subarray(0, 5).toString() !== "%PDF-") return new NextResponse("PDF inválido.", { status: 422 });
  const disposition = new URL(request.url).searchParams.get("download") === "1" ? "attachment" : "inline";
  const plate = vehicleData.placa.replace(/[^A-Z0-9]/gi, "");
  return new NextResponse(new Uint8Array(pdf), { headers: {
    "Content-Type": "application/pdf", "Content-Disposition": `${disposition}; filename="Detran-SC-${plate}.pdf"`,
    "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
  } });
}
