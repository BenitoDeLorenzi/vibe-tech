import { PostoHistory } from "./posto-history";
import { filterPostoHistory, validHistoryDate } from "@/lib/posto-history";
import { OrdensRealtime } from "./ordens-realtime";
import Link from "next/link";
import { ListMetrics } from "@/components/list-metrics";
import { MobileLiveSearch } from "@/components/mobile-live-search";
import {
  BadgeCheck,
  Building2,
  CalendarClock,
  Car,
  Clock,
  Fuel,
  LogOut,
  ReceiptText,
  Search,
  CircleCheck,
} from "lucide-react";

import { AbastecimentoCompleteForm } from "@/app/frotas/abastecimento-complete-form";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
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
import { Input } from "@/components/ui/input";
import {
  formatFrotaDate,
  getAbastecimentosData,
  type FrotaAbastecimento,
} from "@/lib/frotas-data";
import { requirePostoSession } from "@/lib/posto-auth";
import { logoutPostoAction } from "./actions";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{
    q?: string;
    tab?: string;
    from?: string;
    to?: string;
  }>;
};

export default async function PortalPostoPage({ searchParams }: PageProps) {
  const session = await requirePostoSession();
  const params = await searchParams;
  const history = params.tab === "history";
  const from = validHistoryDate(params.from);
  const to = validHistoryDate(params.to);
  const data = await getAbastecimentosData({
    postoId: session.id,
    prefeituraId: session.prefeitura_id,
    query: params.q,
    completedFrom: history ? from : undefined,
    completedTo: history ? to : undefined,
    status: history ? "completed" : "issued",
  });
  const ordens = history ? filterPostoHistory(data.abastecimentos, session.id, session.prefeitura_id, from, to) : data.abastecimentos;
  const nextExpiry = ordens.map(item => item.expires_at).filter((value): value is string => Boolean(value)).sort((a, b) => Date.parse(a) - Date.parse(b))[0] ?? null;
  const prefeitura = data.prefeituras.find(
    (item) => item.id === session.prefeitura_id
  );
  const prefeituraNome = prefeitura?.nome ?? ordens[0]?.prefeitura_nome ?? "Empresa";
  const ordensVencendoHoje = ordens.filter((ordem) =>
    isTodayOrPast(ordem.expires_at)
  ).length;
  const veiculosUnicos = new Set(ordens.map((ordem) => ordem.veiculo_id)).size;

  return (
    <main className="min-h-screen bg-background p-3 sm:bg-muted/25 sm:p-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:gap-5">
        <header className="relative overflow-hidden rounded-xl border bg-background">
          <div className="grid gap-4 p-3 pr-14 sm:p-4 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground sm:size-12">
                <Fuel className="size-5 sm:size-6" />
              </div>
              <div className="min-w-0">
                <div className="mb-1 text-xs text-muted-foreground">Portal do posto</div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="truncate text-base font-semibold tracking-tight sm:text-xl">
                    {session.nome}
                  </h1>
                  <Badge
                    variant="outline"
                    className="hidden border-emerald-200 bg-emerald-50 text-emerald-700 sm:inline-flex dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400"
                  >
                    <BadgeCheck className="size-3" />
                    Credenciado
                  </Badge>
                </div>
                <p className="mt-1 truncate text-sm text-muted-foreground">
                  CNPJ {formatCnpj(session.cnpj)}
                </p>
                <p className="truncate text-xs text-muted-foreground sm:hidden">{prefeituraNome}</p>
              </div>
            </div>

            <div className="absolute right-3 top-3 flex flex-col gap-3 sm:static sm:flex-row sm:items-center lg:justify-end">
              <div className="hidden min-w-0 items-center gap-3 rounded-lg border bg-muted/20 px-3 py-2 sm:flex">
                {prefeitura?.brasao_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={prefeitura.brasao_url}
                    alt={`Logo de ${prefeituraNome}`}
                    className="size-11 shrink-0 rounded-md object-contain"
                  />
                ) : (
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-md bg-background">
                    <Building2 className="size-5 text-muted-foreground" />
                  </div>
                )}
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">
                    {prefeituraNome}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    Vibe Frotas
                  </div>
                </div>
              </div>
              <form action={logoutPostoAction}>
                <Button type="submit" variant="outline" aria-label="Sair do portal" className="size-9 gap-2 px-0 sm:w-auto sm:px-3">
                  <LogOut className="size-4" />
                  <span className="hidden sm:inline">Sair</span>
                </Button>
              </form>
            </div>
          </div>
        </header>

        <nav aria-label="Abastecimentos do posto" className="flex w-full gap-1 rounded-lg bg-muted p-1 sm:w-fit">
          <Link href="/frotas/posto" aria-current={!history ? "page" : undefined} className={buttonVariants({ variant: history ? "ghost" : "default", size: "sm", className: "min-w-0 flex-1 sm:flex-none" })}>Pendentes</Link>
          <Link href="/frotas/posto?tab=history" aria-current={history ? "page" : undefined} className={buttonVariants({ variant: history ? "default" : "ghost", size: "sm", className: "min-w-0 flex-1 sm:flex-none" })}><span className="sm:hidden">Histórico</span><span className="hidden sm:inline">Histórico de abastecimentos</span></Link>
        </nav>
        <div className="sticky top-0 z-20 -mx-3 bg-background sm:hidden"><MobileLiveSearch placeholder="Buscar por ordem, placa ou veículo" /></div>
        {history ? <PostoHistory orders={ordens} q={params.q} from={from} to={to} /> : <>
        <section className="hidden gap-3 md:grid md:grid-cols-3">
          <SummaryCard
            icon={ReceiptText}
            label="Ordens pendentes"
            value={String(ordens.length)}
          />
          <SummaryCard
            icon={CalendarClock}
            label="Vencendo hoje"
            value={String(ordensVencendoHoje)}
          />
          <SummaryCard
            icon={Car}
            label="Veículos aguardando"
            value={String(veiculosUnicos)}
          />
        </section>

        <Card className="gap-0 overflow-visible bg-transparent py-0 ring-0 sm:gap-4 sm:overflow-hidden sm:bg-card sm:py-4 sm:ring-1">
          <CardHeader className="hidden px-0 pb-3 sm:block sm:px-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle>Ordens pendentes</CardTitle>
                <OrdensRealtime nextExpiry={nextExpiry} />
                <div className="mt-3">
                  {ordens.length > 0 ? <ListMetrics items={[{ label: params.q ? "Encontradas" : "Pendentes", value: ordens.length, tone: "inUse" }]} /> : null}
                </div>
              </div>
              <PortalPostoFilters q={params.q} />
            </div>
          </CardHeader>
          <CardContent className="px-0 sm:px-4">
            {ordens.length ? (
              <div className="grid gap-3">
                {ordens.map((ordem) => (
                  <OrdemPostoCard key={ordem.id} ordem={ordem} />
                ))}
              </div>
            ) : (
              <div className="flex min-h-[280px] flex-col items-center justify-center rounded-lg border bg-muted/20 p-8 text-center">
                <Building2 className="size-10 text-muted-foreground" />
                <h2 className="mt-3 text-base font-semibold">
                  {params.q ? "Nenhuma ordem encontrada" : "Tudo em dia"}
                </h2>
                <p className="mt-1 max-w-md text-sm text-muted-foreground">
                  {params.q ? "Tente outro número de ordem, placa ou veículo." : "As novas ordens autorizadas aparecerão aqui para atendimento."}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
        </>}
      </div>
    </main>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Fuel;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-background p-4">
      <div className="flex size-10 items-center justify-center rounded-lg bg-sky-500/10">
        <Icon className="size-5 text-sky-700 dark:text-sky-400" />
      </div>
      <div>
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="text-2xl font-semibold tracking-normal">{value}</div>
      </div>
    </div>
  );
}

function PortalPostoFilters({
  q,
}: {
  q?: string;
}) {
  return (
    <form className="flex w-full flex-col gap-2 lg:w-auto lg:min-w-[420px] lg:flex-row">
      <div className="relative min-w-0 flex-1">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="h-9 pl-9"
          name="q"
          aria-label="Buscar por ordem, placa ou veículo"
          placeholder="Buscar por ordem, placa ou veículo"
          defaultValue={q}
        />
      </div>
      <Button type="submit" className="h-9 gap-2">
        <Search className="size-4" />
        Buscar
      </Button>
      {q ? <Link href="/frotas/posto" className={buttonVariants({ variant: "outline", className: "h-9" })}>Limpar</Link> : null}
    </form>
  );
}

function OrdemPostoCard({ ordem }: { ordem: FrotaAbastecimento }) {
  const validade = ordem.expires_at ? formatDateTime(ordem.expires_at) : "-";

  return (
    <article className="overflow-hidden rounded-xl border bg-background">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/25 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <ReceiptText className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">{ordem.numero_ordem}</h2>
          <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400"><Clock />Pendente</Badge>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><CalendarClock className="size-3.5" />Válida até {validade}</div>
      </div>
      <div className="grid gap-4 p-4 md:grid-cols-[1fr_auto] md:items-center">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-sky-500/10 text-sky-700 dark:text-sky-400"><Car className="size-6" /></div>
          <div className="min-w-0"><div className="text-xl font-semibold tracking-wide">{ordem.placa}</div><div className="break-words text-sm text-muted-foreground">{ordem.modelo} · {ordem.marca}{ordem.ano ? ` · ${ordem.ano}` : ""}</div></div>
        </div>
        <Dialog>
          <DialogTrigger className={buttonVariants({ className: "h-10 w-full gap-2 md:w-auto" })}><CircleCheck className="size-4" />Concluir abastecimento</DialogTrigger>
          <DialogContent className="sm:max-w-2xl"><DialogHeader><DialogTitle>Concluir abastecimento</DialogTitle><DialogDescription>Informe os dados reais do abastecimento de {ordem.placa}.</DialogDescription></DialogHeader><AbastecimentoCompleteForm portalPosto abastecimento={ordem} /></DialogContent>
        </Dialog>
      </div>
      <div className="grid gap-2 px-4 pb-4 sm:grid-cols-2 lg:grid-cols-3">
        <Info label="Motorista" value={ordem.motorista} />
        <Info label="Combustível autorizado" value={`${ordem.combustivel}${ordem.arla_incluso ? " + ARLA" : ""}`} />
        <Info label="Emissão" value={`${formatFrotaDate(ordem.data_abastecimento)} · ${ordem.emitido_por ?? "-"}`} />
      </div>
    </article>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md bg-muted/35 px-2.5 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="break-words text-sm font-medium">{value}</div>
    </div>
  );
}

function formatCnpj(value: string | null) {
  const digits = value?.replace(/\D/g, "") ?? "";

  if (digits.length !== 14) {
    return value ?? "-";
  }

  return digits.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    "$1.$2.$3/$4-$5"
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

function isTodayOrPast(value: string | null) {
  if (!value) {
    return false;
  }

  const date = new Date(value);
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  return date.getTime() <= endOfToday.getTime();
}
