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

  const soci = extractSoci(cleanText);
  const amministratori = extractAmministratori(cleanText);

  return dedupeByCf([...soci, ...amministratori]);
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

function extractSoci(text: string): VisuraRappresentante[] {
  const results: VisuraRappresentante[] = [];

  const socioRegex =
    /Proprieta'\s+([A-ZÀ-Ü' ]+?)\s+Quota di nominali:[\s\S]*?Codice fiscale:\s*([A-Z0-9]{16})[\s\S]*?(?:Domicilio del titolare o rappresentante|domicilio del titolare o rappresentante)\s+comune\s+([A-ZÀ-Ü' ]+?)\s+\([A-Z]{2}\)\s+(.+?)\s+CAP\s+(\d{5})/gm;

  let match: RegExpExecArray | null;

  while ((match = socioRegex.exec(text)) !== null) {
    const nome = normalizeName(match[1]);
    const codiceFiscale = (match[2] || "").trim().toUpperCase();
    const citta = normalizeCity(match[3]);
    const indirizzo = normalizeAddress(match[4]);
    const cap = (match[5] || "").trim();

    if (!nome || !codiceFiscale) continue;

    results.push({
      nome_cognome: nome,
      codice_fiscale: codiceFiscale,
      luogo_nascita: null,
      data_nascita: null,
      citta_residenza: citta,
      indirizzo_residenza: indirizzo,
      nazionalita: null,
      CAP: cap || null,
      ruolo: "socio",
    });
  }

  return results;
}

function extractAmministratori(text: string): VisuraRappresentante[] {
  const results: VisuraRappresentante[] = [];

  const adminRegex =
    /Amministratore\s+([A-ZÀ-Ü' ]+?)\s+Rappresentante dell'impresa\s+Nato a\s+([A-ZÀ-Ü' ]+?)\s+\([A-Z]{2}\)\s+il\s+(\d{2}\/\d{2}\/\d{4})\s+Codice fiscale:\s*([A-Z0-9]{16})\s+([A-ZÀ-Ü' ]+?)\s+\([A-Z]{2}\)\s+(.+?)\s+CAP\s+(\d{5})/gm;

  let match: RegExpExecArray | null;

  while ((match = adminRegex.exec(text)) !== null) {
    const nome = normalizeName(match[1]);
    const luogoNascita = normalizeCity(match[2]);
    const dataNascita = toIsoDate(match[3]);
    const codiceFiscale = (match[4] || "").trim().toUpperCase();
    const cittaResidenza = normalizeCity(match[5]);
    const indirizzo = normalizeAddress(match[6]);
    const cap = (match[7] || "").trim();

    if (!nome || !codiceFiscale) continue;

    results.push({
      nome_cognome: nome,
      codice_fiscale: codiceFiscale,
      luogo_nascita: luogoNascita,
      data_nascita: dataNascita,
      citta_residenza: cittaResidenza,
      indirizzo_residenza: indirizzo,
      nazionalita: null,
      CAP: cap || null,
      ruolo: "amministratore",
    });
  }

  return results;
}

function normalizeName(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.replace(/\s+/g, " ").trim();
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
