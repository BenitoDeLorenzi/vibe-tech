"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { MoreHorizontal, History, Wallet, Send, Ban, Trash2, Pencil } from "lucide-react";
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
import { EditarCategoriaContaPaga } from "./editar-categoria-conta-paga";

export function ContaActions({
  conta,
  contas,
  livre,
  solicitado,
  parcelas,
  categorias,
  podeEditarTodas,
}: {
  conta: ContaPagar;
  contas: ContaFinanceira[];
  livre: number;
  solicitado: number;
  parcelas: ContaPagar[];
  categorias: CategoriaFinanceira[];
  podeEditarTodas: boolean;
}) {
  const [acao, setAcao] = useState<
    "pagar" | "solicitar_pagamento" | "cancelar" | "pagar_excluir" | "editar" | null
  >(null);
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const sistema = conta.cartao_id ? undefined : contas.find((c) => c.ativo && c.tipo === "cobranca");
  const podeCancelar =
    !conta.cancelada &&
    !conta.fechamento_id &&
    solicitado === 0 &&
    Number(conta.pago) === 0;
  const edicaoSomenteCategoria = Number(conta.pago) > 0;
  const podeEditar = !conta.cancelada && !conta.fechamento_id && (edicaoSomenteCategoria || solicitado === 0);
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
              size="icon-sm"
              aria-label={`Ações de ${conta.descricao}`}
            />
          }
        >
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {podeEditar && <DropdownMenuItem onClick={() => abrir("editar")}>
            <Pencil />{edicaoSomenteCategoria ? "Alterar categoria" : "Editar despesa"}
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
          {podeCancelar && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => abrir("cancelar")}
              >
                <Ban />
                Cancelar conta
              </DropdownMenuItem>
            </>
          )}
          {conta.cancelada && (
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
      {acao === "editar" && (edicaoSomenteCategoria ? <EditarCategoriaContaPaga
        conta={conta}
        categorias={categorias}
        parcelas={parcelas}
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setAcao(null);
        }}
        returnFocus={trigger}
      /> : <EditarContaPagar
        conta={conta}
        parcelas={parcelas}
        categorias={categorias}
        podeEditarTodas={podeEditarTodas}
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setAcao(null);
        }}
        returnFocus={trigger}
      />)}
      {acao && acao !== "editar" && (
        <FinanceiroForm
          acao={acao}
          label={
            acao === "pagar"
              ? "Registrar pagamento"
              : acao === "solicitar_pagamento"
                ? "Solicitar ao sistema"
                : acao === "pagar_excluir"
                  ? "Excluir conta"
                  : "Cancelar conta"
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
              ? "A conta cancelada sairá da lista. Pagamentos e solicitações anteriores permanecerão no histórico financeiro."
              : acao === "cancelar"
              ? "A conta será cancelada e permanecerá no histórico."
              : acao === "pagar"
                ? `${conta.descricao}. Registre apenas pagamentos já executados. Selecione o sistema de cobrança quando ele pagou diretamente.`
                : conta.descricao
          }
          open={open}
          onOpenChange={setOpen}
          returnFocus={trigger}
        />
      )}
    </>
  );
}
