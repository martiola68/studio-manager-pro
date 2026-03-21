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
  const blocks = splitIntoBlocks(cleanText);

  const parsed: VisuraRappresentante[] = [];

  for (const block of blocks) {
    const role = detectRole(block);
    if (!role) continue;

    const subject = parseSubjectBlock(block, role);
    if (!subject) continue;

    // con questo schema possiamo tenere solo soggetti con CF
    if (!subject.nome_cognome || !subject.codice_fiscale) continue;

    parsed.push(subject);
  }

  return dedupeByCf(parsed);
}

function normalizeText(text: string): string {
  return text
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function splitIntoBlocks(text: string): string[] {
  return text
    .split(/\n(?=[A-ZÀ-Ü][A-ZÀ-Ü' ]{5,}(?:\n|$))/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

function detectRole(block: string): "amministratore" | "socio" | null {
  const lower = block.toLowerCase();

  if (
    lower.includes("amministratore") ||
    lower.includes("legale rappresentante") ||
    lower.includes("consigliere") ||
    lower.includes("presidente")
  ) {
    return "amministratore";
  }

  if (
    lower.includes(" socio ") ||
    lower.startsWith("socio") ||
    lower.includes("quota") ||
    lower.includes("partecipazione")
  ) {
    return "socio";
  }

  return null;
}

function parseSubjectBlock(
  block: string,
  ruolo: "amministratore" | "socio"
): VisuraRappresentante | null {
  const nomeMatch =
    block.match(/^([A-ZÀ-Ü][A-ZÀ-Ü' ]{4,})/m);

  const cfMatch =
    block.match(/codice fiscale[: ]+([A-Z0-9]{16})/i) ||
    block.match(/\b([A-Z]{6}[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{3}[A-Z])\b/i);

  const nascitaMatch =
    block.match(/nato(?:\/a)? a ([^,\n]+).*?il ([0-9]{2}\/[0-9]{2}\/[0-9]{4})/i);

  const residenzaMatch =
    block.match(/residen(?:te|za) (?:in|a)?\s*([^,\n;]+)(?:[,;]\s*([^,\n;]+))?/i);

  const capMatch = block.match(/\b(\d{5})\b/);

  const nome_cognome = nomeMatch?.[1]?.trim() ?? null;
  const codice_fiscale = cfMatch?.[1]?.trim().toUpperCase() ?? null;
  const luogo_nascita = nascitaMatch?.[1]?.trim() ?? null;
  const data_nascita = nascitaMatch?.[2] ? toIsoDate(nascitaMatch[2]) : null;
  const citta_residenza = residenzaMatch?.[1]?.trim() ?? null;
  const indirizzo_residenza = residenzaMatch?.[2]?.trim() ?? null;
  const CAP = capMatch?.[1] ?? null;

  if (!nome_cognome || !codice_fiscale) return null;

  return {
    nome_cognome,
    codice_fiscale,
    luogo_nascita,
    data_nascita,
    citta_residenza,
    indirizzo_residenza,
    nazionalita: null,
    CAP,
    ruolo,
  };
}

function toIsoDate(value: string): string | null {
  const m = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function dedupeByCf(items: VisuraRappresentante[]): VisuraRappresentante[] {
  const map = new Map<string, VisuraRappresentante>();

  for (const item of items) {
    if (!item.codice_fiscale) continue;
    if (!map.has(item.codice_fiscale)) {
      map.set(item.codice_fiscale, item);
    }
  }

  return Array.from(map.values());
}
