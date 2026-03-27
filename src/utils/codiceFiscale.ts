export const CF_RE =
  /^[A-Z]{6}[0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$/;

export function normalizeCF(cf: string) {
  return (cf || "").trim().toUpperCase();
}

const ODD_MAP: Record<string, number> = {
  "0": 1,
  "1": 0,
  "2": 5,
  "3": 7,
  "4": 9,
  "5": 13,
  "6": 15,
  "7": 17,
  "8": 19,
  "9": 21,
  A: 1,
  B: 0,
  C: 5,
  D: 7,
  E: 9,
  F: 13,
  G: 15,
  H: 17,
  I: 19,
  J: 21,
  K: 2,
  L: 4,
  M: 18,
  N: 20,
  O: 11,
  P: 3,
  Q: 6,
  R: 8,
  S: 12,
  T: 14,
  U: 16,
  V: 10,
  W: 22,
  X: 25,
  Y: 24,
  Z: 23,
};

const EVEN_MAP: Record<string, number> = {
  "0": 0,
  "1": 1,
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "9": 9,
  A: 0,
  B: 1,
  C: 2,
  D: 3,
  E: 4,
  F: 5,
  G: 6,
  H: 7,
  I: 8,
  J: 9,
  K: 10,
  L: 11,
  M: 12,
  N: 13,
  O: 14,
  P: 15,
  Q: 16,
  R: 17,
  S: 18,
  T: 19,
  U: 20,
  V: 21,
  W: 22,
  X: 23,
  Y: 24,
  Z: 25,
};

export function computeCFCheckChar(cf15: string) {
  let sum = 0;

  for (let i = 0; i < 15; i++) {
    const c = cf15[i];
    const isOddPosition = (i + 1) % 2 === 1;
    sum += isOddPosition ? ODD_MAP[c] : EVEN_MAP[c];
  }

  const r = sum % 26;
  return String.fromCharCode("A".charCodeAt(0) + r);
}

export function isValidCF(cfRaw: string) {
  const cf = normalizeCF(cfRaw);

  if (!CF_RE.test(cf)) return false;

  const expected = computeCFCheckChar(cf.substring(0, 15));
  return expected === cf[15];
}

export function extractCodiceCatastaleFromCF(cfRaw?: string | null) {
  const cf = normalizeCF(cfRaw || "");

  if (!CF_RE.test(cf)) return null;

  return cf.slice(11, 15);
}

export function extractCodiceCatastaleFromCF(codiceFiscale: string): string {
  const cf = normalizeCF(codiceFiscale);
  if (cf.length !== 16) return "";
  return cf.slice(11, 15);
}

function decodeOmocodiaChar(char: string): string {
  const map: Record<string, string> = {
    L: "0",
    M: "1",
    N: "2",
    P: "3",
    Q: "4",
    R: "5",
    S: "6",
    T: "7",
    U: "8",
    V: "9",
  };

  const upper = char.toUpperCase();
  return map[upper] ?? upper;
}

export function extractDataNascitaFromCF(codiceFiscale: string): string | null {
  const cf = normalizeCF(codiceFiscale);
  if (cf.length !== 16) return null;

  const yearPart =
    decodeOmocodiaChar(cf[6]) + decodeOmocodiaChar(cf[7]);

  const monthChar = cf[8].toUpperCase();

  const dayPart =
    decodeOmocodiaChar(cf[9]) + decodeOmocodiaChar(cf[10]);

  const monthMap: Record<string, number> = {
    A: 1,
    B: 2,
    C: 3,
    D: 4,
    E: 5,
    H: 6,
    L: 7,
    M: 8,
    P: 9,
    R: 10,
    S: 11,
    T: 12,
  };

  const month = monthMap[monthChar];
  if (!month) return null;

  let day = Number(dayPart);
  if (Number.isNaN(day)) return null;

  if (day > 40) {
    day -= 40;
  }

  if (day < 1 || day > 31) return null;

  const yy = Number(yearPart);
  if (Number.isNaN(yy)) return null;

  const currentYear = new Date().getFullYear() % 100;
  const fullYear = yy <= currentYear ? 2000 + yy : 1900 + yy;

  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");

  return `${fullYear}-${mm}-${dd}`;
}
