"use client";
import { useEffect, useId, useState } from "react";
import { AvatarPhotoControl } from "@/components/avatar-photo-control";

import { Controller, useForm } from "react-hook-form";
import { mask } from "remask";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel, FieldError } from "@/components/ui/field";
import {
  salvarDadosPerfil,
  salvarFotoPerfil,
  alterarSenhaPerfil,
} from "./actions";

export function DadosPerfilForm({
  nome,
  telefone,
}: {
  nome: string;
  telefone: string;
}) {
  const id = useId();
  const router = useRouter();
  const form = useForm({ defaultValues: { nome, telefone: formatPhone(telefone) } });
  const { errors, isSubmitting } = form.formState;
  return (
    <form
      id="dados-perfil-form"
      noValidate
      className="space-y-4"
      onSubmit={form.handleSubmit(async (values) => {
        form.clearErrors("root");
        try {
          const r = await salvarDadosPerfil(values);
          if (r.error) {
            form.setError("root", { message: r.error });
            return;
          }
          toast.success(r.success);
          router.refresh();
        } catch {
          form.setError("root", {
            message: "Não foi possível salvar. Tente novamente.",
          });
        }
      })}
    >
      <div className="grid gap-3">
        <Field data-invalid={Boolean(errors.nome)}>
          <FieldLabel htmlFor={id + "nome"}>Nome completo</FieldLabel>
          <Input
            id={id + "nome"}
            disabled={isSubmitting}
            aria-invalid={Boolean(errors.nome)}
            autoComplete="name"
            {...form.register("nome", {
              validate: (v) =>
                (v.trim().length >= 2 && v.trim().length <= 120) ||
                "Informe de 2 a 120 caracteres.",
            })}
          />
          <FieldError errors={[errors.nome]} />
        </Field>
        <Controller
          control={form.control}
          name="telefone"
          rules={{ validate: (value) => {
            const digits = value.replace(/\D/g, "");
            return !digits || digits.length === 10 || digits.length === 11 || "Informe um telefone com DDD válido.";
          } }}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={id + "telefone"}>Telefone (opcional)</FieldLabel>
              <Input
                id={id + "telefone"}
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                placeholder="(00) 00000-0000"
                maxLength={15}
                disabled={isSubmitting}
                aria-invalid={fieldState.invalid}
                {...field}
                onChange={(event) => field.onChange(formatPhone(event.target.value))}
              />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
      </div>
      <FieldError errors={[errors.root]} />
    </form>
  );
}

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  return mask(digits, digits.length > 10 ? "(99) 99999-9999" : "(99) 9999-9999");
}

export function FotoPerfilForm({
  nome,
  avatarUrl,
}: {
  nome: string;
  avatarUrl: string | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<string | null | undefined>(undefined);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  const source = preview === undefined ? avatarUrl : preview;
  async function save(file: File | null) {
    if (pending) return;
    setError("");
    if (
      file &&
      (!file.size ||
        file.size > 3 * 1024 * 1024 ||
        !["image/jpeg", "image/png", "image/webp"].includes(file.type))
    ) {
      setError("Escolha JPG, PNG ou WebP de até 3 MB.");
      return;
    }
    setPending(true);
    try {
      const data = new FormData();
      if (file) data.set("foto", file);
      else data.set("remover", "true");
      const result = await salvarFotoPerfil(data);
      if (result.error) {
        setError(result.error);
        return;
      }
      setPreview(file ? URL.createObjectURL(file) : null);
      toast.success(result.success);
      router.refresh();
    } catch {
      setError("Não foi possível atualizar a foto. Tente novamente.");
    } finally {
      setPending(false);
    }
  }
  return (
    <AvatarPhotoControl
      nome={nome}
      source={source}
      pending={pending}
      error={error}
      onSelect={(file) => void save(file)}
      onRemove={() => void save(null)}
    />
  );
}
export function SenhaPerfilForm() {
  const id = useId();
  const form = useForm({
    defaultValues: { atual: "", nova: "", confirmacao: "", encerrar: false },
  });
  const { errors, isSubmitting } = form.formState;
  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={form.handleSubmit(async (values) => {
        form.clearErrors("root");
        try {
          const r = await alterarSenhaPerfil(values);
          if (r.error) {
            form.setError("root", { message: r.error });
            return;
          }
          toast.success(r.success);
          form.reset();
        } catch {
          form.setError("root", {
            message: "Não foi possível alterar a senha. Tente novamente.",
          });
        }
      })}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {(
          [
            { name: "atual", label: "Senha atual" },
            { name: "nova", label: "Nova senha" },
            { name: "confirmacao", label: "Confirmar nova senha" },
          ] as const
        ).map(({ name, label }) => (
          <Field
            key={name}
            className={name === "atual" ? "sm:col-span-2" : undefined}
            data-invalid={Boolean(errors[name])}
          >
            <FieldLabel htmlFor={id + name}>{label}</FieldLabel>
            <Input
              id={id + name}
              type="password"
              autoComplete={
                name === "atual" ? "current-password" : "new-password"
              }
              disabled={isSubmitting}
              aria-invalid={Boolean(errors[name])}
              {...form.register(name, {
                required: "Preencha este campo.",
                maxLength: { value: 128, message: "Use até 128 caracteres." },
                validate: (v) =>
                  name === "nova"
                    ? (v.length >= 8 && v !== form.getValues("atual")) ||
                      "Use pelo menos 8 caracteres e uma senha diferente da atual."
                    : name === "confirmacao"
                      ? v === form.getValues("nova") ||
                        "As senhas não coincidem."
                      : true,
              })}
            />
            <FieldError errors={[errors[name]]} />
          </Field>
        ))}
      </div>
      <FieldLabel className="flex items-center gap-2">
        <Controller
          control={form.control}
          name="encerrar"
          render={({ field }) => (
            <Checkbox
              checked={field.value}
              onCheckedChange={field.onChange}
              disabled={isSubmitting}
            />
          )}
        />
        Encerrar outras sessões
      </FieldLabel>
      <p className="text-xs text-muted-foreground">
        As outras sessões deixarão de renovar o acesso. Sessões já abertas podem
        continuar até o token atual expirar.
      </p>
      <FieldError errors={[errors.root]} />
      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Alterando…" : "Alterar senha"}
        </Button>
      </div>
    </form>
  );
}
