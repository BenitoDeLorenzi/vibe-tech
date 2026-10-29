import "server-only";

import { request } from "node:https";

const interOrigin = "https://cdpj.partners.bancointer.com.br";
const tokenPath = "/oauth/v2/token";
const scope = "boleto-cobranca.read boleto-cobranca.write";

type InterToken = {
  access_token: string;
  expires_in: number;
  token_type: string;
};

let cachedToken: { value: string; expiresAt: number } | null = null;

function credentials() {
  const clientId = process.env.INTER_CLIENT_ID?.trim();
  const clientSecret = process.env.INTER_CLIENT_SECRET?.trim();
  const cert = process.env.INTER_CERT_BASE64?.trim();
  const key = process.env.INTER_KEY_BASE64?.trim();
  if (!clientId || !clientSecret || !cert || !key) {
    throw new Error("Configure as credenciais da API do Inter no servidor.");
  }
  return {
    clientId,
    clientSecret,
    cert: Buffer.from(cert, "base64"),
    key: Buffer.from(key, "base64"),
  };
}

export async function getInterAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt)
    return cachedToken.value;

  const { clientId, clientSecret, cert, key } = credentials();
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "client_credentials",
    scope,
  }).toString();

  const response = await new Promise<{ status: number; body: string }>(
    (resolve, reject) => {
      const req = request(
        `${interOrigin}${tokenPath}`,
        {
          method: "POST",
          cert,
          key,
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Content-Length": Buffer.byteLength(body),
          },
          timeout: 15000,
        },
        (res) => {
          let data = "";
          res.setEncoding("utf8");
          res.on("data", (chunk: string) => {
            data += chunk;
            if (data.length > 100_000)
              req.destroy(new Error("Resposta do Inter excedeu o limite."));
          });
          res.on("end", () =>
            resolve({ status: res.statusCode ?? 0, body: data }),
          );
        },
      );
      req.on("timeout", () =>
        req.destroy(new Error("Tempo de conexão com o Inter esgotado.")),
      );
      req.on("error", reject);
      req.end(body);
    },
  );

  if (response.status !== 200) {
    throw new Error(
      `O Inter recusou a autenticação (HTTP ${response.status}). Confira as credenciais e as permissões da integração.`,
    );
  }

  let token: InterToken;
  try {
    token = JSON.parse(response.body) as InterToken;
  } catch {
    throw new Error("O Inter retornou uma resposta de autenticação inválida.");
  }
  if (
    !token.access_token ||
    !Number.isFinite(token.expires_in) ||
    token.expires_in <= 0
  ) {
    throw new Error("O Inter não retornou um token de acesso válido.");
  }
  cachedToken = {
    value: token.access_token,
    expiresAt: Date.now() + Math.max(0, token.expires_in - 120) * 1000,
  };
  return token.access_token;
}

export type InterPayer = {
  cpfCnpj: string;
  tipoPessoa: "JURIDICA";
  nome: string;
  endereco: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
  email: string;
  ddd?: string;
  telefone?: string;
};

export async function issueInterBilling(input: {
  seuNumero: string;
  valor: number;
  vencimento: string;
  pagador: InterPayer;
}): Promise<string> {
  const token = await getInterAccessToken();
  const { cert, key } = credentials();
  const body = JSON.stringify({
    seuNumero: input.seuNumero,
    valorNominal: input.valor,
    dataVencimento: input.vencimento,
    numDiasAgenda: 30,
    pagador: input.pagador,
    formasRecebimento: ["BOLETO", "PIX"],
  });

  const response = await new Promise<{ status: number; body: string }>((resolve, reject) => {
    const req = request(
      `${interOrigin}/cobranca/v3/cobrancas`,
      {
        method: "POST",
        cert,
        key,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
        timeout: 20000,
      },
      (res) => {
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (chunk: string) => {
          data += chunk;
          if (data.length > 100_000) req.destroy(new Error("Resposta do Inter excedeu o limite."));
        });
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body: data }));
      },
    );
    req.on("timeout", () => req.destroy(new Error("Tempo de emissão no Inter esgotado.")));
    req.on("error", reject);
    req.end(body);
  });

  if (response.status < 200 || response.status >= 300) {
    throw new Error(`O Inter não confirmou a emissão (HTTP ${response.status}).`);
  }
  let result: { codigoSolicitacao?: string };
  try {
    result = JSON.parse(response.body) as { codigoSolicitacao?: string };
  } catch {
    throw new Error("O Inter não retornou uma confirmação legível da emissão.");
  }
  if (!result.codigoSolicitacao)
    throw new Error("O Inter não retornou o código da solicitação de cobrança.");
  return result.codigoSolicitacao;
}

async function interBillingRequest(path: string, method: "GET" | "POST" | "PUT", payload?: object) {
  const token = await getInterAccessToken();
  const { cert, key } = credentials();
  const body = payload ? JSON.stringify(payload) : undefined;
  const response = await new Promise<{ status: number; body: string }>((resolve, reject) => {
    const req = request(`${interOrigin}/cobranca/v3/cobrancas${path}`, {
      method, cert, key, timeout: 20000,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) } : {}),
      },
    }, res => {
      let data = "";
      res.setEncoding("utf8");
      res.on("data", (chunk: string) => {
        data += chunk;
        if (data.length > 10_000_000) req.destroy(new Error("Resposta do Inter excedeu o limite."));
      });
      res.on("end", () => resolve({ status: res.statusCode ?? 0, body: data }));
    });
    req.on("timeout", () => req.destroy(new Error("Tempo de consulta ao Inter esgotado.")));
    req.on("error", reject);
    req.end(body);
  });
  if (response.status < 200 || response.status >= 300)
    throw new Error(`O Inter não confirmou a operação (HTTP ${response.status}).`);
  if (!response.body) return {};
  try { return JSON.parse(response.body) as unknown; }
  catch { throw new Error("O Inter retornou uma resposta inválida."); }
}

export type InterBillingDetail = {
  cobranca?: { codigoSolicitacao?: string; seuNumero?: string; situacao?: string; valorTotalRecebido?: string | number; dataSituacao?: string };
  boleto?: { nossoNumero?: string; linhaDigitavel?: string; codigoBarras?: string };
  pix?: { pixCopiaECola?: string };
};

export async function retrieveInterBilling(code: string): Promise<InterBillingDetail> {
  return await interBillingRequest(`/${encodeURIComponent(code)}`, "GET") as InterBillingDetail;
}

export async function findInterBillingByYourNumber(number: string, start: string, end: string): Promise<string | null> {
  const query = new URLSearchParams({ dataInicial: start, dataFinal: end, "paginacao.paginaAtual": "0", "paginacao.itensPorPagina": "10", seuNumero: number });
  const result = await interBillingRequest(`?${query}`, "GET") as { cobrancas?: InterBillingDetail[] };
  return result.cobrancas?.find(item => item.cobranca?.seuNumero === number)?.cobranca?.codigoSolicitacao ?? null;
}

export async function cancelInterBilling(code: string, reason: string): Promise<void> {
  await interBillingRequest(`/${encodeURIComponent(code)}/cancelar`, "POST", { motivoCancelamento: reason });
}

export async function retrieveInterBillingPdf(code: string): Promise<Buffer> {
  const data = await interBillingRequest(`/${encodeURIComponent(code)}/pdf`, "GET") as { pdf?: string };
  if (!data.pdf || data.pdf.length > 10_000_000) throw new Error("PDF indisponível no Inter.");
  const pdf = Buffer.from(data.pdf, "base64");
  if (pdf.subarray(0, 5).toString() !== "%PDF-") throw new Error("PDF inválido recebido do Inter.");
  return pdf;
}

export async function getInterBillingWebhook(): Promise<string | null> {
  try {
    const result = await interBillingRequest("/webhook", "GET") as { webhookUrl?: string };
    return result.webhookUrl ?? null;
  } catch (error) {
    if (error instanceof Error && error.message.includes("HTTP 404")) return null;
    throw error;
  }
}

export async function setInterBillingWebhook(url: string): Promise<void> {
  await interBillingRequest("/webhook", "PUT", { webhookUrl: url });
}
