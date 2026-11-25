"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { MoreHorizontal, History, Wallet, Send, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import type { ContaFinanceira, ContaPagar, CategoriaFinanceira } from "@/lib/gestao-contas";
import { FinanceiroForm } from "../financeiro-form";
import { EditarContaPagar } from "./editar-conta-form";

export function ContaActions({
  conta,
  contas,
  livre,
  solicitado,
  parcelas,
  categorias,
  podeEditarTodas,
  calendarLabel,
  calendarClassName,
}: {
  conta: ContaPagar;
  contas: ContaFinanceira[];
  livre: number;
  solicitado: number;
  parcelas: ContaPagar[];
  categorias: CategoriaFinanceira[];
  podeEditarTodas: boolean;
  calendarLabel?: string;
  calendarClassName?: string;
}) {
  const [acao, setAcao] = useState<
    "pagar" | "solicitar_pagamento" | "pagar_excluir" | "editar" | null
  >(null);
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const sistema = conta.cartao_id ? undefined : contas.find((c) => c.ativo && c.tipo === "cobranca");
  const podeExcluir = !conta.fechamento_id && solicitado === 0;
  const demaisParcelas = parcelas.filter((parcela) =>
    (parcela.parcela_numero ?? 0) > (conta.parcela_numero ?? 0) &&
    !parcela.cancelada && Number(parcela.pago) === 0).length;
  const podeEditar = !conta.cancelada && !conta.fechamento_id && (Number(conta.pago) > 0 || solicitado === 0);
  function abrir(value: NonNullable<typeof acao>) {
    setAcao(value);
    setOpen(true);
  }
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              ref={trigger}
              variant="ghost"
              size={calendarLabel ? "sm" : "icon-sm"}
              className={calendarClassName}
              aria-label={`Ações de ${conta.descricao}`}
            />
          }
        >
          {calendarLabel ? calendarLabel : <MoreHorizontal className="size-4" />}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {podeEditar && <DropdownMenuItem onClick={() => abrir("editar")}>
            <Pencil />Editar despesa
          </DropdownMenuItem>}
          <DropdownMenuItem
            render={
              <Link href={`/gestao/financeiro/extratos?pagar=${conta.id}`} />
            }
          >
            <History />
            Histórico
          </DropdownMenuItem>
          {livre > 0 && (
            <DropdownMenuItem onClick={() => abrir("pagar")}>
              <Wallet />
              Registrar pagamento
            </DropdownMenuItem>
          )}
          {livre > 0 && sistema && (
            <DropdownMenuItem onClick={() => abrir("solicitar_pagamento")}>
              <Send />
              Solicitar ao sistema
            </DropdownMenuItem>
          )}
          {podeExcluir && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => abrir("pagar_excluir")}>
                <Trash2 />
                Excluir conta
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {acao === "editar" && <EditarContaPagar
        conta={conta}
        contas={contas}
        parcelas={parcelas}
        categorias={categorias}
        podeEditarTodas={podeEditarTodas}
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setAcao(null);
        }}
        returnFocus={trigger}
      />}
      {acao && acao !== "editar" && (
        <FinanceiroForm
          acao={acao}
          label={
            acao === "pagar"
              ? "Registrar pagamento"
              : acao === "solicitar_pagamento"
                ? "Solicitar ao sistema"
                : "Excluir conta"
          }
          contas={conta.cartao_id ? contas.filter((c) => c.tipo === "caixa" || c.tipo === "banco") : contas}
          defaults={{
            id: conta.id,
            valor: String(livre),
            ...(acao === "solicitar_pagamento"
              ? { conta_id: sistema?.id ?? "" }
              : {}),
          }}
          description={
            acao === "pagar_excluir"
              ? "Revise a exclusão. A conta sairá da lista, mas o histórico financeiro será preservado."
              : acao === "pagar"
                ? `${conta.descricao}. Registre apenas pagamentos já executados. Selecione o sistema de cobrança quando ele pagou diretamente.`
                : conta.descricao
          }
          open={open}
          demaisParcelas={demaisParcelas}
          onOpenChange={setOpen}
          returnFocus={trigger}
        />
      )}
    </>
  );
}
