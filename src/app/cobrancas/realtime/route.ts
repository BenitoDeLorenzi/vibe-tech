import { getCurrentUserProfile } from "@/lib/auth-data";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const profile = await getCurrentUserProfile();
  if (profile?.role !== "bdl_admin" || !profile.primeiro_acesso_concluido_em)
    return new Response(null, { status: 401 });
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return new Response(null, { status: 503 });

  const db = createSupabaseServerClient();
  const channel = db.channel(`inter-billing-${profile.id}-${crypto.randomUUID()}`);
  let cleanup = (_close = true) => { void _close; };
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      let closed = false;
      const send = (event: string) => {
        if (!closed) controller.enqueue(encoder.encode(`event: ${event}\ndata: {}\n\n`));
      };
      const heartbeat = setInterval(() => {
        if (!closed) controller.enqueue(encoder.encode(": heartbeat\n\n"));
      }, 15_000);
      const expiry = setTimeout(() => cleanup(), 50_000);
      cleanup = (close = true) => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        clearTimeout(expiry);
        request.signal.removeEventListener("abort", onAbort);
        void db.removeChannel(channel);
        if (close) controller.close();
      };
      const onAbort = () => cleanup();
      request.signal.addEventListener("abort", onAbort, { once: true });
      if (request.signal.aborted) { cleanup(); return; }
      const changed = () => send("changed");
      channel
        .on("postgres_changes", { schema: "public", table: "inter_cobrancas", event: "INSERT" }, changed)
        .on("postgres_changes", { schema: "public", table: "inter_cobrancas", event: "UPDATE" }, changed)
        .on("postgres_changes", { schema: "public", table: "licenca_pagamentos", event: "UPDATE" }, changed)
        .subscribe(status => {
          if (status === "SUBSCRIBED") send("ready");
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") cleanup();
        });
    },
    cancel() { cleanup(false); },
  });
  return new Response(stream, { headers: {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-store, no-transform",
    "X-Accel-Buffering": "no",
  } });
}
