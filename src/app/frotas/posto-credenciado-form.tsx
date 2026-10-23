"use client";

import { FormDialogCancel } from "@/components/form-dialog-cancel";

import { startTransition, useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { mask } from "remask";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PrefeituraCombobox } from "@/components/prefeitura-combobox";
import {
  type FrotaPostoCredenciado,
  type FrotaPrefeituraOption,
} from "@/lib/frotas-data";
import { createPostoCredenciado, updatePostoCredenciado } from "./actions";

type PostoCredenciadoFormProps = {
  posto?: FrotaPostoCredenciado;
  prefeituras: FrotaPrefeituraOption[];
  selectedPrefeituraId?: string;
  showPrefeituraField?: boolean;
};

type PostoCredenciadoValues = {
  cnpj: string;
  endereco: string;
  nome: string;
  prefeitura_id: string;
  telefone: string;
};

export function PostoCredenciadoForm({
  posto,
  prefeituras,
  selectedPrefeituraId,
  showPrefeituraField = true,
}: PostoCredenciadoFormProps) {
  const isEditing = Boolean(posto);
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const successRef = useRef<HTMLDivElement>(null);
  const [state, formAction, actionPending] = useActionState(
    isEditing ? updatePostoCredenciado : createPostoCredenciado,
    {}
  );
  const form = useForm<PostoCredenciadoValues>({
    defaultValues: {
      cnpj: posto?.cnpj ?? "",
      endereco: posto?.endereco ?? "",
      nome: posto?.nome ?? "",
      prefeitura_id: posto?.prefeitura_id ?? selectedPrefeituraId ?? "",
      telefone: posto?.telefone ?? "",
    },
  });

  useEffect(() => {
    if (state.success) {
      if (state.temporaryPassword) return;
      toast.success(state.success, {
        id: isEditing ? "posto-update-success" : "posto-create-success",
      });
      router.refresh();
      closeParentDialog(formRef.current);
      if (!isEditing) {
        form.reset({
          cnpj: "",
          endereco: "",
          nome: "",
          prefeitura_id: selectedPrefeituraId ?? "",
          telefone: "",
        });
      }
    }
  }, [form, isEditing, router, selectedPrefeituraId, state.success, state.temporaryPassword]);

  function submitForm(values: PostoCredenciadoValues) {
    const formData = new FormData();
    if (posto?.id) {
      formData.set("id", posto.id);
    }
    formData.set("prefeitura_id", values.prefeitura_id);
    formData.set("nome", values.nome);
    formData.set("cnpj", values.cnpj);
    formData.set("endereco", values.endereco);
    formData.set("telefone", values.telefone);

    startTransition(() => {
      formAction(formData);
    });
  }

  if (state.temporaryPassword) return (
    <div ref={successRef} className="space-y-4">
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
        <p className="font-semibold">Posto cadastrado</p>
        <p className="mt-1">Copie a senha provisória e entregue-a ao responsável pelo posto. Ela será mostrada somente agora.</p>
      </div>
      <Field><FieldLabel htmlFor="posto-cnpj-criado">CNPJ de acesso</FieldLabel><Input id="posto-cnpj-criado" value={form.getValues("cnpj")} readOnly /></Field>
      <Field><FieldLabel htmlFor="posto-senha-provisoria">Senha provisória</FieldLabel><Input id="posto-senha-provisoria" value={state.temporaryPassword} readOnly className="font-mono" /></Field>
      <p className="text-xs text-muted-foreground">No primeiro login, o posto definirá uma nova senha, completará o endereço e confirmará o e-mail. Se perder esta senha, use a ação de redefinição na lista de postos.</p>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => navigator.clipboard.writeText(state.temporaryPassword!)}>Copiar senha</Button>
        <Button type="button" onClick={() => { closeParentDialog(successRef.current); router.refresh(); }}>Concluir</Button>
      </DialogFooter>
    </div>
  );

  return (
    <form
      ref={formRef}
      onSubmit={form.handleSubmit(submitForm)}
      className="space-y-4"
      noValidate
    >
      {state.error ? (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{state.error}</span>
        </div>
      ) : null}

      <fieldset disabled={actionPending} className="disabled:opacity-70">
        <FieldGroup className="gap-4">
          {showPrefeituraField ? (
            <Controller
              control={form.control}
              name="prefeitura_id"
              rules={{ required: "Selecione a empresa." }}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="prefeitura_id">Empresa</FieldLabel>
                  <PrefeituraCombobox
                    id="prefeitura_id"
                    value={field.value || null}
                    onChange={(value) => field.onChange(value ?? "")}
                    prefeituras={prefeituras}
                    disabled={actionPending}
                    invalid={fieldState.invalid}
                  />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
          ) : (
            <input type="hidden" {...form.register("prefeitura_id")} />
          )}
          <TextField
            control={form.control}
            label="Nome do posto"
            name="nome"
            rules={{ required: "Informe o nome do posto." }}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField
              control={form.control}
              label="CNPJ"
              name="cnpj"
              rules={{
                required: "Informe o CNPJ do posto.",
                validate: (value) =>
                  value.replace(/\D/g, "").length === 14 ||
                  "Informe um CNPJ válido.",
              }}
              transform={(value) =>
                mask(value.replace(/\D/g, ""), ["99.999.999/9999-99"])
              }
            />
            <TextField
              control={form.control}
              label="Telefone"
              name="telefone"
              transform={(value) =>
                mask(value.replace(/\D/g, ""), [
                  "(99) 9999-9999",
                  "(99) 99999-9999",
                ])
              }
            />
          </div>
          {isEditing ? <TextField control={form.control} label="Endereço" name="endereco" /> : null}
        </FieldGroup>
      </fieldset>

      <DialogFooter>
        <FormDialogCancel disabled={actionPending} />
        <Button type="submit" className="gap-2" disabled={actionPending}>
          {actionPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <CheckCircle2 className="size-4" />
          )}
          {actionPending
            ? isEditing
              ? "Salvando..."
              : "Cadastrando..."
            : isEditing
              ? "Salvar alterações"
              : "Cadastrar posto"}
        </Button>
      </DialogFooter>
    </form>
  );
}

type TextFieldProps = {
  control: ReturnType<typeof useForm<PostoCredenciadoValues>>["control"];
  label: string;
  name: keyof PostoCredenciadoValues;
  rules?: Parameters<typeof Controller<PostoCredenciadoValues>>[0]["rules"];
  transform?: (value: string) => string;
  type?: "password" | "text";
};

function TextField({
  control,
  label,
  name,
  rules,
  transform,
  type = "text",
}: TextFieldProps) {
  return (
    <Controller
      control={control}
      name={name}
      rules={rules}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor={name}>{label}</FieldLabel>
          <Input
            id={name}
            type={type}
            value={field.value}
            aria-invalid={fieldState.invalid}
            onChange={(event) =>
              field.onChange(
                transform ? transform(event.target.value) : event.target.value
              )
            }
          />
          <FieldError errors={[fieldState.error]} />
        </Field>
      )}
    />
  );
}

function closeParentDialog(formElement: HTMLElement | null) {
  const closeButton = formElement
    ?.closest('[data-slot="dialog-content"]')
    ?.querySelector<HTMLElement>('[data-slot="dialog-close"]');

  closeButton?.click();
}
