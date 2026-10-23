"use client";

import { startTransition, useActionState, useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { mask } from "remask";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { LogOut } from "lucide-react";
import { FotoPerfilForm } from "@/app/perfil/perfil-forms";
import { logoutAction } from "@/app/login/actions";
import { confirmarCodigoPrimeiroAcesso, reenviarCodigoPrimeiroAcesso, salvarPrimeiroAcesso, type FirstAccessState } from "./actions";

type Values = { email: string; telefone: string; nova_senha: string; confirmacao: string };
const initialState: FirstAccessState = {};

export function PrimeiroAcessoForm({ nome, avatarUrl, email, telefone, senhaAlterada }: {
  nome: string; avatarUrl: string | null; email: string; telefone: string; senhaAlterada: boolean;
}) {
  const [state, formAction, pending] = useActionState(salvarPrimeiroAcesso, initialState);
  const passwordUpdated = senhaAlterada || Boolean(state.senhaAlterada);
  const form = useForm<Values>({ defaultValues: { email, telefone, nova_senha: "", confirmacao: "" } });
  useEffect(() => { if (state.success) toast.success(state.success); }, [state.success]);
  function submit(values: Values) {
    const data = new FormData();
    for (const [key, value] of Object.entries(values)) data.set(key, value);
    startTransition(() => formAction(data));
  }
  return (
    <div className="space-y-6">
      {passwordUpdated ? <CodigoConfirmacaoForm email={form.getValues("email")} /> : <>
      <FotoPerfilForm nome={nome} avatarUrl={avatarUrl} />
      <form noValidate onSubmit={form.handleSubmit(submit)} className="space-y-5">
        <FieldGroup className="gap-4">
          <Field data-invalid={Boolean(form.formState.errors.email)}>
            <FieldLabel htmlFor="primeiro-email">E-mail para recuperação</FieldLabel>
            <Input id="primeiro-email" type="email" autoComplete="email" placeholder="voce@empresa.com.br" aria-invalid={Boolean(form.formState.errors.email)} disabled={pending} {...form.register("email", { required: "Informe seu e-mail.", pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: "Informe um e-mail válido." } })} />
            <FieldError errors={[form.formState.errors.email]} />
          </Field>
          <Field data-invalid={Boolean(form.formState.errors.telefone)}>
            <FieldLabel htmlFor="primeiro-telefone">Telefone (opcional)</FieldLabel>
            <Controller control={form.control} name="telefone" rules={{ validate: value => !value || /^\(\d{2}\) \d{4,5}-\d{4}$/.test(value) || "Informe um telefone com DDD válido." }} render={({ field, fieldState }) => <Input {...field} id="primeiro-telefone" type="tel" inputMode="numeric" autoComplete="tel" placeholder="(00) 00000-0000" maxLength={15} aria-invalid={fieldState.invalid} disabled={pending} onChange={event => { const digits = event.target.value.replace(/\D/g, "").slice(0, 11); field.onChange(mask(digits, digits.length > 10 ? "(99) 99999-9999" : "(99) 9999-9999")); }} />} />
            <FieldError errors={[form.formState.errors.telefone]} />
          </Field>
            <p className="text-sm font-medium">Crie sua nova senha</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Controller control={form.control} name="nova_senha" rules={{ required: "Crie uma nova senha.", minLength: { value: 8, message: "Use pelo menos 8 caracteres." } }} render={({ field, fieldState }) => <Field data-invalid={fieldState.invalid}><FieldLabel htmlFor="nova-senha">Nova senha</FieldLabel><Input {...field} id="nova-senha" type="password" autoComplete="new-password" aria-invalid={fieldState.invalid} disabled={pending} /><FieldError errors={[fieldState.error]} /></Field>} />
              <Controller control={form.control} name="confirmacao" rules={{ required: "Confirme a nova senha.", validate: value => value === form.getValues("nova_senha") || "As senhas não coincidem." }} render={({ field, fieldState }) => <Field data-invalid={fieldState.invalid}><FieldLabel htmlFor="confirmacao-senha">Confirme a nova senha</FieldLabel><Input {...field} id="confirmacao-senha" type="password" autoComplete="new-password" aria-invalid={fieldState.invalid} disabled={pending} /><FieldError errors={[fieldState.error]} /></Field>} />
            </div>
        </FieldGroup>
        {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
        {state.success && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">{state.success}</p>}
        <Button type="submit" className="h-9 w-full" disabled={pending}>{pending ? "Salvando..." : "Salvar e enviar código"}</Button>
      </form>
      </>}
      <div className="border-t pt-5 text-center">
        <p className="mb-3 text-xs text-muted-foreground">Não deseja continuar com esta conta?</p>
        <form action={logoutAction}>
          <Button type="submit" variant="outline" className="w-full gap-2">
            <LogOut className="size-4" /> Sair e entrar com outra conta
          </Button>
        </form>
      </div>
    </div>
  );
}

function CodigoConfirmacaoForm({ email }: { email: string }) {
  const [state, action, pending] = useActionState(confirmarCodigoPrimeiroAcesso, {});
  const [resendState, resendAction, resendPending] = useActionState(reenviarCodigoPrimeiroAcesso, {});
  const form = useForm<{ codigo: string }>({ defaultValues: { codigo: "" } });
  return <div className="space-y-6">
    <p className="text-sm leading-6 text-muted-foreground">Digite o código de seis dígitos enviado para <strong className="font-medium text-foreground">{email}</strong>.</p>
    <form noValidate className="space-y-5" onSubmit={form.handleSubmit(values => {
    const data = new FormData();
    data.set("codigo", values.codigo);
    startTransition(() => action(data));
  })}>
    <Field data-invalid={Boolean(form.formState.errors.codigo)} className="items-center">
      <FieldLabel htmlFor="codigo-primeiro-acesso">Código recebido por e-mail</FieldLabel>
      <Controller control={form.control} name="codigo" rules={{ required: "Informe o código.", pattern: { value: /^\d{6}$/, message: "Digite os seis dígitos." } }} render={({ field, fieldState }) => <InputOTP id="codigo-primeiro-acesso" maxLength={6} pattern="^[0-9]+$" inputMode="numeric" autoComplete="one-time-code" aria-invalid={fieldState.invalid} disabled={pending} value={field.value} onChange={field.onChange} containerClassName="justify-center"><InputOTPGroup>{Array.from({ length: 6 }, (_, index) => <InputOTPSlot key={index} index={index} className="size-12 text-lg" />)}</InputOTPGroup></InputOTP>} />
      <FieldError errors={[form.formState.errors.codigo]} />
    </Field>
    {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
    <Button type="submit" className="w-full" disabled={pending}>{pending ? "Verificando..." : "Confirmar código"}</Button>
  </form>
  <form action={resendAction} className="space-y-2 text-center">
    <Button type="submit" variant="ghost" size="sm" disabled={resendPending}>{resendPending ? "Reenviando..." : "Reenviar código"}</Button>
    {resendState.error && <p role="alert" className="text-sm text-destructive">{resendState.error}</p>}
    {resendState.success && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">{resendState.success}</p>}
  </form>
  </div>;
}
