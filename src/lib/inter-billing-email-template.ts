import { INTER_BILLING_SCHEDULE_DAYS } from "@/lib/inter-client";

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[char] ?? char);
const money = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
const date = (value: string) => new Date(`${value.slice(0, 10)}T12:00:00Z`).toLocaleDateString("pt-BR", { timeZone: "UTC" });

function frame(title: string, lead: string, content: string) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body style="margin:0;padding:0;background:#f3f5f9;color:#16213b;font-family:Arial,Helvetica,sans-serif">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f5f9"><tr><td align="center" style="padding:32px 16px">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#fff;border:1px solid #e5eaf2;border-radius:14px;overflow:hidden">
  <tr><td style="background:#07132f;padding:26px 32px;border-top:4px solid #087dff"><table role="presentation" cellspacing="0" cellpadding="0"><tr><td style="width:38px;height:38px;border-radius:8px;background:#075bea;color:#fff;text-align:center;font-size:16px;font-weight:bold">VT</td><td style="padding-left:12px;color:#fff;font-size:20px;font-weight:bold;letter-spacing:1px">VIBE <span style="font-weight:normal">TECH</span></td></tr></table></td></tr>
  <tr><td style="padding:32px"><p style="margin:0 0 8px;color:#075bea;font-size:12px;font-weight:bold;letter-spacing:1.4px;text-transform:uppercase">Vibe Tech · Cobranças</p>
  <h1 style="margin:0 0 14px;font-size:25px;line-height:1.3;color:#101b34">${escapeHtml(title)}</h1>
  <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.6">${escapeHtml(lead)}</p>${content}
  <p style="margin:28px 0 0;padding-top:18px;border-top:1px solid #e5eaf2;color:#64748b;font-size:12px;line-height:1.6">Em caso de dúvida sobre esta cobrança, responda a este e-mail antes de efetuar o pagamento.</p>
  </td></tr></table>
  <p style="margin:18px 0 0;color:#64748b;font-size:12px;text-align:center;line-height:1.6">VIBE TECH LTDA · Soluções Tecnológicas<br>CNPJ 69.683.349/0001-71</p>
  </td></tr></table></body></html>`;
}

function detail(label: string, value: string) {
  return `<tr><td style="padding:9px 0;color:#64748b;font-size:13px">${escapeHtml(label)}</td><td align="right" style="padding:9px 0;color:#16213b;font-size:14px;font-weight:bold">${escapeHtml(value)}</td></tr>`;
}

export function buildInterBillEmail(input: {
  empresa: string; modulo: string; competencia: string; valor: number; vencimento: string;
  linhaDigitavel: string; pix: string; substituiAnterior: boolean;
}) {
  const competence = `${input.competencia.slice(5, 7)}/${input.competencia.slice(0, 4)}`;
  const lastDate = new Date(`${input.vencimento}T12:00:00Z`);
  lastDate.setUTCDate(lastDate.getUTCDate() + INTER_BILLING_SCHEDULE_DAYS);
  const lastDay = date(lastDate.toISOString());
  const intro = input.substituiAnterior
    ? "O boleto anterior foi cancelado. Este novo boleto o substitui para a mensalidade indicada abaixo."
    : "Segue a cobrança da mensalidade da sua licença Vibe Tech. O boleto está anexado a este e-mail.";
  const html = frame("Sua mensalidade está disponível", `Olá, ${input.empresa}. ${intro}`,
    `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #dbe7ff;border-radius:10px;background:#f7faff;padding:8px 18px">
    ${detail("Serviço", `Licença ${input.modulo}`)}${detail("Competência", competence)}${detail("Valor", money(input.valor))}${detail("Vencimento", date(input.vencimento))}
    </table>
    <p style="margin:22px 0 8px;font-size:14px;font-weight:bold">Linha digitável</p><p style="margin:0;padding:14px;border:1px solid #e5eaf2;border-radius:8px;background:#f8fafc;font-family:monospace;font-size:13px;line-height:1.6;word-break:break-all">${escapeHtml(input.linhaDigitavel)}</p>
    <p style="margin:22px 0 8px;font-size:14px;font-weight:bold">Pix copia e cola</p><p style="margin:0;padding:14px;border:1px solid #e5eaf2;border-radius:8px;background:#f8fafc;font-family:monospace;font-size:12px;line-height:1.6;word-break:break-all">${escapeHtml(input.pix)}</p>
    <p style="margin:18px 0 0;color:#64748b;font-size:13px;line-height:1.6">O vencimento é ${date(input.vencimento)}. A baixa automática está programada para ${lastDay}, 30 dias após o vencimento. Após vencer, confirme a disponibilidade do pagamento no banco.</p>`);
  const text = `Olá, ${input.empresa}.\n\n${intro}\n\nServiço: Licença ${input.modulo}\nCompetência: ${competence}\nValor: ${money(input.valor)}\nVencimento: ${date(input.vencimento)}\nBaixa automática programada: ${lastDay}\n\nLinha digitável: ${input.linhaDigitavel}\n\nPix copia e cola: ${input.pix}\n\nO boleto segue em anexo.\n\nVIBE TECH LTDA · CNPJ 69.683.349/0001-71`;
  return { html, text, subject: `${input.substituiAnterior ? "Novo boleto" : "Boleto"} da licença ${input.modulo} · ${competence} | Vibe Tech` };
}

export function buildInterPaymentEmail(input: {
  empresa: string; modulo: string; competencia: string; valor: number; recebidoEm: string;
  origem: string; protocolo: string; diferente: boolean;
}) {
  const competence = `${input.competencia.slice(5, 7)}/${input.competencia.slice(0, 4)}`;
  const summary = `${input.empresa} pagou a mensalidade ${competence} da licença ${input.modulo}.`;
  const html = frame("Pagamento confirmado", summary,
    `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #d1fae5;border-radius:10px;background:#f0fdf4;padding:8px 18px">
    ${detail("Empresa", input.empresa)}${detail("Serviço", input.modulo)}${detail("Competência", competence)}${detail("Valor recebido", money(input.valor))}${detail("Data", date(input.recebidoEm))}${detail("Forma", input.origem)}
    </table><p style="margin:18px 0 0;color:#64748b;font-size:13px;word-break:break-all">Protocolo Inter: ${escapeHtml(input.protocolo)}</p>
    ${input.diferente ? '<p style="margin:18px 0 0;padding:12px;border-radius:8px;background:#fff7ed;color:#9a3412;font-size:13px">Atenção: o valor recebido é diferente do valor nominal da mensalidade. Confira a conciliação.</p>' : ""}`);
  const text = `Pagamento confirmado pelo Inter.\n${summary}\nValor recebido: ${money(input.valor)}\nData: ${date(input.recebidoEm)}\nForma: ${input.origem}\nProtocolo: ${input.protocolo}${input.diferente ? "\nAtenção: valor recebido diferente do valor nominal." : ""}`;
  return { html, text, subject: `Pagamento recebido · ${input.empresa} · ${competence} | Vibe Tech` };
}
