"use client";

import { useEffect, useId, useState, type RefObject } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { FormSelect } from "@/components/form-select";
import { CurrencyInput } from "../../currency-input";
import type { CategoriaFinanceira, ContaFinanceira, ContaPagar } from "@/lib/gestao-contas";
import { dinheiro, dataBR } from "@/lib/gestao-types";
import { editarContaPagar, listarPagamentosContaPagar } from "./editar-actions";

type Pagamento = { id: string; conta_id: string; valor: number; data: string };

type Valores = {
  escopo: "" | "uma" | "todas";
  descricao: string;
  categoria: string;
  fornecedor: string;
  observacoes: string;
  valor: string;
  vencimento: string;
};

export function EditarContaPagar({ conta, contas, parcelas, categorias, podeEditarTodas, open, onOpenChange, returnFocus }: {
  conta: ContaPagar;
  contas: ContaFinanceira[];
  parcelas: ContaPagar[];
  categorias: CategoriaFinanceira[];
  podeEditarTodas: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  returnFocus?: RefObject<HTMLButtonElement | null>;
}) {
  const router = useRouter();
  const uid = useId();
  const paga = Number(conta.pago) > 0;
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [origens, setOrigens] = useState<Record<string, string>>({});
  const [carregando, setCarregando] = useState(paga);
  const [erroPagamentos, setErroPagamentos] = useState("");
  useEffect(() => {
    if (!paga) return;
    let ativo = true;
    listarPagamentosContaPagar(conta.id).then((resultado) => {
      if (!ativo) return;
      if (resultado.error) setErroPagamentos(resultado.error);
      else {
        const itens = resultado.pagamentos as Pagamento[];
        setPagamentos(itens);
        setOrigens(Object.fromEntries(itens.map((item) => [item.id, item.conta_id])));
        if (!itens.length) setErroPagamentos("Nenhum pagamento ativo foi encontrado para esta conta.");
      }
      setCarregando(false);
    }).catch(() => {
      if (ativo) { setErroPagamentos("Não foi possível carregar os pagamentos."); setCarregando(false); }
    });
    return () => { ativo = false; };
  }, [conta.id, paga]);
  const ordenadas = [...parcelas].sort((a, b) => (a.parcela_numero ?? 0) - (b.parcela_numero ?? 0));
  const parcelada = Boolean(conta.parcelamento_id && (conta.parcelas_total ?? 0) > 1);
  const total = (ordenadas.reduce((s, p) => s + Math.round(Number(p.valor) * 100), 0) / 100).toFixed(2);
  const ativas = categorias.filter((c) => c.ativo && c.nome !== "Fechamento");
  const form = useForm<Valores>({ defaultValues: {
    escopo: parcelada ? "" : "uma",
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
    <DialogContent finalFocus={returnFocus} className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Editar despesa</DialogTitle>
        <DialogDescription>{paga ? "Corrija os dados da despesa e a origem dos pagamentos registrados." : "Altere os dados antes de registrar pagamentos ou solicitações."}</DialogDescription>
      </DialogHeader>
      <form noValidate className="space-y-4" onSubmit={form.handleSubmit(async (values) => {
        try {
          if (!values.escopo) { form.setError("escopo", { message: "Escolha quais parcelas deseja editar." }); return; }
          if (paga && (carregando || erroPagamentos || pagamentos.some((item) => !origens[item.id]))) return;
          const result = await editarContaPagar({ id: conta.id, ...values, escopo: values.escopo, paga,
            origens: paga ? pagamentos.map((item) => ({ id: item.id, conta_id: origens[item.id] })) : undefined });
          if (result.error) { form.setError("root", { message: result.error }); return; }
          toast.success(result.success);
          onOpenChange(false);
          router.refresh();
        } catch {
          form.setError("root", { message: "Não foi possível editar a despesa. Tente novamente." });
        }
      })}>
        {parcelada && <Field data-invalid={!!errors.escopo}>
          <FieldLabel>Quais parcelas deseja editar?</FieldLabel>
          <div className="grid gap-2 sm:grid-cols-2">
            {([
              { value: "uma", label: `Somente esta parcela`, detail: `${conta.parcela_numero}/${conta.parcelas_total}`, disabled: false },
              { value: "todas", label: "Todas as parcelas", detail: `${conta.parcelas_total} parcelas`, disabled: !podeEditarTodas },
            ] as const).map((opcao) => <button key={opcao.value} type="button" aria-pressed={escopo === opcao.value}
              disabled={isSubmitting || opcao.disabled}
              className="rounded-lg border px-3 py-3 text-left transition-colors hover:bg-muted/50 aria-pressed:border-primary aria-pressed:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => {
                form.setValue("escopo", opcao.value, { shouldValidate: true });
                form.setValue("valor", opcao.value === "todas" ? total : Number(conta.valor).toFixed(2));
                form.setValue("vencimento", opcao.value === "todas" ? ordenadas[0].vencimento : conta.vencimento);
                form.clearErrors();
              }}>
              <span className="block text-sm font-medium">{opcao.label}</span>
              <span className="text-xs text-muted-foreground">{opcao.detail}</span>
            </button>)}
          </div>
          <FieldError errors={[errors.escopo]} />
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
            <Controller name="valor" control={form.control} rules={{ validate: (value) => /^\d+(\.\d{1,2})?$/.test(value) && Number(value) > 0 && Number(value) < 1e9 && (!paga || Number(value) >= Number(conta.pago)) || "O valor deve ser válido e não pode ser menor que o total já pago." }} render={({ field }) =>
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
        {paga && <div className="space-y-3 rounded-lg border p-3">
          <p className="text-sm font-medium">Origem dos pagamentos</p>
          {carregando && <p className="text-xs text-muted-foreground">Carregando pagamentos…</p>}
          {pagamentos.map((pagamento) => <Field key={pagamento.id}>
            <FieldLabel htmlFor={`${uid}-${pagamento.id}`}>{dataBR(pagamento.data)} · {dinheiro(Math.abs(Number(pagamento.valor)))}</FieldLabel>
            <FormSelect id={`${uid}-${pagamento.id}`} value={origens[pagamento.id] ?? ""}
              options={contas.filter((item) => item.ativo && (!conta.cartao_id || item.tipo !== "cobranca"))
                .map((item) => ({ value: item.id, label: item.nome }))}
              onValueChange={(valor) => setOrigens((atual) => ({ ...atual, [pagamento.id]: valor }))}
              disabled={isSubmitting} />
          </Field>)}
          {erroPagamentos && <p role="alert" className="text-xs text-destructive">{erroPagamentos}</p>}
          <p className="text-xs text-muted-foreground">A troca da origem ajusta o saldo das contas. O valor pago e a data do pagamento permanecem iguais.</p>
        </div>}
        {escopo === "todas" && <p className="text-xs text-muted-foreground">O valor total será repartido entre as parcelas. Os vencimentos seguirão mensalmente a partir da data informada.</p>}
        <FieldError errors={[errors.root]} />
        <DialogFooter>
          <Button type="button" variant="outline" disabled={isSubmitting} onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="submit" disabled={isSubmitting || (paga && (carregando || !!erroPagamentos || pagamentos.some((item) => !origens[item.id])))}>{isSubmitting ? "Salvando…" : "Salvar alterações"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
