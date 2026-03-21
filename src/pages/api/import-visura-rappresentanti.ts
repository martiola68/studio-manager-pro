export type VisuraRappresentante = {
  nome_cognome: string | null;
  codice_fiscale: string | null;
  luogo_nascita: string | null;
  data_nascita: string | null;
  citta_residenza: string | null;
  indirizzo_residenza: string | null;
  nazionalita: string | null;
  CAP: string | null;
  ruolo: "amministratore" | "socio" | null;
};

export function mapVisuraRappresentanti(text: string): VisuraRappresentante[] {
  const cleanText = normalizeText(text);
  const lines = cleanText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const results: VisuraRappresentante[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const cfMatch = line.match(/Codice fiscale:\s*([A-Z0-9]{16})/i);
    if (!cfMatch) continue;

    const codiceFiscale = cfMatch[1].toUpperCase();

    const windowStart = Math.max(0, i - 8);
    const windowEnd = Math.min(lines.length - 1, i + 8);
    const block = lines.slice(windowStart, windowEnd + 1);

    const ruolo = detectRole(block);
    const nome = findNameBeforeCf(lines, i);
    const nascita = findBirthData(block);
    const domicilio = findDomicile(block);

    if (!nome || !codiceFiscale) continue;

    results.push({
      nome_cognome: nome,
      codice_fiscale: codiceFiscale,
      luogo_nascita: nascita.luogo_nascita,
      data_nascita: nascita.data_nascita,
      citta_residenza: domicilio.citta_residenza,
      indirizzo_residenza: domicilio.indirizzo_residenza,
      nazionalita: null,
      CAP: domicilio.CAP,
      ruolo,
    });
  }

  return dedupeByCf(results);
}

function normalizeText(text: string): string {
  return text
    .replace(/\r/g, "\n")
    .replace(/\u00A0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .replace(/[’`]/g, "'")
    .trim();
}

function detectRole(block: string[]): "amministratore" | "socio" | null {
  const joined = block.join(" ").toLowerCase();

  if (joined.includes("amministratore") || joined.includes("rappresentante dell'impresa")) {
    return "amministratore";
  }

  if (joined.includes("proprieta'") || joined.includes("quota di nominali")) {
    return "socio";
  }

  return null;
}

function findNameBeforeCf(lines: string[], cfIndex: number): string | null {
  for (let j = cfIndex - 1; j >= Math.max(0, cfIndex - 6); j--) {
    const line = lines[j].trim();

    if (isLikelyPersonName(line)) {
      return normalizeName(line);
    }
  }

  return null;
}

function isLikelyPersonName(line: string): boolean {
  if (!line) return false;
  if (line.length < 5) return false;
  if (/Codice fiscale:/i.test(line)) return false;
  if (/Nato a/i.test(line)) return false;
  if (/Rappresentante dell'impresa/i.test(line)) return false;
  if (/Proprieta'/i.test(line)) return false;
  if (/Amministratore/i.test(line)) return false;
  if (/Quota di nominali/i.test(line)) return false;
  if (/Tipo di diritto/i.test(line)) return false;
  if (/domicilio/i.test(line)) return false;
  if (/carica/i.test(line)) return false;
  if (/poteri/i.test(line)) return false;
  if (/posta elettronica/i.test(line)) return false;

  return /^[A-ZÀ-Ü' ]+$/.test(line);
}

function normalizeName(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.replace(/\s+/g, " ").trim();
}

function findBirthData(block: string[]): {
  luogo_nascita: string | null;
  data_nascita: string | null;
} {
  const joined = block.join(" ");

  const match = joined.match(/Nato a\s+([A-ZÀ-Ü' ]+?)\s+\([A-Z]{2}\)\s+il\s+(\d{2}\/\d{2}\/\d{4})/i);
  if (!match) {
    return {
      luogo_nascita: null,
      data_nascita: null,
    };
  }

  return {
    luogo_nascita: normalizeCity(match[1]),
    data_nascita: toIsoDate(match[2]),
  };
}

function findDomicile(block: string[]): {
  citta_residenza: string | null;
  indirizzo_residenza: string | null;
  CAP: string | null;
} {
  for (let i = 0; i < block.length; i++) {
    const line = block[i];

    const m = line.match(/^([A-ZÀ-Ü' ]+?)\s+\([A-Z]{2}\)\s+(.+?)\s+CAP\s+(\d{5})$/i);
    if (m) {
      return {
        citta_residenza: normalizeCity(m[1]),
        indirizzo_residenza: normalizeAddress(m[2]),
        CAP: m[3],
      };
    }
  }

  return {
    citta_residenza: null,
    indirizzo_residenza: null,
    CAP: null,
  };
}

function normalizeCity(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.replace(/\s+/g, " ").trim();
}

function normalizeAddress(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.replace(/\s+/g, " ").trim();
}

function toIsoDate(value: string | null | undefined): string | null {
  if (!value) return null;

  const m = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;

  return `${m[3]}-${m[2]}-${m[1]}`;
}

function dedupeByCf(items: VisuraRappresentante[]): VisuraRappresentante[] {
  const map = new Map<string, VisuraRappresentante>();

  for (const item of items) {
    const cf = item.codice_fiscale?.trim().toUpperCase();
    if (!cf) continue;

    if (!map.has(cf)) {
      map.set(cf, item);
    }
  }

  return Array.from(map.values());
}
