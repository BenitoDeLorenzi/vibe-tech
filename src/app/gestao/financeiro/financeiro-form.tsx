"use client";
import { useId, useState, type RefObject } from "react";
import Link from "next/link";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldLabel, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { FormSelect } from "@/components/form-select";
import { CurrencyInput } from "../currency-input";
import { Checkbox } from "@/components/ui/checkbox";
import { operarFinanceiro } from "./actions";
import { hojeFinanceiro, type ContaFinanceira, type CartaoCredito, type CategoriaFinanceira } from "@/lib/gestao-contas";
type Props = {
  acao: string;
  label: string;
  contas?: ContaFinanceira[];
  cartoes?: CartaoCredito[];
  categorias?: CategoriaFinanceira[];
  defaults?: Record<string, string>;
  description?: string;
  compact?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  returnFocus?: RefObject<HTMLButtonElement | null>;
  demaisParcelas?: number;
};
const positive = (v: string) =>
  /^\d+(\.\d{1,2})?$/.test(v) && Number(v) > 0 && Number(v) < 1e9;
export function FinanceiroForm({
  acao,
  label,
  contas = [],
  cartoes = [],
  categorias = [],
  defaults = {},
  description,
  compact,
  open: controlledOpen,
  onOpenChange,
  returnFocus,
  demaisParcelas = 0,
}: Props) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const [pending, setPending] = useState(false);
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!pending) setOpen(value);
      }}
    >
      {controlledOpen === undefined && (
        <DialogTrigger
          render={
            <Button
              variant={compact ? "outline" : "default"}
              size={compact ? "sm" : "default"}
            />
          }
        >
          {label}
        </DialogTrigger>
      )}
      <DialogContent
        finalFocus={returnFocus}
        className="max-h-[90dvh] overflow-y-auto sm:max-w-lg"
      >
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
          <DialogDescription>
            {description ?? "Confira os dados antes de registrar."}
          </DialogDescription>
        </DialogHeader>
        {open && (
          <FormBody
            acao={acao}
            contas={contas}
            cartoes={cartoes}
            categorias={categorias}
            defaults={defaults}
            demaisParcelas={demaisParcelas}
            onPending={setPending}
            done={() => setOpen(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
function FormBody({
  acao,
  contas,
  cartoes,
  categorias,
  defaults,
  demaisParcelas,
  done,
  onPending,
}: {
  acao: string;
  contas: ContaFinanceira[];
  cartoes: CartaoCredito[];
  categorias: CategoriaFinanceira[];
  defaults: Record<string, string>;
  demaisParcelas: number;
  done: () => void;
  onPending: (pending: boolean) => void;
}) {
  const router = useRouter();
  const uid = useId();
  const [request] = useState(() => crypto.randomUUID());
  const form = useForm<Record<string, string>>({
    defaultValues: {
      data: hojeFinanceiro(),
      vencimento: hojeFinanceiro(),
      tipo: "banco",
      categoria: categorias.find((c) => c.ativo && c.nome === "Outras despesas")?.nome ?? categorias.find((c) => c.ativo && !c.sistema)?.nome ?? "",
      caixa: "0",
      banco: "0",
      sistema: "0",
      modo: "unico",
      parcelas: "2",
      forma_prevista: "cartao",
      demais: "false",
      ...defaults,
    },
  });
  const { errors, isSubmitting } = form.formState;
  const modo = useWatch({ control: form.control, name: "modo" });
  const forma = useWatch({ control: form.control, name: "forma_prevista" });
  function input(name: string, label: string, type = "text", required = true) {
    return (
      <Field data-invalid={!!errors[name]}>
        <FieldLabel htmlFor={uid + name}>{label}</FieldLabel>
        <Input
          id={uid + name}
          type={type}
          aria-invalid={!!errors[name]}
          disabled={isSubmitting}
          {...form.register(name, {
            required: required ? "Preencha este campo." : false,
            maxLength: {
              value: name === "observacoes" ? 1000 : 200,
              message: "Texto muito longo.",
            },
            validate: (v) =>
              !required ||
              type === "date" ||
              v?.trim().length >= 2 ||
              "Preencha este campo.",
          })}
        />
        <FieldError errors={[errors[name]]} />
      </Field>
    );
  }
  function money(name: string, label: string, zero = false) {
    return (
      <Field data-invalid={!!errors[name]}>
        <FieldLabel htmlFor={uid + name}>{label}</FieldLabel>
        <Controller
          control={form.control}
          name={name}
          rules={{
            validate: (v) =>
              (zero && /^0(?:\.0{1,2})?$/.test(v)) ||
              positive(v) ||
              "Informe um valor válido em reais.",
          }}
          render={({ field }) => (
            <CurrencyInput
              id={uid + name}
              value={field.value ?? ""}
              onValueChange={field.onChange}
              onBlur={field.onBlur}
              ref={field.ref}
              disabled={isSubmitting}
              aria-invalid={!!errors[name]}
            />
          )}
        />
        <FieldError errors={[errors[name]]} />
      </Field>
    );
  }
  function select(
    name: string,
    label: string,
    options: { value: string; label: string }[],
  ) {
    return (
      <Field data-invalid={!!errors[name]}>
        <FieldLabel htmlFor={uid + name}>{label}</FieldLabel>
        <Controller
          name={name}
          control={form.control}
          rules={{ required: "Selecione uma opção." }}
          render={({ field }) => (
            <FormSelect
              id={uid + name}
              options={options}
              value={field.value ?? ""}
              onValueChange={field.onChange}
              onBlur={field.onBlur}
              ref={field.ref}
              disabled={isSubmitting}
              aria-invalid={!!errors[name]}
            />
          )}
        />
        <FieldError errors={[errors[name]]} />
      </Field>
    );
  }
  const available = contas
    .filter((c) => c.ativo)
    .map((c) => ({ value: c.id, label: c.nome }));
  const movement = [
    "pagar",
    "transferir",
    "aporte",
    "retirada",
    "ajuste_entrada",
    "ajuste_saida",
  ].includes(acao);
  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={form.handleSubmit(async (values) => {
        if (acao === "pagar_cadastrar" && values.modo === "parcelado" && values.forma_prevista === "cartao" && !cartoes.some((c) => c.id === values.cartao_id && c.ativo)) {
          form.setError("root", { message: "Cadastre e selecione um cartão ativo." });
          return;
        }
        onPending(true);
        try {
          const result = await operarFinanceiro(acao === "pagar_cadastrar" && values.modo === "parcelado" ? "pagar_parcelado" : acao, {
            ...values,
            ...(values.forma_prevista === "outro" ? { cartao_id: "" } : {}),
            requisicao: request,
          });
          if (result.error) {
            form.setError("root", { message: result.error });
            return;
          }
          toast.success(result.success);
          router.refresh();
          done();
        } catch {
          form.setError("root", {
            message: "Não foi possível registrar. Tente novamente.",
          });
        } finally {
          onPending(false);
        }
      })}
    >
      {acao === "ativar" && (
        <>
          <p className="text-sm text-muted-foreground">
            Informe os saldos disponíveis antes dos próximos fechamentos. Os
            fechamentos já confirmados ficam no histórico e devem estar
            incluídos nesses saldos. Informe também o valor líquido que já está
            retido no sistema de cobrança.
          </p>
          {input("data", "Data de início", "date")}
          <div className="grid grid-cols-2 gap-3">
            {money("caixa", "Saldo inicial do caixa", true)}
            {money("banco", "Saldo inicial do banco", true)}
          </div>
          {money("sistema", "Saldo inicial no sistema de cobrança", true)}
        </>
      )}
      {acao === "conta" && (
        <>
          {input("descricao", "Nome da conta")}
          {select("tipo", "Tipo", [
            { value: "caixa", label: "Caixa" },
            { value: "banco", label: "Banco" },
            { value: "cobranca", label: "Sistema de cobrança" },
          ])}
          <p className="text-xs text-muted-foreground">
            A conta começa com saldo zero. Use um aporte ou ajuste para
            registrar valores existentes.
          </p>
        </>
      )}
      {acao === "cartao_cadastrar" && (
        <>
          {input("descricao", "Nome do cartão")}
          <div className="grid grid-cols-2 gap-3">
            {input("fechamento_dia", "Dia do fechamento", "number", false)}
            {input("vencimento_dia", "Dia do vencimento", "number", false)}
          </div>
          <p className="text-xs text-muted-foreground">Os dias identificam a fatura. Ao lançar parcelas, informe a data do primeiro vencimento.</p>
        </>
      )}
      {acao === "pagar_cadastrar" && (
        <>
          {input("descricao", "Descrição")}
          {select("modo", "Pagamento", [
            { value: "unico", label: "Pagamento único" },
            { value: "parcelado", label: "Cartão de crédito ou parcelado" },
          ])}
          <div className="grid gap-3 sm:grid-cols-2">
            {select(
              "categoria",
              "Categoria",
              categorias.filter((c) => c.ativo && c.nome !== "Fechamento").map((c) => ({ value: c.nome, label: c.nome })),
            )}
            {input("fornecedor", "Fornecedor (opcional)", "text", false)}
            {money("valor", modo === "parcelado" ? "Valor total" : "Valor")}
            {input("vencimento", modo === "parcelado" ? "Primeiro vencimento" : "Vencimento", "date")}
          </div>
          <Link href="/gestao/financeiro/categorias" className="inline-block text-xs text-primary hover:underline">Gerenciar categorias de despesas</Link>
          {modo === "parcelado" && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field data-invalid={!!errors.parcelas}>
                  <FieldLabel htmlFor={uid + "parcelas"}>Número de parcelas</FieldLabel>
                  <Input id={uid + "parcelas"} type="number" min={1} max={60} step={1} disabled={isSubmitting} aria-invalid={!!errors.parcelas}
                    {...form.register("parcelas", { validate: (v) => /^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 60 || "Informe de 1 a 60 parcelas." })} />
                  <FieldError errors={[errors.parcelas]} />
                </Field>
                {select("forma_prevista", "Forma prevista", [
                  { value: "cartao", label: "Cartão de crédito" },
                  { value: "outro", label: "Outro parcelamento" },
                ])}
              </div>
              {forma === "cartao" && (
                cartoes.some((c) => c.ativo) ? select("cartao_id", "Cartão", cartoes.filter((c) => c.ativo).map((c) => ({ value: c.id, label: c.nome })))
                  : <p className="text-sm text-destructive">Cadastre um cartão em Contas e saldos antes de lançar as parcelas.</p>
              )}
              <p className="text-xs text-muted-foreground">Cada parcela vira uma conta a pagar. O saldo de Caixa ou Banco muda somente quando você registra o pagamento da parcela.</p>
            </>
          )}
          {input("observacoes", "Observação (opcional)", "text", false)}
        </>
      )}
      {movement && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            {input("data", "Data da movimentação", "date")}
            {money("valor", "Valor")}
          </div>
          {select(
            "conta_id",
            ["aporte", "ajuste_entrada"].includes(acao)
              ? "Conta de destino"
              : "Conta de origem",
            available,
          )}
          {acao === "transferir" &&
            select("destino_id", "Conta de destino", available)}
          {["aporte", "retirada", "ajuste_entrada", "ajuste_saida"].includes(
            acao,
          ) && input("descricao", "Justificativa")}
        </>
      )}
      {["solicitar_repasse", "solicitar_pagamento"].includes(acao) && (
        <>
          {select(
            "conta_id",
            "Sistema de cobrança",
            contas
              .filter((c) => c.ativo && c.tipo === "cobranca")
              .map((c) => ({ value: c.id, label: c.nome })),
          )}
          {acao === "solicitar_repasse" &&
            select(
              "destino_id",
              "Banco de destino",
              contas
                .filter((c) => c.ativo && c.tipo === "banco")
                .map((c) => ({ value: c.id, label: c.nome })),
            )}
          {money("valor", "Valor solicitado")}
          {input("observacoes", "Observação (opcional)", "text", false)}
          <p className="text-xs text-muted-foreground">
            O valor ficará reservado até a conclusão ou o cancelamento. Registre
            aqui o pedido feito à empresa; o Vibe Gestão não envia solicitações
            externas.
          </p>
        </>
      )}
      {acao === "concluir_solicitacao" &&
        input("data", "Data em que foi executado", "date")}
      {acao === "pagar_excluir" && (
        <>
          <p className="text-sm text-muted-foreground">A conta sairá da lista. Pagamentos já registrados permanecem no extrato e não serão estornados.</p>
          {demaisParcelas > 0 && <div className="flex items-start gap-3 rounded-lg border p-3">
            <Controller control={form.control} name="demais" render={({ field }) =>
              <Checkbox id={uid + "demais"} checked={field.value === "true"} onCheckedChange={(checked) => field.onChange(checked === true ? "true" : "false")} disabled={isSubmitting} />
            } />
            <label htmlFor={uid + "demais"} className="cursor-pointer text-sm">Cancelar também as {demaisParcelas} parcela(s) seguintes ainda não pagas. Elas continuarão visíveis como canceladas.</label>
          </div>}
        </>
      )}
      {["cancelar", "estornar", "cancelar_solicitacao"].includes(acao) &&
        input("descricao", "Justificativa")}
      <FieldError errors={[errors.root]} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" disabled={isSubmitting} onClick={done}>
          Voltar
        </Button>
        <Button type="submit" variant={acao === "pagar_excluir" ? "destructive" : "default"} disabled={isSubmitting}>
          {isSubmitting ? "Registrando…" : acao === "pagar_excluir" ? "Excluir conta" : "Confirmar"}
        </Button>
      </div>
    </form>
  );
}
