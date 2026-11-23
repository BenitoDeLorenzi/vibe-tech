import { Users, CircleCheck, CircleMinus, Wallet } from "lucide-react";
import { getGestaoContext } from "@/lib/gestao-data";
import { getEquipeData } from "@/lib/gestao-equipe-data";
import { saldoColaborador } from "@/lib/gestao-equipe";
import { dinheiro } from "@/lib/gestao-types";
import { gestaoListLimit } from "@/lib/gestao-list-limit";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ExtratoColaborador } from "./extrato-colaborador";
import { GestaoShell } from "../gestao-shell";
import { GestaoShowMore } from "../gestao-show-more";
import {
  Panel,
  Empty,
  GestaoDialog,
  MetricBadge,
  ListBadge,
  SearchToolbar,
} from "../ui";
import { ColaboradorForm } from "./equipe-forms";

export async function EquipePage({
  query,
}: {
  tipo?: "colaboradores";
  query: { q?: string; limite?: string };
}) {
  const ctx = await getGestaoContext();
  if (!ctx.gestor || !ctx.unidade)
    return (
      <GestaoShell title="Colaboradores" icon={Users}>
        <Panel title="Acesso restrito">
          <p className="text-sm text-muted-foreground">
            A gestão da equipe está disponível para gestores da unidade.
          </p>
        </Panel>
      </GestaoShell>
    );
  const { colaboradores, extrato } = await getEquipeData();
  const q = query.q?.trim().toLocaleLowerCase("pt-BR") ?? "";
  const pessoas = colaboradores.filter((c) =>
    `${c.nome} ${c.funcao} ${c.telefone}`
      .toLocaleLowerCase("pt-BR")
      .includes(q),
  );
  const saldos = new Map(
    colaboradores.map((c) => [c.id, saldoColaborador(extrato, c.id)]),
  );
  const totalPendente =
    [...saldos.values()].reduce((s, v) => s + Math.round(v * 100), 0) / 100;
  return (
    <GestaoShell
      title="Colaboradores"
      icon={Users}
      actions={
        <SearchToolbar
          placeholder="Buscar colaborador"
          query={query.q}
          clearHref="/gestao/equipe"
        >
          <GestaoDialog title="Novo colaborador" label="Novo colaborador">
            <ColaboradorForm unidadeId={ctx.unidade.id} />
          </GestaoDialog>
        </SearchToolbar>
      }
    >
      <Panel
        title="Colaboradores cadastrados"
        icon={Users}
        description="Registre a presença e os pagamentos no fechamento. Consulte o saldo e o extrato de cada colaborador aqui."
        metrics={
          <>
            <MetricBadge
              label="Ativos"
              icon={CircleCheck}
              tone="success"
              value={colaboradores.filter((c) => c.ativo).length}
            />
            <MetricBadge
              label="A pagar"
              icon={Wallet}
              tone="warning"
              value={dinheiro(totalPendente)}
            />
          </>
        }
      >
        {pessoas.length ? (
          <>
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Colaborador</TableHead>
                    <TableHead className="text-right">Valor sugerido</TableHead>
                    <TableHead className="text-right">Saldo pendente</TableHead>
                    <TableHead>Situação</TableHead>
                    <TableHead className="w-[128px] text-right">
                      Ações
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pessoas.slice(0, gestaoListLimit(query.limite)).map((c) => {
                    const historico = extrato
                      .filter((i) => i.colaborador_id === c.id)
                      .sort(
                        (a, b) => b.data.localeCompare(a.data) || b.id - a.id,
                      );
                    return (
                      <TableRow key={c.id}>
                        <TableCell>
                          <div className="font-medium">{c.nome}</div>
                          <div className="text-xs text-muted-foreground">
                            {c.funcao}
                            {c.telefone ? ` · ${c.telefone}` : ""}
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {dinheiro(c.valor)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {dinheiro(saldos.get(c.id) ?? 0)}
                        </TableCell>
                        <TableCell>
                          <ListBadge
                            icon={c.ativo ? CircleCheck : CircleMinus}
                            tone={c.ativo ? "success" : "neutral"}
                          >
                            {c.ativo ? "Ativo" : "Inativo"}
                          </ListBadge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <ExtratoColaborador
                              colaborador={c}
                              historico={historico}
                              saldo={saldos.get(c.id) ?? 0}
                            />
                            <GestaoDialog
                              editing
                              key={`${c.id}-${c.versao}`}
                              title="Editar colaborador"
                              label={`Editar ${c.nome}`}
                            >
                              <ColaboradorForm
                                unidadeId={ctx.unidade!.id}
                                colaborador={c}
                              />
                            </GestaoDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <GestaoShowMore shown={Math.min(gestaoListLimit(query.limite), pessoas.length)} total={pessoas.length} />
          </>
        ) : (
          <Empty
            title={q ? "Nenhum resultado encontrado" : "Cadastre sua equipe"}
            description={
              q
                ? "Ajuste os termos da busca."
                : "Cadastre os colaboradores e o valor sugerido para o trabalho."
            }
          />
        )}
      </Panel>
    </GestaoShell>
  );
}
