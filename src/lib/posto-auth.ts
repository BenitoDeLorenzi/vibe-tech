import { createHmac, pbkdf2Sync, randomBytes, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase-server";

const postoSessionCookie = "bdl_posto_session";
const sessionDurationMs = 12 * 60 * 60 * 1000;

export type PostoSession = {
  cnpj: string | null;
  id: string;
  nome: string;
  prefeitura_id: string;
  primeiro_acesso_concluido_em: string | null;
};

type PostoSessionPayload = PostoSession & {
  exp: number;
  iat?: number;
};

type PostoAuthRow = PostoSession & {
  senha_hash: string | null;
  status: "active" | "inactive";
};

export async function createPostoSession(posto: PostoSession) {
  const cookieStore = await cookies();
  const payload: PostoSessionPayload = {
    ...posto,
    exp: Date.now() + sessionDurationMs,
    iat: Date.now(),
  };

  cookieStore.set(postoSessionCookie, encodeSession(payload), {
    httpOnly: true,
    maxAge: sessionDurationMs / 1000,
    path: "/frotas/posto",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function clearPostoSession() {
  const cookieStore = await cookies();
  cookieStore.set(postoSessionCookie, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/frotas/posto",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function getPostoSession() {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(postoSessionCookie)?.value;

  if (!cookieValue) {
    return null;
  }

  const payload = decodeSession(cookieValue);

  if (!payload || payload.exp < Date.now()) {
    await clearPostoSession();
    return null;
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("frota_postos_credenciados")
    .select("id,prefeitura_id,nome,cnpj,status,primeiro_acesso_concluido_em,sessao_revogada_em")
    .eq("id", payload.id)
    .maybeSingle();

  if (error || !data) {
    await clearPostoSession();
    return null;
  }

  const posto = data as PostoSession & { status: "active" | "inactive"; sessao_revogada_em: string | null };

  if (posto.status !== "active" || (posto.sessao_revogada_em && (payload.iat ?? 0) < Date.parse(posto.sessao_revogada_em))) {
    await clearPostoSession();
    return null;
  }

  return {
    cnpj: posto.cnpj,
    id: posto.id,
    nome: posto.nome,
    prefeitura_id: posto.prefeitura_id,
    primeiro_acesso_concluido_em: posto.primeiro_acesso_concluido_em,
  } satisfies PostoSession;
}

export async function requirePostoSession() {
  const session = await getPostoSession();

  if (!session) {
    redirect("/frotas/posto/login");
  }

  if (!session.primeiro_acesso_concluido_em) redirect("/frotas/posto/primeiro-acesso");

  return session;
}

export async function authenticatePosto(cnpj: string, password: string) {
  const supabase = createSupabaseServerClient();
  const normalizedCnpj = cnpj.replace(/\D/g, "");
  const maskedCnpj = maskCnpj(normalizedCnpj);
  const { data, error } = await supabase
    .from("frota_postos_credenciados")
    .select("id,prefeitura_id,nome,cnpj,status,senha_hash,primeiro_acesso_concluido_em")
    .in("cnpj", [normalizedCnpj, maskedCnpj])
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const posto = data as PostoAuthRow;

  if (
    posto.status !== "active" ||
    !posto.senha_hash ||
    !verifyPassword(password, posto.senha_hash)
  ) {
    return null;
  }

  return {
    cnpj: posto.cnpj,
    id: posto.id,
    nome: posto.nome,
    prefeitura_id: posto.prefeitura_id,
    primeiro_acesso_concluido_em: posto.primeiro_acesso_concluido_em,
  } satisfies PostoSession;
}

export function hashPostoPassword(password: string) {
  const iterations = 120000;
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(password, salt, iterations, 32, "sha256").toString("hex");
  return `pbkdf2_sha256$${iterations}$${salt}$${hash}`;
}

function encodeSession(payload: PostoSessionPayload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

function decodeSession(value: string) {
  const [body, signature] = value.split(".");

  if (!body || !signature || sign(body) !== signature) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8")
    ) as PostoSessionPayload;

    if (!payload.id || !payload.prefeitura_id || !payload.nome || !payload.exp) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

function sign(value: string) {
  return createHmac("sha256", getSessionSecret()).update(value).digest("hex");
}

function getSessionSecret() {
  return (
    process.env.POSTO_PORTAL_SECRET ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    "bdl-tech-local-posto-session"
  );
}

function maskCnpj(value: string) {
  return value.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    "$1.$2.$3/$4-$5"
  );
}

function verifyPassword(password: string, storedHash: string) {
  const [algorithm, iterationsValue, salt, hash] = storedHash.split("$");

  if (algorithm !== "pbkdf2_sha256" || !iterationsValue || !salt || !hash) {
    return false;
  }

  const iterations = Number(iterationsValue);

  if (!Number.isFinite(iterations) || iterations <= 0) {
    return false;
  }

  const candidate = pbkdf2Sync(password, salt, iterations, 32, "sha256");
  const stored = Buffer.from(hash, "hex");

  return (
    candidate.length === stored.length && timingSafeEqual(candidate, stored)
  );
}
