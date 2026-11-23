"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { MoreHorizontal, Pencil, Power, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { FormSelect } from "@/components/form-select";
import { chaveCategoriaFinanceira } from "@/lib/gestao-categoria-financeira";
import type { CategoriaFinanceira } from "@/lib/gestao-contas";
import { operarCategoriaFinanceira } from "./actions";

export function NovaCategoriaFinanceira({ categorias }: { categorias: CategoriaFinanceira[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const form = useForm<{ nome: string }>({ defaultValues: { nome: "" } });
  const { errors, isSubmitting } = form.formState;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button className="h-9" />}>Nova categoria</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova categoria de despesa</DialogTitle>
          <DialogDescription>Use categorias para organizar as contas a pagar desta unidade.</DialogDescription>
        </DialogHeader>
        <form noValidate onSubmit={form.handleSubmit(async ({ nome }) => {
          if (categorias.some((c) => chaveCategoriaFinanceira(c.nome) === chaveCategoriaFinanceira(nome))) {
            form.setError("nome", { message: "Esta categoria já existe, mesmo sem acentos." });
            return;
          }
          try {
            const result = await operarCategoriaFinanceira("criar", { nome: nome.trim() });
            if (result.error) { form.setError("root", { message: result.error }); return; }
            toast.success(result.success);
            form.reset();
            setOpen(false);
            router.refresh();
          } catch {
            form.setError("root", { message: "Não foi possível cadastrar a categoria. Tente novamente." });
          }
        })} className="space-y-4">
          <Field data-invalid={!!errors.nome}>
            <FieldLabel htmlFor="categoria-financeira-nome">Nome</FieldLabel>
            <Controller name="nome" control={form.control} rules={{ required: "Informe o nome.", minLength: { value: 2, message: "Use pelo menos 2 caracteres." }, maxLength: { value: 100, message: "Use até 100 caracteres." } }}
              render={({ field }) => <Input id="categoria-financeira-nome" placeholder="Ex.: Materiais da obra" aria-invalid={!!errors.nome} disabled={isSubmitting} {...field} />} />
            <FieldError errors={[errors.nome]} />
          </Field>
          <FieldError errors={[errors.root]} />
          <DialogFooter>
            <Button type="button" variant="outline" disabled={isSubmitting} onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Salvando…" : "Cadastrar categoria"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CategoriaFinanceiraActions({ categoria, categorias }: {
  categoria: CategoriaFinanceira;
  categorias: CategoriaFinanceira[];
}) {
  const router = useRouter();
  const [acao, setAcao] = useState<"editar" | "situacao" | "excluir" | null>(null);
  const [nome, setNome] = useState(categoria.nome);
  const [substituta, setSubstituta] = useState("");
  const [erro, setErro] = useState("");
  const [pending, setPending] = useState(false);
  const alternativas = categorias.filter((c) => c.ativo && c.id !== categoria.id && c.nome !== "Fechamento");

  function abrir(opcao: NonNullable<typeof acao>) {
    setNome(categoria.nome);
    setSubstituta("");
    setErro("");
    setAcao(opcao);
  }

  async function confirmar() {
    if (!acao) return;
    if (acao === "editar") {
      if (nome.trim().length < 2 || nome.trim().length > 100) {
        setErro("Informe um nome de 2 a 100 caracteres.");
        return;
      }
      if (categorias.some((c) => c.id !== categoria.id && chaveCategoriaFinanceira(c.nome) === chaveCategoriaFinanceira(nome))) {
        setErro("Esta categoria já existe, mesmo sem acentos.");
        return;
      }
    }
    if (acao === "excluir" && !substituta) {
      setErro("Escolha a categoria que receberá as despesas existentes.");
      return;
    }
    setPending(true);
    try {
      const dados = acao === "editar" ? { id: categoria.id, nome: nome.trim() }
        : acao === "situacao" ? { id: categoria.id, ativo: !categoria.ativo }
          : { id: categoria.id, substituta_id: substituta };
      const result = await operarCategoriaFinanceira(acao, dados);
      if (result.error) { setErro(result.error); return; }
      toast.success(result.success);
      setAcao(null);
      router.refresh();
    } catch {
      setErro("Não foi possível salvar. Tente novamente.");
    } finally { setPending(false); }
  }

  return <>
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Ações de ${categoria.nome}`} />}>
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => abrir("editar")}><Pencil />Editar</DropdownMenuItem>
        <DropdownMenuItem onClick={() => abrir("situacao")}><Power />{categoria.ativo ? "Inativar" : "Ativar"}</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => abrir("excluir")}><Trash2 />Excluir</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <Dialog open={acao !== null} onOpenChange={(open) => { if (!open && !pending) setAcao(null); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{acao === "editar" ? "Editar categoria" : acao === "excluir" ? "Excluir categoria" : `${categoria.ativo ? "Inativar" : "Ativar"} categoria`}</DialogTitle>
          <DialogDescription>
            {acao === "editar" ? "O novo nome será aplicado também às despesas já cadastradas, inclusive às parcelas."
              : acao === "excluir" ? "As despesas desta categoria serão transferidas para a categoria escolhida antes da exclusão."
                : categoria.ativo ? "Ela deixará de aparecer em novas contas. As despesas existentes permanecem cadastradas."
                  : "Ela voltará a aparecer no cadastro de contas a pagar."}
          </DialogDescription>
        </DialogHeader>
        {acao === "editar" && <Field data-invalid={!!erro}>
          <FieldLabel htmlFor={`editar-categoria-${categoria.id}`}>Nome</FieldLabel>
          <Input id={`editar-categoria-${categoria.id}`} value={nome} maxLength={100} disabled={pending} aria-invalid={!!erro} onChange={(event) => { setNome(event.target.value); setErro(""); }} />
        </Field>}
        {acao === "excluir" && <Field data-invalid={!!erro}>
          <FieldLabel htmlFor={`substituta-${categoria.id}`}>Mover despesas para</FieldLabel>
          <FormSelect id={`substituta-${categoria.id}`} value={substituta} options={alternativas.map((c) => ({ value: c.id, label: c.nome }))} onValueChange={(value) => { setSubstituta(value); setErro(""); }} disabled={pending} />
        </Field>}
        {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
        <DialogFooter>
          <Button type="button" variant="outline" disabled={pending} onClick={() => setAcao(null)}>Cancelar</Button>
          <Button type="button" variant={acao === "excluir" || (acao === "situacao" && categoria.ativo) ? "destructive" : "default"} disabled={pending} onClick={confirmar}>
            {pending ? "Salvando…" : acao === "editar" ? "Salvar alterações" : acao === "excluir" ? "Excluir categoria" : categoria.ativo ? "Inativar" : "Ativar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}
