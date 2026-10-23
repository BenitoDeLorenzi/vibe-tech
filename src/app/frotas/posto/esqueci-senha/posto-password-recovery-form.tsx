"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, KeyRound } from "lucide-react";
import { mask } from "remask";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { redefinirSenhaPosto, solicitarRecuperacaoPosto, verificarRecuperacaoPosto } from "../acesso-actions";

export function PostoPasswordRecoveryForm() {
  const [step, setStep] = useState<"cnpj" | "code" | "password" | "done">("cnpj");
  const [cnpj, setCnpj] = useState("");
  const [code, setCode] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function requestCode(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault(); setError(""); setMessage("");
    if (cnpj.replace(/\D/g, "").length !== 14) { setError("Informe um CNPJ com 14 dígitos."); return; }
    setPending(true);
    try {
      const result = await solicitarRecuperacaoPosto(cnpj);
      if (result.error) setError(result.error);
      else { setCode(""); setResetToken(""); setStep("code"); setMessage(result.success ?? "Código enviado."); }
    } catch { setError("Não foi possível enviar o código. Tente novamente."); }
    finally { setPending(false); }
  }

  async function verifyCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setMessage("");
    if (!/^\d{6}$/.test(code)) { setError("Informe os seis dígitos do código."); return; }
    setPending(true);
    try {
      const result = await verificarRecuperacaoPosto(cnpj, code);
      if (result.error) setError(result.error);
      else if (result.resetToken) { setResetToken(result.resetToken); setCode(""); setStep("password"); }
    } catch { setError("Não foi possível confirmar o código. Tente novamente."); }
    finally { setPending(false); }
  }

  async function savePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    if (newPassword.length < 8 || newPassword.length > 128) { setError("A senha deve ter entre 8 e 128 caracteres."); return; }
    if (newPassword !== confirmation) { setError("As senhas não coincidem."); return; }
    setPending(true);
    try {
      const result = await redefinirSenhaPosto({ resetToken, novaSenha: newPassword, confirmacao: confirmation });
      if (result.error) setError(result.error);
      else { setStep("done"); setResetToken(""); setNewPassword(""); setConfirmation(""); }
    } catch { setError("Não foi possível redefinir a senha. Tente novamente."); }
    finally { setPending(false); }
  }

  return <div className="space-y-5">
    {step === "cnpj" ? <form onSubmit={requestCode} className="space-y-5" noValidate>
      <Field><FieldLabel htmlFor="recovery-posto-cnpj">CNPJ</FieldLabel><Input id="recovery-posto-cnpj" inputMode="numeric" autoComplete="username" maxLength={18} placeholder="00.000.000/0000-00" value={cnpj} onChange={e => setCnpj(mask(e.target.value.replace(/\D/g, ""), "99.999.999/9999-99"))} disabled={pending} /></Field>
      <Button type="submit" className="w-full" disabled={pending}>{pending ? "Enviando…" : "Enviar código"}</Button>
      <Button type="button" variant="ghost" className="w-full" disabled={pending} onClick={() => { if (cnpj.replace(/\D/g, "").length === 14) { setError(""); setStep("code"); } else setError("Informe um CNPJ com 14 dígitos."); }}>Já tenho um código</Button>
    </form> : step === "code" ? <form onSubmit={verifyCode} className="space-y-5" noValidate>
      <p className="text-sm text-muted-foreground">Digite o código enviado ao e-mail verificado do posto vinculado ao CNPJ <strong className="text-foreground">{cnpj}</strong>.</p>
      <Field className="items-center"><FieldLabel htmlFor="recovery-posto-code">Código de recuperação</FieldLabel><InputOTP id="recovery-posto-code" maxLength={6} pattern="^[0-9]+$" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={setCode} disabled={pending} containerClassName="justify-center"><InputOTPGroup>{Array.from({ length: 6 }, (_, i) => <InputOTPSlot key={i} index={i} className="size-12 text-lg" />)}</InputOTPGroup></InputOTP></Field>
      <Button type="submit" className="w-full" disabled={pending}>{pending ? "Verificando…" : "Confirmar código"}</Button>
      <div className="flex items-center justify-between gap-2"><Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => { setError(""); setStep("cnpj"); }}>Trocar CNPJ</Button><Button type="button" variant="link" size="sm" disabled={pending} onClick={() => requestCode()}>Reenviar código</Button></div>
    </form> : step === "password" ? <form onSubmit={savePassword} className="space-y-5" noValidate>
      <p className="text-sm text-muted-foreground">Código confirmado. Agora crie sua nova senha.</p>
      <div className="grid gap-4 sm:grid-cols-2"><Field><FieldLabel htmlFor="recovery-posto-password">Nova senha</FieldLabel><Input id="recovery-posto-password" type="password" autoComplete="new-password" value={newPassword} onChange={e => setNewPassword(e.target.value)} disabled={pending} /></Field><Field><FieldLabel htmlFor="recovery-posto-confirm">Confirmar senha</FieldLabel><Input id="recovery-posto-confirm" type="password" autoComplete="new-password" value={confirmation} onChange={e => setConfirmation(e.target.value)} disabled={pending} /></Field></div>
      <Button type="submit" className="w-full" disabled={pending}>{pending ? "Redefinindo…" : "Redefinir senha"}</Button>
      <Button type="button" variant="ghost" className="w-full" disabled={pending} onClick={() => { setResetToken(""); setError(""); setStep("cnpj"); }}>Recomeçar</Button>
    </form> : <div className="space-y-5"><div className="rounded-xl border bg-muted/30 p-5 text-center"><KeyRound className="mx-auto mb-3 size-7 text-emerald-600" /><h2 className="font-semibold">Acesso recuperado</h2><p className="mt-1 text-sm text-muted-foreground">Sua nova senha já pode ser usada no portal do posto.</p></div><Link href="/frotas/posto/login" className={buttonVariants({ className: "w-full" })}>Voltar ao login</Link></div>}
    {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    {message && step !== "done" ? <p role="status" className="text-sm text-emerald-700">{message}</p> : null}
    {step !== "done" ? <Link href="/frotas/posto/login" className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Voltar ao login</Link> : null}
  </div>;
}
