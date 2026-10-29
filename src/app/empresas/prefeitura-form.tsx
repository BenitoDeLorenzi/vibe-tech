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
import { Controller, useForm, useWatch } from "react-hook-form";
import { mask } from "remask";
import {
  AlertCircle,
  Building2,
  MapPin,
  Loader2,
  Plus,
  Save,
} from "lucide-react";
import { toast } from "sonner";

import { AvatarPhotoControl } from "@/components/avatar-photo-control";
import { Checkbox } from "@/components/ui/checkbox";
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
import { createPrefeitura, updatePrefeitura } from "./actions";

const estados = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
];

const ufItems = [
  { label: "Selecione a UF", value: null },
  ...estados.map((estado) => ({
    label: estado,
    value: estado,
  })),
];

type PrefeituraFormValues = {
  is_prefeitura: boolean;
  nome_fantasia: string;
  cep: string;
  cidade: string;
  cnpj: string;
  endereco: string;
  endereco_numero: string;
  bairro: string;
  endereco_complemento: string;
  email_cobranca: string;
  telefone_cobranca: string;
  nome: string;
  uf: string | null;
};

type PrefeituraFormProps = {
  prefeitura?: {
    is_prefeitura: boolean;
    nome_fantasia?: string | null;
    id: string;
    nome: string;
    cnpj: string;
    cidade: string | null;
    uf: string | null;
    cep: string | null;
    brasao_path: string | null;
    brasao_url: string | null;
    endereco: string | null;
    endereco_numero: string | null;
    bairro: string | null;
    endereco_complemento: string | null;
    email_cobranca: string | null;
    telefone_cobranca: string | null;
  };
};

export function PrefeituraForm({ prefeitura }: PrefeituraFormProps) {
  const isEditing = Boolean(prefeitura);
  const [avatar, setAvatar] = useState<File | null | undefined>(undefined);
  const [avatarError, setAvatarError] = useState("");
  const [cepMessage, setCepMessage] = useState("");
  const [searchingCep, setSearchingCep] = useState(false);
  const initialCep = useRef(prefeitura?.cep ?? "");
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  function selectAvatar(file: File | null) {
    if (
      file &&
      (!file.size ||
        file.size > 3 * 1024 * 1024 ||
        !["image/jpeg", "image/png", "image/webp"].includes(file.type))
    ) {
      setAvatarError("Escolha JPG, PNG ou WebP de até 3 MB.");
      return;
    }
    setAvatarError("");
    setAvatar(file);
    setPreview(file ? URL.createObjectURL(file) : null);
  }
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, actionPending] = useActionState(
    isEditing ? updatePrefeitura : createPrefeitura,
    {},
  );
  const form = useForm<PrefeituraFormValues>({
    defaultValues: {
      is_prefeitura: prefeitura?.is_prefeitura ?? false,
      nome_fantasia: prefeitura?.nome_fantasia ?? "",
      cep: prefeitura?.cep ?? "",
      cidade: prefeitura?.cidade ?? "",
      cnpj: prefeitura?.cnpj ?? "",
      endereco: prefeitura?.endereco ?? "",
      endereco_numero: prefeitura?.endereco_numero ?? "",
      bairro: prefeitura?.bairro ?? "",
      endereco_complemento: prefeitura?.endereco_complemento ?? "",
      email_cobranca: prefeitura?.email_cobranca ?? "",
      telefone_cobranca: prefeitura?.telefone_cobranca ?? "",
      nome: prefeitura?.nome ?? "",
      uf: prefeitura?.uf ?? null,
    },
  });

  const [nomeFantasia, nomeOficial] = useWatch({
    control: form.control,
    name: ["nome_fantasia", "nome"],
  });

  const cepValue = useWatch({ control: form.control, name: "cep" });
  useEffect(() => {
    const digits = cepValue?.replace(/\D/g, "") ?? "";
    if (digits.length !== 8 || cepValue === initialCep.current) return;
    const controller = new AbortController();
    async function search() {
      setCepMessage("");
      setSearchingCep(true);
      try {
        const response = await fetch(
          `https://viacep.com.br/ws/${digits}/json/`,
          {
            signal: controller.signal,
          },
        );
        if (!response.ok) throw new Error("Falha na consulta do CEP.");
        const address: {
          erro?: boolean;
          uf?: string;
          localidade?: string;
          bairro?: string;
          logradouro?: string;
        } = await response.json();
        if (controller.signal.aborted) return;
        if (address.erro) {
          setCepMessage(
            "CEP não encontrado. Confira os números ou preencha o endereço manualmente.",
          );
          return;
        }
        if (address.uf)
          form.setValue("uf", address.uf, { shouldValidate: true });
        if (address.localidade)
          form.setValue("cidade", address.localidade, { shouldValidate: true });
        if (address.bairro)
          form.setValue("bairro", address.bairro, { shouldValidate: true });
        if (address.logradouro)
          form.setValue("endereco", address.logradouro, {
            shouldValidate: true,
          });
        setCepMessage("");
      } catch {
        if (!controller.signal.aborted)
          setCepMessage(
            "Não foi possível consultar o CEP. Preencha o endereço manualmente.",
          );
      } finally {
        if (!controller.signal.aborted) setSearchingCep(false);
      }
    }
    void search();
    return () => controller.abort();
  }, [cepValue, form]);

  useEffect(() => {
    if (state.success) {
      toast.success(state.success, {
        id: isEditing ? "prefeitura-edit-success" : "prefeitura-create-success",
      });
      router.refresh();

      if (!isEditing) {
        form.reset({
          is_prefeitura: false,
          nome_fantasia: "",
          cep: "",
          cidade: "",
          cnpj: "",
          endereco: "",
          endereco_numero: "",
          bairro: "",
          endereco_complemento: "",
          email_cobranca: "",
          telefone_cobranca: "",
          nome: "",
          uf: null,
        });
        formRef.current?.reset();
      }

      closeParentDialog(formRef.current);
    }
  }, [form, isEditing, router, state.success]);

  function submitForm(values: PrefeituraFormValues, formData: FormData) {
    if (prefeitura) {
      formData.set("id", prefeitura.id);
    }

    formData.set("nome", values.nome);
    formData.set("nome_fantasia", values.nome_fantasia);
    formData.set("cnpj", values.cnpj);
    formData.set("cidade", values.cidade);
    formData.set("uf", values.uf ?? "");
    formData.set("cep", values.cep);
    formData.set("endereco", values.endereco);
    formData.set("endereco_numero", values.endereco_numero);
    formData.set("bairro", values.bairro);
    formData.set("endereco_complemento", values.endereco_complemento);
    formData.set("email_cobranca", values.email_cobranca);
    formData.set("telefone_cobranca", values.telefone_cobranca);
    formData.set("is_prefeitura", String(values.is_prefeitura));
    if (avatar instanceof File) formData.set("brasao", avatar);
    if (avatar === null) formData.set("remove_brasao", "true");

    startTransition(() => {
      formAction(formData);
    });
  }

  return (
    <form
      ref={formRef}
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        void form.handleSubmit((values) => submitForm(values, formData))(event);
      }}
      className="space-y-4"
      noValidate
    >
      {prefeitura ? (
        <input type="hidden" name="id" value={prefeitura.id} />
      ) : null}
      {state.error ? (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{state.error}</span>
        </div>
      ) : null}

      <fieldset disabled={actionPending} className="disabled:opacity-70">
        <FieldGroup className="gap-4">
          <div className="grid gap-4 rounded-xl border bg-muted/20 p-4 sm:grid-cols-[150px_minmax(0,1fr)] sm:gap-5">
            <div className="self-start">
              <AvatarPhotoControl
                nome={nomeFantasia || nomeOficial || "Empresa"}
                source={avatar === undefined ? prefeitura?.brasao_url : preview}
                pending={actionPending}
                error={avatarError}
                onSelect={selectAvatar}
                onRemove={() => selectAvatar(null)}
                label="logotipo da empresa"
                contain
                hint="Clique no avatar para alterar o logotipo."
              />
            </div>
            <div className="grid min-w-0 gap-4">
              <Field data-invalid={Boolean(form.formState.errors.nome)}>
                <FieldLabel htmlFor="nome">
                  Razão social / nome oficial
                </FieldLabel>
                <Input
                  id="nome"
                  placeholder="Empresa de Santa Helena"
                  aria-invalid={Boolean(form.formState.errors.nome)}
                  {...form.register("nome", {
                    required: "Informe o nome da empresa.",
                  })}
                />
                <FieldError errors={[form.formState.errors.nome]} />
              </Field>

              <Field
                data-invalid={Boolean(form.formState.errors.nome_fantasia)}
              >
                <FieldLabel htmlFor="nome_fantasia">
                  Nome fantasia (opcional)
                </FieldLabel>
                <Input
                  id="nome_fantasia"
                  placeholder="Nome pelo qual a empresa é conhecida"
                  aria-invalid={Boolean(form.formState.errors.nome_fantasia)}
                  {...form.register("nome_fantasia", {
                    validate: (value) =>
                      !value.trim() ||
                      (value.trim().length >= 2 && value.trim().length <= 80) ||
                      "Use de 2 a 80 caracteres.",
                  })}
                />
                <FieldError errors={[form.formState.errors.nome_fantasia]} />
              </Field>
              <div className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                <Field data-invalid={Boolean(form.formState.errors.cnpj)}>
                  <FieldLabel htmlFor="cnpj">CNPJ</FieldLabel>
                  <Input
                    id="cnpj"
                    inputMode="numeric"
                    maxLength={18}
                    placeholder="00.000.000/0001-00"
                    aria-invalid={Boolean(form.formState.errors.cnpj)}
                    {...form.register("cnpj", {
                      required: "Informe o CNPJ.",
                      onChange: (event) => {
                        event.currentTarget.value = mask(
                          event.currentTarget.value,
                          "99.999.999/9999-99",
                        );
                      },
                      validate: (value) =>
                        value.replace(/\D/g, "").length === 14 ||
                        "Informe um CNPJ válido.",
                    })}
                  />
                  <FieldError errors={[form.formState.errors.cnpj]} />
                </Field>
                <Controller
                  control={form.control}
                  name="is_prefeitura"
                  render={({ field }) => (
                    <div className="flex min-h-9 items-center gap-2 pb-1">
                      <Checkbox
                        id="is_prefeitura"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={actionPending}
                      />
                      <FieldLabel
                        htmlFor="is_prefeitura"
                        className="whitespace-nowrap"
                      >
                        Prefeitura
                      </FieldLabel>
                    </div>
                  )}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 border-b pb-2 text-sm font-medium">
            <MapPin className="size-4 text-muted-foreground" />
            Endereço
          </div>
          <div className="grid gap-3 sm:grid-cols-[130px_100px_minmax(0,1fr)]">
            <Field data-invalid={Boolean(form.formState.errors.cep)}>
              <FieldLabel htmlFor="cep">CEP</FieldLabel>
              <Input
                id="cep"
                inputMode="numeric"
                maxLength={9}
                placeholder="00000-000"
                aria-invalid={Boolean(form.formState.errors.cep)}
                aria-describedby={
                  searchingCep || cepMessage ? "cep-status" : undefined
                }
                {...form.register("cep", {
                  required: "Informe o CEP.",
                  onChange: (event) => {
                    event.currentTarget.value = mask(
                      event.currentTarget.value,
                      "99999-999",
                    );
                    setCepMessage("");
                    if (
                      event.currentTarget.value.replace(/\D/g, "").length !== 8
                    )
                      setSearchingCep(false);
                  },
                  validate: (value) =>
                    value.replace(/\D/g, "").length === 8 ||
                    "Informe um CEP válido.",
                })}
              />
              <FieldError errors={[form.formState.errors.cep]} />
            </Field>
            <Controller
              control={form.control}
              name="uf"
              rules={{ required: "Selecione a UF." }}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="uf">UF</FieldLabel>
                  <Select
                    items={ufItems}
                    name={field.name}
                    value={field.value}
                    onValueChange={field.onChange}
                    required
                    disabled={actionPending}
                  >
                    <SelectTrigger
                      id="uf"
                      className="w-full"
                      aria-invalid={fieldState.invalid}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent align="center" alignItemWithTrigger={false}>
                      <SelectGroup>
                        <SelectLabel>Estados</SelectLabel>
                        {ufItems.map((item) => (
                          <SelectItem
                            key={item.value ?? "empty"}
                            value={item.value}
                          >
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
            <Field data-invalid={Boolean(form.formState.errors.cidade)}>
              <FieldLabel htmlFor="cidade">Cidade</FieldLabel>
              <Input
                id="cidade"
                placeholder="Cidade"
                aria-invalid={Boolean(form.formState.errors.cidade)}
                {...form.register("cidade", {
                  required: "Informe a cidade.",
                })}
              />
              <FieldError errors={[form.formState.errors.cidade]} />
            </Field>
          </div>
          {searchingCep || cepMessage ? (
            <p
              id="cep-status"
              className="text-xs text-muted-foreground"
              role="status"
            >
              {searchingCep ? "Consultando CEP…" : cepMessage}
            </p>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_110px]">
            <Field data-invalid={Boolean(form.formState.errors.bairro)}>
              <FieldLabel htmlFor="bairro">Bairro</FieldLabel>
              <Input
                id="bairro"
                placeholder="Centro"
                aria-invalid={Boolean(form.formState.errors.bairro)}
                {...form.register("bairro", {
                  required: !isEditing ? "Informe o bairro." : false,
                })}
              />
              <FieldError errors={[form.formState.errors.bairro]} />
            </Field>
            <Field data-invalid={Boolean(form.formState.errors.endereco)}>
              <FieldLabel htmlFor="endereco">Endereço</FieldLabel>
              <Input
                id="endereco"
                placeholder="Rua, avenida ou praça"
                aria-invalid={Boolean(form.formState.errors.endereco)}
                {...form.register("endereco", {
                  required: "Informe o endereço.",
                })}
              />
              <FieldError errors={[form.formState.errors.endereco]} />
            </Field>
            <Field
              data-invalid={Boolean(form.formState.errors.endereco_numero)}
            >
              <FieldLabel htmlFor="endereco_numero">Número</FieldLabel>
              <Input
                id="endereco_numero"
                placeholder="123"
                aria-invalid={Boolean(form.formState.errors.endereco_numero)}
                {...form.register("endereco_numero", {
                  required: !isEditing ? "Informe o número ou S/N." : false,
                })}
              />
              <FieldError errors={[form.formState.errors.endereco_numero]} />
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="endereco_complemento">
              Complemento (opcional)
            </FieldLabel>
            <Input
              id="endereco_complemento"
              placeholder="Sala, bloco ou referência"
              {...form.register("endereco_complemento")}
            />
          </Field>
          <div className="flex items-center gap-2 border-b pb-2 text-sm font-medium">
            <Building2 className="size-4 text-muted-foreground" />
            Contato para cobrança
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field data-invalid={Boolean(form.formState.errors.email_cobranca)}>
              <FieldLabel htmlFor="email_cobranca">
                E-mail de cobrança
              </FieldLabel>
              <Input
                id="email_cobranca"
                type="email"
                autoComplete="email"
                placeholder="financeiro@empresa.com.br"
                aria-invalid={Boolean(form.formState.errors.email_cobranca)}
                {...form.register("email_cobranca", {
                  required: !isEditing
                    ? "Informe o e-mail de cobrança."
                    : false,
                  pattern: {
                    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                    message: "Informe um e-mail válido.",
                  },
                })}
              />
              <FieldError errors={[form.formState.errors.email_cobranca]} />
            </Field>
            <Field
              data-invalid={Boolean(form.formState.errors.telefone_cobranca)}
            >
              <FieldLabel htmlFor="telefone_cobranca">
                Telefone de cobrança (opcional)
              </FieldLabel>
              <Input
                id="telefone_cobranca"
                inputMode="tel"
                placeholder="(00) 00000-0000"
                aria-invalid={Boolean(form.formState.errors.telefone_cobranca)}
                {...form.register("telefone_cobranca", {
                  onChange: (event) => {
                    event.currentTarget.value = mask(
                      event.currentTarget.value,
                      ["(99) 9999-9999", "(99) 99999-9999"],
                    );
                  },
                  validate: (value) =>
                    !value ||
                    [10, 11].includes(value.replace(/\D/g, "").length) ||
                    "Informe um telefone válido.",
                })}
              />
              <FieldError errors={[form.formState.errors.telefone_cobranca]} />
            </Field>
          </div>
        </FieldGroup>
      </fieldset>

      <DialogFooter>
        <FormDialogCancel disabled={actionPending} />
        <Button type="submit" className="gap-2" disabled={actionPending}>
          {actionPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : isEditing ? (
            <Save className="size-4" />
          ) : (
            <Plus className="size-4" />
          )}
          {actionPending
            ? "Salvando..."
            : isEditing
              ? "Salvar alterações"
              : "Cadastrar empresa"}
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
