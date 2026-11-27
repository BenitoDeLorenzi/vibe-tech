import { forbidden } from "next/navigation";
import { Wallet, Landmark, CreditCard, Clock, TrendingUp, TrendingDown, Receipt } from "lucide-react";
import { getGestaoContext } from "@/lib/gestao-data";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getFinanceiroData } from "@/lib/gestao-contas-data";
import { resumoContas, valorReservado, pendentePagar, centavosFin, hojeFinanceiro } from "@/lib/gestao-contas";
import { dataBR, dinheiro } from "@/lib/gestao-types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GestaoShell } from "../../gestao-shell";
import { GestaoShowMore } from "../../gestao-show-more";
import { gestaoListLimit } from "@/lib/gestao-list-limit";
import { Panel, Empty } from "../../ui";
import { FinanceiroForm } from "../financeiro-form";
import { SolicitacoesList } from "../solicitacoes-list";
import { DetalhesModal } from "./detalhes-modal";
import { DespesasCategorias } from "./despesas-categorias";
import { VencimentosGrafico } from "./vencimentos-grafico";
export default async function ContasPage({ searchParams }: { searchParams: Promise<{ contas?: string; cartoes?: string; solicitacoes?: string }> }) {
  const params = await searchParams;
  const { profile, unidade } = await getGestaoContext();
  if (profile.role !== "bdl_admin") forbidden();
  const fin = await getFinanceiroData();
  const resumo = resumoContas(fin);
  const totais = unidade && fin.inicio
    ? await createSupabaseServerClient().rpc("gestao_fin_totais_contas", { p_ator: profile.id, p_unidade: unidade.id })
    : null;
  if (totais?.error) throw new Error("Não foi possível carregar o resumo financeiro.");
  const receitas = Number(totais?.data?.[0]?.receitas ?? 0);
  const equipePaga = Number(totais?.data?.[0]?.equipe_paga ?? 0);
  const contasLancadas = fin.pagar.filter((p) => !p.cancelada)
    .reduce((s, p) => s + centavosFin(p.valor), 0) / 100;
  const despesas = (centavosFin(contasLancadas) + centavosFin(equipePaga)) / 100;
  const totalDevido = fin.pagar.reduce((s, p) => s + centavosFin(pendentePagar(p)), 0) / 100;
  const vencido = fin.pagar.filter((p) => p.vencimento < hojeFinanceiro())
    .reduce((s, p) => s + centavosFin(pendentePagar(p)), 0) / 100;
  const saldoTotal = (centavosFin(resumo.disponivel) + centavosFin(resumo.retido) - centavosFin(totalDevido)) / 100;
  return (
    <GestaoShell
      title="Contas e saldos"
      icon={Wallet}
      actions={
        fin.inicio ? <div className="flex gap-2"><FinanceiroForm acao="cartao_cadastrar" label="Novo cartão" /><FinanceiroForm acao="conta" label="Nova conta" /></div> : null
      }
    >
      {!unidade ? (
        <Empty
          title="Nenhuma unidade disponível"
          description="Selecione uma empresa com licença vigente."
        />
      ) : !fin.inicio ? (
        <Panel
          title="Comece pelo saldo atual"
          description="Ative o controle financeiro desta unidade."
        >
          <FinanceiroForm acao="ativar" label="Configurar saldos iniciais" />
        </Panel>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {[
              {
                title: "Receitas",
                value: receitas,
                icon: TrendingUp,
                detail: "Vendas registradas desde a ativação",
                tone: "text-emerald-700 dark:text-emerald-400",
              },
              {
                title: "Despesas",
                value: despesas > 0 ? -despesas : 0,
                icon: TrendingDown,
                detail: `Contas lançadas + ${dinheiro(equipePaga)} em equipe paga`,
                tone: despesas > 0 ? "text-destructive" : "text-muted-foreground",
              },
              {
                title: "A pagar em aberto",
                value: totalDevido > 0 ? -totalDevido : 0,
                icon: Receipt,
                detail: "Parcelas e contas ainda não quitadas",
                tone: totalDevido > 0 ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground",
              },
              {
                title: "Vencido",
                value: vencido > 0 ? -vencido : 0,
                icon: Clock,
                detail: "Contas com vencimento anterior a hoje",
                tone: vencido > 0 ? "text-destructive" : "text-muted-foreground",
              },
              {
                title: "Saldo total",
                value: saldoTotal,
                icon: Wallet,
                detail: "Caixa, bancos e cobrança − todas as contas em aberto",
                tone: saldoTotal < 0 ? "text-destructive" : "text-emerald-700 dark:text-emerald-400",
              },
            ].map(({ title, value, icon: Icon, detail, tone }) => (
              <Card key={title} size="sm" className="min-w-0 gap-2">
                <CardHeader>
                  <CardTitle className="flex min-w-0 items-center gap-2 text-xs font-medium">
                    <Icon className={`size-3.5 shrink-0 ${tone}`} />
                    {title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-xl font-semibold tabular-nums ${tone}`}>{dinheiro(value)}</div>
                  <p className="mt-1 text-[11px] leading-tight text-muted-foreground">{detail}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="space-y-4">
          <Panel title="Contas e cartões" description={`Controle iniciado em ${dataBR(fin.inicio)}.`} icon={Landmark}>
            <div className="mb-4 flex flex-wrap gap-2 border-b pb-4">
              {[
                { acao: "transferir", label: "Transferir" },
                { acao: "aporte", label: "Aporte" },
                { acao: "retirada", label: "Retirada" },
                { acao: "ajuste_entrada", label: "Ajuste de entrada" },
                { acao: "ajuste_saida", label: "Ajuste de saída" },
              ].map((item) => <FinanceiroForm key={item.acao} {...item} contas={fin.contas} compact />)}
            </div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Total devido em contas e cartões</span>
              <strong className={`tabular-nums ${totalDevido > 0 ? "text-destructive" : ""}`}>{dinheiro(totalDevido > 0 ? -totalDevido : 0)}</strong>
            </div>
            <div className="grid gap-5 lg:grid-cols-2 lg:gap-6">
              <section className="min-w-0" aria-label="Contas">
                <h3 className="mb-2 text-sm font-semibold">Contas <span className="font-normal text-muted-foreground">({fin.contas.length})</span></h3>
                <div className="space-y-1.5">
                  {fin.contas.slice(0, gestaoListLimit(params.contas)).map((c) => <div key={c.id} className="flex min-w-0 items-center gap-2 rounded-lg border px-2.5 py-1.5">
                    <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted">
                      {c.tipo === "cobranca" ? <CreditCard className="size-3.5" /> : c.tipo === "banco" ? <Landmark className="size-3.5" /> : <Wallet className="size-3.5" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{c.nome}</p>
                      <p className="truncate text-[11px] text-muted-foreground">{c.tipo === "cobranca" ? `Sistema de cobrança · ${dinheiro(valorReservado(fin.solicitacoes, c.id))} reservados` : c.tipo === "banco" ? "Banco" : "Caixa"}</p>
                    </div>
                    <strong className={`shrink-0 text-xs tabular-nums ${Number(c.saldo) < 0 ? "text-destructive" : ""}`}>{dinheiro(Number(c.saldo))}</strong>
                    <DetalhesModal tipo="conta" id={c.id} nome={c.nome} valor={Number(c.saldo)} />
                  </div>)}
                  {!fin.contas.length && <p className="rounded-lg border p-6 text-center text-sm text-muted-foreground">Nenhuma conta cadastrada.</p>}
                </div>
                <GestaoShowMore shown={Math.min(gestaoListLimit(params.contas), fin.contas.length)} total={fin.contas.length} param="contas" />
              </section>
              <section className="min-w-0 lg:border-l lg:pl-6" aria-label="Cartões">
                <h3 className="mb-2 text-sm font-semibold">Cartões <span className="font-normal text-muted-foreground">({fin.cartoes.length})</span></h3>
                <div className="space-y-1.5">
                  {fin.cartoes.slice(0, gestaoListLimit(params.cartoes)).map((cartao) => {
                    const parcelas = fin.pagar.filter((p) => p.cartao_id === cartao.id && pendentePagar(p) > 0);
                    const aberto = parcelas.reduce((total, p) => total + centavosFin(pendentePagar(p)), 0) / 100;
                    return <div key={cartao.id} className="flex min-w-0 items-center gap-2 rounded-lg border px-2.5 py-1.5">
                      <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted"><CreditCard className="size-3.5" /></div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{cartao.nome}</p>
                        <p className="truncate text-[11px] text-muted-foreground">{parcelas.length} parcela(s) pendente(s){cartao.vencimento_dia ? ` · Vence dia ${cartao.vencimento_dia}` : ""}</p>
                      </div>
                      <strong className={`shrink-0 text-xs tabular-nums ${aberto > 0 ? "text-destructive" : ""}`}>{dinheiro(aberto > 0 ? -aberto : 0)}</strong>
                      <DetalhesModal tipo="cartao" id={cartao.id} nome={cartao.nome} valor={aberto > 0 ? -aberto : 0} />
                    </div>;
                  })}
                  {!fin.cartoes.length && <p className="rounded-lg border p-6 text-center text-sm text-muted-foreground">Nenhum cartão cadastrado.</p>}
                </div>
                <GestaoShowMore shown={Math.min(gestaoListLimit(params.cartoes), fin.cartoes.length)} total={fin.cartoes.length} param="cartoes" />
              </section>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Sistema de cobrança: {dinheiro(resumo.retido)} em saldo, dos quais {dinheiro(resumo.livre)} estão livres para solicitar.</p>
          </Panel>
          <div className="grid gap-4 xl:grid-cols-2 [&>[data-slot=card]]:h-full">
            <DespesasCategorias contas={fin.pagar} equipePaga={equipePaga} />
            <VencimentosGrafico contas={fin.pagar} hoje={hojeFinanceiro()} />
          </div>
          </div>
          <SolicitacoesList financeiro={fin} limite={gestaoListLimit(params.solicitacoes)} />
        </>
      )}
    </GestaoShell>
  );
}
