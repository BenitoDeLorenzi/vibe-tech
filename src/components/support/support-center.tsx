"use client";

import { AdaptiveListSize } from "@/components/adaptive-list-size";
import { createContext, useContext, useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { ArrowLeft, CheckCheck, CircleCheck, Clock3, Headset, ListFilter, LoaderCircle, MessageCircle, Paperclip, Plus, RotateCcw, Search, Send, X } from "lucide-react";
import { HeaderSeparator } from "@/components/header-separator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { PaginationControl } from "@/components/pagination-control";
import { AdminMobileCard } from "@/components/admin-mobile-card";
import { FormSelect } from "@/components/form-select";
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { mobileDrawerContentClassName } from "@/lib/mobile-drawer";
import { cn } from "@/lib/utils";
import { useSupportLive } from "./support-live";

type Status = "waiting" | "active" | "resolved";
type Ticket = { id: string; assunto: string; status: Status; usuario_id: string | null; solicitante_nome?: string; empresa: string; usuario: string; novas: number; updated_at: string; created_at?: string; origem?: string; empresas?: { nome: string }; perfis?: { nome: string } };
type Message = { id: number; autor_id: string; autor_nome: string; suporte: boolean; tipo: string; texto: string; created_at: string; anexos: Array<{ name: string; url: string }> };
const statusMeta = {
  waiting: { label: "Aguardando atendimento", icon: Clock3, color: "border-transparent bg-amber-500/10 text-amber-700 dark:text-amber-400" },
  active: { label: "Em atendimento", icon: Headset, color: "border-transparent bg-blue-500/10 text-blue-700 dark:text-blue-400" },
  resolved: { label: "Resolvido", icon: CircleCheck, color: "border-transparent bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" },
};
const date = (value: string) => new Date(value).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
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
export function SupportToolbar({ master = false }: { master?: boolean }) {
  const params = useSearchParams();
  const { query, setQuery, search, setSearch, status, setStatus, setPage, setLoading, setNewOpen } = useSupportWorkspace();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileQuery, setMobileQuery] = useState(search);
  const [mobileStatus, setMobileStatus] = useState(status);
  const { refresh } = useSupportLive();
  if (params.get("conversa")) return null;
  const filter = () => { setSearch(query.trim()); setPage(1); setLoading(true); refresh(); };
  return <div className="flex w-full min-w-0 items-center justify-end gap-2">
    <div className="md:hidden"><Drawer open={mobileOpen} onOpenChange={setMobileOpen} showSwipeHandle>
      <DrawerTrigger render={<Button type="button" variant="outline" size="icon" className="relative" aria-label="Filtrar atendimentos" onClick={() => { setMobileQuery(search); setMobileStatus(status); }} />}>
        <ListFilter className="size-4" />{(search || status) && <span className="absolute -right-1 -top-1 size-2.5 rounded-full bg-primary ring-2 ring-background" aria-hidden="true" />}
      </DrawerTrigger>
      <DrawerContent className={mobileDrawerContentClassName}><DrawerHeader className="border-b text-left"><DrawerTitle>Filtrar atendimentos</DrawerTitle><DrawerDescription>Busque chamados e escolha a situação.</DrawerDescription></DrawerHeader>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4"><label className="block space-y-2 text-sm font-medium">Buscar<Input value={mobileQuery} onChange={event => setMobileQuery(event.target.value)} placeholder="Assunto, empresa ou usuário" /></label><div className="space-y-2 text-sm font-medium"><label>Situação</label><FormSelect aria-label="Situação" value={mobileStatus || "all"} onValueChange={value => setMobileStatus(value === "all" ? "" : value)} options={[{ value: "all", label: "Todos" }, ...Object.entries(statusMeta).map(([value, meta]) => ({ value, label: meta.label }))]} /></div></div>
        <DrawerFooter className="flex-row gap-2 border-t bg-popover p-4"><Button type="button" variant="outline" className="flex-1" onClick={() => { setQuery(""); setSearch(""); setStatus(""); setPage(1); setLoading(true); setMobileOpen(false); refresh(); }}>Limpar</Button><Button type="button" className="flex-1" onClick={() => { setQuery(mobileQuery); setSearch(mobileQuery.trim()); setStatus(mobileStatus); setPage(1); setLoading(true); setMobileOpen(false); refresh(); }}>Aplicar filtros</Button></DrawerFooter>
      </DrawerContent>
    </Drawer></div>
    <form className="hidden min-w-0 flex-1 justify-end gap-2 2xl:flex" onSubmit={event => { event.preventDefault(); filter(); }}>
      <div className="relative min-w-0 w-[320px] shrink"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Buscar atendimentos" placeholder={master ? "Buscar assunto, empresa ou usuário" : "Buscar chamado"} className="h-9 pl-9" value={query} onChange={event => setQuery(event.target.value)} /></div>
      {search || status ? <Button type="button" variant="outline" className="h-9 gap-2" onClick={() => { setQuery(""); setSearch(""); setStatus(""); setPage(1); setLoading(true); refresh(); }}><X className="size-4" />Limpar</Button> : <Button type="submit" variant="outline" className="h-9"><Search className="size-4" />Filtrar</Button>}
    </form>
    <div className="hidden shrink-0 gap-1 rounded-lg bg-muted p-1 xl:flex">{[{ value: "", label: "Todos" }, ...Object.entries(statusMeta).map(([value, meta]) => ({ value, label: value === "resolved" ? "Resolvidos" : meta.label }))].map(option => <Button key={option.value} variant={status === option.value ? "default" : "ghost"} size="sm" className={status === option.value ? "h-7 shrink-0 px-2 text-xs shadow-sm" : "h-7 shrink-0 px-2 text-xs text-muted-foreground"} onClick={() => { setStatus(option.value); setPage(1); setLoading(true); refresh(); }}>{option.label}</Button>)}</div>
    {!master && <><HeaderSeparator className="hidden 2xl:block" /><Button className="size-9 shrink-0 gap-0 p-0 md:w-auto md:gap-2 md:px-3" aria-label="Abrir chamado" onClick={() => setNewOpen(true)}><Plus className="size-4" /><span className="sr-only md:not-sr-only">Abrir chamado</span></Button></>}
  </div>;
}

export function SupportCenter({ master = false, userId }: { master?: boolean; userId: string }) {
  const { base, revision, unread, connected, refresh } = useSupportLive();
  const isMobile = useIsMobile();
  const params = useSearchParams();
  const selected = params.get("conversa");
  const { newOpen, setNewOpen, setPage, search, status, page, loading, setLoading } = useSupportWorkspace();
  const [size, setSize] = useState(10);
  const resize = useCallback((next: number) => { setSize(next); setPage(1); setLoading(true); }, [setPage, setLoading]);
  const [data, setData] = useState<{ items: Ticket[]; total: number }>({ items: [], total: 0 });
  const [error, setError] = useState("");
  useEffect(() => {
    if (selected) return;
    const controller = new AbortController();
    void fetch(`${base}&${new URLSearchParams({ q: search, status, page: String(page), size: String(isMobile ? 10 : size) })}`, { cache: "no-store", signal: controller.signal })
      .then(async response => { const result = await response.json(); if (!response.ok) throw new Error(result.error); return result; })
      .then(result => { setPage(result.page); setData(previous => isMobile && page > 1 ? { ...result, items: [...new Map([...previous.items, ...result.items].map(item => [item.id, item])).values()] } : result); setError(""); setLoading(false); })
      .catch(error => { if (!controller.signal.aborted) { setError(error.message); setLoading(false); } });
    return () => controller.abort();
  }, [base, search, status, page, size, isMobile, revision, selected, setLoading, setPage]);
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
            {loading ? <TableLoadingRows columns={master ? 6 : 4} /> : data.items.length ? data.items.map(ticket => <TableRow key={ticket.id} className={cn(ticket.novas > 0 && "bg-blue-500/5")}><TableCell><div className="flex items-center gap-2"><MessageCircle className="size-4 shrink-0 text-muted-foreground" /><span className="max-w-80 truncate font-medium">{ticket.assunto}</span>{ticket.novas > 0 && <Badge className="bg-red-600 text-white">{ticket.novas}</Badge>}</div></TableCell>{master && <><TableCell>{ticket.empresa}</TableCell><TableCell>{ticket.usuario}</TableCell></>}<TableCell className="whitespace-nowrap tabular-nums">{date(ticket.updated_at)}</TableCell><TableCell><StatusBadge status={ticket.status} /></TableCell><TableCell className="text-right"><Button variant="outline" size="sm" onClick={() => open(ticket.id)}><MessageCircle />Abrir chat</Button></TableCell></TableRow>) : <TableRow><TableCell colSpan={master ? 6 : 4} className="h-40 text-center text-muted-foreground"><Headset className="mx-auto mb-3 size-7" />{search || status ? "Nenhum chamado encontrado." : master ? "Nenhum chamado por enquanto." : "Precisa de ajuda? Abra um chamado para a equipe Vibe Tech."}</TableCell></TableRow>}
          </TableBody></Table></div>
          <div className="mt-auto hidden flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground md:flex"><AdaptiveListSize size={size} onSizeChange={resize} maximum={25} loading={loading} /><span>{data.total} registros</span><PaginationControl page={page} pageCount={Math.max(1, Math.ceil(data.total / size))} disabled={loading} onPageChange={next => { setPage(next); setLoading(true); }} /></div>
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
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [atBottom, setAtBottom] = useState(true);
  const panel = useRef<HTMLDivElement>(null);
  const lastRead = useRef(0);
  const initial = useRef(true);
  const shouldScroll = useRef(true);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`${base}&conversa=${id}`, { cache: "no-store", signal: controller.signal }).then(async response => {
      const data = await response.json(); if (!response.ok) throw new Error(data.error); return data;
    }).then(data => {
      setTicket(data.ticket); setError("");
      if (initial.current) { setHasMore(data.hasMore); initial.current = false; }
      setMessages(previous => { const merged = new Map(previous.map(item => [item.id, item])); for (const item of data.messages as Message[]) merged.set(item.id, item); return [...merged.values()].sort((a, b) => a.id - b.id); });
    }).catch(error => { if (!controller.signal.aborted) setError(error.message); });
    return () => controller.abort();
  }, [base, id, revision]);
  useEffect(() => { if (shouldScroll.current && panel.current) panel.current.scrollTop = panel.current.scrollHeight; }, [messages]);
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
    const height = panel.current?.scrollHeight ?? 0;
    try {
      const response = await fetch(`${base}&conversa=${id}&before=${messages[0]?.id}`, { cache: "no-store" });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      shouldScroll.current = false;
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
      <CardHeader className="max-h-[25dvh] shrink-0 overflow-y-auto border-b py-3"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 space-y-1"><CardTitle className="break-words">{ticket.assunto}</CardTitle>{master && <p className="truncate text-xs text-muted-foreground">{ticket.empresas?.nome} · {ticket.perfis?.nome ?? ticket.solicitante_nome}</p>}</div><div className="flex flex-wrap items-center gap-2"><StatusBadge status={ticket.status} />{ticket.status === "resolved" ? <Button variant="outline" size="sm" disabled={busy} onClick={() => void changeStatus("waiting")}><RotateCcw />Reabrir</Button> : master && <>{ticket.status === "waiting" && <Button variant="outline" size="sm" disabled={busy} onClick={() => void changeStatus("active")}><Headset />Iniciar atendimento</Button>}<Button variant="outline" size="sm" disabled={busy} onClick={() => void changeStatus("resolved")}><CheckCheck />Resolver</Button></>}</div></div></CardHeader>
      <div ref={panel} className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain bg-muted/20 p-4" role="log" aria-label="Chat do chamado" aria-live="polite" onScroll={event => { const node = event.currentTarget; const bottom = node.scrollHeight - node.scrollTop - node.clientHeight < 40; shouldScroll.current = bottom; setAtBottom(bottom); }}>
        {hasMore && <div className="text-center"><Button size="sm" variant="outline" disabled={loadingOlder} onClick={() => void older()}>{loadingOlder ? "Carregando…" : "Carregar mensagens anteriores"}</Button></div>}
        {messages.map(message => message.tipo === "status" ? <div key={message.id} className="text-center text-xs text-muted-foreground">{message.autor_nome} · {message.texto} · {date(message.created_at)}</div> : <div key={message.id} className={cn("flex", message.autor_id === userId ? "justify-end" : "justify-start")}><div className={cn("max-w-[90%] space-y-2 rounded-xl border p-3 sm:max-w-[75%]", message.autor_id === userId ? "border-primary/15 bg-primary/5" : "bg-background")}><div className="flex flex-wrap items-center gap-2 text-xs"><span className="font-semibold">{message.autor_nome}</span>{message.suporte && <Badge variant="secondary" className="text-[10px]">Vibe Tech</Badge>}<time className="text-muted-foreground" dateTime={message.created_at}>{date(message.created_at)}</time></div>{message.texto && <p className="whitespace-pre-wrap break-words text-sm [overflow-wrap:anywhere]">{message.texto}</p>}{message.anexos.length > 0 && <div className="flex flex-wrap gap-2">{message.anexos.map(file => <a key={file.url} href={file.url} target="_blank" rel="noreferrer" className="max-w-full break-all rounded-md border bg-background p-2 text-sm underline-offset-4 hover:underline" aria-label={`Abrir imagem ${file.name}`}><Paperclip className="mr-1 inline size-4" />{file.name}</a>)}</div>}</div></div>)}
      </div>
      {!atBottom && <Button size="sm" variant="ghost" className="shrink-0" onClick={() => { if (panel.current) panel.current.scrollTop = panel.current.scrollHeight; shouldScroll.current = true; setAtBottom(true); }}>Ir para as mensagens mais recentes</Button>}
      <div className="shrink-0 border-t bg-background p-3">{ticket.status === "resolved" ? <p className="text-center text-sm text-muted-foreground">Chamado resolvido. Reabra o chamado se precisar continuar neste chat.</p> : <Composer ticket={id} onSent={() => { shouldScroll.current = true; setAtBottom(true); refresh(); }} />}</div>
    </Card>}
  </>;
}

function Composer({ ticket, isNew = false, onSent, onCancel }: { ticket?: string; isNew?: boolean; onSent: (id: string) => void; onCancel?: () => void }) {
  const { base } = useSupportLive();
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<{ assunto: string; texto: string }>();
  const fileInput = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const ids = useId();
  const request = useRef<string | null>(null);
  const conversation = useRef<string | null>(ticket ?? null);
  const [error, setError] = useState("");
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
    try { const result = await sendForm(base, form); reset(); setFiles([]); request.current = null; onSent(result.conversa); } catch (error) { setError((error as Error).message); }
  };
  if (!isNew) return <form noValidate onSubmit={event => void handleSubmit(submit)(event)} className="space-y-2">
    {files.length > 0 && <ul className="flex max-h-24 flex-wrap gap-2 overflow-y-auto">{files.map((file, index) => <li key={`${file.name}-${file.lastModified}-${file.size}`} className="flex min-w-0 max-w-full items-center gap-2 rounded-lg border bg-muted/30 py-1 pl-2 pr-1">
      <Paperclip className="size-3.5 shrink-0 text-muted-foreground" /><span className="max-w-48 truncate text-xs" title={file.name}>{file.name}</span>
      <Tooltip><TooltipTrigger render={<Button type="button" variant="destructive" size="icon-sm" disabled={isSubmitting} aria-label={`Remover imagem ${file.name}`} onClick={() => { setFiles(previous => previous.filter((_, position) => position !== index)); setError(""); }} />}><X /></TooltipTrigger><TooltipContent>Remover imagem</TooltipContent></Tooltip>
    </li>)}</ul>}
    {error && <ErrorNotice message={error} />}
    <fieldset disabled={isSubmitting} className="flex min-w-0 items-end gap-2 disabled:opacity-60">
      <input ref={fileInput} className="hidden" type="file" multiple accept="image/jpeg,image/png,image/webp" aria-label="Selecionar imagens" onChange={event => { selectFiles(event.target.files); event.target.value = ""; }} />
      <Tooltip><TooltipTrigger render={<Button type="button" variant="outline" size="icon" className="size-10 shrink-0" disabled={files.length >= 3 || isSubmitting} aria-label="Anexar imagens" onClick={() => fileInput.current?.click()} />}><Paperclip /></TooltipTrigger><TooltipContent>Anexar imagens · até 3 imagens, máximo de 3 MB</TooltipContent></Tooltip>
      <div className="min-w-0 flex-1"><Label className="sr-only" htmlFor={`${ids}-texto`}>Mensagem</Label><Textarea id={`${ids}-texto`} rows={1} className="h-10 min-h-10 resize-none field-sizing-fixed py-2.5" placeholder="Escreva sua mensagem…" aria-invalid={!!errors.texto} {...register("texto", { maxLength: { value: 5000, message: "Use até 5.000 caracteres." } })} /></div>
      <Tooltip><TooltipTrigger render={<Button type="submit" className="h-10 shrink-0 gap-2" disabled={isSubmitting} aria-label={isSubmitting ? "Enviando mensagem" : "Enviar mensagem"} />}>{isSubmitting ? <LoaderCircle className="animate-spin" /> : <Send />}<span className="hidden sm:inline">{isSubmitting ? "Enviando…" : "Enviar"}</span></TooltipTrigger><TooltipContent>Enviar mensagem</TooltipContent></Tooltip>
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
