"use client";

import { useState } from "react";
import { mask } from "remask";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { confirmarPrimeiroAcessoPosto, prepararPrimeiroAcessoPosto, reenviarPrimeiroAcessoPosto } from "../acesso-actions";
import { logoutPostoAction } from "../actions";

export function PostoFirstAccessForm({ initialEmail, initialEndereco, initialTelefone, initialCodePending }: {
  initialEmail: string; initialEndereco: string; initialTelefone: string; initialCodePending: boolean;
}) {
  const [step, setStep] = useState<"details" | "code">(initialCodePending ? "code" : "details");
  const [email, setEmail] = useState(initialEmail);
  const [endereco, setEndereco] = useState(initialEndereco);
  const [telefone, setTelefone] = useState(initialTelefone);
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [codigo, setCodigo] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function prepare(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setMessage(""); setPending(true);
    try {
      const result = await prepararPrimeiroAcessoPosto({ email, endereco, telefone, novaSenha, confirmacao });
      if (result.error) setError(result.error);
      else { setStep("code"); setMessage("success" in result ? result.success ?? "Código enviado." : "Código enviado."); setNovaSenha(""); setConfirmacao(""); }
    } catch { setError("Não foi possível salvar os dados. Tente novamente."); }
    finally { setPending(false); }
  }

  async function resend() {
    setPending(true); setError(""); setMessage("");
    try {
      const result = await reenviarPrimeiroAcessoPosto();
      if (result.error) setError(result.error);
      else setMessage(result.success ?? "Código reenviado.");
    } catch { setError("Não foi possível reenviar o código."); }
    finally { setPending(false); }
  }

  async function confirm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    if (!/^\d{6}$/.test(codigo)) { setError("Informe os seis dígitos do código."); return; }
    setPending(true);
    try {
      const result = await confirmarPrimeiroAcessoPosto(codigo);
      if (result?.error) setError(result.error);
    } catch { setError("Não foi possível confirmar o código. Tente novamente."); }
    finally { setPending(false); }
  }

  return <div className="space-y-5">
    {step === "details" ? <form onSubmit={prepare} className="space-y-4" noValidate>
      <Field><FieldLabel htmlFor="posto-email">E-mail do posto</FieldLabel><Input id="posto-email" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} disabled={pending} /></Field>
      <Field><FieldLabel htmlFor="posto-endereco">Endereço</FieldLabel><Input id="posto-endereco" autoComplete="street-address" value={endereco} onChange={e => setEndereco(e.target.value)} disabled={pending} /></Field>
      <Field><FieldLabel htmlFor="posto-telefone">Telefone (opcional)</FieldLabel><Input id="posto-telefone" inputMode="tel" autoComplete="tel" value={telefone} onChange={e => setTelefone(mask(e.target.value.replace(/\D/g, ""), ["(99) 9999-9999", "(99) 99999-9999"]))} disabled={pending} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field><FieldLabel htmlFor="posto-nova-senha">Nova senha</FieldLabel><Input id="posto-nova-senha" type="password" autoComplete="new-password" value={novaSenha} onChange={e => setNovaSenha(e.target.value)} disabled={pending} /></Field>
        <Field><FieldLabel htmlFor="posto-confirmacao">Confirmar senha</FieldLabel><Input id="posto-confirmacao" type="password" autoComplete="new-password" value={confirmacao} onChange={e => setConfirmacao(e.target.value)} disabled={pending} /></Field>
      </div>
      <Button type="submit" className="w-full" disabled={pending}>{pending ? "Salvando…" : "Salvar e enviar código"}</Button>
    </form> : <form onSubmit={confirm} className="space-y-5" noValidate>
      <p className="text-sm text-muted-foreground">Digite o código enviado ao e-mail do posto para liberar o portal.</p>
      <Field className="items-center"><FieldLabel htmlFor="posto-codigo">Código de verificação</FieldLabel>
        <InputOTP id="posto-codigo" maxLength={6} pattern="^[0-9]+$" inputMode="numeric" autoComplete="one-time-code" value={codigo} onChange={setCodigo} disabled={pending} containerClassName="justify-center"><InputOTPGroup>{Array.from({ length: 6 }, (_, i) => <InputOTPSlot key={i} index={i} className="size-12 text-lg" />)}</InputOTPGroup></InputOTP>
      </Field>
      <Button type="submit" className="w-full" disabled={pending}>{pending ? "Confirmando…" : "Confirmar código"}</Button>
      <div className="flex items-center justify-between gap-2">
        <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => { setError(""); setMessage(""); setStep("details"); }}>Corrigir dados</Button>
        <Button type="button" variant="link" size="sm" disabled={pending} onClick={resend}>Reenviar código</Button>
      </div>
    </form>}
    {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    {message ? <p role="status" className="text-sm text-emerald-700">{message}</p> : null}
    <form action={logoutPostoAction}><Button type="submit" variant="ghost" className="w-full" disabled={pending}>Sair e entrar com outro posto</Button></form>
  </div>;
}
