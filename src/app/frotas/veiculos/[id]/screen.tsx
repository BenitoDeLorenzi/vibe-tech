import { ListMetrics } from "@/components/list-metrics";
import { VehicleOverview, VehicleOverviewHeader } from "./vehicle-overview";
import Link from "next/link";
import { forbidden, notFound } from "next/navigation";
import {
  ArrowLeft,
  Car,
  CircleAlert,
  CircleCheck,
  CircleDollarSign,
  CircleX,
  ClipboardCheck,
  LoaderCircle,
  FileText,
  Fuel,
  Paperclip,
  Pencil,
  Plus,
  ShieldAlert,
  Wrench,
} from "lucide-react";

import { AnexosList, AnexosManagerForm } from "@/app/frotas/anexos-manager-form";
import { DebitoManualForm } from "@/app/frotas/debito-manual-form";
import { FrotasShell } from "@/app/frotas/frotas-shell";
import { MultaManualForm } from "@/app/frotas/multa-manual-form";
import { VehicleRealtimeSync } from "@/app/frotas/veiculos/vehicle-realtime-sync";
import { VehicleLookupSync } from "@/app/frotas/veiculos/vehicle-lookup-sync";
import { VeiculoForm } from "@/app/frotas/veiculo-form";
import { VencimentoDataForm } from "@/app/frotas/vencimento-data-form";
import { VencimentoPagamentoForm } from "@/app/frotas/vencimento-pagamento-form";
import { requireUserProfile } from "@/lib/auth-data";
import {
  formatAbastecimentoStatus,
  formatFrotaDate,
  formatFrotaDaysRemaining,
  formatManutencaoStatus,
  formatVeiculoStatus,
  formatVencimentoTipo,
  getFrotasData,
  getVeiculoConsultaVeicularData,
  getVeiculoDebitosData,
  getVeiculoPlexiResumo,
  type AbastecimentoStatus,
  type FrotaDebitoVeicular,
  type FrotaMultaVeicular,
  type FrotaProcessoVeicular,
  type FrotaRecursoInfracao,
  type FrotaVeiculo,
  type FrotaVeiculoAbastecimento,
  type FrotaVeiculoManutencao,
  type FrotaVencimento,
  type PagamentoStatus,
  type VeiculoStatus,
} from "@/lib/frotas-data";
import { getFrotasPermissionAccess } from "@/lib/frotas-permissions";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function VeiculoGestaoPage({ params }: PageProps) {
  const profile = await requireUserProfile();
  const access = await getFrotasPermissionAccess(profile);
  if (!access.canViewVeiculos) forbidden();
  const { id } = await params;
  const data = await getFrotasData({ veiculoId: id });
  const veiculo = data.veiculos[0];

  if (!veiculo || (profile.role !== "bdl_admin" && veiculo.prefeitura_id !== profile.prefeitura_id)) {
    notFound();
  }
  const [debitosData, consultaVeicularData, plexiResumo] = await Promise.all([
    getVeiculoDebitosData(id), getVeiculoConsultaVeicularData(id), getVeiculoPlexiResumo(id),
  ]);

  const totalDebitos = data.vencimentos.length + debitosData.debitos.length;
  const title = "Gestão do veículo";

  return (
    <FrotasShell
      active="veiculos"
      actions={
        <div className="flex items-center justify-end gap-2">
          <Link
            href="/frotas/veiculos"
            className={buttonVariants({
              variant: "outline",
              className: "h-9 gap-2",
            })}
          >
            <ArrowLeft className="size-4" />
            Voltar
          </Link>
          {access.canUpdateVeiculos ? (
            <Dialog>
              <DialogTrigger
                className={buttonVariants({
                  className: "h-9 gap-2",
                })}
              >
                <Pencil className="size-4" />
                {veiculo.status === "processing" ? "Consulta em andamento" : veiculo.status === "consult_error" ? "Conferir cadastro" : "Editar"}
              </DialogTrigger>
              <DialogContent className="sm:max-w-4xl">
                <DialogHeader>
                  <DialogTitle>{veiculo.status === "consult_error" ? "Conferir cadastro do veículo" : "Editar veículo"}</DialogTitle>
                </DialogHeader>
                <VeiculoForm
                  prefeituras={data.prefeituras}

                  selectedPrefeituraId={veiculo.prefeitura_id}
                  showPrefeituraField={profile.role === "bdl_admin"}
                  veiculo={veiculo}
                />
              </DialogContent>
            </Dialog>
          ) : null}
        </div>
      }
      icon={Car}
      prefeituras={data.prefeituras}
      profile={profile}
      selectedPrefeituraId={veiculo.prefeitura_id}
      title={title}
    >
      <VehicleLookupSync prefeituraId={veiculo.prefeitura_id} vehicleIds={veiculo.status === "processing" ? [veiculo.id] : []} />
      <VehicleRealtimeSync
        prefeituraId={veiculo.prefeitura_id}
        vehicleId={veiculo.id}
      />
      <main className="flex flex-1 flex-col gap-3 p-4">
        <VehicleOverviewHeader canUpdate={access.canUpdateVeiculos} veiculo={veiculo} status={<VehicleStatusBadge status={veiculo.status} lookupStatus={veiculo.consulta_status} />} />

        <Tabs defaultValue="resumo" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="resumo">
              <Car className="size-4" />
              Resumo
            </TabsTrigger>
            <TabsTrigger value="debitos">
              <CircleDollarSign className="size-4" />
              Débitos
            </TabsTrigger>
            <TabsTrigger value="multas">
              <ShieldAlert className="size-4" />
              Multas
            </TabsTrigger>
            <TabsTrigger value="processos">
              <FileText className="size-4" />
              Processos
            </TabsTrigger>
            <TabsTrigger value="manutencoes">
              <Wrench className="size-4" />
              Manutenção
            </TabsTrigger>
            <TabsTrigger value="abastecimentos">
              <Fuel className="size-4" />
              Abastecimento
            </TabsTrigger>
            <TabsTrigger value="anexos">
              <Paperclip className="size-4" />
              Anexos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="resumo">
            <VehicleOverview veiculo={veiculo} consultation={plexiResumo ? {
              debtTotal: debitosData.debitos.reduce((sum, debt) => sum + Number(debt.amount), 0),
              debtCount: debitosData.debitos.length,
              fineTotal: plexiResumo.totalMultasPagar,
              fineHistory: plexiResumo.historicoMultas,
              consultedAt: plexiResumo.consultadoEm,
            } : null} />
          </TabsContent>

          <TabsContent value="debitos">
            <VehicleDebitsTab
              automaticDebts={debitosData.debitos}
              canManage={access.canManageVencimentos}
              manualDebts={data.vencimentos}
              totalDebitos={totalDebitos}
              veiculo={veiculo}
            />
            {plexiResumo?.dividaAtiva.length ? <Card className="mt-3"><CardHeader><CardTitle>IPVA em dívida ativa</CardTitle><CardDescription>Informações retornadas pelo Detran/SC.</CardDescription></CardHeader><CardContent className="space-y-3">
              {plexiResumo.dividaAtiva.map((debt, index) => <div key={index} className="rounded-lg border p-3 text-sm">{Object.entries(debt).filter(([, value]) => typeof value === "string" || typeof value === "number").map(([key, value]) => <div key={key} className="flex justify-between gap-4"><span className="text-muted-foreground">{key}</span><span>{String(value)}</span></div>)}</div>)}
            </CardContent></Card> : null}
          </TabsContent>

          <TabsContent value="multas">
            <VehicleFinesTab
              canManage={access.canManageVeiculos}
              multas={consultaVeicularData.multas}
              veiculo={veiculo}
            />
          </TabsContent>

          <TabsContent value="processos">
            <VehicleProcessesTab
              processos={consultaVeicularData.processos}
              recursos={consultaVeicularData.recursos}
            />
          </TabsContent>

          <TabsContent value="manutencoes">
            <VehicleMaintenanceHistory manutencoes={veiculo.manutencoes} />
          </TabsContent>

          <TabsContent value="abastecimentos">
            <VehicleFuelHistory abastecimentos={veiculo.abastecimentos} />
          </TabsContent>

          <TabsContent value="anexos">
            <Card>
              <CardHeader>
                <CardTitle>Anexos</CardTitle>
                <CardDescription>
                  Documentos vinculados ao veículo {veiculo.placa}.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {access.canUpdateVeiculos ? (
                  <AnexosManagerForm
                    anexos={veiculo.anexos}
                    ownerId={veiculo.id}
                    ownerLabel="veículo"
                    type="veiculo"
                    pdfDocument={plexiResumo?.temPdf ? { url: `/api/frotas/veiculos/${id}/documento-plexi`, downloadUrl: `/api/frotas/veiculos/${id}/documento-plexi?download=1`, createdAt: plexiResumo.consultadoEm } : undefined}
                  />
                ) : (
                  <AnexosList anexos={veiculo.anexos} pdfDocument={plexiResumo?.temPdf ? { url: `/api/frotas/veiculos/${id}/documento-plexi`, downloadUrl: `/api/frotas/veiculos/${id}/documento-plexi?download=1`, createdAt: plexiResumo.consultadoEm } : undefined} />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </FrotasShell>
  );
}

function VehicleDebitsTab({
  automaticDebts,
  canManage,
  manualDebts,
  totalDebitos,
  veiculo,
}: {
  automaticDebts: FrotaDebitoVeicular[];
  canManage: boolean;
  manualDebts: FrotaVencimento[];
  totalDebitos: number;
  veiculo: FrotaVeiculo;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Débitos</CardTitle>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ListMetrics items={[{ label: "Débitos", value: totalDebitos, tone: "info" }]} />
            {canManage ? (
              <Dialog>
                <DialogTrigger
                  className={buttonVariants({
                    className: "h-9 gap-2",
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {manualDebts.map((vencimento) => (
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
                      {vencimento.valor ? formatCurrency(vencimento.valor) : "-"}
                    </TableCell>
                    <TableCell>
                      <VencimentoSituationBadge
                        days={vencimento.dias_restantes}
                      />
                    </TableCell>
                    <TableCell>
                      <PaymentSummary vencimento={vencimento} />
                      <VencimentoActions
                        canManage={canManage}
                        vencimento={vencimento}
                      />
                    </TableCell>
                  </TableRow>
                ))}
                {automaticDebts.map((debito) => (
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
                      {debito.due_date ? formatExternalDate(debito.due_date) : "-"}
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
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="flex min-h-[240px] flex-col items-center justify-center rounded-lg border bg-muted/20 p-8 text-center">
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

function ExternalDebtStatusBadge({ debito }: { debito: FrotaDebitoVeicular }) {
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

function formatExternalDebtType(type: string | null) {
  const labels: Record<string, string> = {
    dpvat: "Seguro",
    ipva: "IPVA",
    licensing: "Licenciamento",
    ticket: "Multa",
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

function VehicleMaintenanceHistory({ manutencoes }: { manutencoes: FrotaVeiculoManutencao[] }) {
  return <Card><CardHeader><CardTitle>Histórico de manutenção</CardTitle></CardHeader><CardContent>
    <div className="overflow-hidden rounded-lg border"><Table><TableHeader><TableRow className="bg-muted/50">
      <TableHead>Entrada / saída</TableHead><TableHead>Serviço</TableHead><TableHead>Oficina / responsável</TableHead><TableHead>Quilometragem</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Valor</TableHead>
    </TableRow></TableHeader><TableBody>
      {manutencoes.length ? manutencoes.map((item) => <TableRow key={item.id}>
        <TableCell>{formatFrotaDate(item.data_entrada)}<div className="text-xs text-muted-foreground">{item.data_saida ? formatFrotaDate(item.data_saida) : "Em andamento"}</div></TableCell>
        <TableCell><div className="font-medium">{item.tipo}</div><div className="max-w-[360px] whitespace-normal text-xs text-muted-foreground">{item.descricao}</div>{item.observacoes ? <div className="text-xs text-muted-foreground">{item.observacoes}</div> : null}</TableCell>
        <TableCell>{item.oficina || "-"}<div className="text-xs text-muted-foreground">{item.responsavel || "-"}</div></TableCell>
        <TableCell>{formatMileage(item.quilometragem)}</TableCell><TableCell><MaintenanceStatusBadge status={item.status} /></TableCell>
        <TableCell className="text-right font-medium">{item.valor !== null ? formatCurrency(item.valor) : "-"}</TableCell>
      </TableRow>) : <TableRow><TableCell colSpan={6} className="h-28 text-center text-muted-foreground">Nenhuma manutenção registrada.</TableCell></TableRow>}
    </TableBody></Table></div>
  </CardContent></Card>;
}

function VehicleFuelHistory({ abastecimentos }: { abastecimentos: FrotaVeiculoAbastecimento[] }) {
  const totalGeral = abastecimentos.reduce((total, item) => total + getFuelOrderTotal(item), 0);
  const concluidas = abastecimentos.filter((item) => item.status === "completed").length;
  return <Card><CardHeader className="flex flex-wrap items-center justify-between gap-3"><CardTitle>Histórico de abastecimento</CardTitle><ListMetrics items={[
    { label: "Ordens", value: abastecimentos.length },
    { label: "Concluídas", value: concluidas, tone: "success" },
    { label: "Média", value: formatFuelAverage(calculateAverageFuelConsumption(abastecimentos)), icon: "gauge" },
    { label: "Total", value: formatCurrency(totalGeral), tone: "info", icon: "money" },
  ]} /></CardHeader><CardContent>
    <div className="overflow-hidden rounded-lg border"><Table><TableHeader><TableRow className="bg-muted/50">
      <TableHead>Ordem</TableHead><TableHead>Data</TableHead><TableHead>Posto / motorista</TableHead><TableHead>Quilometragem</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Total</TableHead>
    </TableRow></TableHeader><TableBody>
      {abastecimentos.length ? abastecimentos.map((item) => <TableRow key={item.id}>
        <TableCell className="font-medium">{item.numero_ordem}{item.numero_nota_fiscal ? <div className="text-xs font-normal text-muted-foreground">NF {item.numero_nota_fiscal}</div> : null}</TableCell>
        <TableCell>{formatFrotaDate(item.data_abastecimento)}</TableCell><TableCell>{item.posto_nome || "-"}<div className="text-xs text-muted-foreground">{item.motorista || "-"}</div></TableCell>
        <TableCell>{formatMileage(item.quilometragem)}</TableCell><TableCell><FuelStatusBadge status={item.status} />{item.arla_incluso ? <Badge variant="secondary" className="ml-2">ARLA</Badge> : null}</TableCell>
        <TableCell className="text-right font-medium">{formatCurrency(getFuelOrderTotal(item))}</TableCell>
      </TableRow>) : <TableRow><TableCell colSpan={6} className="h-28 text-center text-muted-foreground">Nenhum abastecimento registrado.</TableCell></TableRow>}
    </TableBody></Table></div>
  </CardContent></Card>;
}

function VehicleFinesTab({
  canManage,
  multas,
  veiculo,
}: {
  canManage: boolean;
  multas: FrotaMultaVeicular[];
  veiculo: FrotaVeiculo;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Multas</CardTitle>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ListMetrics items={[{ label: "Multas", value: multas.length, tone: "warning" }]} />
            {canManage ? (
              <Dialog>
                <DialogTrigger
                  className={buttonVariants({
                    className: "h-9 gap-2",
                  })}
                >
                  <Plus className="size-4" />
                  Nova multa
                </DialogTrigger>
                <DialogContent className="sm:max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Nova multa</DialogTitle>
                    <DialogDescription>
                      Cadastre manualmente uma multa de {veiculo.modelo} ·{" "}
                      {veiculo.placa}.
                    </DialogDescription>
                  </DialogHeader>
                  <MultaManualForm veiculoId={veiculo.id} />
                </DialogContent>
              </Dialog>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="pagar">
          <TabsList className="mb-3">
            <TabsTrigger value="pagar">A pagar ({multas.filter((fine) => fine.origem === "pagar").length})</TabsTrigger>
            <TabsTrigger value="historico">Histórico ({multas.filter((fine) => fine.origem === "historico").length})</TabsTrigger>
            <TabsTrigger value="manual">Manuais ({multas.filter((fine) => fine.origem === "manual").length})</TabsTrigger>
          </TabsList>
          {(["pagar", "historico", "manual"] as const).map((origin) => {
            const filtered = multas.filter((fine) => fine.origem === origin);
            return <TabsContent key={origin} value={origin}>
        {filtered.length ? (
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Auto</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((multa) => (
                  <TableRow key={multa.id}>
                    <TableCell className="font-medium">
                      {multa.numero_auto}
                    </TableCell>
                    <TableCell>
                      {multa.data_infracao
                        ? formatVehicleDate(multa.data_infracao)
                        : "-"}
                      {multa.hora ? (
                        <div className="text-xs text-muted-foreground">
                          {multa.hora}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[360px]">
                        <div className="whitespace-normal font-medium">
                          {multa.descricao ?? "Infração não informada"}
                        </div>
                        <div className="whitespace-normal text-xs text-muted-foreground">
                          {multa.local_complemento ?? "Local não informado"}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {multa.situacao ?? "Não informada"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(multa.valor)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="flex min-h-[240px] flex-col items-center justify-center rounded-lg border bg-muted/20 p-8 text-center">
            <ShieldAlert className="size-8 text-muted-foreground" />
            <h3 className="mt-3 text-base font-semibold">
              Nenhuma multa registrada
            </h3>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Nenhuma multa nesta visualização.
            </p>
          </div>
        )}
            </TabsContent>;
          })}
        </Tabs>
      </CardContent>
    </Card>
  );
}

function VehicleProcessesTab({ processos, recursos }: { processos: FrotaProcessoVeicular[]; recursos: FrotaRecursoInfracao[] }) {
  const services = processos.flatMap((process) => process.servicos.map((service, index) => ({ ...service, process: process.processo, key: process.id + "-" + index })));
  return <div className="space-y-3">
    <Card><CardHeader><CardTitle>Processos</CardTitle></CardHeader><CardContent><div className="overflow-hidden rounded-lg border"><Table><TableHeader><TableRow className="bg-muted/50">
      <TableHead>Processo</TableHead><TableHead>Início</TableHead><TableHead>Encerramento</TableHead><TableHead>Interessado</TableHead><TableHead>Situação</TableHead>
    </TableRow></TableHeader><TableBody>{processos.length ? processos.map((process) => <TableRow key={process.id}><TableCell className="font-medium">{process.processo || "-"}</TableCell><TableCell>{process.inicio_em || "-"}</TableCell><TableCell>{process.final_em || "-"}</TableCell><TableCell>{process.interessado || "-"}</TableCell><TableCell><Badge variant="outline">{process.situacao || "Não informada"}</Badge></TableCell></TableRow>) : <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">Nenhum processo registrado.</TableCell></TableRow>}</TableBody></Table></div></CardContent></Card>
    <Card><CardHeader><CardTitle>Recursos de infração</CardTitle></CardHeader><CardContent><div className="overflow-hidden rounded-lg border"><Table><TableHeader><TableRow className="bg-muted/50">
      <TableHead>Processo</TableHead><TableHead>Auto</TableHead><TableHead>Infração</TableHead><TableHead>Resultado</TableHead>
    </TableRow></TableHeader><TableBody>{recursos.length ? recursos.map((resource) => <TableRow key={resource.id}><TableCell className="max-w-[300px] whitespace-normal font-medium">{resource.processo || "-"}</TableCell><TableCell>{resource.numero_auto || "-"}</TableCell><TableCell className="max-w-[360px] whitespace-normal">{resource.detalhamento_infracao || "-"}</TableCell><TableCell><Badge variant="outline" className="whitespace-normal">{resource.resultado_processo || "Não informado"}</Badge></TableCell></TableRow>) : <TableRow><TableCell colSpan={4} className="h-24 text-center text-muted-foreground">Nenhum recurso registrado.</TableCell></TableRow>}</TableBody></Table></div></CardContent></Card>
    <Card><CardHeader><CardTitle>Serviços dos processos</CardTitle></CardHeader><CardContent><div className="overflow-hidden rounded-lg border"><Table><TableHeader><TableRow className="bg-muted/50"><TableHead>Processo</TableHead><TableHead>Serviço</TableHead><TableHead>Data</TableHead><TableHead>Hora</TableHead></TableRow></TableHeader><TableBody>{services.length ? services.map((service) => <TableRow key={service.key}><TableCell>{service.process || "-"}</TableCell><TableCell className="font-medium">{service.nome || "-"}</TableCell><TableCell>{service.data || "-"}</TableCell><TableCell>{service.hora || "-"}</TableCell></TableRow>) : <TableRow><TableCell colSpan={4} className="h-24 text-center text-muted-foreground">Nenhum serviço registrado.</TableCell></TableRow>}</TableBody></Table></div></CardContent></Card>
  </div>;
}

function VehicleStatusBadge({ status, lookupStatus }: { status: VeiculoStatus; lookupStatus?: string | null }) {
  const styles: Record<VeiculoStatus, string> = {
    active:
      "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50",
    inactive: "border-zinc-200 bg-zinc-100 text-zinc-700 hover:bg-zinc-100",
    maintenance:
      "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50",
    consult_error: lookupStatus === "error" ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-50" : "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50",
    processing: "border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-50",
  };
  const icons = {
    active: CircleCheck,
    consult_error: lookupStatus === "error" ? CircleX : ClipboardCheck,
    inactive: CircleX,
    maintenance: Wrench,
    processing: LoaderCircle,
  } satisfies Record<VeiculoStatus, typeof CircleCheck>;
  const Icon = icons[status];

  return (
    <Badge variant="outline" className={styles[status]}>
      <Icon className={status === "processing" ? "size-3.5 animate-spin" : "size-3.5"} />
      {status === "consult_error" && lookupStatus === "error" ? "Falha na consulta" : formatVeiculoStatus(status)}
    </Badge>
  );
}

function MaintenanceStatusBadge({
  status,
}: {
  status: FrotaVeiculoManutencao["status"];
}) {
  const styles: Record<FrotaVeiculoManutencao["status"], string> = {
    cancelled: "border-zinc-200 bg-zinc-100 text-zinc-700 hover:bg-zinc-100",
    completed:
      "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50",
    open: "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50",
  };

  return (
    <Badge variant="outline" className={styles[status]}>
      {formatManutencaoStatus(status)}
    </Badge>
  );
}

function FuelStatusBadge({ status }: { status: AbastecimentoStatus }) {
  const styles: Record<AbastecimentoStatus, string> = {
    cancelled: "border-zinc-200 bg-zinc-100 text-zinc-700 hover:bg-zinc-100",
    completed:
      "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50",
    expired: "border-red-200 bg-red-50 text-red-700 hover:bg-red-50",
    issued: "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50",
  };

  return (
    <Badge variant="outline" className={styles[status]}>
      {formatAbastecimentoStatus(status)}
    </Badge>
  );
}

function formatMileage(value: number | null) {
  if (value === null) {
    return "-";
  }

  return `${new Intl.NumberFormat("pt-BR").format(value)} km`;
}

function formatVehicleDate(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    currency: "BRL",
    style: "currency",
  }).format(value);
}

function formatFuelAverage(value: number | null) {
  if (value === null) {
    return "-";
  }

  return `${new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 2,
  }).format(value)} km/L`;
}

function calculateAverageFuelConsumption(
  abastecimentos: FrotaVeiculoAbastecimento[]
) {
  const completedOrders = abastecimentos
    .filter(
      (abastecimento) =>
        abastecimento.status === "completed" &&
        Boolean(abastecimento.quilometragem) &&
        Boolean(abastecimento.litros)
    )
    .sort((a, b) => {
      const aTime = new Date(a.completed_at ?? a.created_at).getTime();
      const bTime = new Date(b.completed_at ?? b.created_at).getTime();
      return aTime - bTime;
    });

  let totalDistance = 0;
  let totalLiters = 0;

  completedOrders.forEach((order, index) => {
    const previous = completedOrders[index - 1];

    if (!previous?.quilometragem || !order.quilometragem || !order.litros) {
      return;
    }

    const distance = order.quilometragem - previous.quilometragem;

    if (distance <= 0) {
      return;
    }

    totalDistance += distance;
    totalLiters += order.litros;
  });

  if (totalDistance <= 0 || totalLiters <= 0) {
    return null;
  }

  return Math.round((totalDistance / totalLiters) * 100) / 100;
}

function getFuelOrderTotal(abastecimento: FrotaVeiculoAbastecimento) {
  return (abastecimento.valor_total ?? 0) + (abastecimento.arla_valor_total ?? 0);
}
