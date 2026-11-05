export function mesiControlloAV7(tipo: unknown): number | null {
  const normalized = typeof tipo === "string" ? tipo.trim().toUpperCase() : "";
  if (normalized === "SEMPLIFICATE") return 36;
  if (normalized === "ORDINARIE") return 24;
  if (normalized === "RAFFORZATE") return 6;
  return null;
}

export function calcolaScadenzaAV7(data: string, mesi: number): string {
  const parts = data.split("-").map(Number);
  if (parts.length !== 3 || parts.some(x => !Number.isInteger(x))) return "";
  const [year, month, day] = parts;
  const source = new Date(Date.UTC(year, month - 1, day));
  if (source.getUTCFullYear() !== year || source.getUTCMonth() !== month - 1 || source.getUTCDate() !== day) return "";
  if (!Number.isInteger(mesi) || mesi <= 0) return "";
  const target = new Date(Date.UTC(year, month - 1 + mesi, 1));
  const end = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, end));
  return [target.getUTCFullYear(), String(target.getUTCMonth() + 1).padStart(2, "0"), String(target.getUTCDate()).padStart(2, "0")].join("-");
}