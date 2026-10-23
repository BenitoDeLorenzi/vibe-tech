import Link from "next/link";
import { forbidden } from "next/navigation";
import { Wallet, Landmark, CreditCard, Clock } from "lucide-react";
import { getGestaoContext } from "@/lib/gestao-data";
import { getFinanceiroData } from "@/lib/gestao-contas-data";
import { resumoContas, valorReservado } from "@/lib/gestao-contas";
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
import { Panel, ListBadge, Empty } from "../../ui";
import { FinanceiroForm } from "../financeiro-form";
import { SolicitacoesList } from "../solicitacoes-list";
export default async function ContasPage() {
  const { profile, unidade } = await getGestaoContext();
  if (profile.role !== "bdl_admin") forbidden();
  const fin = await getFinanceiroData();
  const resumo = resumoContas(fin);
  return (
    <GestaoShell
      title="Contas e saldos"
      icon={Wallet}
      actions={
        fin.inicio ? <FinanceiroForm acao="conta" label="Nova conta" /> : null
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
                title: "Caixa e bancos",
                value: resumo.disponivel,
                icon: Wallet,
              },
              {
                title: "No sistema de cobrança",
                value: resumo.retido,
                icon: CreditCard,
              },
              {
                title: "Livre para solicitar",
                value: resumo.livre,
                icon: CreditCard,
              },
              {
                title: "A pagar em 7 dias + vencidas",
                value: resumo.pagar7,
                icon: Clock,
              },
            ].map(({ title, value, icon: Icon }) => (
              <Card key={title} className="gap-3">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Icon className="size-4 text-muted-foreground" />
                    {title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-semibold tabular-nums">
                  {dinheiro(value)}
                </CardContent>
              </Card>
            ))}
          </div>
          <Panel
            title="Minhas contas"
            description={`Controle iniciado em ${dataBR(fin.inicio)}. Fechamentos anteriores à ativação não alteram estes saldos.`}
            icon={Landmark}
          >
            <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Conta</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fin.contas.map((c) => (
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
                ))}
              </TableBody>
            </Table>
          </div>
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
          <SolicitacoesList financeiro={fin} />
        </>
      )}
    </GestaoShell>
  );
}
