import Link from "next/link";
import { forbidden, notFound } from "next/navigation";
import {
  ArrowLeft,
  FileText,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireUserProfile } from "@/lib/auth-data";
import {
  formatFrotaDate,
  formatManutencaoStatus,
  formatVencimentoTipo,
  formatVeiculoStatus,
  type FrotaAbastecimento,
  type FrotaManutencao,
  type FrotaVeiculo,
  type FrotaVencimento,
} from "@/lib/frotas-data";
import { getFrotasPermissionAccess } from "@/lib/frotas-permissions";
import {
  buildRelatorioDataSet,
  formatRelatorioStatus,
  formatRelatorioTipo,
  getRelatorio,
  type FrotaRelatorio,
  type RelatorioDataSet,
} from "@/lib/relatorios-data";
import { FrotasShell } from "../../frotas-shell";
import {
  RelatorioAutoPrint,
  RelatorioPrintButton,
} from "../relatorio-print-controls";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ print?: string }>;
};

export default async function RelatorioDetailsPage({
  params,
  searchParams,
}: PageProps) {
  const profile = await requireUserProfile();
  const access = await getFrotasPermissionAccess(profile);

  if (!access.canViewRelatorios) {
    forbidden();
  }

  const [{ id }, query] = await Promise.all([params, searchParams]);
  const autoPrint = query.print === "1";
  let relatorio: FrotaRelatorio;
  let dataSet: RelatorioDataSet;

  try {
    relatorio = await getRelatorio(id);
    dataSet = await buildRelatorioDataSet(relatorio);
  } catch {
    notFound();
  }

  return (
    <FrotasShell
      active="relatorios"
      actions={
        <div className="flex items-center gap-2 print:hidden">
          <Link
            className={buttonVariants({
              className: "h-9 gap-2",
              variant: "outline",
            })}
            href="/frotas/relatorios"
          >
            <ArrowLeft className="size-4" />
            Voltar
          </Link>
          <RelatorioPrintButton />
        </div>
      }
      icon={FileText}
      prefeituras={[
        {
          brasao_url: relatorio.prefeitura_brasao_url,
          id: relatorio.prefeitura_id,
          nome: relatorio.prefeitura_nome,
        },
      ]}
      profile={profile}
      selectedPrefeituraId={relatorio.prefeitura_id}
      title="Relatório"
    >
      <main
        data-report-print-document
        className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 p-4 print:max-w-none print:gap-2 print:p-0 print:text-[9px]"
      >
        <RelatorioAutoPrint enabled={autoPrint} />

        <Card className="print:rounded-none print:border-0 print:ring-0">
          <CardHeader className="border-b print:pb-2 print:px-0">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-center gap-4">
                {relatorio.prefeitura_brasao_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    alt={`Logo de ${relatorio.prefeitura_nome}`}
                    className="size-16 rounded-lg border object-contain p-1 print:size-11"
                    src={relatorio.prefeitura_brasao_url}
                  />
                ) : (
                  <div className="flex size-16 items-center justify-center rounded-lg border bg-muted print:size-11">
                    <FileText className="size-7 text-muted-foreground" />
                  </div>
                )}
                <div className="min-w-0">
                  <div className="text-sm text-muted-foreground">
                    {relatorio.prefeitura_nome}
                  </div>
                  <CardTitle className="mt-1 text-2xl print:text-base">
                    {relatorio.titulo}
                  </CardTitle>
                  <div className="mt-2 flex flex-wrap gap-2 print:mt-1 print:gap-1">
                    <Badge variant="outline">
                      {formatRelatorioTipo(relatorio.tipo)}
                    </Badge>
                    <Badge variant="secondary">
                      {formatRelatorioStatus(relatorio.status)}
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="min-w-48 text-right text-sm text-muted-foreground print:min-w-36">
                <div className="mb-3 rounded-lg border bg-muted/40 px-3 py-2 text-center print:mb-2 print:bg-white print:px-2 print:py-1.5">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground print:text-[7px]">
                    Período
                  </div>
                  <div className="text-base font-semibold text-foreground print:text-[10px]">
                    {formatReportPeriod(relatorio)}
                  </div>
                </div>
                <div>Gerado em</div>
                <div className="font-medium text-foreground">
                  {formatDateTime(relatorio.created_at)}
                </div>
                <div className="mt-2">Criado por</div>
                <div className="font-medium text-foreground">
                  {relatorio.criado_por ?? "-"}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 py-4 print:space-y-2 print:py-2 print:px-0">
            <div className="grid gap-3 sm:grid-cols-3 print:gap-2">
              <MetricTile
                label="Registros"
                value={String(dataSet.items.length)}
              />
              <MetricTile
                label="Valor total"
                value={formatCurrency(dataSet.valorTotal)}
              />
              <MetricTile
                label="Tipo"
                value={formatRelatorioTipo(relatorio.tipo)}
              />
            </div>

            <RelatorioTable dataSet={dataSet} />

            <div className="grid gap-8 pt-10 sm:grid-cols-2 print:gap-6 print:pt-8">
              <SignatureLine label="Responsável pela emissão" />
              <SignatureLine label="Setor responsável" />
            </div>
          </CardContent>
        </Card>
      </main>
    </FrotasShell>
  );
}

function RelatorioTable({ dataSet }: { dataSet: RelatorioDataSet }) {
  if (!dataSet.items.length) {
    return (
      <div className="flex min-h-36 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
        Nenhum registro encontrado para os filtros deste relatório.
      </div>
    );
  }

  if (dataSet.tipo === "fuel") {
    return <FuelTable items={dataSet.items} />;
  }

  if (dataSet.tipo === "maintenance") {
    return <MaintenanceTable items={dataSet.items} />;
  }

  if (dataSet.tipo === "expirations") {
    return <ExpirationsTable items={dataSet.items} />;
  }

  return <VehiclesTable items={dataSet.items} />;
}

function FuelTable({ items }: { items: FrotaAbastecimento[] }) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead>Ordem</TableHead>
            <TableHead>Data</TableHead>
            <TableHead>Veículo</TableHead>
            <TableHead>Motorista</TableHead>
            <TableHead>Posto</TableHead>
            <TableHead>NF</TableHead>
            <TableHead className="text-right">Litros</TableHead>
            <TableHead className="text-right">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell>{item.numero_ordem}</TableCell>
              <TableCell>{formatFrotaDate(item.data_abastecimento)}</TableCell>
              <TableCell>
                {item.modelo} · {item.placa}
              </TableCell>
              <TableCell>{item.motorista || "-"}</TableCell>
              <TableCell>{item.posto_nome || "-"}</TableCell>
              <TableCell>{item.numero_nota_fiscal || "-"}</TableCell>
              <TableCell className="text-right">
                {formatLiters((item.litros ?? 0) + (item.arla_litros ?? 0))}
              </TableCell>
              <TableCell className="text-right">
                {formatCurrency(getFuelOrderTotal(item))}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function MaintenanceTable({ items }: { items: FrotaManutencao[] }) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead>Veículo</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Descrição</TableHead>
            <TableHead>Entrada</TableHead>
            <TableHead>Saída</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Valor</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell>
                {item.modelo} · {item.placa}
              </TableCell>
              <TableCell>{item.tipo}</TableCell>
              <TableCell>{item.descricao}</TableCell>
              <TableCell>{formatFrotaDate(item.data_entrada)}</TableCell>
              <TableCell>
                {item.data_saida ? formatFrotaDate(item.data_saida) : "-"}
              </TableCell>
              <TableCell>{formatManutencaoStatus(item.status)}</TableCell>
              <TableCell className="text-right">
                {formatCurrency(item.valor ?? 0)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function VehiclesTable({ items }: { items: FrotaVeiculo[] }) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead>Veículo</TableHead>
            <TableHead>Placa</TableHead>
            <TableHead>Renavam</TableHead>
            <TableHead>Combustível</TableHead>
            <TableHead>Km</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell>
                {item.modelo} · {item.marca} · {item.ano}
              </TableCell>
              <TableCell>{item.placa}</TableCell>
              <TableCell>{item.renavam ?? "-"}</TableCell>
              <TableCell>{item.combustivel ?? "-"}</TableCell>
              <TableCell>{formatNumber(item.quilometragem ?? 0)}</TableCell>
              <TableCell>{formatVeiculoStatus(item.status)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ExpirationsTable({ items }: { items: FrotaVencimento[] }) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead>Veículo</TableHead>
            <TableHead>Placa</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Data do débito</TableHead>
            <TableHead>Situação</TableHead>
            <TableHead>Pagamentos</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell>{item.modelo}</TableCell>
              <TableCell>{item.placa}</TableCell>
              <TableCell>{formatVencimentoTipo(item.tipo)}</TableCell>
              <TableCell>{formatFrotaDate(item.data_vencimento)}</TableCell>
              <TableCell>
                {item.dias_restantes < 0
                  ? `Vencido há ${Math.abs(item.dias_restantes)} dia(s)`
                  : `Vence em ${item.dias_restantes} dia(s)`}
              </TableCell>
              <TableCell>{item.total_pagamentos}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 px-3 py-2">
      <div className="text-lg font-semibold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function SignatureLine({ label }: { label: string }) {
  return (
    <div className="pt-10 text-center text-sm">
      <div className="border-t border-foreground/40 pt-2">{label}</div>
    </div>
  );
}

function formatReportPeriod(relatorio: FrotaRelatorio) {
  if (!relatorio.periodo_inicio || !relatorio.periodo_fim) {
    return "Atual";
  }

  return `${formatDate(relatorio.periodo_inicio)} - ${formatDate(
    relatorio.periodo_fim
  )}`;
}

function getFuelOrderTotal(item: FrotaAbastecimento) {
  return (item.valor_total ?? 0) + (item.arla_valor_total ?? 0);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    currency: "BRL",
    style: "currency",
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatLiters(value: number) {
  return `${new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 2,
  }).format(value)} L`;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}
