export function buildFirstAccessOtpEmail(name: string, code: string) {
  return buildOtpEmail(name, code, "first-access");
}

export function buildProfileVerificationOtpEmail(name: string, code: string) {
  return buildOtpEmail(name, code, "profile");
}

export function buildPasswordRecoveryOtpEmail(name: string, code: string) {
  return buildOtpEmail(name, code, "password-recovery");
}

function buildOtpEmail(name: string, code: string, purpose: "first-access" | "profile" | "password-recovery") {
  const firstName = escapeHtml(name.trim().split(/\s+/)[0] || "usuário");
  const firstAccess = purpose === "first-access";
  const passwordRecovery = purpose === "password-recovery";
  const context = firstAccess ? "concluir o primeiro acesso" : passwordRecovery ? "redefinir sua senha" : "confirmar seu e-mail de recuperação";
  const destination = firstAccess ? "na tela de primeiro acesso" : passwordRecovery ? "na tela de recuperação de senha" : "no seu perfil";
  const text = `Olá, ${name.trim() || "usuário"}.\n\nSeu código de verificação para ${context} na Vibe Tech é: ${code}\n\nDigite o código ${destination}. Ele vence em 10 minutos e pode ser usado uma única vez.\n\nSe você não solicitou este código, ignore esta mensagem. Não compartilhe o código com ninguém.\n\nVibe Tech LTDA\nCNPJ: 69.683.349/0001-71`;

  const html = `<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${passwordRecovery ? "Código de recuperação" : "Código de verificação"} · Vibe Tech</title></head>
<body style="margin:0;padding:0;background-color:#f3f5f9;color:#172033;font-family:Arial,Helvetica,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Seu código para ${context} vence em 10 minutos.</div>
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#f3f5f9;"><tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width:560px;background-color:#ffffff;border:1px solid #e4e9f1;border-radius:14px;overflow:hidden;">
      <tr><td style="background-color:#0b1535;border-top:4px solid #0b7dff;padding:25px 32px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
          <td style="width:36px;height:36px;border-radius:8px;background-color:#075bea;color:#ffffff;text-align:center;font-size:15px;font-weight:700;letter-spacing:-1px;">VT</td>
          <td style="padding-left:12px;color:#ffffff;font-size:18px;font-weight:700;letter-spacing:1px;">VIBE <span style="font-weight:400;">TECH</span></td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:34px 32px 30px;">
        <p style="margin:0 0 10px;color:#075bea;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">${firstAccess ? "Primeiro acesso" : "Segurança da conta"}</p>
        <h1 style="margin:0 0 20px;color:#101b34;font-size:25px;line-height:1.25;">${passwordRecovery ? "Redefina sua senha" : "Confirme seu e-mail"}</h1>
        <p style="margin:0 0 22px;color:#475569;font-size:15px;line-height:1.7;">Olá, ${firstName}. Use o código abaixo para ${firstAccess ? "concluir a configuração da sua conta" : passwordRecovery ? "criar uma nova senha com segurança" : "confirmar seu e-mail de recuperação"}.</p>
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#f5f8ff;border:1px solid #dbe7ff;border-radius:10px;"><tr><td align="center" style="padding:22px 12px;">
          <p style="margin:0 0 8px;color:#64748b;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">Seu código de verificação</p>
          <p style="margin:0;color:#0b1535;font-size:34px;font-weight:700;letter-spacing:9px;line-height:1.25;">${code}</p>
        </td></tr></table>
        <p style="margin:20px 0 0;color:#475569;font-size:14px;line-height:1.6;">Digite os seis números ${destination}. O código <strong style="color:#172033;">vence em 10 minutos</strong> e pode ser usado uma única vez.</p>
        <p style="margin:20px 0 0;padding-top:18px;border-top:1px solid #e4e9f1;color:#64748b;font-size:13px;line-height:1.6;">Não solicitou este código? Ignore este e-mail. A Vibe Tech nunca pedirá que você compartilhe o código por telefone ou mensagem.</p>
      </td></tr>
    </table>
    <p style="margin:20px 0 0;color:#64748b;font-size:12px;line-height:1.7;text-align:center;">VIBE TECH LTDA · Soluções Tecnológicas<br>CNPJ: 69.683.349/0001-71</p>
  </td></tr></table>
</body></html>`;

  return { text, html };
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}
