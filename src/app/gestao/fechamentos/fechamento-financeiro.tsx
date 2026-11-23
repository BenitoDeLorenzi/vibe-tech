"use client";
import { Controller, useWatch, type UseFormReturn } from "react-hook-form";
import { FormSelect } from "@/components/form-select";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { type FinanceiroData, pendentePagar } from "@/lib/gestao-contas";
import { dinheiro } from "@/lib/gestao-types";
import type { Campos } from "./fechamento-form";
export function FechamentoFinanceiro({
  form,
  financeiro,
  disabled,
  legado,
}: {
  form: UseFormReturn<Campos>;
  financeiro: FinanceiroData;
  disabled: boolean;
  legado: boolean;
}) {
  const pagamentos = useWatch({ control: form.control, name: "pagamentos" });
  const despesas = useWatch({ control: form.control, name: "despesas" });
  const equipe = useWatch({ control: form.control, name: "equipe" });
  const data = useWatch({ control: form.control, name: "data" });
  if (legado || data < (financeiro.inicio ?? ""))
    return (
      <p className="mb-4 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
        Fechamento histórico: não altera os saldos financeiros. Eventuais
        correções devem ser registradas como ajustes pelo Master.
      </p>
    );
  const disponiveis = financeiro.contas
    .filter((c) => c.ativo)
    .map((c) => ({ value: c.id, label: c.nome }));
  return (
    <div className="mb-5 space-y-5 rounded-lg border p-4">
      <div>
        <h3 className="text-sm font-semibold">Movimentação financeira</h3>
        <p className="text-xs text-muted-foreground">Escolha onde registrar os recebimentos e pagamentos deste fechamento.</p>
      </div>
      <div className="space-y-3">
      <h4 className="text-sm font-medium">Recebimentos</h4>
      {pagamentos.map(
        (p, i) =>
          Number(p.valor) > 0 && (
            <div
              key={i}
              className="grid items-end gap-3 sm:grid-cols-[100px_1fr]"
            >
              <span className="pb-2 text-sm font-medium">{p.forma}</span>
              <Field>
                <FieldLabel>Destino</FieldLabel>
                <Controller
                  name={`pagamentos.${i}.conta_id`}
                  control={form.control}
                  render={({ field }) => (
                    <FormSelect
                      aria-label={`Conta de ${p.forma}`}
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={disabled}
                      options={financeiro.contas
                        .filter(
                          (c) =>
                            c.ativo &&
                            c.tipo ===
                              (p.forma === "Dinheiro" ? "caixa" : "cobranca"),
                        )
                        .map((c) => ({ value: c.id, label: c.nome }))}
                    />
                  )}
                />
              </Field>
            </div>
          ),
      )}
      <p className="text-xs text-muted-foreground">
        Dinheiro entra no caixa. Os demais recebimentos ficam no sistema de
        cobrança, já descontadas as taxas.
      </p>
      </div>
      {despesas.length > 0 && <div className="space-y-3 border-t pt-4"><h4 className="text-sm font-medium">Despesas</h4>
      {despesas.map((d, i) => (
        <div key={i} className="space-y-3 rounded-lg border p-3">
          <p className="text-sm font-medium">
            {d.descricao || `Despesa ${i + 1}`}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field>
              <FieldLabel>Pagar com</FieldLabel>
              <Controller
                name={`despesas.${i}.conta_id`}
                control={form.control}
                render={({ field }) => (
                  <FormSelect
                    aria-label={`Conta da despesa ${i + 1}`}
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={disabled}
                    options={disponiveis}
                  />
                )}
              />
            </Field>
            <Field data-invalid={Boolean(form.formState.errors.despesas?.[i]?.categoria)}>
              <FieldLabel>Categoria</FieldLabel>
              <Controller
                name={`despesas.${i}.categoria`}
                control={form.control}
                rules={{ required: "Escolha a categoria da despesa." }}
                render={({ field }) => (
                  <FormSelect
                    aria-label={`Categoria da despesa ${i + 1}`}
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={disabled || Boolean(d.pagar_id)}
                    options={financeiro.categorias.filter((c) => c.ativo && c.nome !== "Fechamento").map((c) => ({ value: c.nome, label: c.nome }))}
                  />
                )}
              />
              <FieldError errors={[form.formState.errors.despesas?.[i]?.categoria]} />
            </Field>
          </div>
          <details className="text-sm">
            <summary className="cursor-pointer text-muted-foreground">Usar conta a pagar já cadastrada (opcional)</summary>
            <div className="mt-3">
              <Field>
                <FieldLabel>Conta a pagar</FieldLabel>
                <Controller
                  name={`despesas.${i}.pagar_id`}
                  control={form.control}
                  render={({ field }) => (
                    <FormSelect
                      aria-label={`Conta a pagar da despesa ${i + 1}`}
                      value={field.value || "nova"}
                      onValueChange={(value) => {
                        field.onChange(value === "nova" ? "" : value);
                        if (value !== "nova") {
                          const conta = financeiro.pagar.find((p) => p.id === value);
                          if (conta) form.setValue(`despesas.${i}.categoria`, conta.categoria);
                        }
                      }}
                      disabled={disabled}
                      options={[
                        { value: "nova", label: "Criar nova despesa paga" },
                        ...financeiro.pagar.filter((p) => pendentePagar(p) > 0 || p.id === field.value)
                          .map((p) => ({ value: p.id, label: `${p.descricao} · ${dinheiro(pendentePagar(p))}` })),
                      ]}
                    />
                  )}
                />
              </Field>
            </div>
          </details>
        </div>
      ))}
      </div>}
      {equipe.some((c) => c.pagar && Number(c.valor_pago) > 0) && (
        <div className="space-y-3 border-t pt-4">
          <div><h4 className="text-sm font-medium">Equipe</h4><p className="text-xs text-muted-foreground">Os pagamentos serão classificados como Pessoal.</p></div>
        <Field>
          <FieldLabel>Conta para pagamento da equipe</FieldLabel>
          <Controller
            name="equipe_conta_id"
            control={form.control}
            render={({ field }) => (
              <FormSelect
                aria-label="Conta para pagamento da equipe"
                value={field.value}
                onValueChange={field.onChange}
                disabled={disabled}
                options={disponiveis}
              />
            )}
          />
        </Field>
        </div>
      )}
    </div>
  );
}
