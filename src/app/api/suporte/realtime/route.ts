import { getSupportScope, getSupportTicket, isUuid } from "@/lib/suporte";
import { createSupabaseServerClient } from "@/lib/supabase-server";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const scope = await getSupportScope(params);
  if (!scope) return new Response(null, { status: 403 });
  const conversationId = params.get("conversa");
  if (conversationId && (!isUuid(conversationId) || !(await getSupportTicket(scope, conversationId)))) return new Response(null, { status: 404 });
  const db = createSupabaseServerClient();
  const channel = conversationId
    ? db.channel(`support-typing-${conversationId}`, { config: { private: true } })
    : db.channel(`support-${scope.profile.id}-${crypto.randomUUID()}`);
  let cleanup = () => {};
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const encoder = new TextEncoder();
      const send = (event: string, data: object = {}) => { if (!closed) controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)); };
      const heartbeat = setInterval(() => { if (!closed) controller.enqueue(encoder.encode(": heartbeat\n\n")); }, 15000);
      const abort = () => { if (closed) return; cleanup(); controller.close(); };
      const expiry = setTimeout(abort, 50000);
      cleanup = () => { if (closed) return; closed = true; clearInterval(heartbeat); clearTimeout(expiry); request.signal.removeEventListener("abort", abort); void db.removeChannel(channel); };
      request.signal.addEventListener("abort", abort, { once: true });
      if (request.signal.aborted) { abort(); return; }
      if (conversationId) {
        channel.on("broadcast", { event: "typing" }, ({ payload }) => {
          if (payload?.senderId !== scope.profile.id) send("typing", payload);
        }).on("postgres_changes", { schema: "public", table: "suporte_leituras", event: "*", filter: `conversa_id=eq.${conversationId}` }, () => send("changed"));
      } else channel.on("postgres_changes", { schema: "public", table: "suporte_conversas", event: "*", ...(scope.master ? {} : { filter: `usuario_id=eq.${scope.profile.id}` }) }, payload => {
        const row = payload.new as Record<string, unknown>;
        if (scope.master || (row.usuario_id === scope.profile.id && row.empresa_id === scope.empresa)) send("changed");
      }).on("postgres_changes", { schema: "public", table: "suporte_leituras", event: "*", filter: `usuario_id=eq.${scope.profile.id}` }, payload => {
        if ((payload.new as Record<string, unknown>).usuario_id === scope.profile.id) send("changed");
      });
      channel.subscribe(status => {
        if (status === "SUBSCRIBED") send("ready");
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") abort();
      });
    },
    cancel() { cleanup(); },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-store, no-transform", "X-Accel-Buffering": "no" } });
}

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return new Response(null, { status: 403 });
  const params = new URL(request.url).searchParams;
  const scope = await getSupportScope(params);
  const conversationId = params.get("conversa");
  if (!scope || !conversationId || !isUuid(conversationId)) return new Response(null, { status: 403 });
  const ticket = await getSupportTicket(scope, conversationId);
  if (!ticket || ticket.status === "resolved") return new Response(null, { status: 404 });
  if (Number(request.headers.get("content-length")) > 128) return new Response(null, { status: 413 });
  const reader = request.body?.getReader();
  if (!reader) return new Response(null, { status: 400 });
  let raw = "";
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    raw += decoder.decode(value, { stream: true });
    if (raw.length > 128) { await reader.cancel(); return new Response(null, { status: 413 }); }
  }
  const body = (() => { try { return JSON.parse(raw) as { typing?: unknown }; } catch { return null; } })();
  if (typeof body?.typing !== "boolean") return new Response(null, { status: 400 });
  const db = createSupabaseServerClient();
  const channel = db.channel(`support-typing-${conversationId}`, { config: { private: true } });
  try {
    const result = await channel.httpSend("typing", { senderId: scope.profile.id, typing: body.typing });
    return new Response(null, { status: result.success ? 204 : 503 });
  } finally {
    await db.removeChannel(channel);
  }
}
