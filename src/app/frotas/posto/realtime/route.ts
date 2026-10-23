import { getPostoSession } from "@/lib/posto-auth";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const session = await getPostoSession();
  if (!session?.primeiro_acesso_concluido_em) return new Response(null, { status: 401 });
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return new Response(null, { status: 503 });
  const supabase = createSupabaseServerClient();
  const channel = supabase.channel(`posto-orders-${session.id}-${crypto.randomUUID()}`);
  let cleanup = (_closeStream = true) => { void _closeStream; };
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      let closed = false;
      const send = (event: string) => {
        if (!closed) controller.enqueue(encoder.encode(`event: ${event}\ndata: {}\n\n`));
      };
      const heartbeat = setInterval(() => {
        if (!closed) controller.enqueue(encoder.encode(": heartbeat\n\n"));
      }, 15000);
      // Reconnect periodically to revalidate the station session and bound server lifetime.
      const expiry = setTimeout(() => cleanup(), 50000);
      cleanup = (closeStream = true) => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        clearTimeout(expiry);
        request.signal.removeEventListener("abort", onAbort);
        void supabase.removeChannel(channel);
        if (closeStream) controller.close();
      };
      const onAbort = () => cleanup();
      request.signal.addEventListener("abort", onAbort, { once: true });
      if (request.signal.aborted) { cleanup(); return; }
      const changed = (payload: { new: Record<string, unknown> }) => {
        if (payload.new.posto_id === session.id && payload.new.prefeitura_id === session.prefeitura_id) send("changed");
      };
      const filter = { schema: "public", table: "frota_abastecimentos", filter: `posto_id=eq.${session.id}` };
      channel.on("postgres_changes", { ...filter, event: "INSERT" }, changed)
        .on("postgres_changes", { ...filter, event: "UPDATE" }, changed)
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
