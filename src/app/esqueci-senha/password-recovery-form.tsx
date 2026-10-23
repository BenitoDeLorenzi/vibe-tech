"use client";

import Link from "next/link";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { ArrowLeft, KeyRound } from "lucide-react";
import { mask } from "remask";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { redefinirSenhaVerificada, solicitarCodigoRecuperacao, verificarCodigoRecuperacao } from "./actions";

type Values = { cpf: string; codigo: string; novaSenha: string; confirmacao: string };

export function PasswordRecoveryForm() {
  const [step, setStep] = useState<"cpf" | "code" | "password" | "done">("cpf");
  const [resetToken, setResetToken] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const form = useForm<Values>({ defaultValues: { cpf: "", codigo: "", novaSenha: "", confirmacao: "" } });

  async function sendCode() {
    const valid = await form.trigger("cpf");
    if (!valid) return;
    setPending(true);
    setError("");
    setMessage("");
    try {
      const result = await solicitarCodigoRecuperacao(form.getValues("cpf"));
      if (result.error) setError(result.error);
      else {
        setResetToken("");
        form.setValue("codigo", "");
        setStep("code");
        setMessage(result.success ?? "Código enviado.");
      }
    } catch {
      setError("Não foi possível enviar o código. Tente novamente.");
    } finally {
      setPending(false);
    }
  }

  async function verifyCode(values: Values) {
    setPending(true);
    setError("");
    setMessage("");
    try {
      const result = await verificarCodigoRecuperacao({ cpf: values.cpf, codigo: values.codigo });
      if (result.error) setError(result.error);
      else if (result.resetToken) {
        setResetToken(result.resetToken);
        setStep("password");
        form.setValue("codigo", "");
      }
    } catch {
      setError("Não foi possível confirmar o código. Tente novamente.");
    } finally {
      setPending(false);
    }
  }

  async function resetPassword(values: Values) {
    setPending(true);
    setError("");
    setMessage("");
    try {
      const result = await redefinirSenhaVerificada({ resetToken, novaSenha: values.novaSenha, confirmacao: values.confirmacao });
      if (result.error) setError(result.error);
      else {
        setStep("done");
        setResetToken("");
        setMessage(result.success ?? "Senha redefinida.");
        form.reset({ cpf: "", codigo: "", novaSenha: "", confirmacao: "" });
      }
    } catch {
      setError("Não foi possível redefinir a senha. Tente novamente.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-5">
      {step === "done" ? (
        <div className="space-y-5">
          <div className="rounded-xl border bg-muted/30 p-5 text-center">
            <KeyRound className="mx-auto mb-3 size-7 text-emerald-600" />
            <h2 className="font-semibold">Acesso recuperado</h2>
            <p className="mt-1 text-sm text-muted-foreground">Sua nova senha já pode ser usada no login.</p>
          </div>
          <Link href="/login" className={buttonVariants({ className: "w-full" })}>Voltar ao login</Link>
        </div>
      ) : step === "cpf" ? (
        <form noValidate className="space-y-5" onSubmit={form.handleSubmit(() => sendCode())}>
          <Controller control={form.control} name="cpf" rules={{ required: "Informe seu CPF.", validate: value => value.replace(/\D/g, "").length === 11 || "Informe um CPF com 11 dígitos." }} render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="recovery-cpf">CPF</FieldLabel>
              <Input {...field} id="recovery-cpf" inputMode="numeric" autoComplete="username" maxLength={14} placeholder="000.000.000-00" disabled={pending} aria-invalid={fieldState.invalid} onChange={event => field.onChange(mask(event.target.value.replace(/\D/g, ""), "999.999.999-99"))} />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )} />
          <Button type="submit" className="w-full" disabled={pending}>{pending ? "Enviando…" : "Enviar código"}</Button>
          <Button type="button" variant="ghost" className="w-full" disabled={pending} onClick={async () => { if (await form.trigger("cpf")) { setError(""); setMessage(""); setStep("code"); } }}>Já tenho um código</Button>
        </form>
      ) : step === "code" ? (
        <form noValidate className="space-y-5" onSubmit={form.handleSubmit(verifyCode)}>
          <p className="text-sm leading-6 text-muted-foreground">Digite o código enviado ao e-mail verificado da conta vinculada ao CPF <strong className="text-foreground">{form.getValues("cpf")}</strong>.</p>
          <Controller control={form.control} name="codigo" rules={{ required: "Informe o código.", pattern: { value: /^\d{6}$/, message: "Digite os seis dígitos." } }} render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid} className="items-center">
              <FieldLabel htmlFor="recovery-code">Código de recuperação</FieldLabel>
              <InputOTP id="recovery-code" maxLength={6} pattern="^[0-9]+$" inputMode="numeric" autoComplete="one-time-code" disabled={pending} aria-invalid={fieldState.invalid} value={field.value} onChange={field.onChange} containerClassName="justify-center">
                <InputOTPGroup>{Array.from({ length: 6 }, (_, index) => <InputOTPSlot key={index} index={index} className="size-12 text-lg" />)}</InputOTPGroup>
              </InputOTP>
              <FieldError errors={[fieldState.error]} />
            </Field>
          )} />
          <Button type="submit" className="w-full" disabled={pending}>{pending ? "Verificando…" : "Confirmar código"}</Button>
          <div className="flex items-center justify-between gap-2">
            <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => { setError(""); setMessage(""); setStep("cpf"); }}>Trocar CPF</Button>
            <Button type="button" variant="link" size="sm" disabled={pending} onClick={sendCode}>Reenviar código</Button>
          </div>
        </form>
      ) : (
        <form noValidate className="space-y-5" onSubmit={form.handleSubmit(resetPassword)}>
          <p className="text-sm leading-6 text-muted-foreground">Código confirmado. Agora crie sua nova senha para concluir a recuperação.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Controller control={form.control} name="novaSenha" rules={{ required: "Crie uma nova senha.", minLength: { value: 8, message: "Use pelo menos 8 caracteres." } }} render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}><FieldLabel htmlFor="recovery-password">Nova senha</FieldLabel><Input {...field} id="recovery-password" type="password" autoComplete="new-password" disabled={pending} aria-invalid={fieldState.invalid} /><FieldError errors={[fieldState.error]} /></Field>
            )} />
            <Controller control={form.control} name="confirmacao" rules={{ required: "Confirme a senha.", validate: value => value === form.getValues("novaSenha") || "As senhas não coincidem." }} render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}><FieldLabel htmlFor="recovery-confirm">Confirmar senha</FieldLabel><Input {...field} id="recovery-confirm" type="password" autoComplete="new-password" disabled={pending} aria-invalid={fieldState.invalid} /><FieldError errors={[fieldState.error]} /></Field>
            )} />
          </div>
          <Button type="submit" className="w-full" disabled={pending}>{pending ? "Redefinindo…" : "Redefinir senha"}</Button>
          <Button type="button" variant="ghost" className="w-full" disabled={pending} onClick={() => { setResetToken(""); setError(""); setMessage(""); setStep("cpf"); }}>Recomeçar</Button>
        </form>
      )}
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      {message && step !== "done" ? <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">{message}</p> : null}
      {step !== "done" ? <Link href="/login" className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Voltar ao login</Link> : null}
    </div>
  );
}
