"use client";

import { ContractPreview } from "./contract-preview";
import { FormSelect } from "@/components/form-select";
import { FormDialogCancel } from "@/components/form-dialog-cancel";

import { startTransition, useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { currency } from "remask";
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
  type Licenca,
  type LicencaModuloOption,
  type LicencaPrefeituraOption,
} from "@/lib/licencas-data";
import { createLicenca, updateLicenca } from "./actions";
import { DatePickerInput } from "./date-picker-input";

type LicencaFormProps = {
  defaultFim?: string;
  defaultInicio?: string;
  defaultPrefeituraId?: string;
  licenca?: Licenca;
  modulos: LicencaModuloOption[];
  prefeituras: LicencaPrefeituraOption[];
};

type LicencaFormValues = {
  fim: string;
  inicio: string;
  modulo_id: string | null;
  prefeitura_id: string | null;
  status: string | null;
  dia_vencimento: number;
  valor_mensal: number | null;
};

const statusOptions = [
  { value: "active", label: "Ativa" },
  { value: "suspended", label: "Suspensa" },
  { value: "expired", label: "Vencida" },
];

export function LicencaForm({
  defaultFim,
  defaultInicio,
  defaultPrefeituraId,
  licenca,
  modulos,
  prefeituras,
}: LicencaFormProps) {
  const isEditing = Boolean(licenca);
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, actionPending] = useActionState(
    isEditing ? updateLicenca : createLicenca,
    {}
  );
  const form = useForm<LicencaFormValues>({
    defaultValues: {
      fim: licenca?.contrato.fim ?? defaultFim ?? "",
      inicio: licenca?.contrato.inicio ?? defaultInicio ?? "",
      modulo_id: licenca?.modulo_id ?? null,
      prefeitura_id: licenca?.prefeitura_id ?? defaultPrefeituraId ?? null,
      status: licenca?.status ?? "active",
      dia_vencimento: licenca?.dia_vencimento ?? 10,
      valor_mensal: licenca?.valor_mensal ?? null,
    },
  });
  const moduloItems = [
    { label: "Selecione o módulo", value: null },
    ...modulos.map((modulo) => ({
      label: modulo.nome,
      value: modulo.id,
    })),
  ];
  const statusItems = statusOptions.map((option) => ({
    label: option.label,
    value: option.value,
  }));
  const valorMensal = useWatch({
    control: form.control,
    name: "valor_mensal",
  });
  const inicioPreview = useWatch({ control: form.control, name: "inicio" });
  const fimPreview = useWatch({ control: form.control, name: "fim" });
  const diaPreview = useWatch({ control: form.control, name: "dia_vencimento" });

  useEffect(() => {
    if (state.success) {
      toast.success(state.success, {
        id: isEditing ? "licenca-edit-success" : "licenca-create-success",
      });
      router.refresh();

      if (!isEditing) {
        form.reset({
          fim: defaultFim ?? "",
          inicio: defaultInicio ?? "",
          modulo_id: null,
          prefeitura_id: defaultPrefeituraId ?? null,
          status: "active",
          dia_vencimento: 10,
          valor_mensal: null,
        });
      }

      closeParentDialog(formRef.current);
    }
  }, [
    defaultFim,
    defaultInicio,
    defaultPrefeituraId,
    form,
    isEditing,
    router,
    state.success,
  ]);

  function submitForm(values: LicencaFormValues) {
    const formData = new FormData();

    if (licenca) {
      formData.set("id", licenca.id);
    }

    formData.set("prefeitura_id", values.prefeitura_id ?? "");
    formData.set("modulo_id", values.modulo_id ?? "");
    formData.set("inicio", values.inicio);
    formData.set("fim", values.fim);
    formData.set("dia_vencimento", String(values.dia_vencimento));
    formData.set("valor_mensal", String(values.valor_mensal ?? ""));
    formData.set("status", values.status ?? "");

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
      {licenca ? <input type="hidden" name="id" value={licenca.id} /> : null}
      {state.error ? (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{state.error}</span>
        </div>
      ) : null}

      {isEditing && <p className="text-sm text-muted-foreground">O contrato e suas cobranças são preservados. Aqui você pode alterar o status; use Renovar para um novo período e Cobranças para ajustes individuais.</p>}
      <fieldset disabled={actionPending} className="disabled:opacity-70">
        <FieldGroup className="gap-4">
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
                  disabled={actionPending || isEditing}
                  invalid={fieldState.invalid}
                  placeholder="Pesquisar por empresa ou CNPJ"
                />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />

          <Controller
            control={form.control}
            name="modulo_id"
            rules={{ required: "Selecione o módulo." }}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="modulo_id">Módulo</FieldLabel>
                <Select
                  items={moduloItems}
                  name={field.name}
                  value={field.value}
                  onValueChange={field.onChange}
                  required
                  disabled={actionPending || isEditing}
                >
                  <SelectTrigger
                    id="modulo_id"
                    className="w-full"
                    aria-invalid={fieldState.invalid}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Módulos</SelectLabel>
                      {moduloItems.map((item) => (
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

          <div className="grid gap-3 sm:grid-cols-2">
            <Controller
              control={form.control}
              name="inicio"
              rules={{ required: "Informe a data de início." }}
              render={({ field, fieldState }) => (
                <DatePickerInput
                  id="inicio"
                  name={field.name}
                  label="Início"
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={actionPending || isEditing}
                  error={fieldState.error?.message}
                  required
                />
              )}
            />

            <Controller
              control={form.control}
              name="fim"
              rules={{
                required: "Informe a data final.",
                validate: (value) =>
                  !form.getValues("inicio") ||
                  !value ||
                  value >= form.getValues("inicio") ||
                  "A data final não pode ser menor que a data inicial.",
              }}
              render={({ field, fieldState }) => (
                <DatePickerInput
                  id="fim"
                  name={field.name}
                  label="Fim"
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={actionPending || isEditing}
                  error={fieldState.error?.message}
                  required
                />
              )}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
            <Controller
              control={form.control}
              name="valor_mensal"
              rules={{
                validate: (value) =>
                  value !== null && value > 0
                    ? true
                    : "Informe o valor mensal.",
              }}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="valor_mensal">
                    Mensalidade
                  </FieldLabel>
                  <CurrencyInput
                    id="valor_mensal"
                    name={field.name}
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={actionPending || isEditing}
                    invalid={fieldState.invalid}
                  />
                  
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />

            <Controller
              control={form.control}
              name="status"
              rules={{ required: "Selecione o status." }}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="status">Status</FieldLabel>
                  <Select
                    items={statusItems}
                    name={field.name}
                    value={field.value}
                    onValueChange={field.onChange}
                    required
                    disabled={actionPending}
                  >
                    <SelectTrigger
                      id="status"
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
          <Controller control={form.control} name="dia_vencimento" render={({field}) => <Field><FieldLabel>Dia de vencimento</FieldLabel><FormSelect aria-label="Dia de vencimento" value={String(field.value)} onValueChange={v=>field.onChange(Number(v))} disabled={actionPending || isEditing} options={Array.from({length:31},(_,i)=>({value:String(i+1),label:'Dia '+(i+1)}))} /></Field>} />
          {!isEditing && <ContractPreview inicio={inicioPreview} fim={fimPreview} valor={valorMensal} dia={diaPreview} />}
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
              : "Cadastrar licença"}
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

type CurrencyInputProps = {
  disabled?: boolean;
  id: string;
  invalid?: boolean;
  name: string;
  onValueChange: (value: number | null) => void;
  value: number | null;
};

function CurrencyInput({
  disabled,
  id,
  invalid,
  name,
  onValueChange,
  value,
}: CurrencyInputProps) {
  const displayValue =
    value !== null
      ? currency.mask({
          locale: "pt-BR",
          currency: "BRL",
          value,
        })
      : "";

  return (
    <>
      <input name={name} type="hidden" value={value ?? ""} />
      <Input
        disabled={disabled}
        id={id}
        inputMode="numeric"
        value={displayValue}
        placeholder="R$ 0,00"
        aria-invalid={invalid}
        onChange={(event) => {
          const digits = event.target.value.replace(/\D/g, "");
          const nextValue = digits ? Number(digits) / 100 : null;

          onValueChange(nextValue);
        }}
      />
    </>
  );
}

