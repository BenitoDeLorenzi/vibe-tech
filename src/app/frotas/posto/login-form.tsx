"use client";

import Link from "next/link";
import { startTransition, useActionState, useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { Fuel, LogIn } from "lucide-react";
import { mask } from "remask";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { loginPostoAction, type PostoLoginState } from "./actions";

const initialState: PostoLoginState = {};
type PostoLoginValues = { cnpj: string; senha: string };

export function PostoLoginForm() {
  const [state, formAction, pending] = useActionState(loginPostoAction, initialState);
  const form = useForm<PostoLoginValues>({ defaultValues: { cnpj: "", senha: "" } });

  useEffect(() => {
    if (state.error) toast.error(state.error, { id: "posto-login-error" });
  }, [state.error]);

  function submit(values: PostoLoginValues) {
    const data = new FormData();
    data.set("cnpj", values.cnpj);
    data.set("senha", values.senha);
    startTransition(() => formAction(data));
  }

  return (
    <form onSubmit={form.handleSubmit(submit)} className="space-y-5" noValidate>
      <FieldGroup>
        <Controller
          control={form.control}
          name="cnpj"
          rules={{
            required: "Informe o CNPJ do posto.",
            validate: (value) => value.replace(/\D/g, "").length === 14 || "Informe um CNPJ com 14 dígitos.",
          }}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="cnpj">CNPJ</FieldLabel>
              <Input
                {...field}
                id="cnpj"
                placeholder="00.000.000/0000-00"
                inputMode="numeric"
                maxLength={18}
                autoComplete="username"
                aria-invalid={fieldState.invalid}
                aria-describedby={fieldState.invalid ? "cnpj-error" : undefined}
                disabled={pending}
                onChange={(event) => field.onChange(mask(event.currentTarget.value.replace(/\D/g, ""), "99.999.999/9999-99"))}
              />
              <FieldError id="cnpj-error" errors={[fieldState.error]} />
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="senha"
          rules={{ required: "Informe a senha do posto." }}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <div className="flex items-center justify-between gap-2"><FieldLabel htmlFor="senha">Senha</FieldLabel><Link href="/frotas/posto/esqueci-senha" className="text-xs text-muted-foreground hover:text-foreground">Esqueci minha senha</Link></div>
              <Input
                {...field}
                id="senha"
                type="password"
                placeholder="Digite a senha do posto"
                autoComplete="current-password"
                aria-invalid={fieldState.invalid}
                aria-describedby={fieldState.invalid ? "senha-error" : undefined}
                disabled={pending}
              />
              <FieldError id="senha-error" errors={[fieldState.error]} />
            </Field>
          )}
        />
      </FieldGroup>
      <Button type="submit" className="h-9 w-full gap-2" disabled={pending}>
        {pending ? <Fuel className="size-4" /> : <LogIn className="size-4" />}
        {pending ? "Entrando..." : "Entrar no portal"}
      </Button>
    </form>
  );
}
