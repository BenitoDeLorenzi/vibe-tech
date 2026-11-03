export function getCurrentFleetMonth(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit",
  }).formatToParts(date);
  const year = parts.find(part => part.type === "year")?.value;
  const month = parts.find(part => part.type === "month")?.value;
  return `${year}-${month}`;
}

export function resolveFleetMonth(value?: string | null): string {
  if (value === "all") return "";
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value ?? "") ? value! : getCurrentFleetMonth();
}
