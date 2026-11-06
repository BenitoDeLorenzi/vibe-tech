"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CircleCheck, CircleX, ClipboardList, Eye, LoaderCircle, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { AdminMobileCard } from "@/components/admin-mobile-card";
import { FrotasEmptyState } from "@/components/frotas-empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ListPanelHeader } from "@/components/list-panel-header";
import { Progress, ProgressLabel } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type Run = { id: string; competencia: string; status: string; createdAt: string; completedAt: string | null; total: number; success: number; error: number; pending: number };
type Item = { id: string; veiculo_id: string | null; placa: string; renavam: string | null; status: string; error_message: string | null; completed_at: string | null };

function date(value: string | null) { return value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value)) : "—"; }
function month(value: string) { const [year, month] = value.slice(0, 7).split("-"); return `${month}/${year}`; }
function status(run: Run) { return run.status === "processing" ? "Em andamento" : run.error ? "Concluída com falhas" : "Concluída"; }

export function VehicleUpdatesPanel({ companyId, companyName, competencia, initialRuns, vehicleCount, canManage, simulation }: {
  companyId?: string; companyName: string; competencia: string; initialRuns: Run[]; vehicleCount: number; canManage: boolean; simulation: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [runs, setRuns] = useState(initialRuns);
  const confirmOpen = !simulation && canManage && Boolean(vehicleCount) && !runs.some((run) => run.competencia === competencia) && searchParams.get("novo") === "1";
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const [visibleCount, setVisibleCount] = useState(10);
  const active = !simulation && runs.some((run) => run.status === "processing");
  const currentProgress = simulation ? runs[0] : runs.find((run) => run.status === "processing");

  function closeConfirm() {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("novo");
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  }

  useEffect(() => {
    if (!simulation) return;
    const timer = window.setInterval(() => setRuns((current) => current.map((run) => {
      const processed = run.success + run.error;
      if (processed >= run.total) return run;
      const next = processed + 1;
      return { ...run, success: next - 3, pending: run.total - next,
        status: next === run.total ? "completed" : "processing",
        completedAt: next === run.total ? new Date().toISOString() : null };
    })), 500);
    return () => window.clearInterval(timer);
  }, [simulation]);

  const refresh = useCallback(async (withItems = false) => {
    if (!companyId) return;
    const query = new URLSearchParams({ prefeitura: companyId });
    if (withItems && detailsId) query.set("runId", detailsId);
    const response = await fetch(`/api/frotas/veiculos/atualizacoes?${query}`, { cache: "no-store" });
    if (!response.ok) throw new Error("Não foi possível atualizar o histórico.");
    const payload = await response.json();
    setRuns(payload.runs);
    if (withItems && payload.items) setItems(payload.items);
  }, [companyId, detailsId]);

  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => { void refresh(Boolean(detailsId)).catch(() => {}); }, 10_000);
    return () => window.clearInterval(timer);
  }, [active, detailsId, refresh]);

  async function mutate(action: "start" | "retry", runId?: string) {
    if (!companyId || simulation) return;
    setBusy(true);
    try {
      const response = await fetch("/api/frotas/veiculos/atualizacoes", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, runId, prefeitura: companyId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Não foi possível iniciar a atualização.");
      if (action === "start") closeConfirm();
      toast.success(action === "start" ? "Atualização iniciada." : "Nova tentativa iniciada para os veículos com falha.");
      await refresh(Boolean(detailsId));
    } catch (error) { toast.error(error instanceof Error ? error.message : "Falha ao iniciar."); }
    finally { setBusy(false); }
  }

  async function openDetails(runId: string) {
    setDetailsId(runId);
    if (simulation) return;
    setLoadingItems(true);
    try {
      const query = new URLSearchParams({ prefeitura: companyId ?? "", runId });
      const response = await fetch(`/api/frotas/veiculos/atualizacoes?${query}`, { cache: "no-store" });
      if (!response.ok) throw new Error();
      const result = await response.json();
      setRuns(result.runs); setItems(result.items ?? []);
    } catch { toast.error("Não foi possível carregar os veículos."); }
    finally { setLoadingItems(false); }
  }

  const selectedRun = runs.find((run) => run.id === detailsId);
  const shownItems = simulation && selectedRun ? Array.from({ length: 100 }, (_, index) => {
    const state = index < 3 ? "error" : index < selectedRun.success + selectedRun.error ? "success" : "pending";
    return { id: `simulation-${index + 1}`, veiculo_id: null, placa: `SIM${String(index + 1).padStart(4, "0")}`,
      renavam: `000000${String(index + 1).padStart(5, "0")}`, status: state,
      error_message: state === "error" ? "Exemplo de falha. Nenhuma requisição real foi feita." : null,
      completed_at: state === "pending" ? null : selectedRun.createdAt };
  }) : items;
  return <main className="flex min-h-full flex-col gap-3 p-4">
    {currentProgress && <section className="rounded-xl border bg-card p-4" aria-label="Progresso da atualização">
      <Progress value={Math.round(((currentProgress.success + currentProgress.error) / Math.max(1, currentProgress.total)) * 100)}>
        <ProgressLabel>Atualização {month(currentProgress.competencia)} {simulation && <Badge variant="secondary" className="ml-2">Simulação</Badge>}</ProgressLabel>
        <span className="ml-auto text-sm tabular-nums text-muted-foreground">{currentProgress.success + currentProgress.error} de {currentProgress.total}</span>
      </Progress>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-muted-foreground">{currentProgress.success} concluídos · {currentProgress.error} falhas · {currentProgress.pending} aguardando</p>{simulation && <Button variant="outline" size="sm" onClick={() => setRuns(initialRuns)}>Reiniciar simulação</Button>}</div>
    </section>}
    <Card className="frotas-list-card flex flex-1 flex-col">
      <div className="hidden md:block"><ListPanelHeader title="Histórico de atualizações" icon={ClipboardList} /></div>
      <CardContent className="space-y-3">
        {!companyId && !simulation ? <FrotasEmptyState icon={ClipboardList} title="Nenhuma empresa selecionada" description="Selecione uma empresa licenciada para consultar as atualizações." />
          : !runs.length ? <FrotasEmptyState icon={ClipboardList} title="Nenhuma atualização encontrada" description={`Inicie a primeira atualização mensal dos veículos de ${companyName}.`} />
          : <>
            <div className="space-y-3 md:hidden">{runs.slice(0, visibleCount).map((run) => <AdminMobileCard key={run.id}
              title={month(run.competencia)} badge={<RunBadge run={run} />}
              details={[{ label: "Iniciada em", value: date(run.createdAt) }, { label: "Veículos", value: run.total }, { label: "Concluídos", value: run.success }, { label: "Falhas", value: run.error }]}
              actions={<Tooltip><TooltipTrigger render={<Button size="icon-sm" variant="outline" aria-label={`Ver detalhes de ${month(run.competencia)}`} onClick={() => void openDetails(run.id)} />}><Eye className="size-4" /></TooltipTrigger><TooltipContent>Ver detalhes</TooltipContent></Tooltip>} />)}</div>
            <div className="hidden overflow-hidden rounded-lg border md:block"><Table><TableHeader><TableRow className="bg-muted/50"><TableHead>Competência</TableHead><TableHead>Iniciada em</TableHead><TableHead>Total</TableHead><TableHead>Concluídos</TableHead><TableHead>Falhas</TableHead><TableHead>Situação</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
              <TableBody>{runs.slice(0, visibleCount).map((run) => <TableRow key={run.id}><TableCell className="font-medium">{month(run.competencia)}</TableCell><TableCell>{date(run.createdAt)}</TableCell><TableCell>{run.total}</TableCell><TableCell>{run.success}</TableCell><TableCell>{run.error}</TableCell><TableCell><RunBadge run={run} /></TableCell><TableCell className="text-right"><Tooltip><TooltipTrigger render={<Button size="icon-sm" variant="outline" aria-label={`Ver detalhes de ${month(run.competencia)}`} onClick={() => void openDetails(run.id)} />}><Eye className="size-4" /></TooltipTrigger><TooltipContent>Ver detalhes</TooltipContent></Tooltip></TableCell></TableRow>)}</TableBody>
            </Table></div>
            {visibleCount < runs.length && <Button variant="outline" className="w-full" onClick={() => setVisibleCount((count) => count + 10)}>Mostrar mais</Button>}
            <p className="text-center text-xs text-muted-foreground">Mostrando {Math.min(visibleCount, runs.length)} de {runs.length}</p>
          </>}
      </CardContent>
    </Card>
    <Dialog open={confirmOpen} onOpenChange={(open) => { if (!open) closeConfirm(); }}><DialogContent><DialogHeader><DialogTitle>Nova atualização mensal</DialogTitle><DialogDescription>Confira os dados antes de iniciar as consultas.</DialogDescription></DialogHeader>
      <div className="rounded-lg border bg-muted/30 p-3 text-sm"><div className="flex justify-between gap-3"><span>Empresa</span><strong className="text-right">{companyName}</strong></div><div className="mt-2 flex justify-between"><span>Competência</span><strong>{month(competencia)}</strong></div><div className="mt-2 flex justify-between"><span>Veículos cadastrados</span><strong>{vehicleCount}</strong></div></div>
      <p className="text-sm text-muted-foreground">Será feita uma consulta por veículo com placa e Renavam válidos. Veículos sem esses dados aparecerão como falha. A operação continua após fechar esta janela e pode consumir créditos por consulta.</p>
      <DialogFooter><DialogClose render={<Button variant="outline" disabled={busy} />}>Cancelar</DialogClose><Button disabled={busy} onClick={() => void mutate("start")}>{busy && <LoaderCircle className="size-4 animate-spin" />} Iniciar atualização</Button></DialogFooter>
    </DialogContent></Dialog>
    <Dialog open={Boolean(detailsId)} onOpenChange={(open) => { if (!open) { setDetailsId(null); setItems([]); } }}><DialogContent className="sm:max-w-2xl"><DialogHeader><DialogTitle>Veículos consultados · {selectedRun ? month(selectedRun.competencia) : ""}</DialogTitle><DialogDescription>{selectedRun ? `${selectedRun.success} concluídos · ${selectedRun.error} falhas · ${selectedRun.pending} aguardando` : "Resultado individual das consultas."}</DialogDescription></DialogHeader>
      {loadingItems ? <p className="py-8 text-center text-sm text-muted-foreground">Carregando veículos…</p> : <div className="space-y-2">{shownItems.map((item) => <div key={item.id} className="flex items-start justify-between gap-3 rounded-lg border p-3 text-sm"><div><div className="font-medium">{item.placa} <span className="font-normal text-muted-foreground">· Renavam {item.renavam ?? "—"}</span></div>{item.error_message && item.status === "error" && <p className="mt-1 text-xs text-destructive">{item.error_message.replace(/Plexi/gi, "serviço de consulta")}</p>}{item.completed_at && <p className="mt-1 text-xs text-muted-foreground">{date(item.completed_at)}</p>}</div><ItemBadge value={item.status} /></div>)}</div>}
      <DialogFooter>{canManage && selectedRun && selectedRun.error > 0 && selectedRun.pending === 0 && <Button variant="outline" disabled={busy} onClick={() => void mutate("retry", selectedRun.id)}><RotateCcw className="size-4" /> Tentar novamente as falhas</Button>}<DialogClose render={<Button variant="secondary" />}>Fechar</DialogClose></DialogFooter>
    </DialogContent></Dialog>
  </main>;
}

function RunBadge({ run }: { run: Run }) { return <Badge variant="outline" className={run.status === "processing" ? "border-sky-200 bg-sky-50 text-sky-700" : run.error ? "border-amber-200 bg-amber-50 text-amber-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}>{run.status === "processing" ? <LoaderCircle className="size-3 animate-spin" /> : run.error ? <CircleX className="size-3" /> : <CircleCheck className="size-3" />}{status(run)}</Badge>; }
function ItemBadge({ value }: { value: string }) { return <Badge variant="outline" className={value === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : value === "error" ? "border-red-200 bg-red-50 text-red-700" : "border-sky-200 bg-sky-50 text-sky-700"}>{value === "success" ? "Concluído" : value === "error" ? "Falhou" : value === "processing" ? "Consultando" : "Aguardando"}</Badge>; }
