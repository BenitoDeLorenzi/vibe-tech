import Link from "next/link";
import { forbidden, notFound } from "next/navigation";
import {
  ArrowLeft,
  CircleAlert,
  CircleCheck,
  CircleDollarSign,
  CircleX,
  Pencil,
  Plus,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  formatFrotaDate,
  formatFrotaDaysRemaining,
  formatVencimentoTipo,
  getFrotasData,
  getVeiculoDebitosData,
  type FrotaDebitoConsulta,
  type FrotaDebitoVeicular,
  type FrotaVencimento,
  type PagamentoStatus,
} from "@/lib/frotas-data";
import { requireUserProfile } from "@/lib/auth-data";
import { getFrotasPermissionAccess } from "@/lib/frotas-permissions";
import { DebitoManualForm } from "../../../debito-manual-form";
import { FrotasShell } from "../../../frotas-shell";
import { VencimentoDataForm } from "../../../vencimento-data-form";
import { VencimentoPagamentoForm } from "../../../vencimento-pagamento-form";
import { VencimentosToasts } from "../../../vencimentos-toasts";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    error?: string;
    renewed?: string;
    situacao?: string;
    tipo?: string;
  }>;
};

const tipoFilters = [
  { label: "Todos", tipo: undefined },
  { label: "IPVA", tipo: "ipva" },
  { label: "Licenciamento", tipo: "licenciamento" },
  { label: "Seguro", tipo: "seguro" },
];

const situacaoFilters = [
  { label: "Todos", situacao: undefined },
  { label: "Vencendo", situacao: "due-soon" },
  { label: "Vencidos", situacao: "expired" },
  { label: "Pagos", situacao: "paid" },
];

export default async function VeiculoDebitosPage({
  params,
  searchParams,
}: PageProps) {
  const profile = await requireUserProfile();
  const access = await getFrotasPermissionAccess(profile);
  if (!access.isFullAccess && !access.keys.includes("expirations.read") && !access.canManageVencimentos) forbidden();

  const routeParams = await params;
  const queryParams = await searchParams;
  const data = await getFrotasData({
    veiculoId: routeParams.id,
    vencimentoStatus: queryParams.situacao,
    vencimentoTipo: queryParams.tipo,
  });
  const debitosData = await getVeiculoDebitosData(routeParams.id);
  const veiculo = data.veiculos[0];

  if (!veiculo) {
    notFound();
  }

  const totalDebitos = data.vencimentos.length + debitosData.debitos.length;

  const buildFilterHref = (values: {
    situacao?: string | null;
    tipo?: string | null;
  }) => {
    const query = new URLSearchParams();
    const situacao = Object.hasOwn(values, "situacao")
      ? values.situacao
      : queryParams.situacao;
    const tipo = Object.hasOwn(values, "tipo")
      ? values.tipo
      : queryParams.tipo;

    if (situacao) {
      query.set("situacao", situacao);
    }

    if (tipo) {
      query.set("tipo", tipo);
    }

    const queryString = query.toString();
    return `/frotas/veiculos/${veiculo.id}/debitos${
      queryString ? `?${queryString}` : ""
    }`;
  };

  return (
    <FrotasShell
      active="veiculos"
      actions={
        <VeiculoDebitosToolbar
          buildFilterHref={buildFilterHref}
          canManage={access.canManageVencimentos}
          params={queryParams}
          veiculo={veiculo}
        />
      }
      icon={CircleDollarSign}
      prefeituras={data.prefeituras}
      profile={profile}
      selectedPrefeituraId={veiculo.prefeitura_id}
      title="Débitos"
    >
      <VencimentosToasts
        error={queryParams.error}
        renewed={queryParams.renewed}
      />
      <main className="flex flex-1 flex-col gap-3 p-4">
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <div>
                  <CardTitle>Débitos do veículo</CardTitle>
                  <CardDescription>
                    {veiculo.modelo} · {veiculo.marca} · {veiculo.placa}
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <LatestConsultBadge consulta={debitosData.consultas[0]} />
                <Badge variant="outline">{totalDebitos} débito(s)</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {totalDebitos ? (
              <div className="overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Débito</TableHead>
                      <TableHead>Data limite</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Situação</TableHead>
                      <TableHead>Pagamento</TableHead>
                      <TableHead>Origem</TableHead>
                      <TableHead className="w-[92px] text-right">
                        Ações
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.vencimentos.map((vencimento) => (
                      <TableRow key={vencimento.id}>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <div className="font-medium">
                              {formatVencimentoTipo(vencimento.tipo)}
                            </div>
                            <div className="max-w-[260px] truncate text-xs text-muted-foreground">
                              {vencimento.descricao ?? "Cadastro manual"}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {formatFrotaDate(vencimento.data_vencimento)}
                        </TableCell>
                        <TableCell className="font-medium">
                          {vencimento.valor
                            ? formatCurrency(vencimento.valor)
                            : "-"}
                        </TableCell>
                        <TableCell>
                          <VencimentoSituationBadge
                            days={vencimento.dias_restantes}
                          />
                        </TableCell>
                        <TableCell>
                          <PaymentSummary vencimento={vencimento} />
                        </TableCell>
                        <TableCell>
                          <DebtOriginBadge origem={vencimento.origem} />
                        </TableCell>
                        <TableCell>
                          <VencimentoActions
                            canManage={access.canManageVencimentos}
                            vencimento={vencimento}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                    {debitosData.debitos.map((debito) => (
                      <TableRow key={debito.id}>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <div className="font-medium">
                              {debito.title ?? "Débito veicular"}
                            </div>
                            <div className="max-w-[420px] whitespace-normal text-xs text-muted-foreground">
                              {formatExternalDebtType(debito.type)}
                              {debito.description ? ` · ${debito.description}` : ""}
                            </div>
                            {debito.year ? <div className="text-xs text-muted-foreground">Exercício {debito.year}</div> : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          {debito.due_date
                            ? formatExternalDate(debito.due_date)
                            : "-"}
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(debito.amount)}
                        </TableCell>
                        <TableCell>
                          <ExternalDebtStatusBadge debito={debito} />
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            Aguardando conciliação
                          </span>
                        </TableCell>
                        <TableCell>
                          <DebtOriginBadge origem={debito.provider ?? "api"} />
                        </TableCell>
                        <TableCell>
                          <div className="text-right text-xs text-muted-foreground">
                            Consulta
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex min-h-[260px] flex-col items-center justify-center rounded-lg border bg-muted/20 p-8 text-center">
                <CircleDollarSign className="size-8 text-muted-foreground" />
                <h3 className="mt-3 text-base font-semibold">
                  Nenhum débito encontrado
                </h3>
                <p className="mt-1 max-w-md text-sm text-muted-foreground">
                  Nenhum débito cadastrado para este veículo.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </FrotasShell>
  );
}

function LatestConsultBadge({
  consulta,
}: {
  consulta?: FrotaDebitoConsulta;
}) {
  if (!consulta) {
    return <Badge variant="outline">Sem consulta</Badge>;
  }

  const label = {
    disabled: "Desativada",
    error: "Erro",
    pending: "Pendente",
    processing: "Processando",
    success: "Concluída",
  }[consulta.status];

  return (
    <Badge
      variant={consulta.status === "error" ? "destructive" : "outline"}
      title={consulta.error_message ?? undefined}
    >
      {label}
    </Badge>
  );
}

function VeiculoDebitosToolbar({
  buildFilterHref,
  canManage,
  params,
  veiculo,
}: {
  buildFilterHref: (values: {
    situacao?: string | null;
    tipo?: string | null;
  }) => string;
  canManage: boolean;
  params: Awaited<PageProps["searchParams"]>;
  veiculo: Awaited<ReturnType<typeof getFrotasData>>["veiculos"][number];
}) {
  return (
    <div className="flex w-full min-w-0 items-center gap-2">
      <Link
        href="/frotas/veiculos"
        className={buttonVariants({
          variant: "outline",
          className: "mr-auto h-9 shrink-0 gap-2",
        })}
      >
        <ArrowLeft className="size-4" />
        Voltar
      </Link>

      <div className="hidden shrink-0 gap-1 rounded-lg bg-muted p-1 lg:flex">
        {tipoFilters.map((option) => {
          const isActive = option.tipo
            ? params.tipo === option.tipo
            : !params.tipo;

          return (
            <Link
              key={option.label}
              href={buildFilterHref({ tipo: option.tipo ?? null })}
              className={buttonVariants({
                variant: isActive ? "default" : "ghost",
                size: "sm",
                className: isActive
                  ? "h-7 shrink-0 px-2 text-xs shadow-sm"
                  : "h-7 shrink-0 px-2 text-xs text-muted-foreground",
              })}
            >
              {option.label}
            </Link>
          );
        })}
      </div>

      <div className="hidden shrink-0 gap-1 rounded-lg bg-muted p-1 xl:flex">
        {situacaoFilters.map((option) => {
          const isActive = option.situacao
            ? params.situacao === option.situacao
            : !params.situacao;

          return (
            <Link
              key={option.label}
              href={buildFilterHref({
                situacao: option.situacao ?? null,
              })}
              className={buttonVariants({
                variant: isActive ? "default" : "ghost",
                size: "sm",
                className: isActive
                  ? "h-7 shrink-0 px-2 text-xs shadow-sm"
                  : "h-7 shrink-0 px-2 text-xs text-muted-foreground",
              })}
            >
              {option.label}
            </Link>
          );
        })}
      </div>

      {canManage ? (
        <Dialog>
          <DialogTrigger
            className={buttonVariants({
              className: "h-9 shrink-0 gap-2",
            })}
          >
            <Plus className="size-4" />
            Novo débito
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Novo débito</DialogTitle>
              <DialogDescription>
                Cadastre manualmente um débito de {veiculo.modelo} ·{" "}
                {veiculo.placa}.
              </DialogDescription>
            </DialogHeader>
            <DebitoManualForm veiculoId={veiculo.id} />
          </DialogContent>
        </Dialog>
      ) : null}
      <Link
        href={`/frotas/veiculos/${veiculo.id}/debitos`}
        className="sr-only"
      >
        Limpar filtros
      </Link>
    </div>
  );
}

function VencimentoActions({
  canManage,
  vencimento,
}: {
  canManage: boolean;
  vencimento: FrotaVencimento;
}) {
  if (!canManage) {
    return (
      <div className="text-right text-xs text-muted-foreground">
        Somente leitura
      </div>
    );
  }

  return (
    <div className="flex justify-end gap-1">
      <Dialog>
        <Tooltip>
          <TooltipTrigger
            render={
              <DialogTrigger
                className={buttonVariants({
                  variant: "ghost",
                  size: "icon-sm",
                })}
                aria-label="Registrar pagamento"
              >
                <CircleDollarSign className="size-4" />
              </DialogTrigger>
            }
          />
          <TooltipContent>Registrar pagamento</TooltipContent>
        </Tooltip>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Registrar pagamento</DialogTitle>
            <DialogDescription>
              Informe valor, forma de pagamento e parcelas de{" "}
              {formatVencimentoTipo(vencimento.tipo)} do veículo{" "}
              {vencimento.placa}.
            </DialogDescription>
          </DialogHeader>
          <VencimentoPagamentoForm vencimento={vencimento} />
        </DialogContent>
      </Dialog>

      <Dialog>
        <Tooltip>
          <TooltipTrigger
            render={
              <DialogTrigger
                className={buttonVariants({
                  variant: "ghost",
                  size: "icon-sm",
                })}
                aria-label="Editar débito"
              >
                <Pencil className="size-4" />
              </DialogTrigger>
            }
          />
          <TooltipContent>Editar débito</TooltipContent>
        </Tooltip>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar débito</DialogTitle>
            <DialogDescription>
              Ajuste a data limite de {formatVencimentoTipo(vencimento.tipo)} do
              veículo {vencimento.placa}.
            </DialogDescription>
          </DialogHeader>
          <VencimentoDataForm vencimento={vencimento} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PaymentSummary({ vencimento }: { vencimento: FrotaVencimento }) {
  if (!vencimento.ultimo_pagamento) {
    return (
      <span className="text-sm text-muted-foreground">Ainda não pago</span>
    );
  }

  return (
    <div>
      <div className="font-medium">
        {formatFrotaDate(vencimento.ultimo_pagamento)}
      </div>
      <div className="mt-1 flex items-center gap-1.5">
        <PaymentStatusBadge status={vencimento.ultimo_pagamento_status} />
        {vencimento.ultimo_pagamento_valor ? (
          <span className="text-xs text-muted-foreground">
            {formatCurrency(vencimento.ultimo_pagamento_valor)}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function ExternalDebtStatusBadge({
  debito,
}: {
  debito: FrotaDebitoVeicular;
}) {
  if (debito.is_expired) {
    return (
      <Badge
        variant="outline"
        className="border-red-200 bg-red-100 text-red-700 hover:bg-red-100"
      >
        <CircleX className="size-3.5" />
        Vencido
      </Badge>
    );
  }

  if (debito.required) {
    return (
      <Badge
        variant="outline"
        className="border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50"
      >
        <CircleAlert className="size-3.5" />
        Obrigatório
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50"
    >
      <CircleCheck className="size-3.5" />
      Em aberto
    </Badge>
  );
}

function DebtOriginBadge({ origem }: { origem: string }) {
  const isAutomatic = origem === "api" || origem === "plexi";

  return (
    <Badge
      variant="outline"
      className={
        isAutomatic
          ? "border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-50"
          : "border-zinc-200 bg-zinc-100 text-zinc-700 hover:bg-zinc-100"
      }
    >
      {origem === "plexi" ? "Plexi" : isAutomatic ? "Importado" : "Manual"}
    </Badge>
  );
}

function formatExternalDebtType(type: string | null) {
  const labels: Record<string, string> = {
    licensing: "Licenciamento",
    ipva: "IPVA",
    ticket: "Multa",
    dpvat: "Seguro",
  };

  if (!type) {
    return "Débito";
  }

  return labels[type.toLowerCase()] ?? type;
}

function formatExternalDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC",
  }).format(new Date(value));
}

function VencimentoSituationBadge({ days }: { days: number }) {
  const className =
    days < 0
      ? "border-red-200 bg-red-600 text-white hover:bg-red-600"
      : days <= 7
        ? "border-red-200 bg-red-100 text-red-700 hover:bg-red-100"
        : days <= 15
          ? "border-orange-200 bg-orange-100 text-orange-700 hover:bg-orange-100"
          : days <= 30
            ? "border-yellow-200 bg-yellow-100 text-yellow-800 hover:bg-yellow-100"
            : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50";
  const Icon = days < 0 ? CircleX : days <= 30 ? CircleAlert : CircleCheck;

  return (
    <Badge variant="outline" className={className}>
      <Icon className="size-3.5" />
      {formatFrotaDaysRemaining(days)}
    </Badge>
  );
}

function PaymentStatusBadge({ status }: { status: PagamentoStatus | null }) {
  const label: Record<PagamentoStatus, string> = {
    paid: "Quitado",
    partial: "Parcial",
    pending: "Pendente",
  };
  const className: Record<PagamentoStatus, string> = {
    paid: "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50",
    partial: "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50",
    pending: "border-zinc-200 bg-zinc-100 text-zinc-700 hover:bg-zinc-100",
  };
  const normalizedStatus = status ?? "paid";

  return (
    <Badge variant="outline" className={className[normalizedStatus]}>
      {normalizedStatus === "paid" ? (
        <CircleCheck className="size-3.5" />
      ) : (
        <CircleAlert className="size-3.5" />
      )}
      {label[normalizedStatus]}
    </Badge>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    currency: "BRL",
    style: "currency",
  }).format(value);
}
