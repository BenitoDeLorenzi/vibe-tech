"use client";

import { AdaptiveListSize } from "@/components/adaptive-list-size";
import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Bell, Fuel, Wrench, KeyRound, Headset, CircleCheck, CircleX, ArrowUpRight } from "lucide-react";
import { TableLoadingRows } from "@/components/table-loading";
import { Badge } from "@/components/ui/badge";
import { SidebarMenuBadge } from "@/components/ui/sidebar";
import { Button, buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ListMetrics } from "@/components/list-metrics";
import { PaginationControl } from "@/components/pagination-control";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

type Notification = {
  tipo: "abastecimento" | "manutencao" | "uso_veiculo" | "suporte";
  suporte_id: string | null;
  manutencao_id: string | null; uso_id: string | null;
  id: number; ordem_id: string | null; evento: "issued" | "completed" | "cancelled";
  numero_ordem: string; veiculo: string; posto: string | null; responsavel: string | null;
  created_at: string; lida: boolean;
};
type Feed = { items: Notification[]; unread: number; total: number; page: number; pageCount: number };
type Center = Feed & {
  available: boolean; empresa: string; loading: boolean; error: boolean; connected: boolean;
  size: number; resize: (size: number) => void; goToPage: (page: number) => void; refresh: () => Promise<void>; read: (id: number) => void;
};
const Context = createContext<Center | null>(null);

export function NotificationProvider({ empresa, enabled, children }: {
  empresa?: string; enabled: boolean; children: ReactNode;
}) {
  const mobile = useIsMobile();
  const [feed, setFeed] = useState<Feed>({ items: [], unread: 0, total: 0, page: 1, pageCount: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [connected, setConnected] = useState(false);
  const [requestedPage, setRequestedPage] = useState(1);
  const [size, setSize] = useState(13);
  const effectiveSize = mobile ? 10 : size;
  const resize = useCallback((next: number) => { setSize(next); setRequestedPage(1); setLoading(true); }, []);
  const pending = useRef(new Set<number>());
  const base = `/frotas/notificacoes/feed?empresa=${encodeURIComponent(empresa ?? "")}`;
  const version = useRef(0);
  const refresh = useCallback(async () => {
    if (!enabled || !empresa) return;
    const requestVersion = ++version.current;
    try {
      const response = await fetch(`${base}&size=${effectiveSize}&page=${requestedPage}`, { cache: "no-store" });
      if (!response.ok) throw new Error("feed");
      const next: Feed = await response.json();
      if (version.current !== requestVersion) return;
      setFeed(previous => mobile && requestedPage > 1 ? { ...next, items: [...new Map([...previous.items, ...next.items].map(item => [item.id, item])).values()] } : next);
      setError(false);
    } catch { if (version.current === requestVersion) setError(true); }
    finally { if (version.current === requestVersion) setLoading(false); }
  }, [base, empresa, enabled, requestedPage, effectiveSize, mobile]);

  useEffect(() => {
    if (!enabled || !empresa) return;
    const events = new EventSource(`/frotas/notificacoes/realtime?empresa=${encodeURIComponent(empresa)}`);
    let timer: ReturnType<typeof setTimeout>;
    const changed = () => { clearTimeout(timer); timer = setTimeout(() => void refresh(), 150); };
    events.addEventListener("ready", () => { setConnected(true); changed(); });
    events.addEventListener("changed", changed);
    events.onerror = () => setConnected(false);
    const visible = () => { if (document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange", visible);
    const requests = version;
    changed();
    return () => { requests.current++; clearTimeout(timer); events.close(); document.removeEventListener("visibilitychange", visible); };
  }, [enabled, empresa, refresh]);

  useEffect(() => {
    if (!enabled || !empresa) return;
    let busy = false;
    let active = true;
    const timer = setInterval(async () => {
      if (busy || !pending.current.size || document.visibilityState !== "visible") return;
      busy = true;
      const ids = [...pending.current].slice(0, 30);
      try {
        const response = await fetch(base, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) });
        if (!response.ok) throw new Error("read");
        ids.forEach(id => pending.current.delete(id));
        if (!active) return;
        setFeed(previous => ({ ...previous, items: previous.items.map(item => ids.includes(item.id) ? { ...item, lida: true } : item) }));
        await refresh();
      } catch { if (active) setError(true); }
      finally { busy = false; }
    }, 800);
    return () => { active = false; clearInterval(timer); };
  }, [base, enabled, empresa, refresh]);

  const read = useCallback((id: number) => { pending.current.add(id); }, []);
  const goToPage = (next: number) => {
    if (loading || next === feed.page || next < 1 || next > feed.pageCount) return;
    setLoading(true);
    setRequestedPage(next);
  };
  return <Context.Provider value={{ ...feed, size, resize, goToPage, available: enabled && !!empresa, empresa: empresa ?? "", loading: enabled && !!empresa && loading, error, connected, refresh, read }}>{children}</Context.Provider>;
}

export function NotificationBadge() {
  const center = useContext(Context);
  if (!center?.unread) return null;
  return <>
    <SidebarMenuBadge className="bg-red-600 text-white peer-hover/menu-button:text-white peer-data-active/menu-button:text-white" aria-label={`${center.unread} notificações novas`}>
      {center.unread > 99 ? "99+" : center.unread}
    </SidebarMenuBadge>
    <span className="pointer-events-none absolute right-1 top-1 hidden size-2 rounded-full bg-red-600 ring-2 ring-sidebar group-data-[collapsible=icon]:block" aria-label="Novas notificações" />
  </>;
}

const events = {
  issued: { title: "Emitida", icon: Fuel, color: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  completed: { title: "Concluída", icon: CircleCheck, color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  cancelled: { title: "Cancelada", icon: CircleX, color: "bg-red-500/10 text-red-600 dark:text-red-400" },
};

const activities = {
  suporte: { title: "Atendimento", icon: Headset, color: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400", route: "ajuda", issued: "Resposta", completed: "Resolvida" },
  abastecimento: { title: "Abastecimento", icon: Fuel, color: "bg-blue-500/10 text-blue-600 dark:text-blue-400", route: "abastecimento", issued: "Emitida", completed: "Concluída" },
  manutencao: { title: "Manutenção", icon: Wrench, color: "bg-amber-500/10 text-amber-600 dark:text-amber-400", route: "manutencao", issued: "Aberta", completed: "Concluída" },
  uso_veiculo: { title: "Uso do veículo", icon: KeyRound, color: "bg-violet-500/10 text-violet-600 dark:text-violet-400", route: "uso-veiculo", issued: "Retirada", completed: "Devolvida" },
};

function NotificationRow({ item, center }: { item: Notification; center: Center }) {
  const [highlight] = useState(!item.lida);
  const ref = useRef<HTMLTableRowElement>(null);
  const { read } = center;
  useEffect(() => {
    if (item.lida || !ref.current) return;
    let visible = false;
    const mark = () => { if (visible && document.visibilityState === "visible") read(item.id); };
    const observer = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; mark(); }, { threshold: 0.6 });
    observer.observe(ref.current);
    document.addEventListener("visibilitychange", mark);
    return () => { observer.disconnect(); document.removeEventListener("visibilitychange", mark); };
  }, [item.id, item.lida, read]);
  const event = events[item.evento];
  const activity = activities[item.tipo];
  const recordId = item.tipo === "suporte" ? item.suporte_id : item.tipo === "manutencao" ? item.manutencao_id : item.tipo === "uso_veiculo" ? item.uso_id : item.ordem_id;
  const statusTitle = item.evento === "cancelled" ? event.title : activity[item.evento];
  const StatusIcon = item.evento === "issued" ? activity.icon : event.icon;
  const query = new URLSearchParams({ prefeitura: center.empresa });
  if (recordId) {
    query.set(item.tipo === "suporte" ? "conversa" : item.tipo === "abastecimento" ? "ordem" : "registro", recordId);
    if (item.tipo === "abastecimento") query.set("q", item.numero_ordem);
  }
  return <TableRow ref={ref} className={cn(highlight && "bg-blue-500/5")}>
    <TableCell><div className="flex min-w-[180px] items-center gap-2">
      <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", activity.color)}><activity.icon className="size-4" /></span>
      <span className="font-medium">{activity.title}</span>
      {highlight && <span className="size-2 shrink-0 rounded-full bg-red-500" aria-label="Nova nesta visita" />}
    </div></TableCell>
    <TableCell><Badge variant="outline" className={cn("gap-1.5 border-transparent", event.color)}><StatusIcon />{statusTitle}</Badge></TableCell>
    <TableCell>{item.responsavel ?? "Sistema"}</TableCell>
    <TableCell className="whitespace-nowrap tabular-nums"><time dateTime={item.created_at}>{new Date(item.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })}</time></TableCell>
    <TableCell className="text-right">{recordId ? <Link className={buttonVariants({ variant: "outline", size: "sm" })} aria-label={`Ver ${activity.title.toLowerCase()}`} href={`/frotas/${activity.route}?${query}`}>{item.tipo === "abastecimento" ? "Ver ordem" : "Ver registro"}<ArrowUpRight className="size-4" /></Link> : <span className="text-xs text-muted-foreground">Registro excluído</span>}</TableCell>
  </TableRow>;
}

export function NotificationList() {
  const center = useContext(Context);
  if (!center) return null;
  return <main className="flex min-h-full flex-col gap-3 p-4"><Card className="frotas-list-card flex flex-1 flex-col">
    <CardHeader><div className="flex flex-wrap items-center justify-between gap-3">
      <div className="hidden md:flex"><CardTitle>Notificações</CardTitle></div><ListMetrics items={[{ label: "Novas", value: center.unread, tone: "warning" }]} />
      {center.available && <span className="hidden items-center gap-2 text-xs text-muted-foreground md:flex"><span className={cn("size-2 rounded-full", center.connected ? "bg-emerald-500" : "bg-muted-foreground/40")} />{center.connected ? "Em tempo real" : "Conectando…"}</span>}
    </div></CardHeader>
    <CardContent className="flex flex-1 flex-col space-y-3">
      {center.error && <div role="alert" className="flex items-center justify-between gap-3 text-sm text-destructive">Não foi possível atualizar as notificações.<Button variant="outline" size="sm" onClick={() => void center.refresh()}>Tentar novamente</Button></div>}
      <div data-fleet-route="/frotas/notificacoes" className="frotas-mobile-table overflow-hidden rounded-lg border" aria-busy={center.loading}>
        <Table><TableHeader><TableRow className="bg-muted/50"><TableHead>Atividade</TableHead><TableHead>Status</TableHead><TableHead>Responsável</TableHead><TableHead>Data e hora</TableHead><TableHead className="w-[140px] text-right">Ações</TableHead></TableRow></TableHeader>
          <TableBody>{center.loading ? <TableLoadingRows columns={5} /> : center.items.length ? center.items.map(item => <NotificationRow key={item.id} item={item} center={center} />) : <TableRow><TableCell colSpan={5} className="h-40 text-center text-muted-foreground"><Bell className="mx-auto mb-3 size-6" />{center.loading ? "Carregando notificações…" : "Nenhuma notificação por enquanto."}</TableCell></TableRow>}</TableBody>
        </Table>
      </div>
      {!center.loading && center.items.length < center.total && <Button type="button" variant="outline" className="w-full md:hidden" onClick={() => center.goToPage(center.page + 1)}>Mostrar mais</Button>}
      {center.items.length > 0 && <p className="text-center text-xs text-muted-foreground md:hidden">Mostrando {center.items.length} de {center.total}</p>}
      <div className="mt-auto hidden flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground md:flex">
        <AdaptiveListSize size={center.size} onSizeChange={center.resize} maximum={13} loading={center.loading} />
        <span>{center.items.length} registros nesta página</span>
        <PaginationControl page={center.page} pageCount={center.pageCount} disabled={center.loading} onPageChange={center.goToPage} />
      </div>
    </CardContent>
  </Card></main>;
}
