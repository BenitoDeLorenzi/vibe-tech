export function gestaoListLimit(raw?: string): number {
  const value = Number(raw);
  return Number.isSafeInteger(value) && value >= 10 ? value : 10;
}
