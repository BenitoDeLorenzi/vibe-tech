"use client";

import { createContext, useContext, useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { ArrowLeft, Check, CheckCheck, CircleCheck, Clock3, Headset, ListFilter, LoaderCircle, MessageCircle, Paperclip, Plus, RotateCcw, Search, Send, Star, X } from "lucide-react";
import { HeaderSeparator } from "@/components/header-separator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupTextarea } from "@/components/ui/input-group";
import { Message as ChatMessage, MessageAvatar, MessageContent } from "@/components/ui/message";
import { MessageScroller, MessageScrollerButton, MessageScrollerContent, MessageScrollerItem, MessageScrollerProvider, MessageScrollerViewport } from "@/components/ui/message-scroller";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ListPanelHeader } from "@/components/list-panel-header";
import { ListMetrics } from "@/components/list-metrics";
import { TableLoadingRows } from "@/components/table-loading";
import { AdminMobileCard } from "@/components/admin-mobile-card";
import { FormSelect } from "@/components/form-select";
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { mobileDrawerContentClassName } from "@/lib/mobile-drawer";
import { cn } from "@/lib/utils";
import { useSupportLive } from "./support-live";

type Status = "waiting" | "active" | "resolved";
type Ticket = { id: string; assunto: string; status: Status; usuario_id: string | null; solicitante_nome?: string; empresa: string; usuario: string; novas: number; updated_at: string; created_at?: string; origem?: string; feedback_resolvido?: boolean | null; feedback_nota?: number | null; feedback_respondido_em?: string | null; empresas?: { nome: string }; perfis?: { nome: string } };
type Message = { id: number; autor_id: string; autor_nome: string; suporte: boolean; tipo: string; texto: string; created_at: string; anexos: Array<{ name: string; url: string }> };
const statusMeta = {
  waiting: { label: "Aguardando atendimento", icon: Clock3, color: "border-transparent bg-amber-500/10 text-amber-700 dark:text-amber-400" },
  active: { label: "Em atendimento", icon: Headset, color: "border-transparent bg-blue-500/10 text-blue-700 dark:text-blue-400" },
  resolved: { label: "Resolvido", icon: CircleCheck, color: "border-transparent bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" },
};
const date = (value: string) => new Date(value).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
const messageTime = (value: string) => new Date(value).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
const messageDay = (value: string) => new Date(value).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
const messageDayLabel = (value: string) => new Date(value).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "long", year: "numeric" });
function SupportMessageAvatar({ support, name, src }: { support: boolean; name: string; src?: string | null }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join("") || "U";
  return <MessageAvatar className="size-10 min-w-10 self-center"><Avatar className="size-10 ring-2 ring-background" aria-label={support ? "Atendente" : name}>
    {!support && src && <AvatarImage src={src} alt={name} />}
    <AvatarFallback className={support ? "bg-primary/10 text-primary" : "bg-muted text-sm font-medium"}>{support ? <Headset className="size-5" aria-hidden="true" /> : initials}</AvatarFallback>
  </Avatar></MessageAvatar>;
}
function StatusBadge({ status }: { status: Status }) {
  const meta = statusMeta[status];
  return <Badge variant="outline" className={cn("gap-1.5 whitespace-nowrap", meta.color)}><meta.icon />{meta.label}</Badge>;
}
async function sendForm(base: string, form: FormData) {
  const response = await fetch(base, { method: "POST", body: form });
  const result = await response.json().catch(() => ({ error: "Não foi possível concluir. Tente novamente." }));
  if (!response.ok) throw new Error(result.error);
  return result;
}

function useWorkspaceState() {
  const [newOpen, setNewOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  return { newOpen, setNewOpen, query, setQuery, search, setSearch, status, setStatus, page, setPage, loading, setLoading };
}
const WorkspaceContext = createContext<ReturnType<typeof useWorkspaceState> | null>(null);
export function SupportWorkspace({ children }: { children: ReactNode }) {
  const state = useWorkspaceState();
  return <WorkspaceContext.Provider value={state}>{children}</WorkspaceContext.Provider>;
}
function useSupportWorkspace() {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error("SupportWorkspace is required");
  return value;
}
export function SupportMobileSearch({ desktop = false }: { desktop?: boolean }) {
  const params = useSearchParams();
  const { query, setQuery, search, setSearch, setPage, loading, setLoading } = useSupportWorkspace();
  const [submittedQuery, setSubmittedQuery] = useState<string | null>(null);
  const searching = submittedQuery !== null && query.trim() === submittedQuery && loading;
  useEffect(() => {
    if (query.trim() === search) return;
    const timer = window.setTimeout(() => {
      setSubmittedQuery(query.trim());
      setSearch(query.trim());
      setPage(1);
      setLoading(true);
    }, 500);
    return () => window.clearTimeout(timer);
  }, [query, search, setLoading, setPage, setSearch]);
  if (params.get("conversa")) return null;
  return <div className={desktop ? "hidden w-[min(320px,30vw)] min-w-40 shrink md:block" : "shrink-0 border-b bg-background px-4 py-2.5 md:hidden"}><div className="relative">
    {searching ? <LoaderCircle aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" /> : <Search aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />}
    <Input aria-label="Buscar atendimentos" placeholder="Buscar assunto, empresa ou usuário" className="h-9 w-full pl-9 pr-9" value={query} onChange={event => { setSubmittedQuery(null); setQuery(event.target.value); }} />
    {query && <Button type="button" variant="ghost" size="icon-sm" aria-label="Limpar busca" className="absolute right-1 top-1/2 -translate-y-1/2" onClick={() => { setSubmittedQuery(null); setQuery(""); }}><X className="size-3.5" /></Button>}
    <span className="sr-only" role="status">{searching ? "Buscando atendimentos…" : ""}</span>
  </div></div>;
}
export function SupportToolbar({ master = false }: { master?: boolean }) {
  const params = useSearchParams();
  const { status, setStatus, setPage, setLoading, setNewOpen } = useSupportWorkspace();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileStatus, setMobileStatus] = useState(status);
  const { refresh } = useSupportLive();
  if (params.get("conversa")) return null;
  return <div className="flex w-full min-w-0 items-center justify-end gap-2">
    <div className="md:hidden"><Drawer open={mobileOpen} onOpenChange={setMobileOpen} showSwipeHandle>
      <DrawerTrigger render={<Button type="button" variant="outline" size="icon" className="relative" aria-label="Filtrar atendimentos" onClick={() => setMobileStatus(status)} />}>
        <ListFilter className="size-4" />{status && <span className="absolute -right-1 -top-1 size-2.5 rounded-full bg-primary ring-2 ring-background" aria-hidden="true" />}
      </DrawerTrigger>
      <DrawerContent className={mobileDrawerContentClassName}><DrawerHeader className="border-b text-left"><DrawerTitle>Filtrar atendimentos</DrawerTitle><DrawerDescription>Escolha a situação dos chamados.</DrawerDescription></DrawerHeader>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4"><div className="space-y-2 text-sm font-medium"><label>Situação</label><FormSelect aria-label="Situação" value={mobileStatus || "all"} onValueChange={value => setMobileStatus(value === "all" ? "" : value)} options={[{ value: "all", label: "Todos" }, ...Object.entries(statusMeta).map(([value, meta]) => ({ value, label: meta.label }))]} /></div></div>
        <DrawerFooter className="flex-row gap-2 border-t bg-popover p-4"><Button type="button" variant="outline" className="flex-1" onClick={() => { setStatus(""); setPage(1); setLoading(true); setMobileOpen(false); refresh(); }}>Limpar</Button><Button type="button" className="flex-1" onClick={() => { setStatus(mobileStatus); setPage(1); setLoading(true); setMobileOpen(false); refresh(); }}>Aplicar filtros</Button></DrawerFooter>
      </DrawerContent>
    </Drawer></div>
    <div className="hidden shrink-0 gap-1 rounded-lg bg-muted p-1 xl:flex">{[{ value: "", label: "Todos" }, ...Object.entries(statusMeta).map(([value, meta]) => ({ value, label: value === "resolved" ? "Resolvidos" : meta.label }))].map(option => <Button key={option.value} variant={status === option.value ? "default" : "ghost"} size="sm" className={status === option.value ? "h-7 shrink-0 px-2 text-xs shadow-sm" : "h-7 shrink-0 px-2 text-xs text-muted-foreground"} onClick={() => { setStatus(option.value); setPage(1); setLoading(true); refresh(); }}>{option.label}</Button>)}</div>
    {!master && <><HeaderSeparator className="hidden 2xl:block" /><Button className="size-9 shrink-0 gap-0 p-0 md:w-auto md:gap-2 md:px-3" aria-label="Abrir chamado" onClick={() => setNewOpen(true)}><Plus className="size-4" /><span className="sr-only md:not-sr-only">Abrir chamado</span></Button></>}
  </div>;
}

export function SupportCenter({ master = false, userId }: { master?: boolean; userId: string }) {
  const { base, revision, unread, connected, refresh } = useSupportLive();
  const params = useSearchParams();
  const selected = params.get("conversa");
  const { newOpen, setNewOpen, setPage, search, status, page, loading, setLoading } = useSupportWorkspace();
  const [data, setData] = useState<{ items: Ticket[]; total: number }>({ items: [], total: 0 });
  const [error, setError] = useState("");
  useEffect(() => {
    if (selected) return;
    const controller = new AbortController();
    void fetch(`${base}&${new URLSearchParams({ q: search, status, page: String(page), size: "10" })}`, { cache: "no-store", signal: controller.signal })
      .then(async response => { const result = await response.json(); if (!response.ok) throw new Error(result.error); return result; })
      .then(result => { setPage(result.page); setData(previous => page > 1 ? { ...result, items: [...new Map([...previous.items, ...result.items].map(item => [item.id, item])).values()] } : result); setError(""); setLoading(false); })
      .catch(error => { if (!controller.signal.aborted) { setError(error.message); setLoading(false); } });
    return () => controller.abort();
  }, [base, search, status, page, revision, selected, setLoading, setPage]);
  const open = (id: string | null) => {
    const current = new URL(window.location.href);
    if (id) current.searchParams.set("conversa", id); else current.searchParams.delete("conversa");
    window.history.pushState(null, "", `${current.pathname}${current.search}`);
  };

  return <main className={cn("flex min-h-full flex-col gap-3 p-4", selected && "h-full overflow-hidden")}>
    {selected ? <TicketChat key={selected} id={selected} master={master} userId={userId} onBack={() => open(null)} /> : <>
      <div className="flex flex-1 flex-col [--card-spacing:--spacing(4)] md:gap-(--card-spacing) md:overflow-hidden md:rounded-xl md:bg-card md:py-(--card-spacing) md:text-card-foreground md:ring-1 md:ring-foreground/10"><ListPanelHeader mobileMetricsOnly title={master ? "Atendimentos" : "Meus chamados"} icon={Headset} metrics={<><ListMetrics loading={loading} items={[{ label: "Novas", value: unread, tone: "warning" }, { label: "Total", value: data.total }]} /><div className="hidden md:block"><LiveStatus connected={connected} /></div></>} />
        <CardContent className="flex flex-1 flex-col space-y-3 px-0 md:px-(--card-spacing)">
          {error && <ErrorNotice message={error} retry={refresh} />}
          <div className="space-y-3 md:hidden">{loading && !data.items.length ? <div className="py-10 text-center text-sm text-muted-foreground"><LoaderCircle className="mx-auto mb-2 size-5 animate-spin" />Carregando atendimentos…</div> : data.items.length ? data.items.map(ticket => <AdminMobileCard key={ticket.id}
            title={<span className="flex items-center gap-2"><MessageCircle className="size-4 shrink-0 text-muted-foreground" />{ticket.assunto}{ticket.novas > 0 && <Badge className="bg-red-600 text-white">{ticket.novas}</Badge>}</span>}
            subtitle={master ? `${ticket.empresa} · ${ticket.usuario}` : ticket.empresa}
            badge={<StatusBadge status={ticket.status} />}
            details={[{ label: "Última atividade", value: date(ticket.updated_at) }]}
            actions={<Button type="button" variant="outline" size="sm" onClick={() => open(ticket.id)}><MessageCircle className="size-4" />Abrir chat</Button>} />) : <div className="flex min-h-[320px] flex-col items-center justify-center p-8 text-center"><div className="flex size-12 items-center justify-center rounded-lg border bg-background"><Headset className="size-6 text-muted-foreground" /></div><h3 className="mt-4 text-base font-semibold">Nenhum atendimento encontrado</h3><p className="mt-1 max-w-md text-sm text-muted-foreground">{search || status ? "Ajuste os filtros para visualizar outros chamados." : master ? "Os chamados das empresas aparecerão aqui." : "Precisa de ajuda? Abra um chamado para a equipe Vibe Tech."}</p></div>}
            {!loading && data.items.length < data.total && <Button type="button" variant="outline" className="w-full" onClick={() => { setPage(page + 1); setLoading(true); }}>Mostrar mais</Button>}
            {data.items.length > 0 && <p className="text-center text-xs text-muted-foreground">Mostrando {data.items.length} de {data.total}</p>}
          </div>
          <div className="hidden overflow-hidden rounded-lg border md:block"><Table><TableHeader><TableRow className="bg-muted/50"><TableHead>Assunto</TableHead>{master && <><TableHead>Empresa</TableHead><TableHead>Usuário</TableHead></>}<TableHead>Última atividade</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader><TableBody>
            {loading && !data.items.length ? <TableLoadingRows columns={master ? 6 : 4} /> : data.items.length ? data.items.map(ticket => <TableRow key={ticket.id} className={cn(ticket.novas > 0 && "bg-blue-500/5")}><TableCell><div className="flex items-center gap-2"><MessageCircle className="size-4 shrink-0 text-muted-foreground" /><span className="max-w-80 truncate font-medium">{ticket.assunto}</span>{ticket.novas > 0 && <Badge className="bg-red-600 text-white">{ticket.novas}</Badge>}</div></TableCell>{master && <><TableCell>{ticket.empresa}</TableCell><TableCell>{ticket.usuario}</TableCell></>}<TableCell className="whitespace-nowrap tabular-nums">{date(ticket.updated_at)}</TableCell><TableCell><StatusBadge status={ticket.status} /></TableCell><TableCell className="text-right"><Button variant="outline" size="sm" onClick={() => open(ticket.id)}><MessageCircle />Abrir chat</Button></TableCell></TableRow>) : <TableRow><TableCell colSpan={master ? 6 : 4} className="h-40 text-center text-muted-foreground"><Headset className="mx-auto mb-3 size-7" />{search || status ? "Nenhum chamado encontrado." : master ? "Nenhum chamado por enquanto." : "Precisa de ajuda? Abra um chamado para a equipe Vibe Tech."}</TableCell></TableRow>}
          </TableBody></Table></div>
          <div className="mt-auto hidden flex-col items-center gap-2 md:flex">{data.items.length < data.total && <Button type="button" variant="outline" className="w-full max-w-64" disabled={loading} onClick={() => { setPage(page + 1); setLoading(true); }}>{loading ? "Carregando…" : "Mostrar mais"}</Button>}{data.total > 0 && <p className="text-xs text-muted-foreground">Mostrando {data.items.length} de {data.total}</p>}</div>
        </CardContent>
      </div>
    </>}
    <Dialog open={newOpen} onOpenChange={setNewOpen}><DialogContent className="sm:max-w-2xl"><DialogHeader><DialogTitle>Abrir chamado</DialogTitle></DialogHeader>{newOpen && <Composer isNew onCancel={() => setNewOpen(false)} onSent={id => { setNewOpen(false); refresh(); open(id); }} />}</DialogContent></Dialog>
  </main>;
}

function LiveStatus({ connected }: { connected: boolean }) {
  return <span className="flex items-center gap-2 text-xs text-muted-foreground"><span className={cn("size-2 rounded-full", connected ? "bg-emerald-500" : "bg-muted-foreground/40")} />{connected ? "Em tempo real" : "Reconectando…"}</span>;
}
function ErrorNotice({ message, retry }: { message: string; retry?: () => void }) {
  return <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-destructive/5 p-3 text-sm text-destructive">{message}{retry && <Button variant="outline" size="sm" onClick={retry}>Tentar novamente</Button>}</div>;
}

function TicketChat({ id, master, userId, onBack }: { id: string; master: boolean; userId: string; onBack: () => void }) {
  const { base, revision, connected, refresh } = useSupportLive();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [userAvatarUrl, setUserAvatarUrl] = useState<string | null>(null);
  const [readReceipts, setReadReceipts] = useState({ client: 0, support: 0 });
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [atBottom, setAtBottom] = useState(true);
  const [otherTyping, setOtherTyping] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const followBottom = useRef(true);
  const lastRead = useRef(0);
  const lastLoadedMessageId = useRef<number | null>(null);
  const initial = useRef(true);
  const lastAutoStart = useRef<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    const after = lastLoadedMessageId.current;
    void fetch(`${base}&conversa=${id}${after ? `&after=${after}` : ""}`, { cache: "no-store", signal: controller.signal }).then(async response => {
      const data = await response.json(); if (!response.ok) throw new Error(data.error); return data;
    }).then(data => {
      setTicket(data.ticket); setError("");
      if (!after) setUserAvatarUrl(data.userAvatarUrl ?? null);
      if (data.messages.length) lastLoadedMessageId.current = data.messages.at(-1).id;
      setReadReceipts({ client: data.readByClient ?? 0, support: data.readBySupport ?? 0 });
      if (initial.current) { setHasMore(data.hasMore); initial.current = false; }
      setMessages(previous => { const merged = new Map(previous.map(item => [item.id, item])); for (const item of data.messages as Message[]) merged.set(item.id, item); return [...merged.values()].sort((a, b) => a.id - b.id); });
      if (data.hasNewer) refresh();
    }).catch(error => { if (!controller.signal.aborted) setError(error.message); });
    return () => controller.abort();
  }, [base, id, revision, refresh]);
  useLayoutEffect(() => {
    if (followBottom.current && panel.current) panel.current.scrollTop = panel.current.scrollHeight;
  }, [messages, otherTyping]);
  useEffect(() => {
    const stream = new EventSource(`${base.replace("/api/suporte?", "/api/suporte/realtime?")}&conversa=${encodeURIComponent(id)}`);
    let expiry: ReturnType<typeof setTimeout>;
    const typing = (event: Event) => {
      const payload = JSON.parse((event as MessageEvent).data) as { senderId?: string; typing?: boolean };
      if (payload.senderId === userId) return;
      clearTimeout(expiry);
      setOtherTyping(payload.typing === true);
      if (payload.typing) expiry = setTimeout(() => setOtherTyping(false), 3500);
    };
    stream.addEventListener("typing", typing);
    stream.addEventListener("changed", refresh);
    return () => { stream.close(); clearTimeout(expiry); };
  }, [base, id, refresh, userId]);
  useEffect(() => {
    if (!master || ticket?.status !== "waiting" || lastAutoStart.current === ticket.updated_at) return;
    lastAutoStart.current = ticket.updated_at;
    const form = new FormData(); form.set("operation", "status"); form.set("conversa", id); form.set("status", "active");
    void sendForm(base, form).then(refresh).catch(error => setError((error as Error).message));
  }, [base, id, master, refresh, ticket?.status, ticket?.updated_at]);
  const latest = messages.at(-1)?.id;
  const markRead = useCallback(async () => {
    if (!latest || latest <= lastRead.current || !atBottom || document.visibilityState !== "visible") return;
    const form = new FormData(); form.set("operation", "read"); form.set("conversa", id); form.set("last", String(latest));
    const previous = lastRead.current;
    lastRead.current = latest;
    try { await sendForm(base, form); refresh(); } catch { lastRead.current = previous; }
  }, [base, id, latest, atBottom, refresh]);
  useEffect(() => { void markRead(); const visible = () => void markRead(); document.addEventListener("visibilitychange", visible); return () => document.removeEventListener("visibilitychange", visible); }, [markRead]);
  const older = async () => {
    setLoadingOlder(true);
    followBottom.current = false;
    const height = panel.current?.scrollHeight ?? 0;
    try {
      const response = await fetch(`${base}&conversa=${id}&before=${messages[0]?.id}`, { cache: "no-store" });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setMessages(previous => { const merged = new Map(previous.map(item => [item.id, item])); for (const item of data.messages as Message[]) merged.set(item.id, item); return [...merged.values()].sort((a,b) => a.id-b.id); });
      setHasMore(data.hasMore);
      requestAnimationFrame(() => { if (panel.current) panel.current.scrollTop += panel.current.scrollHeight - height; });
    } catch (error) { setError((error as Error).message); } finally { setLoadingOlder(false); }
  };
  const changeStatus = async (status: Status) => {
    setBusy(true);
    const form = new FormData(); form.set("operation", "status"); form.set("conversa", id); form.set("status", status);
    try { await sendForm(base, form); refresh(); } catch (error) { setError((error as Error).message); } finally { setBusy(false); }
  };
  return <>
    <div className="flex shrink-0 items-center justify-between gap-3"><Button variant="outline" size="sm" onClick={onBack}><ArrowLeft />Voltar aos chamados</Button><LiveStatus connected={connected} /></div>
    {error && <ErrorNotice message={error} retry={refresh} />}
    {!ticket ? !error && <Card className="p-10 text-center text-sm text-muted-foreground"><LoaderCircle className="mx-auto mb-2 size-5 animate-spin" />Carregando chamado…</Card> : <Card className="min-h-0 flex-1 gap-0 overflow-hidden py-0">
      <CardHeader className="max-h-[25dvh] shrink-0 overflow-y-auto border-b py-3"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 space-y-1"><CardTitle className="break-words">{ticket.assunto}</CardTitle><p className="truncate text-xs text-muted-foreground">{master && ticket.empresas?.nome ? `${ticket.empresas.nome} · ` : ""}Aberto por {ticket.perfis?.nome ?? ticket.solicitante_nome ?? "Usuário"}</p></div><div className="flex flex-wrap items-center gap-2"><StatusBadge status={ticket.status} />{ticket.status === "resolved" ? (master || ticket.feedback_respondido_em) && <Button variant="outline" size="sm" disabled={busy} onClick={() => void changeStatus("waiting")}><RotateCcw />Reabrir</Button> : master && <Button variant="outline" size="sm" disabled={busy} onClick={() => void changeStatus("resolved")}><CheckCheck />Resolver</Button>}</div></div></CardHeader>
      <MessageScrollerProvider>
        <MessageScroller className="min-h-0 flex-1 bg-muted/20">
          <MessageScrollerViewport ref={panel} role="log" aria-label="Chat do chamado" aria-live="polite" onScroll={event => { const node = event.currentTarget; const bottom = node.scrollHeight - node.scrollTop - node.clientHeight < 40; followBottom.current = bottom; setAtBottom(bottom); }}>
            <MessageScrollerContent className="gap-4 p-4">
              {hasMore && <div className="text-center"><Button size="sm" variant="outline" disabled={loadingOlder} onClick={() => void older()}>{loadingOlder ? "Carregando…" : "Carregar mensagens anteriores"}</Button></div>}
              {messages.map((message, index) => <MessageScrollerItem key={message.id} messageId={String(message.id)} className="space-y-3">
                {(index === 0 || messageDay(messages[index - 1].created_at) !== messageDay(message.created_at)) && <div className="flex justify-center"><time dateTime={messageDay(message.created_at)} className="rounded-full bg-background px-3 py-1 text-[11px] font-medium text-muted-foreground shadow-sm ring-1 ring-border/70">{messageDayLabel(message.created_at)}</time></div>}
                {message.tipo === "status" ? <p className="text-center text-xs text-muted-foreground">{message.texto} · {messageTime(message.created_at)}</p> : <ChatMessage align={message.autor_id === userId ? "end" : "start"}>
                  <SupportMessageAvatar support={message.suporte} name={message.autor_nome} src={userAvatarUrl} />
                  <MessageContent className="max-w-[90%] sm:max-w-[75%]">
                    <Bubble align={message.autor_id === userId ? "end" : "start"} variant={message.autor_id === userId ? "muted" : "outline"} className="max-w-full">
                      <BubbleContent className="w-full space-y-2">{message.texto && <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{message.texto}</p>}{message.anexos.length > 0 && <div className="flex flex-wrap gap-2">{message.anexos.map(file => <a key={file.url} href={file.url} target="_blank" rel="noreferrer" className="max-w-full break-all rounded-md border bg-background p-2 text-sm underline-offset-4 hover:underline" aria-label={`Abrir imagem ${file.name}`}><Paperclip className="mr-1 inline size-4" />{file.name}</a>)}</div>}<div className="flex items-center justify-end gap-1.5 text-[10px] text-muted-foreground"><time dateTime={message.created_at}>{messageTime(message.created_at)}</time>{message.autor_id === userId && <span className="inline-flex items-center" title={message.id <= (master ? readReceipts.client : readReceipts.support) ? "Lida" : "Entregue"} aria-label={message.id <= (master ? readReceipts.client : readReceipts.support) ? "Mensagem lida" : "Mensagem entregue"}>{message.id <= (master ? readReceipts.client : readReceipts.support) ? <CheckCheck className="size-3.5 text-sky-600" /> : <Check className="size-3.5" />}</span>}</div></BubbleContent>
                    </Bubble>
                  </MessageContent>
                </ChatMessage>}
              </MessageScrollerItem>)}
              {otherTyping && <MessageScrollerItem messageId="typing" aria-live="polite"><ChatMessage><SupportMessageAvatar support={!master} name={ticket.perfis?.nome ?? ticket.solicitante_nome ?? "Usuário"} src={userAvatarUrl} /><MessageContent><Bubble variant="muted"><BubbleContent className="flex items-center gap-1 py-3" aria-label="Digitando"><span className="size-1.5 animate-bounce rounded-full bg-muted-foreground" /><span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:150ms]" /><span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:300ms]" /></BubbleContent></Bubble></MessageContent></ChatMessage></MessageScrollerItem>}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton aria-label="Ir para as mensagens mais recentes" />
        </MessageScroller>
      </MessageScrollerProvider>
      <div className="shrink-0 border-t bg-background p-3">{ticket.status === "resolved" ? !master && !ticket.feedback_respondido_em ? <ResolutionFeedback base={base} ticketId={id} onSent={refresh} /> : <p className="text-center text-sm text-muted-foreground">{ticket.feedback_respondido_em ? `Avaliação registrada: ${ticket.feedback_nota}/5 estrelas.` : "Chamado resolvido. Reabra o chamado se precisar continuar neste chat."}</p> : <Composer ticket={id} onSent={() => { followBottom.current = true; setAtBottom(true); refresh(); }} />}</div>
    </Card>}
  </>;
}

function ResolutionFeedback({ base, ticketId, onSent }: { base: string; ticketId: string; onSent: () => void }) {
  const [resolved, setResolved] = useState<boolean | null>(null);
  const [rating, setRating] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async () => {
    if (resolved === null || rating < 1 || busy) return;
    setBusy(true); setError("");
    const form = new FormData();
    form.set("operation", "feedback"); form.set("conversa", ticketId);
    form.set("resolvido", String(resolved)); form.set("nota", String(rating));
    try { await sendForm(base, form); onSent(); } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
  };
  return <div className="mx-auto max-w-md space-y-3 py-2 text-center">
    <div><p className="font-medium">O atendimento resolveu seu problema?</p><p className="text-xs text-muted-foreground">Sua resposta nos ajuda a melhorar o suporte.</p></div>
    <div className="flex justify-center gap-2"><Button type="button" variant={resolved === true ? "default" : "outline"} size="sm" onClick={() => setResolved(true)}>Sim, resolveu</Button><Button type="button" variant={resolved === false ? "default" : "outline"} size="sm" onClick={() => setResolved(false)}>Ainda preciso de ajuda</Button></div>
    {resolved !== null && <div className="space-y-2"><p className="text-sm">Como você avalia o atendimento?</p><div className="flex justify-center gap-1" role="group" aria-label="Nota do atendimento">{[1, 2, 3, 4, 5].map(value => <Button key={value} type="button" variant="ghost" size="icon-sm" aria-label={`${value} ${value === 1 ? "estrela" : "estrelas"}`} aria-pressed={rating === value} onClick={() => setRating(value)}><Star className={cn("size-5", value <= rating ? "fill-amber-400 text-amber-500" : "text-muted-foreground")} /></Button>)}</div><Button type="button" className="w-full" disabled={!rating || busy} onClick={() => void submit()}>{busy ? <LoaderCircle className="animate-spin" /> : <CheckCheck />}{busy ? "Enviando avaliação…" : "Enviar avaliação"}</Button></div>}
    {error && <ErrorNotice message={error} />}
  </div>;
}

function Composer({ ticket, isNew = false, onSent, onCancel }: { ticket?: string; isNew?: boolean; onSent: (id: string) => void; onCancel?: () => void }) {
  const { base } = useSupportLive();
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<{ assunto: string; texto: string }>();
  const fileInput = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const ids = useId();
  const request = useRef<string | null>(null);
  const conversation = useRef<string | null>(ticket ?? null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingThrottleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingThrottled = useRef(false);
  const typingActive = useRef(false);
  const [error, setError] = useState("");
  const sendTyping = (typing: boolean) => {
    if (!ticket) return;
    if (typingTimer.current) clearTimeout(typingTimer.current);
    if (typing && typingThrottled.current) {
      typingTimer.current = setTimeout(() => sendTyping(false), 2500);
      return;
    }
    if (!typing && !typingActive.current) return;
    typingActive.current = typing;
    if (typing) {
      typingThrottled.current = true;
      typingThrottleTimer.current = setTimeout(() => { typingThrottled.current = false; }, 1200);
    }
    const url = `${base.replace("/api/suporte?", "/api/suporte/realtime?")}&conversa=${encodeURIComponent(ticket)}`;
    void fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ typing }), keepalive: !typing }).catch(() => {});
    if (typing) typingTimer.current = setTimeout(() => sendTyping(false), 2500);
  };
  useEffect(() => () => { if (typingTimer.current) clearTimeout(typingTimer.current); if (typingThrottleTimer.current) clearTimeout(typingThrottleTimer.current); }, []);
  const selectFiles = (selected: FileList | null) => {
    const next = [...files];
    for (const file of Array.from(selected ?? [])) {
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { setError("Selecione imagens JPG, PNG ou WebP."); return; }
      if (!next.some(item => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified)) next.push(file);
    }
    if (next.length > 3 || next.reduce((size, file) => size + file.size, 0) > 3 * 1024 * 1024) { setError("Selecione até 3 imagens, somando no máximo 3 MB."); return; }
    setFiles(next);
    setError("");
  };
  const submit = async (values: { assunto: string; texto: string }) => {
    setError("");
    request.current ??= crypto.randomUUID();
    conversation.current ??= crypto.randomUUID();
    if (!values.texto?.trim() && !files.length) { setError("Escreva uma mensagem ou selecione uma imagem."); return; }
    if (files.length > 3 || files.reduce((size, file) => size + file.size, 0) > 3 * 1024 * 1024) { setError("Selecione até 3 imagens, somando no máximo 3 MB."); return; }
    const form = new FormData();
    form.set("conversa", conversation.current); form.set("request_id", request.current); form.set("new", String(isNew));
    form.set("assunto", values.assunto ?? ""); form.set("texto", values.texto ?? "");
    let origin = "/frotas/ajuda";
    try { origin = window.sessionStorage.getItem("frotas-support-origin") ?? origin; } catch {}
    form.set("origem", origin);
    for (const file of files) form.append("imagens", file);
    try { const result = await sendForm(base, form); sendTyping(false); reset(); setFiles([]); request.current = null; onSent(result.conversa); } catch (error) { setError((error as Error).message); }
  };
  const chatMessageField = !isNew ? register("texto", { maxLength: { value: 5000, message: "Use até 5.000 caracteres." } }) : null;
  if (!isNew) return <form noValidate onSubmit={event => void handleSubmit(submit)(event)} className="space-y-2">
    {files.length > 0 && <ul className="flex max-h-24 flex-wrap gap-2 overflow-y-auto">{files.map((file, index) => <li key={`${file.name}-${file.lastModified}-${file.size}`} className="flex min-w-0 max-w-full items-center gap-2 rounded-lg border bg-muted/30 py-1 pl-2 pr-1">
      <Paperclip className="size-3.5 shrink-0 text-muted-foreground" /><span className="max-w-48 truncate text-xs" title={file.name}>{file.name}</span>
      <Tooltip><TooltipTrigger render={<Button type="button" variant="destructive" size="icon-sm" disabled={isSubmitting} aria-label={`Remover imagem ${file.name}`} onClick={() => { setFiles(previous => previous.filter((_, position) => position !== index)); setError(""); }} />}><X /></TooltipTrigger><TooltipContent>Remover imagem</TooltipContent></Tooltip>
    </li>)}</ul>}
    {error && <ErrorNotice message={error} />}
    <fieldset disabled={isSubmitting} className="min-w-0 disabled:opacity-60">
      <input ref={fileInput} className="hidden" type="file" multiple accept="image/jpeg,image/png,image/webp" aria-label="Selecionar imagens" onChange={event => { selectFiles(event.target.files); event.target.value = ""; }} />
      <InputGroup className="h-auto flex-col items-stretch rounded-2xl bg-background shadow-sm">
        <Label className="sr-only" htmlFor={`${ids}-texto`}>Mensagem</Label>
        <InputGroupTextarea id={`${ids}-texto`} rows={2} className="max-h-36 min-h-16 resize-none px-3 py-2.5" placeholder="Escreva sua mensagem…" aria-invalid={!!errors.texto} {...chatMessageField} onChange={event => { void chatMessageField?.onChange(event); sendTyping(Boolean(event.currentTarget.value.trim())); }} onBlur={event => { void chatMessageField?.onBlur(event); sendTyping(false); }} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} />
        <InputGroupAddon align="block-end" className="justify-between border-t px-2 py-1.5">
          <Tooltip><TooltipTrigger render={<InputGroupButton type="button" variant="ghost" size="icon-sm" disabled={files.length >= 3 || isSubmitting} aria-label="Anexar imagens" onClick={() => fileInput.current?.click()} />}><Paperclip /></TooltipTrigger><TooltipContent>Anexar imagens · até 3 imagens, máximo de 3 MB</TooltipContent></Tooltip>
          <Tooltip><TooltipTrigger render={<InputGroupButton type="submit" variant="default" size="icon-sm" disabled={isSubmitting} aria-label={isSubmitting ? "Enviando mensagem" : "Enviar mensagem"} />}>{isSubmitting ? <LoaderCircle className="animate-spin" /> : <Send />}</TooltipTrigger><TooltipContent>Enviar mensagem</TooltipContent></Tooltip>
        </InputGroupAddon>
      </InputGroup>
    </fieldset>
    {errors.texto && <p className="text-sm text-destructive">{errors.texto.message}</p>}
  </form>;
  return <form noValidate onSubmit={event => void handleSubmit(submit)(event)} className={isNew ? "space-y-3" : "space-y-2"}>
    <fieldset disabled={isSubmitting} className={cn("min-w-0 disabled:opacity-60", isNew ? "space-y-3" : "max-h-[30dvh] space-y-2 overflow-y-auto")}>
      {isNew && <div className="space-y-2"><Label htmlFor={`${ids}-assunto`}>Assunto</Label><Input id={`${ids}-assunto`} placeholder="Como podemos ajudar?" aria-invalid={!!errors.assunto} {...register("assunto", { required: "Informe o assunto.", minLength: { value: 3, message: "Use pelo menos 3 caracteres." }, maxLength: { value: 120, message: "Use até 120 caracteres." } })} />{errors.assunto && <p className="text-sm text-destructive">{errors.assunto.message}</p>}</div>}
      <div className="space-y-2"><Label className={isNew ? undefined : "sr-only"} htmlFor={`${ids}-texto`}>{isNew ? "Mensagem inicial" : "Mensagem"}</Label><Textarea id={`${ids}-texto`} className={isNew ? "min-h-32" : "h-16 min-h-16 resize-none field-sizing-fixed"} placeholder={isNew ? "Descreva o que aconteceu para iniciarmos o atendimento." : "Escreva sua resposta…"} aria-invalid={!!errors.texto} {...register("texto", { validate: value => !isNew || !!value?.trim() || "Descreva o motivo do chamado.", maxLength: { value: 5000, message: "Use até 5.000 caracteres." } })} />{errors.texto && <p className="text-sm text-destructive">{errors.texto.message}</p>}</div>
      <div className="space-y-3">
        <input ref={fileInput} className="hidden" type="file" multiple accept="image/jpeg,image/png,image/webp" aria-label="Selecionar imagens" onChange={event => { selectFiles(event.target.files); event.target.value = ""; }} />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button type="button" variant="outline" disabled={files.length >= 3} aria-describedby={`${ids}-limites`} onClick={() => fileInput.current?.click()}><Paperclip />Anexar imagens</Button>
          <span className="text-xs text-muted-foreground" aria-live="polite">{files.length ? `${files.length} de 3 imagens selecionadas` : "Opcional"}</span>
        </div>
        {files.length > 0 && <ul className="max-h-24 space-y-2 overflow-y-auto">{files.map((file, index) => <li key={`${file.name}-${file.lastModified}-${file.size}`} className="flex min-w-0 items-center gap-3 rounded-lg border bg-muted/30 p-2.5">
          <Paperclip className="size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium" title={file.name}>{file.name}</p><p className="text-xs text-muted-foreground">{Math.max(1, Math.round(file.size / 1024))} KB</p></div>
          <Tooltip><TooltipTrigger render={<Button type="button" variant="destructive" size="icon-sm" aria-label={`Remover imagem ${file.name}`} onClick={() => { setFiles(previous => previous.filter((_, position) => position !== index)); setError(""); }} />}><X /></TooltipTrigger><TooltipContent>Remover imagem</TooltipContent></Tooltip>
        </li>)}</ul>}
        <p id={`${ids}-limites`} className={isNew ? "text-xs text-muted-foreground" : "sr-only"}>Até 3 imagens JPG, PNG ou WebP · máximo de 3 MB no total.</p>
      </div>
    </fieldset>
    {error && <ErrorNotice message={error} />}
    <div className="flex justify-end gap-2">{onCancel && <Button type="button" variant="outline" disabled={isSubmitting} onClick={onCancel}>Cancelar</Button>}<Button type="submit" disabled={isSubmitting}>{isSubmitting ? <LoaderCircle className="animate-spin" /> : <Send />}{isSubmitting ? "Enviando…" : isNew ? "Abrir chamado" : "Enviar mensagem"}</Button></div>
  </form>;
}
