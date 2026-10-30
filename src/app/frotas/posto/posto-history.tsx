import { DatePickerInput } from "@/app/licencas/date-picker-input";
import Link from "next/link";
import { Eye, Fuel, ReceiptText, Search, CircleDollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Table, TableHeader, TableHead, TableRow, TableBody, TableCell } from "@/components/ui/table";
import type { FrotaAbastecimento } from "@/lib/frotas-data";
import { historyTotals } from "@/lib/posto-history";
import { OrdensRealtime } from "./ordens-realtime";
export const money = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
export const number = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
export const completedDate = (row: FrotaAbastecimento) => row.completed_at ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(row.completed_at)) : "Não informada";
export function PostoHistory({ orders, q, from, to }: { orders: FrotaAbastecimento[]; q?: string; from: string; to: string }) {
  const totals = historyTotals(orders);
  return <>
    <section aria-label="Totais dos resultados" className="hidden gap-3 sm:grid sm:grid-cols-2 lg:grid-cols-4">
      {[{ label:"Abastecimentos", value:String(totals.count), icon:ReceiptText },{ label:"Combustível", value:`${number(totals.liters)} L`, icon:Fuel },{ label:"ARLA", value:`${number(totals.arla)} L`, icon:Fuel },{ label:"Total abastecido", value:money(totals.value), icon:CircleDollarSign }].map(({label,value,icon:Icon})=><Card key={label}><CardContent className="flex items-center gap-3"><span className="rounded-lg bg-sky-500/10 p-2 text-sky-700 dark:text-sky-400"><Icon className="size-5" /></span><div><div className="text-xs text-muted-foreground">{label}</div><div className="text-xl font-semibold tabular-nums">{value}</div></div></CardContent></Card>)}
    </section>
    <Card className="gap-0 overflow-visible bg-transparent py-0 ring-0 sm:gap-4 sm:overflow-hidden sm:bg-card sm:py-4 sm:ring-1"><CardHeader className="hidden px-0 pb-3 sm:block sm:px-4"><CardTitle>Histórico de abastecimentos</CardTitle><OrdensRealtime nextExpiry={null} /></CardHeader><CardContent className="space-y-4 px-0 sm:px-4">
      <form className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_36px] items-end gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-[1fr_160px_160px_auto_auto]">
        <input type="hidden" name="tab" value="history" />
        <label className="hidden space-y-1 text-sm sm:block"><span>Buscar</span><Input key={q ?? ""} name="q" defaultValue={q} placeholder="Ordem, placa, veículo ou motorista" /></label>
        <DatePickerInput key={`from-${from}`} id="history-from" name="from" label="De" defaultValue={from} />
        <DatePickerInput key={`to-${to}`} id="history-to" name="to" label="Até" defaultValue={to} />
        <Button type="submit" variant="outline" aria-label="Filtrar por período" className="size-9 gap-0 px-0 sm:w-auto sm:gap-2 sm:px-3"><Search className="size-4" /><span className="hidden sm:inline">Filtrar</span></Button>
        {from || to ? <Link href="/frotas/posto?tab=history" className={buttonVariants({variant:"outline", className:"col-span-3 h-7 justify-self-end border-0 bg-transparent px-0 text-xs text-muted-foreground shadow-none sm:col-auto sm:h-9 sm:border sm:bg-background sm:px-3 sm:text-sm"})}>Limpar período</Link> : null}
      </form>
      {from && to && from > to ? <p role="alert" className="text-sm text-destructive">A data inicial deve ser anterior ou igual à data final.</p> : null}
      {orders.length ? <div className="vehicle-detail-mobile-table posto-history-mobile-table overflow-hidden rounded-lg border"><Table><TableHeader><TableRow><TableHead>Ordem</TableHead><TableHead>Veículo</TableHead><TableHead>Motorista</TableHead><TableHead>Conclusão</TableHead><TableHead>Litros</TableHead><TableHead className="text-right">Valor</TableHead><TableHead>Nota fiscal</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader><TableBody>
        {orders.map(row=><TableRow key={row.id}><TableCell className="font-medium">{row.numero_ordem}</TableCell><TableCell><div className="font-medium">{row.modelo}</div><div className="text-xs text-muted-foreground">{row.marca} · {row.placa}</div></TableCell><TableCell>{row.motorista}</TableCell><TableCell>{completedDate(row)}</TableCell><TableCell>{number(row.litros??0)} L{row.arla_litros ? <div className="text-xs text-muted-foreground">ARLA: {number(row.arla_litros)} L</div> : null}</TableCell><TableCell className="text-right tabular-nums">{money(row.valor_total??0)}</TableCell><TableCell>{row.numero_nota_fiscal??"-"}</TableCell><TableCell className="text-right"><Tooltip><TooltipTrigger render={<Link href={`/frotas/posto/historico/${row.id}`} aria-label={`Ver abastecimento ${row.numero_ordem}`} className={buttonVariants({variant:"ghost",size:"icon-sm"})}><Eye className="size-4" /></Link>} /><TooltipContent>Ver abastecimento</TooltipContent></Tooltip></TableCell></TableRow>)}
      </TableBody></Table></div> : <div className="rounded-lg bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">Nenhum abastecimento concluído encontrado para os filtros selecionados.</div>}
    </CardContent></Card>
  </>;
}
