"use client";

import { FormDialogCancel } from "@/components/form-dialog-cancel";

import { startTransition, useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { mask } from "remask";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { EmpresaCombobox } from "@/components/empresa-combobox";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type Usuario,
  type UsuarioPrefeituraOption,
  type UsuarioRole,
} from "@/lib/usuarios-data";
import { createUsuario, updateUsuario } from "./actions";

type UsuarioFormValues = {
  ativo: string | null;
  cpf: string;
  nome: string;
  password: string;
  prefeitura_id: string | null;
  role: UsuarioRole | null;
};

type UsuarioFormProps = {
  prefeituras: UsuarioPrefeituraOption[];
  usuario?: Usuario;
};

const roleItems = [
  { label: "Master", value: "bdl_admin" },
  { label: "Administrador", value: "municipal_admin" },
  { label: "Usuário", value: "municipal_user" },
];

const statusItems = [
  { label: "Ativo", value: "true" },
  { label: "Inativo", value: "false" },
];

export function UsuarioForm({ prefeituras, usuario }: UsuarioFormProps) {
  const isEditing = Boolean(usuario);
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, actionPending] = useActionState(
    isEditing ? updateUsuario : createUsuario,
    {}
  );
  const form = useForm<UsuarioFormValues>({
    defaultValues: {
      ativo: usuario ? String(usuario.ativo) : "true",
      cpf: usuario?.cpf ? mask(usuario.cpf, "999.999.999-99") : "",
      nome: usuario?.nome ?? "",
      password: "",
      prefeitura_id: usuario?.prefeitura_id ?? null,
      role: usuario?.role ?? "municipal_user",
    },
  });
  const selectedRole = useWatch({
    control: form.control,
    name: "role",
  });

  useEffect(() => {
    if (state.success) {
      toast.success(state.success, {
        id: isEditing ? "usuario-edit-success" : "usuario-create-success",
      });
      router.refresh();

      if (!isEditing) {
        form.reset({
          ativo: "true",
          cpf: "",
          nome: "",
          password: "",
          prefeitura_id: null,
          role: "municipal_user",
        });
      }

      closeParentDialog(formRef.current);
    }
  }, [form, isEditing, router, state.success]);

  function submitForm(values: UsuarioFormValues) {
    const formData = new FormData();

    if (usuario) {
      formData.set("id", usuario.id);
    }

    formData.set("ativo", values.ativo ?? "");
    formData.set("cpf", values.cpf.replace(/\D/g, ""));
    formData.set("nome", values.nome);
    formData.set("password", values.password);
    formData.set("prefeitura_id", values.prefeitura_id ?? "");
    formData.set("role", values.role ?? "");

    startTransition(() => {
      formAction(formData);
    });
  }

  return (
    <form
      ref={formRef}
      onSubmit={form.handleSubmit(submitForm)}
      className="space-y-4"
      noValidate
    >
      {usuario ? <input type="hidden" name="id" value={usuario.id} /> : null}
      {state.error ? (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{state.error}</span>
        </div>
      ) : null}

      <fieldset disabled={actionPending} className="disabled:opacity-70">
        <FieldGroup className="gap-4">
          <Field data-invalid={Boolean(form.formState.errors.nome)}>
            <FieldLabel htmlFor="nome">Nome</FieldLabel>
            <Input
              id="nome"
              placeholder="João Silva"
              aria-invalid={Boolean(form.formState.errors.nome)}
              {...form.register("nome", {
                required: "Informe o nome do usuário.",
              })}
            />
            <FieldError errors={[form.formState.errors.nome]} />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Controller
              control={form.control}
              name="role"
              rules={{ required: "Selecione o tipo de acesso." }}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="role">Tipo de acesso</FieldLabel>
                  <Select
                    items={roleItems}
                    name={field.name}
                    value={field.value}
                    onValueChange={(value) => {
                      field.onChange(value);
                      form.setValue("prefeitura_id", null);
                      form.setValue("cpf", "");
                    }}
                    required
                    disabled={actionPending}
                  >
                    <SelectTrigger
                      id="role"
                      className="w-full"
                      aria-invalid={fieldState.invalid}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>Perfis</SelectLabel>
                        {roleItems.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />

            <Controller
              control={form.control}
              name="ativo"
              rules={{ required: "Selecione o status." }}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="ativo">Status</FieldLabel>
                  <Select
                    items={statusItems}
                    name={field.name}
                    value={field.value}
                    onValueChange={field.onChange}
                    required
                    disabled={actionPending}
                  >
                    <SelectTrigger
                      id="ativo"
                      className="w-full"
                      aria-invalid={fieldState.invalid}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>Status</SelectLabel>
                        {statusItems.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
          </div>

          <Field data-invalid={Boolean(form.formState.errors.cpf)}>
            <FieldLabel htmlFor="cpf">CPF</FieldLabel>
            <Input
              id="cpf"
              placeholder="000.000.000-00"
              inputMode="numeric"
              maxLength={14}
              aria-invalid={Boolean(form.formState.errors.cpf)}
              {...form.register("cpf", {
                required: "Informe o CPF.",
                onChange: (event) => {
                  event.currentTarget.value = mask(
                    event.currentTarget.value.replace(/\D/g, ""),
                    "999.999.999-99"
                  );
                },
                validate: (value) => {
                  const digits = value.replace(/\D/g, "");

                  if (digits.length !== 11) {
                    return "Informe um CPF com 11 dígitos.";
                  }

                  return isValidCpf(digits) || "Informe um CPF válido.";
                },
              })}
            />
            <FieldError errors={[form.formState.errors.cpf]} />
          </Field>

          {isMunicipalRole(selectedRole) ? (
            <Controller
              control={form.control}
              name="prefeitura_id"
              rules={{ required: "Selecione a empresa." }}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="prefeitura_id">Empresa</FieldLabel>
                  <EmpresaCombobox
                    id="prefeitura_id"
                    value={field.value}
                    onChange={field.onChange}
                    empresas={prefeituras}
                    disabled={actionPending}
                    invalid={fieldState.invalid}
                  />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
          ) : null}

          <Field data-invalid={Boolean(form.formState.errors.password)}>
            <FieldLabel htmlFor="password">
              {isEditing ? "Nova senha" : "Senha"}
            </FieldLabel>
            <Input
              id="password"
              type="password"
              placeholder={isEditing ? "Deixe em branco para manter" : "******"}
              aria-invalid={Boolean(form.formState.errors.password)}
              {...form.register("password", {
                required: isEditing ? false : "Informe a senha.",
                minLength: {
                  value: 6,
                  message: "A senha deve ter pelo menos 6 caracteres.",
                },
              })}
            />
            <FieldError errors={[form.formState.errors.password]} />
          </Field>
        </FieldGroup>
      </fieldset>

      {isEditing ? (
        <p className="text-sm text-muted-foreground">
          Ao trocar a empresa ou o perfil, os acessos anteriores serão removidos.
          Configure as novas permissões após salvar.
        </p>
      ) : null}
      <DialogFooter>
        <FormDialogCancel disabled={actionPending} />
        <Button type="submit" className="gap-2" disabled={actionPending}>
          {actionPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <CheckCircle2 className="size-4" />
          )}
          {actionPending
            ? "Salvando..."
            : isEditing
              ? "Salvar alterações"
              : "Cadastrar usuário"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function isMunicipalRole(role: UsuarioRole | null) {
  return role === "municipal_admin" || role === "municipal_user";
}

function closeParentDialog(formElement: HTMLFormElement | null) {
  const closeButton = formElement
    ?.closest('[data-slot="dialog-content"]')
    ?.querySelector<HTMLElement>('[data-slot="dialog-close"]');

  closeButton?.click();
}

function isValidCpf(cpf: string) {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1+$/.test(cpf)) {
    return false;
  }

  const digits = cpf.split("").map(Number);
  const firstDigit = calculateCpfDigit(digits.slice(0, 9), 10);
  const secondDigit = calculateCpfDigit([...digits.slice(0, 9), firstDigit], 11);

  return firstDigit === digits[9] && secondDigit === digits[10];
}

function calculateCpfDigit(numbers: number[], factor: number) {
  const total = numbers.reduce(
    (sum, number, index) => sum + number * (factor - index),
    0
  );
  const remainder = (total * 10) % 11;

  return remainder === 10 ? 0 : remainder;
}
