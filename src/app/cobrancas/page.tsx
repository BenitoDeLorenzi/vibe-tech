import Link from "next/link";
import { CircleDollarSign } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { ListPanelHeader } from "@/components/list-panel-header";
import { ListMetrics } from "@/components/list-metrics";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BillingFilters } from "./billing-filters";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireRole } from "@/lib/auth-data";
import {
  getLicencas,
  formatCurrency,
  formatDate,
  formatLicencaPagamentoStatus,
} from "@/lib/licencas-data";
import { todayInSaoPaulo } from "@/lib/license-schedule";
import { BillingActions } from "./billing-actions";
export const dynamic = "force-dynamic";
export default async function CobrancasPage({
  searchParams,
}: {
  searchParams: Promise<{
    mes?: string;
    q?: string;
    modulo?: string;
    status?: string;
    pagina?: string;
    error?: string;
  }>;
}) {
  const profile = await requireRole(["bdl_admin"]);
  const params = await searchParams;
  const today = todayInSaoPaulo();
  const mes = /^\d{4}-(0[1-9]|1[0-2])$/.test(params.mes ?? "")
    ? params.mes!
    : today.slice(0, 7);
  const licenses = await getLicencas();
  const modulos = [
    ...new Map(
      licenses.map((l) => [
        l.modulo_id,
        { value: l.modulo_id, label: l.modulo_nome },
      ]),
    ).values(),
  ];
  const query = (params.q ?? "").trim().toLocaleLowerCase("pt-BR");
  const all = licenses
    .filter(
      (l) =>
        (!params.modulo ||
          params.modulo === "all" ||
          l.modulo_id === params.modulo) &&
        (!query ||
          `${l.prefeitura_nome} ${l.prefeitura_cnpj}`
            .toLocaleLowerCase("pt-BR")
            .includes(query)),
    )
    .flatMap((l) =>
      l.pagamentos.map((p) => ({
        ...p,
        empresa: l.prefeitura_nome,
        modulo: l.modulo_nome,
      })),
    );
  const month = all.filter((p) => p.competencia.slice(0, 7) === mes);
  const saldo = (p: (typeof all)[number]) =>
    p.status === "cancelled"
      ? 0
      : Math.max(0, Number(p.valor) - Number(p.valor_pago ?? 0));
  const active = month.filter((p) => p.status !== "cancelled");
  const sum = (rows: typeof all, fn: (p: (typeof all)[number]) => number) =>
    rows.reduce((n, p) => n + fn(p), 0);
  const overdue = (p: (typeof all)[number]) =>
    saldo(p) > 0 && p.vencimento < today;
  const previous = all.filter((p) => p.competencia < `${mes}-01` && overdue(p));
  const cash = all
    .flatMap((p) => p.recebimentos ?? [])
    .filter((r) => !r.estornado_em && r.pago_em.slice(0, 7) === mes)
    .reduce((n, r) => n + Number(r.valor), 0);
  const filtered = (params.status === "previous" ? previous : month)
    .filter(
      (p) =>
        !params.status ||
        params.status === "all" ||
        params.status === "previous" ||
        (params.status === "overdue" ? overdue(p) : p.status === params.status),
    )
    .sort(
      (a, b) =>
        a.vencimento.localeCompare(b.vencimento) ||
        a.empresa.localeCompare(b.empresa),
    );
  const pages = Math.max(1, Math.ceil(filtered.length / 25));
  const page = Math.min(
    pages,
    Math.max(1, Number.parseInt(params.pagina ?? "1") || 1),
  );
  const rows = filtered.slice((page - 1) * 25, page * 25);
  const href = (num: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({
      ...params,
      pagina: String(num),
      mes,
    }))
      if (v && k !== "error") q.set(k, v);
    return `/cobrancas?${q}`;
  };
  return (
    <AdminShell
      active="cobrancas"
      icon={CircleDollarSign}
      profile={profile}
      title="Cobranças"
      actions={
        <BillingFilters
          key={JSON.stringify([mes, params.q, params.modulo, params.status])}
          mes={mes} currentMonth={today.slice(0, 7)} query={params.q ?? ""}
          modulo={params.modulo ?? "all"} status={params.status ?? "all"} modulos={modulos}
        />
      }
    >
      <main className="flex flex-1 flex-col gap-3 p-4 md:p-4">

        {params.error && (
          <p role="alert" className="text-sm text-destructive">
            {params.error}
          </p>
        )}
        <Card>
          <ListPanelHeader
            title={`Mensalidades · ${mes.split("-").reverse().join("/")}`}
            icon={CircleDollarSign}
            metrics={
              <ListMetrics
                items={[
                  {
                    label: "Cobrado",
                    value: formatCurrency(sum(active, (p) => Number(p.valor))),
                  },
                  {
                    label: "Recebido",
                    value: formatCurrency(
                      sum(active, (p) => Number(p.valor_pago ?? 0)),
                    ),
                    tone: "success",
                  },
                  {
                    label: "A vencer",
                    value: formatCurrency(
                      sum(
                        active.filter((p) => !overdue(p)),
                        saldo,
                      ),
                    ),
                  },
                  {
                    label: "Vencido",
                    value: formatCurrency(sum(active.filter(overdue), saldo)),
                    tone: "danger",
                  },
                ]}
              />
            }
          />
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Indicadores da competência selecionada, conforme empresa e módulo.
              Canceladas não entram no total. Atraso é calculado pela data de
              hoje.
            </p>
            <div className="flex flex-wrap gap-4 rounded-lg border bg-muted/30 p-3 text-sm">
              <span>
                Recebimentos em {mes.split("-").reverse().join("/")}:{" "}
                <strong>{formatCurrency(cash)}</strong>
              </span>
              <span>
                Saldo atrasado de competências anteriores:{" "}
                <strong>{formatCurrency(sum(previous, saldo))}</strong>
              </span>
            </div>
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Empresa / módulo</TableHead>
                    <TableHead>Competência</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Cobrado</TableHead>
                    <TableHead>Recebido</TableHead>
                    <TableHead>Saldo</TableHead>
                    <TableHead>Situação</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length ? (
                    rows.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>
                          <Link
                            href={`/empresas/${p.prefeitura_id}`}
                            className="font-medium hover:underline"
                          >
                            {p.empresa}
                          </Link>
                          <p className="text-xs text-muted-foreground">
                            {p.modulo}
                          </p>
                        </TableCell>
                        <TableCell>
                          {p.competencia
                            .slice(0, 7)
                            .split("-")
                            .reverse()
                            .join("/")}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {formatDate(p.vencimento)}
                        </TableCell>
                        <TableCell>{formatCurrency(p.valor)}</TableCell>
                        <TableCell>
                          {formatCurrency(Number(p.valor_pago ?? 0))}
                        </TableCell>
                        <TableCell>{formatCurrency(saldo(p))}</TableCell>
                        <TableCell>
                          <Badge
                            variant={overdue(p) ? "destructive" : "outline"}
                          >
                            {formatLicencaPagamentoStatus(p.status)}
                            {p.status === "partial" && overdue(p)
                              ? " · atrasada"
                              : ""}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <BillingActions pagamento={p} />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="h-40 text-center text-muted-foreground"
                      >
                        Nenhuma cobrança para os filtros selecionados.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {filtered.length} cobranças · Página {page} de {pages}
              </span>
              <div className="flex gap-2">
                {page > 1 && (
                  <Link
                    className={buttonVariants({
                      variant: "outline",
                      size: "sm",
                    })}
                    href={href(page - 1)}
                  >
                    Anterior
                  </Link>
                )}
                {page < pages && (
                  <Link
                    className={buttonVariants({
                      variant: "outline",
                      size: "sm",
                    })}
                    href={href(page + 1)}
                  >
                    Próxima
                  </Link>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </AdminShell>
  );
}
