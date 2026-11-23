"use client";

import { useId, type RefObject } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { FormSelect } from "@/components/form-select";
import { CurrencyInput } from "../../currency-input";
import type { CategoriaFinanceira, ContaPagar } from "@/lib/gestao-contas";
import { editarContaPagar } from "./editar-actions";

type Valores = {
  escopo: "uma" | "todas";
  descricao: string;
  categoria: string;
  fornecedor: string;
  observacoes: string;
  valor: string;
  vencimento: string;
};

export function EditarContaPagar({ conta, parcelas, categorias, podeEditarTodas, open, onOpenChange, returnFocus }: {
  conta: ContaPagar;
  parcelas: ContaPagar[];
  categorias: CategoriaFinanceira[];
  podeEditarTodas: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  returnFocus?: RefObject<HTMLButtonElement | null>;
}) {
  const router = useRouter();
  const uid = useId();
  const ordenadas = [...parcelas].sort((a, b) => (a.parcela_numero ?? 0) - (b.parcela_numero ?? 0));
  const total = (ordenadas.reduce((s, p) => s + Math.round(Number(p.valor) * 100), 0) / 100).toFixed(2);
  const ativas = categorias.filter((c) => c.ativo && c.nome !== "Fechamento");
  const form = useForm<Valores>({ defaultValues: {
    escopo: "uma",
    descricao: conta.descricao,
    categoria: ativas.some((c) => c.nome === conta.categoria) ? conta.categoria : "Outras despesas",
    fornecedor: conta.fornecedor ?? "",
    observacoes: conta.observacoes ?? "",
    valor: Number(conta.valor).toFixed(2),
    vencimento: conta.vencimento,
  } });
  const escopo = useWatch({ control: form.control, name: "escopo" });
  const { errors, isSubmitting } = form.formState;

  return <Dialog open={open} onOpenChange={(next) => { if (!isSubmitting) onOpenChange(next); }}>
    <DialogContent finalFocus={returnFocus} className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Editar despesa</DialogTitle>
        <DialogDescription>Altere os dados antes de registrar pagamentos ou solicitações.</DialogDescription>
      </DialogHeader>
      <form noValidate className="space-y-4" onSubmit={form.handleSubmit(async (values) => {
        try {
          const result = await editarContaPagar({ id: conta.id, ...values });
          if (result.error) { form.setError("root", { message: result.error }); return; }
          toast.success(result.success);
          onOpenChange(false);
          router.refresh();
        } catch {
          form.setError("root", { message: "Não foi possível editar a despesa. Tente novamente." });
        }
      })}>
        {conta.parcelamento_id && (conta.parcelas_total ?? 0) > 1 && <Field>
          <FieldLabel htmlFor={`${uid}-escopo`}>Aplicar alterações em</FieldLabel>
          <FormSelect id={`${uid}-escopo`} value={escopo} options={[
            { value: "uma", label: `Somente parcela ${conta.parcela_numero}/${conta.parcelas_total}` },
            { value: "todas", label: `Todas as ${conta.parcelas_total} parcelas`, disabled: !podeEditarTodas },
          ]} onValueChange={(value) => {
            form.setValue("escopo", value as Valores["escopo"]);
            form.setValue("valor", value === "todas" ? total : Number(conta.valor).toFixed(2));
            form.setValue("vencimento", value === "todas" ? ordenadas[0].vencimento : conta.vencimento);
            form.clearErrors();
          }} disabled={isSubmitting} />
          {!podeEditarTodas && <p className="text-xs text-muted-foreground">A edição conjunta exige que todas as parcelas estejam abertas e sem movimentações.</p>}
        </Field>}
        <Field data-invalid={!!errors.descricao}>
          <FieldLabel htmlFor={`${uid}-descricao`}>Descrição</FieldLabel>
          <Input id={`${uid}-descricao`} aria-invalid={!!errors.descricao} disabled={isSubmitting} {...form.register("descricao", { required: "Informe a descrição.", minLength: { value: 2, message: "Use pelo menos 2 caracteres." }, maxLength: { value: 200, message: "Use até 200 caracteres." } })} />
          <FieldError errors={[errors.descricao]} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field data-invalid={!!errors.categoria}>
            <FieldLabel htmlFor={`${uid}-categoria`}>Categoria</FieldLabel>
            <Controller name="categoria" control={form.control} rules={{ required: "Escolha uma categoria." }} render={({ field }) =>
              <FormSelect id={`${uid}-categoria`} value={field.value} options={ativas.map((c) => ({ value: c.nome, label: c.nome }))} onValueChange={field.onChange} disabled={isSubmitting} aria-invalid={!!errors.categoria} />
            } />
            <FieldError errors={[errors.categoria]} />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${uid}-fornecedor`}>Fornecedor (opcional)</FieldLabel>
            <Input id={`${uid}-fornecedor`} maxLength={120} disabled={isSubmitting} {...form.register("fornecedor")} />
          </Field>
          <Field data-invalid={!!errors.valor}>
            <FieldLabel htmlFor={`${uid}-valor`}>{escopo === "todas" ? "Valor total do parcelamento" : "Valor da conta"}</FieldLabel>
            <Controller name="valor" control={form.control} rules={{ validate: (value) => /^\d+(\.\d{1,2})?$/.test(value) && Number(value) > 0 && Number(value) < 1e9 || "Informe um valor válido." }} render={({ field }) =>
              <CurrencyInput id={`${uid}-valor`} value={field.value ?? ""} onValueChange={field.onChange} onBlur={field.onBlur} ref={field.ref} disabled={isSubmitting} aria-invalid={!!errors.valor} />
            } />
            <FieldError errors={[errors.valor]} />
          </Field>
          <Field data-invalid={!!errors.vencimento}>
            <FieldLabel htmlFor={`${uid}-vencimento`}>{escopo === "todas" ? "Primeiro vencimento" : "Vencimento"}</FieldLabel>
            <Input id={`${uid}-vencimento`} type="date" aria-invalid={!!errors.vencimento} disabled={isSubmitting} {...form.register("vencimento", { required: "Informe o vencimento." })} />
            <FieldError errors={[errors.vencimento]} />
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor={`${uid}-observacoes`}>Observações (opcional)</FieldLabel>
          <Input id={`${uid}-observacoes`} maxLength={2000} disabled={isSubmitting} {...form.register("observacoes")} />
        </Field>
        {escopo === "todas" && <p className="text-xs text-muted-foreground">O valor total será repartido entre as parcelas. Os vencimentos seguirão mensalmente a partir da data informada.</p>}
        <FieldError errors={[errors.root]} />
        <DialogFooter>
          <Button type="button" variant="outline" disabled={isSubmitting} onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Salvando…" : "Salvar alterações"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
