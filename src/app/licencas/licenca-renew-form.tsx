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

import { DatePickerInput } from "@/app/licencas/date-picker-input";
import { renewLicenca } from "@/app/licencas/actions";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { type Licenca } from "@/lib/licencas-data";

type LicencaRenewFormProps = {
  licenca: Licenca;
};

type LicencaRenewFormValues = {
  fim: string;
  inicio: string;
  dia_vencimento: number;
  valor_mensal: number | null;
};

export function LicencaRenewForm({ licenca }: LicencaRenewFormProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, actionPending] = useActionState(renewLicenca, {});
  const defaultInicio = addDaysIsoDate(licenca.fim, 1);
  const defaultFim = addOneYearIsoDate(defaultInicio);
  const form = useForm<LicencaRenewFormValues>({
    defaultValues: {
      fim: defaultFim,
      inicio: defaultInicio,
      dia_vencimento: licenca.dia_vencimento,
      valor_mensal: licenca.valor_mensal,
    },
  });
  const valorMensal = useWatch({
    control: form.control,
    name: "valor_mensal",
  });
  const inicioPreview = useWatch({ control: form.control, name: "inicio" });
  const fimPreview = useWatch({ control: form.control, name: "fim" });
  const diaPreview = useWatch({ control: form.control, name: "dia_vencimento" });

  useEffect(() => {
    if (state.success) {
      toast.success(state.success, { id: "licenca-renew-success" });
      router.refresh();
      closeParentDialog(formRef.current);
    }
  }, [router, state.success]);

  function submitForm(values: LicencaRenewFormValues) {
    const formData = new FormData();

    formData.set("id", licenca.id);
    formData.set("inicio", values.inicio);
    formData.set("fim", values.fim);
    formData.set("dia_vencimento", String(values.dia_vencimento));
    formData.set("valor_mensal", String(values.valor_mensal ?? ""));

    startTransition(() => {
      formAction(formData);
    });
  }

  return (
    <form
      ref={formRef}
      className="space-y-4"
      onSubmit={form.handleSubmit(submitForm)}
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
          <div className="grid gap-3 sm:grid-cols-2">
            <Controller
              control={form.control}
              name="inicio"
              rules={{ required: "Informe a data de início." }}
              render={({ field, fieldState }) => (
                <DatePickerInput
                  id="inicio_renovacao"
                  name={field.name}
                  label="Início"
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={actionPending}
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
                  id="fim_renovacao"
                  name={field.name}
                  label="Fim"
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={actionPending}
                  error={fieldState.error?.message}
                  required
                />
              )}
            />
          </div>

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
                <FieldLabel htmlFor="valor_mensal_renovacao">
                  Mensalidade
                </FieldLabel>
                <CurrencyInput
                  id="valor_mensal_renovacao"
                  name={field.name}
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={actionPending}
                  invalid={fieldState.invalid}
                />
                
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
          <Controller control={form.control} name="dia_vencimento" render={({field}) => <Field><FieldLabel>Dia de vencimento</FieldLabel><FormSelect aria-label="Dia de vencimento" value={String(field.value)} onValueChange={v=>field.onChange(Number(v))} disabled={actionPending} options={Array.from({length:31},(_,i)=>({value:String(i+1),label:'Dia '+(i+1)}))} /></Field>} />
          <ContractPreview inicio={inicioPreview} fim={fimPreview} valor={valorMensal} dia={diaPreview} />
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
          {actionPending ? "Renovando..." : "Renovar licença"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function CurrencyInput({
  disabled,
  id,
  invalid,
  name,
  onValueChange,
  value,
}: {
  disabled?: boolean;
  id: string;
  invalid?: boolean;
  name: string;
  onValueChange: (value: number | null) => void;
  value: number | null;
}) {
  const displayValue =
    value !== null
      ? currency.mask({ currency: "BRL", locale: "pt-BR", value })
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

function closeParentDialog(formElement: HTMLFormElement | null) {
  const closeButton = formElement
    ?.closest('[data-slot="dialog-content"]')
    ?.querySelector<HTMLElement>('[data-slot="dialog-close"]');

  closeButton?.click();
}


function addDaysIsoDate(value: string, days: number) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));

  return formatIsoDate(date);
}

function addOneYearIsoDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const nextDate = new Date(Date.UTC(year + 1, month - 1, day));

  if (nextDate.getUTCMonth() !== month - 1) {
    nextDate.setUTCDate(0);
  }

  nextDate.setUTCDate(nextDate.getUTCDate() - 1);
  return formatIsoDate(nextDate);
}

function formatIsoDate(date: Date) {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}
