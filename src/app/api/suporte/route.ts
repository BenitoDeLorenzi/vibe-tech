import sharp from "sharp";
import { getSupportScope, getSupportTicket, isUuid, supportBucket, supportRpcScope } from "@/lib/suporte";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
const fail = (message: string, status = 400) => json({ error: message }, status);

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const scope = await getSupportScope(params);
    if (!scope) return fail("Acesso não autorizado.", 403);
    const db = createSupabaseServerClient();
    const id = params.get("conversa");
    if (id) {
      const ticket = await getSupportTicket(scope, id);
      if (!ticket) return fail("Atendimento não encontrado.", 404);
      const before = params.get("before");
      if (before && !/^[1-9]\d{0,14}$/.test(before)) return fail("Página inválida.");
      let query = db.from("suporte_mensagens").select("id,autor_id,autor_nome,suporte,tipo,texto,anexos,created_at")
        .eq("conversa_id", id).order("id", { ascending: false }).limit(51);
      if (before) query = query.lt("id", before);
      const { data, error } = await query;
      if (error) return fail("Não foi possível carregar as mensagens.", 500);
      const messages = data.slice(0, 50).reverse().map(item => ({ ...item,
        anexos: (item.anexos as Array<{ name: string }>).map((file, index) => ({ name: file.name,
          url: `/api/suporte/anexo?${new URLSearchParams({ mode: scope.master ? "master" : "usuario", empresa: scope.empresa ?? "", mensagem: String(item.id), indice: String(index) })}` })),
      }));
      return json({ ticket, messages, hasMore: data.length > 50 });
    }
    const status = params.get("status") || null;
    if (status && !["waiting", "active", "resolved"].includes(status)) return fail("Status inválido.");
    const page = Number(params.get("page") || 1);
    if (!Number.isInteger(page) || page < 1 || page > 10000) return fail("Página inválida.");
    const size = Number(params.get("size") ?? 25);
    if (!Number.isInteger(size) || size < 1 || size > 25) return fail("Tamanho de página inválido.");
    const { data, error } = await db.rpc("suporte_listar_pagina", {
      ...supportRpcScope(scope), p_status: status, p_busca: (params.get("q") ?? "").slice(0, 120), p_page: page, p_size: size,
    });
    return error ? fail("Não foi possível carregar os atendimentos.", 500) : json(data);
  } catch { return fail("Não foi possível carregar o suporte. Tente novamente.", 500); }
}

// Bound multipart parsing, including requests without Content-Length.
async function readForm(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("empty");
  const parts: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 3.5 * 1024 * 1024) { await reader.cancel(); throw new Error("large"); }
    parts.push(value);
  }
  return new Response(Buffer.concat(parts), { headers: { "Content-Type": request.headers.get("content-type") ?? "" } }).formData();
}

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return fail("Origem inválida.", 403);
  const scope = await getSupportScope(new URL(request.url).searchParams);
  if (!scope) return fail("Acesso não autorizado.", 403);
  let form: FormData;
  try { form = await readForm(request); } catch { return fail("Envie uma mensagem com até 3 MB em imagens.", 413); }
  const id = String(form.get("conversa") ?? "");
  if (!isUuid(id)) return fail("Atendimento inválido.");
  const db = createSupabaseServerClient();
  const uploaded: string[] = [];
  try {
    const ticket = await getSupportTicket(scope, id);
    const operation = String(form.get("operation") ?? "send");
    if (operation === "read" || operation === "status") {
      if (!ticket) return fail("Atendimento não encontrado.", 404);
      if (operation === "read") {
        const last = Number(form.get("last"));
        if (!Number.isSafeInteger(last) || last <= 0) return fail("Mensagem inválida.");
        const { error } = await db.rpc("suporte_ler", { ...supportRpcScope(scope), p_conversa: id, p_ultima: last });
        return error ? fail("Não foi possível atualizar a leitura.", 500) : json({ ok: true });
      }
      const status = String(form.get("status"));
      if (!["waiting", "active", "resolved"].includes(status) || (!scope.master && !(ticket.status === "resolved" && status === "waiting"))) return fail("Alteração não permitida.", 403);
      const { error } = await db.rpc("suporte_status", { ...supportRpcScope(scope), p_conversa: id, p_status: status });
      return error ? fail("Não foi possível alterar o status. Atualize e tente novamente.", 409) : json({ ok: true });
    }
    if (operation !== "send") return fail("Operação inválida.");
    const isNew = form.get("new") === "true";
    if (!ticket && (!isNew || scope.master)) return fail("Atendimento não encontrado.", 404);
    const subject = ticket?.assunto ?? String(form.get("assunto") ?? "").trim();
    const text = String(form.get("texto") ?? "").trim();
    const requestId = String(form.get("request_id") ?? "");
    const files = form.getAll("imagens").filter((item): item is File => item instanceof File && item.size > 0);
    if (!isUuid(requestId) || subject.length < 3 || subject.length > 120 || text.length > 5000 || (!text && !files.length)) return fail("Informe o assunto e uma mensagem de até 5.000 caracteres.");
    if (files.length > 3 || files.reduce((sum, file) => sum + file.size, 0) > 3 * 1024 * 1024 || files.some(file => !["image/jpeg", "image/png", "image/webp"].includes(file.type))) return fail("Envie até 3 imagens JPG, PNG ou WebP, somando no máximo 3 MB.");
    const { data: existing, error: existingError } = await db.from("suporte_mensagens").select("id,conversa_id,autor_id").eq("request_id", requestId).maybeSingle();
    if (existingError) throw new Error("request lookup");
    if (existing) return existing.conversa_id === id && existing.autor_id === scope.profile.id && ticket ? json({ ok: true, conversa: id }) : fail("Solicitação inválida.", 409);
    if (ticket?.status === "resolved") return fail("Reabra o atendimento para enviar uma nova mensagem.", 409);
    const attachments: Array<{ path: string; name: string }> = [];
    for (const file of files) {
      let image: Buffer;
      try {
        const input = Buffer.from(await file.arrayBuffer());
        const processor = sharp(input, { limitInputPixels: 25000000 });
        const metadata = await processor.metadata();
        if (!["jpeg", "png", "webp"].includes(metadata.format ?? "")) return fail("Formato de imagem não permitido.");
        image = await processor.rotate().resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
      } catch { return fail("Não foi possível ler uma das imagens. Remova o arquivo e selecione uma imagem JPG, PNG ou WebP válida."); }
      const path = `${id}/${requestId}/${crypto.randomUUID()}.webp`;
      const { error } = await db.storage.from(supportBucket).upload(path, image, { contentType: "image/webp", upsert: false });
      if (error) return fail("Não foi possível anexar as imagens. Tente novamente.", 500);
      uploaded.push(path);
      attachments.push({ path, name: file.name.slice(0, 180) });
    }
    const rawOrigin = String(form.get("origem") ?? "/frotas/ajuda");
    const origin = /^\/frotas(?:\/[a-z0-9-]+)*$/i.test(rawOrigin) ? rawOrigin.slice(0, 200) : "/frotas/ajuda";
    const { data: messageId, error } = await db.rpc("suporte_enviar", { ...supportRpcScope(scope), p_conversa: id, p_request: requestId,
      p_assunto: subject, p_texto: text, p_anexos: attachments, p_origem: origin });
    if (error) return fail("Não foi possível enviar. Confira se o atendimento está aberto e tente novamente.", 409);
    // Another retry may have committed this request first; retain only referenced uploads.
    const { data: saved } = await db.from("suporte_mensagens").select("anexos").eq("id", messageId).single();
    const used = new Set((saved?.anexos as Array<{ path: string }> | undefined)?.map(file => file.path));
    if (!saved) { uploaded.length = 0; } else {
      for (let i = uploaded.length - 1; i >= 0; i--) if (used.has(uploaded[i])) uploaded.splice(i, 1);
    }
    return json({ ok: true, conversa: id });
  } catch { return fail("Não foi possível enviar a mensagem. Tente novamente.", 500); }
  finally { if (uploaded.length) await db.storage.from(supportBucket).remove(uploaded); }
}
