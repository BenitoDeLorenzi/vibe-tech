import { ListPanelHeader } from "@/components/list-panel-header";
import { ListMetrics } from "@/components/list-metrics";
import { UsuarioStatusBadge } from "@/components/usuario-status-badge";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Ban,
  Building2,
  CalendarDays,
  CircleCheck,
  CircleDollarSign,
  CircleX,
  Clock3,
  FileClock,
  KeyRound,
  Layers3,
  Pencil,
  Plus,
  RotateCcw,
  Users,
} from "lucide-react";

import { AdminShell } from "@/components/admin-shell";
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
import { LicencaForm } from "@/app/licencas/licenca-form";
import { BillingActions } from "@/app/cobrancas/billing-actions";
import { LicencaRenewForm } from "@/app/licencas/licenca-renew-form";
import {
  formatCurrency,
  formatDate,
  formatDaysRemaining,
  formatLicencaPagamentoStatus,
  formatLicencaStatus,
  getLicencaFormOptions,
  getLicencas,
  type Licenca,
  type LicencaPagamento,
  type LicencaPagamentoStatus,
  type LicencaStatus,
  type LicencaVigenciaStatus,
} from "@/lib/licencas-data";
import {
  formatPrefeituraStatus,
  getPrefeituras,
  type Prefeitura,
  type PrefeituraStatus,
} from "@/lib/prefeituras-data";
import {
  formatCpf,
  formatUsuarioRole,
  getUsuarios,
  type Usuario,
  type UsuarioRole,
} from "@/lib/usuarios-data";
import { requireRole } from "@/lib/auth-data";
import { PrefeituraForm } from "../prefeitura-form";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function PrefeituraDetailsPage({ params }: PageProps) {
  const profile = await requireRole(["bdl_admin"]);
  const { id } = await params;
  const [prefeituras, licencas, usuarios, formOptions] = await Promise.all([
    getPrefeituras(),
    getLicencas(),
    getUsuarios({ prefeituraId: id }),
    getLicencaFormOptions(),
  ]);
  const prefeitura = prefeituras.find((item) => item.id === id);

  if (!prefeitura) {
    notFound();
  }

  const prefeituraLicencas = licencas.filter(
    (licenca) => licenca.prefeitura_id === prefeitura.id,
  );
  const modulos = buildModuloResumo(prefeituraLicencas);
  const receitaAnual = prefeituraLicencas
    .filter((licenca) => licenca.status === "active")
    .reduce((total, licenca) => total + licenca.pagamentos.filter(p => p.contrato_id === licenca.contrato.id && p.status !== "cancelled").reduce((n,p)=>n+Number(p.valor),0), 0);
  const pagamentos = prefeituraLicencas.flatMap((licenca) =>
    licenca.pagamentos.map((pagamento) => ({
      ...pagamento,
      modulo_nome: licenca.modulo_nome,
    })),
  );
  const receitaMensal = prefeituraLicencas
    .filter((licenca) => licenca.status === "active")
    .reduce((total, licenca) => total + Number(licenca.valor_mensal ?? 0), 0);
  const title = formatPrefeituraName(prefeitura.nome);

  return (
    <AdminShell
      active="empresas"
      actions={
        <div className="flex items-center justify-end gap-2">
          <Link
            href="/empresas"
            className={buttonVariants({
              variant: "outline",
              className: "h-9 gap-2",
            })}
          >
            <ArrowLeft className="size-4" />
            Voltar
          </Link>
          <Dialog>
            <DialogTrigger
              className={buttonVariants({
                className: "h-9 gap-2",
              })}
            >
              <Pencil className="size-4" />
              Editar
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>Editar empresa</DialogTitle>
              </DialogHeader>
              <PrefeituraForm prefeitura={prefeitura} />
            </DialogContent>
          </Dialog>
        </div>
      }
      icon={Building2}
      profile={profile}
      title={title}
    >
      <main className="flex flex-1 flex-col gap-3 p-4">
        <PrefeituraHero
          licencas={prefeituraLicencas}
          prefeitura={prefeitura}
          receitaAnual={receitaAnual}
          receitaMensal={receitaMensal}
          usuarios={usuarios}
        />

        <Tabs defaultValue="resumo" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="resumo">
              <Building2 className="size-4" />
              Resumo
            </TabsTrigger>
            <TabsTrigger value="licencas">
              <KeyRound className="size-4" />
              Licenças
            </TabsTrigger>
            <TabsTrigger value="modulos">
              <Layers3 className="size-4" />
              Módulos
            </TabsTrigger>
            <TabsTrigger value="usuarios">
              <Users className="size-4" />
              Usuários
            </TabsTrigger>
            <TabsTrigger value="financeiro">
              <CircleDollarSign className="size-4" />
              Financeiro
            </TabsTrigger>
            <TabsTrigger value="auditoria">
              <FileClock className="size-4" />
              Auditoria
            </TabsTrigger>
          </TabsList>

          <TabsContent value="resumo">
            <PrefeituraSummary prefeitura={prefeitura} />
          </TabsContent>

          <TabsContent value="licencas">
            <LicencasTab
              formOptions={formOptions}
              licencas={prefeituraLicencas}
              prefeitura={prefeitura}
            />
          </TabsContent>

          <TabsContent value="modulos">
            <ModulosTab modulos={modulos} />
          </TabsContent>

          <TabsContent value="usuarios">
            <UsuariosTab usuarios={usuarios} />
          </TabsContent>

          <TabsContent value="financeiro">
            <FinanceiroTab pagamentos={pagamentos} />
          </TabsContent>

          <TabsContent value="auditoria">
            <EmptyTab
              description="O histórico de alterações críticas da empresa será registrado aqui quando a auditoria for implantada."
              icon={FileClock}
              title="Auditoria em preparação"
            />
          </TabsContent>
        </Tabs>
      </main>
    </AdminShell>
  );
}

function PrefeituraHero({
  licencas,
  prefeitura,
  receitaAnual,
  receitaMensal,
  usuarios,
}: {
  licencas: Licenca[];
  prefeitura: Prefeitura;
  receitaAnual: number;
  receitaMensal: number;
  usuarios: Usuario[];
}) {
  const activeLicencas = licencas.filter(
    (licenca) => licenca.status === "active",
  );

  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted/30">
              {prefeitura.brasao_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={prefeitura.brasao_url}
                  alt={`Logotipo de ${prefeitura.nome}`}
                  className="size-full object-contain p-1.5"
                />
              ) : (
                <Building2 className="size-9 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-xl font-semibold">
                  {prefeitura.nome}
                </h2>
                <PrefeituraStatusBadge status={prefeitura.status} />
              </div>
              <div className="text-sm text-muted-foreground">
                {prefeitura.cidade ?? "-"} / {prefeitura.uf ?? "-"} ·{" "}
                {prefeitura.cnpj}
              </div>
              <div className="flex flex-wrap gap-2">
                {activeLicencas.map((licenca) => (
                  <Badge key={licenca.id} variant="outline">
                    {licenca.modulo_nome}
                  </Badge>
                ))}
                {!activeLicencas.length ? (
                  <Badge variant="outline">Sem licença ativa</Badge>
                ) : null}
              </div>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:w-[430px]">
            <MetricTile
              label="Licenças ativas"
              value={String(activeLicencas.length)}
            />
            <MetricTile label="Usuários" value={String(usuarios.length)} />
            <MetricTile
              label="Mensal previsto"
              value={formatCurrency(receitaMensal)}
            />
            <MetricTile
              label="Total contratado"
              value={formatCurrency(receitaAnual)}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PrefeituraSummary({ prefeitura }: { prefeitura: Prefeitura }) {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Cadastro</CardTitle>
          <CardDescription>Dados principais da empresa.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          <CompactDetail label="Nome" value={prefeitura.nome} />
          <CompactDetail label="Nome fantasia" value={prefeitura.nome_fantasia ?? "Não informado"} />
          <CompactDetail label="CNPJ" value={prefeitura.cnpj} />
          <CompactDetail label="Cidade" value={prefeitura.cidade ?? "-"} />
          <CompactDetail label="UF" value={prefeitura.uf ?? "-"} />
          <CompactDetail label="CEP" value={prefeitura.cep ?? "-"} />
          <CompactDetail
            label="Status"
            value={formatPrefeituraStatus(prefeitura.status)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Endereço e identidade</CardTitle>
          <CardDescription>
            Informações usadas no portal e impressões.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          <CompactDetail label="Endereço" value={prefeitura.endereco ?? "-"} />
          <CompactDetail
            label="Brasão"
            value={prefeitura.brasao_url ? "Cadastrado" : "Pendente"}
          />
          <CompactDetail
            label="Criada em"
            value={new Intl.DateTimeFormat("pt-BR").format(
              new Date(prefeitura.created_at),
            )}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function LicencasTab({
  formOptions,
  licencas,
  prefeitura,
}: {
  formOptions: Awaited<ReturnType<typeof getLicencaFormOptions>>;
  licencas: Licenca[];
  prefeitura: Prefeitura;
}) {
  return (
    <Card>
      <ListPanelHeader title="Licenças" icon={KeyRound} metrics={<>
        <ListMetrics items={[{ label: "Total", value: licencas.length }]} />
        <Dialog>
            <DialogTrigger
              className={buttonVariants({
                className: "h-9 gap-2",
              })}
            >
              <Plus className="size-4" />
              Nova licença
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Nova licença</DialogTitle>
              </DialogHeader>
              <LicencaForm
                defaultFim={addOneYearIsoDate(getTodayIsoDate())}
                defaultInicio={getTodayIsoDate()}
                defaultPrefeituraId={prefeitura.id}
                modulos={formOptions.modulos}
                prefeituras={formOptions.prefeituras}
              />
            </DialogContent>
          </Dialog>
      </>} />
      <CardContent>
        {licencas.length ? (
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Módulo</TableHead>
                  <TableHead>Vigência</TableHead>
                  <TableHead>Cobrança</TableHead>
                  <TableHead>Parcelas</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[92px] text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {licencas.map((licenca) => (
                  <TableRow key={licenca.id}>
                    <TableCell>
                      <div className="font-medium">{licenca.modulo_nome}</div>
                      <div className="text-xs text-muted-foreground">
                        {licenca.modulo_subdominio}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm">
                          <CalendarDays className="size-4 text-muted-foreground" />
                          {formatDate(licenca.inicio)} até{" "}
                          {formatDate(licenca.fim)}
                        </div>
                        <LicencaVigenciaBadge
                          diasRestantes={licenca.dias_restantes}
                          status={licenca.vigencia_status}
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">
                        {formatCurrency(licenca.valor_mensal)}/mês
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Mensalidade integral por período contratado
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="outline">
                          {licenca.parcelas_pagas} pagas
                        </Badge>
                        <Badge variant="outline">
                          {licenca.parcelas_abertas} abertas
                        </Badge>
                        {licenca.parcelas_vencidas ? (
                          <Badge
                            className="border-red-200 bg-red-50 text-red-700 hover:bg-red-50"
                            variant="outline"
                          >
                            {licenca.parcelas_vencidas} vencidas
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <LicencaStatusBadge status={licenca.status} />
                    </TableCell>
                    <TableCell>
                      <LicencaActions licenca={licenca} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <EmptyTab
            description={`Cadastre a primeira licença para liberar um módulo para ${prefeitura.nome}.`}
            icon={KeyRound}
            title="Nenhuma licença cadastrada"
          />
        )}
      </CardContent>
    </Card>
  );
}

function LicencaActions({ licenca }: { licenca: Licenca }) {
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
                aria-label="Renovar licença"
              >
                <RotateCcw className="size-4" />
              </DialogTrigger>
            }
          />
          <TooltipContent>Renovar licença</TooltipContent>
        </Tooltip>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Renovar licença</DialogTitle>
            <DialogDescription>
              Defina um novo período e suas mensalidades para{" "}
              {licenca.modulo_nome}.
            </DialogDescription>
          </DialogHeader>
          <LicencaRenewForm licenca={licenca} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ModulosTab({
  modulos,
}: {
  modulos: Array<{
    licencas: number;
    nome: string;
    receita: number;
    subdominio: string;
  }>;
}) {
  if (!modulos.length) {
    return (
      <EmptyTab
        description="Os módulos aparecem aqui conforme as licenças forem cadastradas."
        icon={Layers3}
        title="Nenhum módulo contratado"
      />
    );
  }

  return (
    <Card>
      <ListPanelHeader title="Módulos" icon={Layers3} metrics={<ListMetrics items={[{ label: "Total", value: modulos.length }]} />} />
      <CardContent>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {modulos.map((modulo) => (
            <div key={modulo.nome} className="rounded-lg border p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-medium">{modulo.nome}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {modulo.subdominio}
                  </div>
                </div>
                <Badge variant="outline">{modulo.licencas} licença(s)</Badge>
              </div>
              <div className="mt-3">
                <MetricTile
                  label="Contratos atuais"
                  value={formatCurrency(modulo.receita)}
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function UsuariosTab({ usuarios }: { usuarios: Usuario[] }) {
  if (!usuarios.length) {
    return (
      <EmptyTab
        description="Cadastre usuários das empresas para liberar o acesso aos módulos."
        icon={Users}
        title="Nenhum usuário vinculado"
      />
    );
  }

  return (
    <Card>
      <ListPanelHeader title="Usuários" icon={Users} metrics={<ListMetrics items={[{ label: "Total", value: usuarios.length }]} />} />
      <CardContent>
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Usuário</TableHead>
                <TableHead>Acesso</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Criado em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usuarios.map((usuario) => (
                <TableRow key={usuario.id}>
                  <TableCell>
                    <div className="font-medium">{usuario.nome}</div>
                    <div className="text-xs text-muted-foreground">
                      CPF {formatCpf(usuario.cpf)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <UsuarioRoleBadge role={usuario.role} />
                  </TableCell>
                  <TableCell>
                    <UsuarioStatusBadge usuario={usuario} />
                  </TableCell>
                  <TableCell>
                    {new Intl.DateTimeFormat("pt-BR").format(
                      new Date(usuario.created_at),
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function FinanceiroTab({
  pagamentos,
}: {
  pagamentos: Array<LicencaPagamento & { modulo_nome: string }>;
}) {
  const pagamentosOrdenados = [...pagamentos].sort((a, b) =>
    a.vencimento.localeCompare(b.vencimento),
  );

  return (
    <Card>
      <ListPanelHeader title="Parcelas mensais" icon={CircleDollarSign} metrics={<ListMetrics items={[{ label: "Total", value: pagamentosOrdenados.length }]} />} />
      <CardContent>
        {pagamentosOrdenados.length ? (
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Parcela</TableHead>
                  <TableHead>Módulo</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Pagamento</TableHead>
                  <TableHead className="w-[112px] text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagamentosOrdenados.map((pagamento) => (
                  <TableRow key={pagamento.id}>
                    <TableCell className="font-medium">
                      {pagamento.numero_parcela}
                    </TableCell>
                    <TableCell>{pagamento.modulo_nome}</TableCell>
                    <TableCell>{formatDate(pagamento.vencimento)}</TableCell>
                    <TableCell>{formatCurrency(pagamento.valor)}</TableCell>
                    <TableCell>
                      <PagamentoStatusBadge status={pagamento.status} />
                    </TableCell>
                    <TableCell>
                      {pagamento.pago_em ? (
                        <div className="flex min-w-[260px] flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                          <span>{formatDate(pagamento.pago_em)}</span>
                          <span className="font-medium">
                            {formatCurrency(pagamento.valor_pago)}
                          </span>
                          {pagamento.forma_pagamento ? (
                            <Badge
                              variant="outline"
                              className="h-6 font-normal"
                            >
                              {formatPaymentMethod(pagamento.forma_pagamento)}
                            </Badge>
                          ) : null}
                          {pagamento.documento ? (
                            <span className="text-xs text-muted-foreground">
                              {pagamento.documento}
                            </span>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          Pendente
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <BillingActions pagamento={pagamento} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <EmptyTab
            description="As parcelas serão geradas automaticamente ao criar ou atualizar uma licença."
            icon={CircleDollarSign}
            title="Nenhuma parcela gerada"
          />
        )}
      </CardContent>
    </Card>
  );
}

function EmptyTab({
  description,
  icon: Icon,
  title,
}: {
  description: string;
  icon: typeof Building2;
  title: string;
}) {
  return (
    <Card>
      <CardContent className="flex min-h-[260px] flex-col items-center justify-center p-8 text-center">
        <div className="flex size-12 items-center justify-center rounded-lg border bg-muted/30">
          <Icon className="size-6 text-muted-foreground" />
        </div>
        <h3 className="mt-4 text-base font-semibold">{title}</h3>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          {description}
        </p>
      </CardContent>
    </Card>
  );
}

function CompactDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md bg-muted/35 px-2.5 py-1.5 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate text-right font-medium">{value}</span>
    </div>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-background px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="truncate text-base font-semibold leading-tight">
        {value}
      </div>
    </div>
  );
}

function PrefeituraStatusBadge({ status }: { status: PrefeituraStatus }) {
  const styles: Record<PrefeituraStatus, string> = {
    active:
      "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50",
    cancelled: "border-zinc-200 bg-zinc-100 text-zinc-700 hover:bg-zinc-100",
    expired: "border-red-200 bg-red-50 text-red-700 hover:bg-red-50",
    suspended: "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50",
  };
  const icons = {
    active: CircleCheck,
    cancelled: Ban,
    expired: Clock3,
    suspended: Clock3,
  } satisfies Record<PrefeituraStatus, typeof CircleCheck>;
  const Icon = icons[status];

  return (
    <Badge variant="outline" className={styles[status]}>
      <Icon className="size-3.5" />
      {formatPrefeituraStatus(status)}
    </Badge>
  );
}

function LicencaStatusBadge({ status }: { status: LicencaStatus }) {
  const styles: Record<LicencaStatus, string> = {
    active:
      "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50",
    cancelled: "border-zinc-200 bg-zinc-100 text-zinc-700 hover:bg-zinc-100",
    expired: "border-red-200 bg-red-50 text-red-700 hover:bg-red-50",
    suspended: "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50",
  };
  const icons = {
    active: CircleCheck,
    cancelled: CircleX,
    expired: Clock3,
    suspended: Clock3,
  } satisfies Record<LicencaStatus, typeof CircleCheck>;
  const Icon = icons[status];

  return (
    <Badge variant="outline" className={styles[status]}>
      <Icon className="size-3.5" />
      {formatLicencaStatus(status)}
    </Badge>
  );
}

function LicencaVigenciaBadge({
  diasRestantes,
  status,
}: {
  diasRestantes: number;
  status: LicencaVigenciaStatus;
}) {
  const styles: Record<LicencaVigenciaStatus, string> = {
    active: "border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-50",
    expired: "border-red-200 bg-red-50 text-red-700 hover:bg-red-50",
    expiring: "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50",
  };
  const icons = {
    active: CircleCheck,
    expired: Clock3,
    expiring: Clock3,
  } satisfies Record<LicencaVigenciaStatus, typeof CircleCheck>;
  const Icon = icons[status];

  return (
    <Badge variant="outline" className={styles[status]}>
      <Icon className="size-3.5" />
      {formatDaysRemaining(diasRestantes)}
    </Badge>
  );
}

function PagamentoStatusBadge({ status }: { status: LicencaPagamentoStatus }) {
  const styles: Record<LicencaPagamentoStatus, string> = {
    cancelled: "border-zinc-200 bg-zinc-100 text-zinc-700 hover:bg-zinc-100",
    open: "border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-50",
    overdue: "border-red-200 bg-red-50 text-red-700 hover:bg-red-50",
    partial: "border-amber-200 bg-amber-50 text-amber-700",
    paid: "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50",
  };
  const icons = {
    cancelled: CircleX,
    open: Clock3,
    overdue: Clock3,
    partial: Clock3,
    paid: CircleCheck,
  } satisfies Record<LicencaPagamentoStatus, typeof CircleCheck>;
  const Icon = icons[status];

  return (
    <Badge variant="outline" className={styles[status]}>
      <Icon className="size-3.5" />
      {formatLicencaPagamentoStatus(status)}
    </Badge>
  );
}

function formatPaymentMethod(value: string | null) {
  const labels: Record<string, string> = {
    boleto: "Boleto",
    dinheiro: "Dinheiro",
    outro: "Outro",
    pix: "PIX",
    transferencia: "Transferência",
  };

  if (!value) {
    return "";
  }

  return labels[value] ?? value;
}

function UsuarioRoleBadge({ role }: { role: UsuarioRole }) {
  const styles: Record<UsuarioRole, string> = {
    bdl_admin: "border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-50",
    municipal_admin:
      "border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-50",
    municipal_user:
      "border-zinc-200 bg-zinc-100 text-zinc-700 hover:bg-zinc-100",
  };

  return (
    <Badge variant="outline" className={styles[role]}>
      {formatUsuarioRole(role)}
    </Badge>
  );
}

function buildModuloResumo(licencas: Licenca[]) {
  const modulos = new Map<
    string,
    { licencas: number; nome: string; receita: number; subdominio: string }
  >();

  licencas.forEach((licenca) => {
    const current = modulos.get(licenca.modulo_id) ?? {
      licencas: 0,
      nome: licenca.modulo_nome,
      receita: 0,
      subdominio: licenca.modulo_subdominio,
    };

    current.licencas += 1;
    current.receita += licenca.pagamentos.filter(p => p.contrato_id === licenca.contrato.id && p.status !== "cancelled").reduce((n,p)=>n+Number(p.valor),0);
    modulos.set(licenca.modulo_id, current);
  });

  return Array.from(modulos.values());
}

function formatPrefeituraName(nome: string) {
  return nome;
}

function getTodayIsoDate() {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Sao_Paulo",
    year: "numeric",
  }).formatToParts(new Date());
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";

  return `${year}-${month}-${day}`;
}

function addOneYearIsoDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const nextDate = new Date(Date.UTC(year + 1, month - 1, day));

  if (nextDate.getUTCMonth() !== month - 1) {
    nextDate.setUTCDate(0);
  }

  nextDate.setUTCDate(nextDate.getUTCDate() - 1);
  return [
    nextDate.getUTCFullYear(),
    String(nextDate.getUTCMonth() + 1).padStart(2, "0"),
    String(nextDate.getUTCDate()).padStart(2, "0"),
  ].join("-");
}
