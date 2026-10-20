"use client";
import { useEffect, useId, useState } from "react";
import { AvatarPhotoControl } from "@/components/avatar-photo-control";

import { Controller, useForm } from "react-hook-form";
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
  email_contato,
}: {
  nome: string;
  telefone: string;
  email_contato: string;
}) {
  const id = useId();
  const router = useRouter();
  const form = useForm({ defaultValues: { nome, telefone, email_contato } });
  const { errors, isSubmitting } = form.formState;
  return (
    <form
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
      <div className="grid gap-4 sm:grid-cols-2">
        <Field className="sm:col-span-2" data-invalid={Boolean(errors.nome)}>
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
        <Field data-invalid={Boolean(errors.email_contato)}>
          <FieldLabel htmlFor={id + "email"}>
            E-mail de contato (opcional)
          </FieldLabel>
          <Input
            id={id + "email"}
            type="email"
            autoComplete="email"
            placeholder="voce@exemplo.com"
            disabled={isSubmitting}
            aria-invalid={Boolean(errors.email_contato)}
            {...form.register("email_contato", {
              validate: (value) =>
                !value.trim() ||
                (value.trim().length <= 254 &&
                  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) ||
                "Informe um e-mail válido.",
            })}
          />
          <FieldError errors={[errors.email_contato]} />
        </Field>
        <Field data-invalid={Boolean(errors.telefone)}>
          <FieldLabel htmlFor={id + "telefone"}>Telefone (opcional)</FieldLabel>
          <Input
            id={id + "telefone"}
            type="tel"
            autoComplete="tel"
            disabled={isSubmitting}
            aria-invalid={Boolean(errors.telefone)}
            {...form.register("telefone", {
              maxLength: { value: 30, message: "Use até 30 caracteres." },
            })}
          />
          <FieldError errors={[errors.telefone]} />
        </Field>
      </div>
      <FieldError errors={[errors.root]} />
      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Salvando…" : "Salvar dados"}
        </Button>
      </div>
    </form>
  );
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
