"use client";

import { FormDialogCancel } from "@/components/form-dialog-cancel";

import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type Modulo } from "@/lib/modulos-data";
import { createModulo, updateModulo } from "./actions";

type ModuloFormValues = {
  ativo: string | null;
  nome: string;
  slug: string;
  subdominio: string;
};

type ModuloFormProps = {
  modulo?: Modulo;
};

const statusItems = [
  { label: "Ativo", value: "true" },
  { label: "Inativo", value: "false" },
];

export function ModuloForm({ modulo }: ModuloFormProps) {
  const isEditing = Boolean(modulo);
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [slugEdited, setSlugEdited] = useState(isEditing);
  const [subdominioEdited, setSubdominioEdited] = useState(isEditing);
  const [state, formAction, actionPending] = useActionState(
    isEditing ? updateModulo : createModulo,
    {}
  );
  const form = useForm<ModuloFormValues>({
    defaultValues: {
      ativo: modulo ? String(modulo.ativo) : "true",
      nome: modulo?.nome ?? "",
      slug: modulo?.slug ?? "",
      subdominio: modulo?.subdominio ?? "",
    },
  });

  useEffect(() => {
    if (state.success) {
      toast.success(state.success, {
        id: isEditing ? "modulo-edit-success" : "modulo-create-success",
      });
      router.refresh();

      if (!isEditing) {
        form.reset({
          ativo: "true",
          nome: "",
          slug: "",
          subdominio: "",
        });
      }

      closeParentDialog(formRef.current);
    }
  }, [form, isEditing, router, state.success]);

  function submitForm(values: ModuloFormValues) {
    const formData = new FormData();

    if (modulo) {
      formData.set("id", modulo.id);
    }

    formData.set("nome", values.nome);
    formData.set("slug", values.slug);
    formData.set("subdominio", values.subdominio);
    formData.set("ativo", values.ativo ?? "");

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
      {modulo ? <input type="hidden" name="id" value={modulo.id} /> : null}
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
              placeholder="Vibe Frotas"
              aria-invalid={Boolean(form.formState.errors.nome)}
              {...form.register("nome", {
                required: "Informe o nome do módulo.",
                onChange: (event) => {
                  const slug = normalizeSlug(event.currentTarget.value);

                  if (!slugEdited) {
                    form.setValue("slug", slug, {
                      shouldDirty: true,
                      shouldValidate: true,
                    });
                  }

                  if (!subdominioEdited) {
                    form.setValue("subdominio", `${slug}.bdltech.com.br`, {
                      shouldDirty: true,
                      shouldValidate: true,
                    });
                  }
                },
              })}
            />
            <FieldError errors={[form.formState.errors.nome]} />
          </Field>

          <div className="grid gap-3 sm:grid-cols-[1fr_1fr]">
            <Field data-invalid={Boolean(form.formState.errors.slug)}>
              <FieldLabel htmlFor="slug">Slug</FieldLabel>
              <Input
                id="slug"
                placeholder="vibe-frotas"
                aria-invalid={Boolean(form.formState.errors.slug)}
                {...form.register("slug", {
                  required: "Informe o slug.",
                  onChange: (event) => {
                    setSlugEdited(true);
                    event.currentTarget.value = normalizeSlug(
                      event.currentTarget.value
                    );
                  },
                  pattern: {
                    value: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
                    message: "Use apenas letras, números e hífens.",
                  },
                })}
              />
              <FieldError errors={[form.formState.errors.slug]} />
            </Field>

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

          <Field data-invalid={Boolean(form.formState.errors.subdominio)}>
            <FieldLabel htmlFor="subdominio">Subdomínio</FieldLabel>
            <Input
              id="subdominio"
              placeholder="frotas.exemplo.com.br"
              aria-invalid={Boolean(form.formState.errors.subdominio)}
              {...form.register("subdominio", {
                required: "Informe o subdomínio.",
                onChange: (event) => {
                  setSubdominioEdited(true);
                  event.currentTarget.value = event.currentTarget.value
                    .trim()
                    .toLowerCase();
                },
                pattern: {
                  value:
                    /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/,
                  message: "Informe um subdomínio válido.",
                },
              })}
            />
            <FieldError errors={[form.formState.errors.subdominio]} />
          </Field>
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
            ? "Salvando..."
            : isEditing
              ? "Salvar alterações"
              : "Cadastrar módulo"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function closeParentDialog(formElement: HTMLFormElement | null) {
  const closeButton = formElement
    ?.closest('[data-slot="dialog-content"]')
    ?.querySelector<HTMLElement>('[data-slot="dialog-close"]');

  closeButton?.click();
}

function normalizeSlug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
