"use client";

import { useId, useState, type RefObject } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { FormSelect } from "@/components/form-select";
import type { CategoriaFinanceira, ContaPagar } from "@/lib/gestao-contas";
import { editarCategoriaContaPaga } from "./editar-actions";

export function EditarCategoriaContaPaga({ conta, parcelas, categorias, open, onOpenChange, returnFocus }: {
  conta: ContaPagar;
  parcelas: ContaPagar[];
  categorias: CategoriaFinanceira[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  returnFocus?: RefObject<HTMLButtonElement | null>;
}) {
  const router = useRouter();
  const id = useId();
  const [categoria, setCategoria] = useState(conta.categoria);
  const [escopo, setEscopo] = useState<"uma" | "todas">("uma");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const opcoes = categorias.filter((item) => item.ativo && item.nome !== "Fechamento");
  const podeTodas = Boolean(conta.parcelamento_id && parcelas.length === conta.parcelas_total &&
    parcelas.every((parcela) => !parcela.cancelada && !parcela.fechamento_id));

  async function salvar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!categoria || categoria === conta.categoria && escopo === "uma") {
      onOpenChange(false);
      return;
    }
    setErro("");
    setSalvando(true);
    try {
      const resultado = await editarCategoriaContaPaga({ id: conta.id, escopo, categoria });
      if (resultado.error) { setErro(resultado.error); return; }
      toast.success(resultado.success);
      onOpenChange(false);
      router.refresh();
    } catch {
      setErro("Não foi possível alterar a categoria. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  return <Dialog open={open} onOpenChange={(next) => { if (!salvando) onOpenChange(next); }}>
    <DialogContent finalFocus={returnFocus} className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Alterar categoria</DialogTitle>
        <DialogDescription>O pagamento, o valor e o vencimento da conta permanecem iguais.</DialogDescription>
      </DialogHeader>
      <form className="space-y-4" onSubmit={salvar}>
        {podeTodas && <Field>
          <FieldLabel htmlFor={`${id}-escopo`}>Aplicar alteração em</FieldLabel>
          <FormSelect id={`${id}-escopo`} value={escopo} onValueChange={(value) => setEscopo(value as "uma" | "todas")}
            options={[{ value: "uma", label: `Somente parcela ${conta.parcela_numero}/${conta.parcelas_total}` }, { value: "todas", label: `Todas as ${conta.parcelas_total} parcelas` }]}
            disabled={salvando} />
        </Field>}
        <Field>
          <FieldLabel htmlFor={`${id}-categoria`}>Categoria</FieldLabel>
          <FormSelect id={`${id}-categoria`} value={categoria} onValueChange={setCategoria}
            options={opcoes.map((item) => ({ value: item.nome, label: item.nome }))} disabled={salvando} />
        </Field>
        {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>Cancelar</Button>
          <Button type="submit" disabled={salvando || !opcoes.some((item) => item.nome === categoria)}>{salvando ? "Salvando…" : "Salvar alterações"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
