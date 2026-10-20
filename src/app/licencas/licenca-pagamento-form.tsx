"use client";

import { FormDialogCancel } from "@/components/form-dialog-cancel";

import { startTransition, useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { currency } from "remask";
import { toast } from "sonner";

import { DatePickerInput } from "@/app/licencas/date-picker-input";
import { registerLicencaPagamento } from "@/app/licencas/actions";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
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
import { Textarea } from "@/components/ui/textarea";
import { type LicencaPagamento } from "@/lib/licencas-data";

type LicencaPagamentoFormProps = {
  pagamento: LicencaPagamento;
};

type LicencaPagamentoFormValues = {
  documento: string;
  forma_pagamento: string | null;
  observacoes: string;
  pago_em: string;
  valor_pago: number | null;
};

const paymentMethodItems = [
  { label: "PIX", value: "pix" },
  { label: "Boleto", value: "boleto" },
  { label: "Transferência", value: "transferencia" },
  { label: "Dinheiro", value: "dinheiro" },
  { label: "Outro", value: "outro" },
];

export function LicencaPagamentoForm({ pagamento }: LicencaPagamentoFormProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, actionPending] = useActionState(
    registerLicencaPagamento,
    {}
  );
  const requestId = useRef<string | null>(null);
  const form = useForm<LicencaPagamentoFormValues>({
    defaultValues: {
      documento: pagamento.documento ?? "",
      forma_pagamento: pagamento.forma_pagamento ?? "pix",
      observacoes: pagamento.observacoes ?? "",
      pago_em: getTodayIsoDate(),
      valor_pago: Math.max(0, pagamento.valor - Number(pagamento.valor_pago ?? 0)),
    },
  });

  useEffect(() => {
    if (state.success) {
      toast.success(state.success, { id: "licenca-pagamento-success" });
      router.refresh();
      closeParentDialog(formRef.current);
    }
  }, [router, state.success]);

  function submitForm(values: LicencaPagamentoFormValues) {
    const formData = new FormData();

    requestId.current ??= crypto.randomUUID();
    formData.set("request_id", requestId.current);
    formData.set("id", pagamento.id);
    formData.set("pago_em", values.pago_em);
    formData.set("valor_pago", String(values.valor_pago ?? ""));
    formData.set("forma_pagamento", values.forma_pagamento ?? "");
    formData.set("documento", values.documento);
    formData.set("observacoes", values.observacoes);

    startTransition(() => {
      formAction(formData);
    });
  }

  return (
    <form
      ref={formRef}
      className="space-y-4"
      onSubmit={event => { void form.handleSubmit(submitForm)(event); }}
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
              name="pago_em"
              rules={{ required: "Informe a data do pagamento." }}
              render={({ field, fieldState }) => (
                <DatePickerInput
                  id="pago_em"
                  name={field.name}
                  label="Data do pagamento"
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
              name="valor_pago"
              rules={{
                validate: (value) =>
                  value !== null && value > 0 && value <= Math.round((pagamento.valor - Number(pagamento.valor_pago ?? 0)) * 100) / 100
                    ? true
                    : "Informe um valor positivo até o saldo pendente.",
              }}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="valor_pago">Valor pago</FieldLabel>
                  <CurrencyInput
                    id="valor_pago"
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
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Controller
              control={form.control}
              name="forma_pagamento"
              rules={{ required: "Selecione a forma de pagamento." }}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="forma_pagamento">
                    Forma de pagamento
                  </FieldLabel>
                  <Select
                    items={paymentMethodItems}
                    name={field.name}
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={actionPending}
                    required
                  >
                    <SelectTrigger
                      id="forma_pagamento"
                      className="w-full"
                      aria-invalid={fieldState.invalid}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>Forma de pagamento</SelectLabel>
                        {paymentMethodItems.map((item) => (
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
              name="documento"
              render={({ field }) => (
                <Field>
                  <FieldLabel htmlFor="documento">Documento</FieldLabel>
                  <Input
                    id="documento"
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Nº boleto, PIX ou comprovante"
                  />
                </Field>
              )}
            />
          </div>

          <Controller
            control={form.control}
            name="observacoes"
            render={({ field }) => (
              <Field>
                <FieldLabel htmlFor="observacoes">Observações</FieldLabel>
                <Textarea
                  id="observacoes"
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Informações internas sobre este pagamento"
                  rows={3}
                />
              </Field>
            )}
          />
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
          {actionPending ? "Registrando..." : "Registrar pagamento"}
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
      ? currency.mask({
          currency: "BRL",
          locale: "pt-BR",
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

function closeParentDialog(formElement: HTMLFormElement | null) {
  const closeButton = formElement
    ?.closest('[data-slot="dialog-content"]')
    ?.querySelector<HTMLElement>('[data-slot="dialog-close"]');

  closeButton?.click();
}

function getTodayIsoDate() {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Sao_Paulo",
    year: "numeric",
  }).formatToParts(new Date());
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";

  return `${year}-${month}-${day}`;
}
