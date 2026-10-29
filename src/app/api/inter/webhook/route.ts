import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { syncInterBilling } from "@/lib/inter-billing-sync";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const expected = process.env.INTER_WEBHOOK_SECRET;
  const supplied = new URL(request.url).searchParams.get("token") ?? "";
  if (!expected || supplied.length !== expected.length || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected)))
    return new NextResponse("Não autorizado.", { status: 401 });
  if (Number(request.headers.get("content-length") ?? 0) > 100_000)
    return new NextResponse("Payload muito grande.", { status: 413 });

  let payload: unknown;
  try { payload = await request.json(); }
  catch { return new NextResponse("Payload inválido.", { status: 400 }); }
  const entries = Array.isArray(payload) ? payload : [payload];
  if (entries.length > 20) return new NextResponse("Payload muito grande.", { status: 413 });
  const codes = [...new Set(entries.map(item =>
    item && typeof item === "object" && "codigoSolicitacao" in item && typeof item.codigoSolicitacao === "string"
      ? item.codigoSolicitacao : null,
  ).filter((code): code is string => Boolean(code && code.length <= 100)))];
  if (!codes.length) return NextResponse.json({ received: true });

  const db = createSupabaseServerClient();
  const { data: bills, error } = await db.from("inter_cobrancas")
    .select("id")
    .in("codigo_solicitacao", codes);
  if (error) return new NextResponse("Falha ao localizar boleto.", { status: 500 });
  let failed = false;
  for (const bill of bills ?? []) {
    try { await syncInterBilling(bill.id); }
    catch { failed = true; }
  }
  return NextResponse.json({ received: true }, { status: failed ? 503 : 200 });
}
