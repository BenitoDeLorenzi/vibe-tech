/** Calendar arithmetic anchored to the original day (never chained from February). */
export function addMonths(date: string, months: number) {
  const [year, month, day] = date.split("-").map(Number);
  const last = new Date(Date.UTC(year, month + months, 0)).getUTCDate();
  return new Date(Date.UTC(year, month - 1 + months, Math.min(day, last)))
    .toISOString()
    .slice(0, 10);
}

export function validDate(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}

export function billingSchedule(
  inicio: string,
  fim: string,
  mensalidade: number,
  dia: number,
) {
  if (
    !validDate(inicio) ||
    !validDate(fim) ||
    fim < inicio ||
    !Number.isFinite(mensalidade) ||
    mensalidade <= 0 ||
    mensalidade > 9999999999.99 ||
    !Number.isInteger(dia) ||
    dia < 1 ||
    dia > 31
  )
    return [];
  const rows: {
    numero: number;
    competencia: string;
    ciclo: string;
    vencimento: string;
    valor: number;
  }[] = [];
  for (let i = 0; i < 120; i++) {
    const ciclo = addMonths(inicio, i);
    if (ciclo > fim) return rows;
    const month = ciclo.slice(0, 7);
    const last = new Date(
      Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0),
    ).getUTCDate();
    let vencimento = `${month}-${String(Math.min(dia, last)).padStart(2, "0")}`;
    // A due day before the cycle starts means the next occurrence of that day.
    if (vencimento < ciclo) {
      const next = addMonths(`${month}-01`, 1);
      const end = new Date(
        Date.UTC(Number(next.slice(0, 4)), Number(next.slice(5, 7)), 0),
      ).getUTCDate();
      vencimento = `${next.slice(0, 7)}-${String(Math.min(dia, end)).padStart(2, "0")}`;
    }
    rows.push({
      numero: i + 1,
      competencia: `${month}-01`,
      ciclo,
      vencimento,
      valor: Math.round(mensalidade * 100) / 100,
    });
  }
  return addMonths(inicio, 120) <= fim ? [] : rows;
}

export function todayInSaoPaulo() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
}
