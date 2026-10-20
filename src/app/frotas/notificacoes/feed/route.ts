import { getNotificationScope } from "@/lib/frotas-notificacoes";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const scope = await getNotificationScope(params.get("empresa"));
  if (!scope) return new Response(null, { status: 403 });
  const size = Number(params.get("size") ?? 13);
  if (!Number.isInteger(size) || size < 1 || size > 13) return new Response(null, { status: 400 });
  const requestedPage = Number(params.get("page") ?? 1);
  if (!Number.isSafeInteger(requestedPage) || requestedPage < 1 || requestedPage > 100000) return new Response(null, { status: 400 });
  const { data, error } = await createSupabaseServerClient().rpc("frota_notificacoes_pagina", {
    p_empresa: scope.empresaId, p_usuario: scope.usuarioId, p_tipos: scope.tipos, p_page: requestedPage, p_size: size,
  });
  if (error) return new Response(null, { status: 500 });
  return Response.json(data, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return new Response(null, { status: 403 });
  const scope = await getNotificationScope(new URL(request.url).searchParams.get("empresa"));
  if (!scope) return new Response(null, { status: 403 });
  const body = await request.json().catch(() => null);
  if (!Array.isArray(body?.ids) || body.ids.length > 30 || !body.ids.every((id: unknown) => Number.isSafeInteger(id) && Number(id) > 0)) {
    return new Response(null, { status: 400 });
  }
  const db = createSupabaseServerClient();
  const { data, error } = await db.from("frota_notificacoes").select("id")
    .eq("prefeitura_id", scope.empresaId).or(`destinatario_id.is.null,destinatario_id.eq.${scope.usuarioId}`).in("tipo", scope.tipos).in("id", body.ids);
  if (error) return new Response(null, { status: 500 });
  if (data.length) {
    const result = await db.from("frota_notificacao_leituras").upsert(
      data.map(item => ({ usuario_id: scope.usuarioId, notificacao_id: item.id })),
      { onConflict: "usuario_id,notificacao_id", ignoreDuplicates: true },
    );
    if (result.error) return new Response(null, { status: 500 });
  }
  return Response.json({ ok: true });
}
