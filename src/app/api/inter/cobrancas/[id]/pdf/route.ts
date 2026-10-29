import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth-data";
import { retrieveInterBillingPdf } from "@/lib/inter-client";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireRole(["bdl_admin"]);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse("Boleto inválido.", { status: 400 });
  const { data: bill } = await createSupabaseServerClient().from("inter_cobrancas")
    .select("codigo_solicitacao")
    .eq("id", id).single();
  if (!bill?.codigo_solicitacao) return new NextResponse("Boleto indisponível.", { status: 404 });
  try {
    const pdf = await retrieveInterBillingPdf(bill.codigo_solicitacao);
    return new NextResponse(new Uint8Array(pdf), { headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="boleto-inter-${id}.pdf"`,
      "Cache-Control": "private, no-store",
    } });
  } catch {
    return new NextResponse("PDF ainda não disponível no Inter.", { status: 502 });
  }
}
