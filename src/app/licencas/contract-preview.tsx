"use client";
import { billingSchedule } from "@/lib/license-schedule";
export function ContractPreview({
  inicio,
  fim,
  valor,
  dia,
}: {
  inicio: string;
  fim: string;
  valor: number | null;
  dia: number;
}) {
  const rows = billingSchedule(inicio, fim, valor ?? 0, dia);
  const money = (n: number) =>
    n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const date = (v: string) => v.split("-").reverse().join("/");
  if (!rows.length)
    return (
      <p className="text-xs text-muted-foreground">
        Preencha o período, a mensalidade e o vencimento para visualizar as
        cobranças (até 120 ciclos).
      </p>
    );
  return (
    <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
      <p className="text-sm font-medium">
        {rows.length} mensalidades de {money(rows[0].valor)} · Total{" "}
        {money(rows.reduce((n, r) => n + r.valor, 0))}
      </p>
      <p className="text-xs text-muted-foreground">
        Mensalidade integral por ciclo iniciado, sem proporcional. Competência é
        o mês de início do ciclo. O vencimento usa a próxima ocorrência do dia
        escolhido, limitado ao último dia do mês.
      </p>
      <div className="max-h-40 overflow-y-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr>
              <th className="py-2">Ciclo a partir de</th>
              <th>Vencimento</th>
              <th className="text-right">Valor</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.numero}>
                <td className="py-1">{date(r.ciclo)}</td>
                <td>{date(r.vencimento)}</td>
                <td className="text-right">{money(r.valor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
