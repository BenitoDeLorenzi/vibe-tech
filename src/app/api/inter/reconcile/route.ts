import { NextResponse } from "next/server";
import { syncInterBilling } from "@/lib/inter-billing-sync";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { ensureInterBillingWebhook } from "@/lib/inter-webhook";
import { processPendingInterBillingEmails } from "@/lib/inter-billing-email";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`)
    return new NextResponse("Não autorizado.", { status: 401 });
  try { await ensureInterBillingWebhook(); } catch (error) { console.error("Falha ao configurar notificações do Inter:", error); }

  const db = createSupabaseServerClient();
  const { data: bills, error } = await db.from("inter_cobrancas")
    .select("id")
    .in("status", ["submitted", "cancelling", "uncertain"])
    .or("situacao.is.null,situacao.neq.RECEBIDO")
    .order("consultado_em", { ascending: true, nullsFirst: true })
    .limit(100);
  if (error) return new NextResponse("Falha ao listar boletos.", { status: 500 });

  let updated = 0;
  let failed = 0;
  for (const bill of bills ?? []) {
    try { await syncInterBilling(bill.id); updated++; }
    catch { failed++; }
  }
  let emails = 0;
  try { emails = await processPendingInterBillingEmails(); }
  catch (error) { console.error("Falha ao processar fila de e-mails do Inter:", error); }
  return NextResponse.json({ updated, failed, emails });
}
