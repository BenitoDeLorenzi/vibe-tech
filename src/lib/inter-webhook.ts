import "server-only";

import { getInterBillingWebhook, setInterBillingWebhook } from "@/lib/inter-client";

let checkedAt = 0;

export async function ensureInterBillingWebhook(): Promise<void> {
  if (process.env.VERCEL_ENV !== "production") return;
  if (Date.now() - checkedAt < 60 * 60_000) return;
  const secret = process.env.INTER_WEBHOOK_SECRET;
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? "vibetechsistemas.com";
  if (!secret || !/^[a-z0-9.-]+$/i.test(host))
    throw new Error("Configuração de notificações do Inter incompleta.");

  const url = `https://${host}/api/inter/webhook?token=${encodeURIComponent(secret)}`;
  const current = await getInterBillingWebhook();
  if (current && current !== url)
    throw new Error("O Inter já possui outro webhook de cobrança. Confira a configuração bancária.");
  if (!current) await setInterBillingWebhook(url);
  checkedAt = Date.now();
}
