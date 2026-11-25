"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { List, ArrowUpRight } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { dataBR, dinheiro } from "@/lib/gestao-types";
import { listarDetalhesFinanceiros, type DetalheFinanceiro } from "./detalhes-actions";

export function DetalhesModal({ tipo, id, nome, valor }: {
  tipo: "conta" | "cartao";
  id: string;
  nome: string;
  valor: number;
}) {
  const [open, setOpen] = useState(false);
  const [itens, setItens] = useState<DetalheFinanceiro[]>([]);
  const [total, setTotal] = useState(0);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const requisicao = useRef(0);

  function alterarAbertura(next: boolean) {
    setOpen(next);
    const atual = ++requisicao.current;
    if (!next) return;
    setCarregando(true);
    setItens([]);
    setErro("");
    listarDetalhesFinanceiros(tipo, id).then((resultado) => {
      if (requisicao.current !== atual) return;
      setItens(resultado.itens);
      setTotal(resultado.total);
      setErro(resultado.erro ?? "");
    }).catch(() => { if (requisicao.current === atual) setErro("Não foi possível carregar os lançamentos."); })
      .finally(() => { if (requisicao.current === atual) setCarregando(false); });
  }

  async function mostrarMais() {
    if (carregando) return;
    setCarregando(true);
    try {
      const resultado = await listarDetalhesFinanceiros(tipo, id, Math.floor(itens.length / 20));
      if (resultado.erro) setErro(resultado.erro);
      else {
        setItens((atual) => [...atual, ...resultado.itens]);
        setTotal(resultado.total);
      }
    } catch { setErro("Não foi possível carregar mais lançamentos."); }
    finally { setCarregando(false); }
  }

  const href = tipo === "conta" ? `/gestao/financeiro/extratos?conta=${id}` : `/gestao/financeiro/pagar?cartao=${id}`;
  return <Dialog open={open} onOpenChange={alterarAbertura}>
    <DialogTrigger render={<Button type="button" variant="outline" size="sm" className="h-8 gap-1.5" />}>
      <List className="size-3.5" /> Detalhes
    </DialogTrigger>
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{nome}</DialogTitle>
        <DialogDescription>{tipo === "conta" ? "Lançamentos desta conta" : "Parcelas deste cartão"} · {dinheiro(valor)}</DialogDescription>
      </DialogHeader>
      <div className="max-h-[52dvh] min-h-20 space-y-2 overflow-y-auto pr-1">
        {itens.map((item) => <div key={item.id} className={`flex items-start justify-between gap-3 rounded-lg border px-3 py-2 ${item.estornado ? "opacity-55" : ""}`}>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{item.descricao}</p>
            <p className="text-xs text-muted-foreground">{dataBR(item.data)} · {item.detalhe}</p>
          </div>
          <span className={`shrink-0 text-sm font-semibold tabular-nums ${item.valor < 0 ? "text-destructive" : ""}`}>{dinheiro(item.valor)}</span>
        </div>)}
        {carregando && <p className="py-4 text-center text-sm text-muted-foreground">Carregando…</p>}
        {erro && <p role="alert" className="py-3 text-sm text-destructive">{erro}</p>}
        {!carregando && !erro && !itens.length && <p className="py-6 text-center text-sm text-muted-foreground">Nenhum lançamento encontrado.</p>}
        {!carregando && itens.length < total && <Button type="button" variant="outline" className="w-full" onClick={mostrarMais}>Mostrar mais</Button>}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => setOpen(false)}>Fechar</Button>
        <Link href={href} onClick={() => setOpen(false)} className={buttonVariants({ className: "gap-1.5" })}>
          <ArrowUpRight className="size-4" /> Abrir {tipo === "conta" ? "extrato" : "contas a pagar"}
        </Link>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
