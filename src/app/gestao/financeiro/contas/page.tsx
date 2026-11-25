import Link from "next/link";
import { forbidden } from "next/navigation";
import { Wallet, Landmark, CreditCard, Clock, TrendingUp, TrendingDown } from "lucide-react";
import { getGestaoContext } from "@/lib/gestao-data";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getFinanceiroData } from "@/lib/gestao-contas-data";
import { resumoContas, valorReservado, pendentePagar, centavosFin } from "@/lib/gestao-contas";
import { dataBR, dinheiro } from "@/lib/gestao-types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { buttonVariants } from "@/components/ui/button";
import { GestaoShell } from "../../gestao-shell";
import { GestaoShowMore } from "../../gestao-show-more";
import { gestaoListLimit } from "@/lib/gestao-list-limit";
import { Panel, ListBadge, Empty } from "../../ui";
import { FinanceiroForm } from "../financeiro-form";
import { SolicitacoesList } from "../solicitacoes-list";
export default async function ContasPage({ searchParams }: { searchParams: Promise<{ contas?: string; solicitacoes?: string }> }) {
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
  const saldoTotal = (centavosFin(resumo.disponivel) + centavosFin(resumo.retido) - centavosFin(totalDevido)) / 100;
  const itens = [
    ...fin.cartoes.map((cartao) => ({ tipo: "cartao" as const, cartao })),
    ...fin.contas.map((conta) => ({ tipo: "conta" as const, conta })),
  ];
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
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
                title: "Saldo total",
                value: saldoTotal,
                icon: Wallet,
                detail: "Caixa, bancos e cobrança − todas as contas em aberto",
                tone: saldoTotal < 0 ? "text-destructive" : "text-emerald-700 dark:text-emerald-400",
              },
              {
                title: "Vence em 7 dias ou atrasado",
                value: resumo.pagar7 > 0 ? -resumo.pagar7 : 0,
                icon: Clock,
                detail: "Contas em aberto, incluindo vencidas",
                tone: resumo.pagar7 > 0 ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground",
              },
            ].map(({ title, value, icon: Icon, detail, tone }) => (
              <Card key={title} className="gap-3">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Icon className={`size-4 ${tone}`} />
                    {title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-semibold tabular-nums ${tone}`}>{dinheiro(value)}</div>
                  <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <Panel
            title="Contas e cartões"
            description={`Controle iniciado em ${dataBR(fin.inicio)}. Fechamentos anteriores à ativação não alteram estes saldos.`}
            icon={Landmark}
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Total devido em contas e cartões</span>
              <strong className={`tabular-nums ${totalDevido > 0 ? "text-destructive" : ""}`}>{dinheiro(totalDevido > 0 ? -totalDevido : 0)}</strong>
            </div>
            <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Conta ou cartão</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Saldo / em aberto</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itens.slice(0, gestaoListLimit(params.contas)).map((item) => {
                  if (item.tipo === "conta") {
                    const c = item.conta;
                    return (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.nome}</TableCell>
                    <TableCell>
                      <ListBadge
                        icon={
                          c.tipo === "cobranca"
                            ? CreditCard
                            : c.tipo === "banco"
                              ? Landmark
                              : Wallet
                        }
                        tone="info"
                      >
                        {c.tipo === "cobranca"
                          ? "Sistema de cobrança"
                          : c.tipo === "banco"
                            ? "Banco"
                            : "Caixa"}
                      </ListBadge>
                    </TableCell>
                    <TableCell
                      className={`text-right font-semibold tabular-nums ${Number(c.saldo) < 0 ? "text-destructive" : ""}`}
                    >
                      {dinheiro(Number(c.saldo))}
                      {c.tipo === "cobranca" && (
                        <p className="text-xs font-normal text-muted-foreground">
                          {dinheiro(valorReservado(fin.solicitacoes, c.id))}{" "}
                          reservados
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/gestao/financeiro/extratos?conta=${c.id}`}
                        className={buttonVariants({
                          variant: "ghost",
                          size: "sm",
                        })}
                      >
                        Ver extrato
                      </Link>
                    </TableCell>
                  </TableRow>
                    );
                  }
                  const cartao = item.cartao;
                  const parcelas = fin.pagar.filter((p) => p.cartao_id === cartao.id && pendentePagar(p) > 0);
                  const aberto = parcelas.reduce((total, p) => total + centavosFin(pendentePagar(p)), 0) / 100;
                  return <TableRow key={cartao.id}>
                    <TableCell className="font-medium">{cartao.nome}<p className="text-xs font-normal text-muted-foreground">{parcelas.length} parcela(s) pendente(s){cartao.fechamento_dia ? ` · Fecha dia ${cartao.fechamento_dia}` : ""}{cartao.vencimento_dia ? ` · Vence dia ${cartao.vencimento_dia}` : ""}</p></TableCell>
                    <TableCell><ListBadge icon={CreditCard} tone="warning">Cartão de crédito</ListBadge></TableCell>
                    <TableCell className={`text-right font-semibold tabular-nums ${aberto > 0 ? "text-destructive" : "text-muted-foreground"}`}>{dinheiro(aberto > 0 ? -aberto : 0)}<p className="text-xs font-normal text-muted-foreground">a pagar</p></TableCell>
                    <TableCell className="text-right"><Link href={`/gestao/financeiro/pagar?cartao=${cartao.id}`} className={buttonVariants({ variant: "ghost", size: "sm" })}>Ver parcelas</Link></TableCell>
                  </TableRow>;
                })}
              </TableBody>
            </Table>
          </div>
            <GestaoShowMore shown={Math.min(gestaoListLimit(params.contas), itens.length)} total={itens.length} param="contas" />
            <p className="mt-3 text-xs text-muted-foreground">Sistema de cobrança: {dinheiro(resumo.retido)} em saldo, dos quais {dinheiro(resumo.livre)} estão livres para solicitar.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {[
                { acao: "transferir", label: "Registrar transferência" },
                { acao: "aporte", label: "Aporte" },
                { acao: "retirada", label: "Retirada" },
                { acao: "ajuste_entrada", label: "Ajuste de entrada" },
                { acao: "ajuste_saida", label: "Ajuste de saída" },
              ].map((p) => (
                <FinanceiroForm
                  key={p.acao}
                  {...p}
                  contas={fin.contas}
                  compact
                />
              ))}
            </div>
          </Panel>
          <SolicitacoesList financeiro={fin} limite={gestaoListLimit(params.solicitacoes)} />
        </>
      )}
    </GestaoShell>
  );
}
