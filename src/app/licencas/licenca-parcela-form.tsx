"use client";

import { FormDialogCancel } from "@/components/form-dialog-cancel";

import { startTransition, useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { currency } from "remask";
import { toast } from "sonner";

import { DatePickerInput } from "@/app/licencas/date-picker-input";
import { updateLicencaPagamento } from "@/app/licencas/actions";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { type LicencaPagamento } from "@/lib/licencas-data";

type LicencaParcelaFormProps = {
  pagamento: LicencaPagamento;
};

type LicencaParcelaFormValues = {
  observacoes: string;
  valor: number | null;
  vencimento: string;
};

export function LicencaParcelaForm({ pagamento }: LicencaParcelaFormProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, actionPending] = useActionState(
    updateLicencaPagamento,
    {}
  );
  const form = useForm<LicencaParcelaFormValues>({
    defaultValues: {
      observacoes: pagamento.observacoes ?? "",
      valor: pagamento.valor,
      vencimento: pagamento.vencimento,
    },
  });

  useEffect(() => {
    if (state.success) {
      toast.success(state.success, { id: "licenca-parcela-edit-success" });
      router.refresh();
      closeParentDialog(formRef.current);
    }
  }, [router, state.success]);

  function submitForm(values: LicencaParcelaFormValues) {
    const formData = new FormData();

    formData.set("id", pagamento.id);
    formData.set("vencimento", values.vencimento);
    formData.set("valor", String(values.valor ?? ""));
    formData.set("observacoes", values.observacoes);

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
              name="vencimento"
              rules={{ required: "Informe o vencimento." }}
              render={({ field, fieldState }) => (
                <DatePickerInput
                  id="vencimento_parcela"
                  name={field.name}
                  label="Vencimento"
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
              name="valor"
              rules={{
                validate: (value) =>
                  value !== null && value > 0 ? true : "Informe o valor.",
              }}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="valor_parcela">Valor</FieldLabel>
                  <CurrencyInput
                    id="valor_parcela"
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

          <Controller
            control={form.control}
            name="observacoes"
            render={({ field }) => (
              <Field>
                <FieldLabel htmlFor="observacoes_parcela">Observações</FieldLabel>
                <Textarea
                  id="observacoes_parcela"
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Ajustes, negociação ou observações internas"
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
          {actionPending ? "Salvando..." : "Salvar parcela"}
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
