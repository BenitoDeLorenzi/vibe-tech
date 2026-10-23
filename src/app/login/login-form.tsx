"use client";


import { startTransition, useActionState, useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { LogIn } from "lucide-react";
import { mask } from "remask";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { loginAction, type LoginState } from "./actions";

const initialState: LoginState = {};
type LoginValues = { identifier: string; password: string };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);
  const form = useForm<LoginValues>({ defaultValues: { identifier: "", password: "" } });

  useEffect(() => {
    if (state.error) toast.error(state.error, { id: "login-error" });
  }, [state.error]);

  function submit(values: LoginValues) {
    const data = new FormData();
    data.set("identifier", values.identifier);
    data.set("password", values.password);
    startTransition(() => formAction(data));
  }

  return (
    <form onSubmit={form.handleSubmit(submit)} className="space-y-5" noValidate>
      <FieldGroup>
        <Controller
          control={form.control}
          name="identifier"
          rules={{
            required: "Informe seu CPF.",
            validate: (value) => value.replace(/\D/g, "").length === 11 || "Informe um CPF com 11 dígitos.",
          }}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="identifier">CPF</FieldLabel>
              <Input
                {...field}
                id="identifier"
                placeholder="000.000.000-00"
                inputMode="numeric"
                maxLength={14}
                autoComplete="username"
                aria-invalid={fieldState.invalid}
                aria-describedby={fieldState.invalid ? "identifier-error" : undefined}
                disabled={pending}
                onChange={(event) => field.onChange(mask(event.currentTarget.value.replace(/\D/g, ""), "999.999.999-99"))}
              />
              <FieldError id="identifier-error" errors={[fieldState.error]} />
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="password"
          rules={{ required: "Informe sua senha." }}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <div className="flex items-center justify-between gap-3">
                <FieldLabel htmlFor="password">Senha</FieldLabel>
                <a href="/esqueci-senha" className="relative z-10 text-xs font-medium text-primary underline-offset-4 hover:underline">Esqueci minha senha</a>
              </div>
              <Input
                {...field}
                id="password"
                type="password"
                placeholder="Digite sua senha"
                autoComplete="current-password"
                aria-invalid={fieldState.invalid}
                aria-describedby={fieldState.invalid ? "password-error" : undefined}
                disabled={pending}
              />
              <FieldError id="password-error" errors={[fieldState.error]} />
            </Field>
          )}
        />
      </FieldGroup>
      <Button type="submit" className="h-9 w-full gap-2" disabled={pending}>
        <LogIn className="size-4" />
        {pending ? "Entrando..." : "Entrar"}
      </Button>
    </form>
  );
}
