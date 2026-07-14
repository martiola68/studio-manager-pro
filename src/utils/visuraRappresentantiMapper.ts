export type TitoloPossessoVisura =
  | "piena_proprieta"
  | "nuda_proprieta"
  | "usufrutto"
  | "pegno"
  | "sequestro"
  | "intestazione_fiduciaria"
  | "altro";

export type TipoSoggettoVisura =
  | "amministratore"
  | "socio"
  | "organo_controllo";

export type VisuraRappresentante = {
  nome_cognome: string;
  codice_fiscale?: string | null;
  qualifica?: string | null;
  percentuale_partecipazione?: number | null;
  titolo_possesso?: TitoloPossessoVisura;
  tipo_soggetto: TipoSoggettoVisura;
  data_nomina?: string | null;
  luogo_nascita?: string | null;
  data_nascita?: string | null;
  citta_residenza?: string | null;
  indirizzo_residenza?: string | null;
  CAP?: string | null;
  nazionalita?: string | null;
};

export type VisuraRappresentanteImportabile =
  VisuraRappresentante & {
    selected: boolean;
  };

type SezioneVisura =
  | "ROOT"
  | "SOCI"
  | "AMMINISTRATORI"
  | "ORGANI_CONTROLLO"
  | "OTHER";

const CF_PERSONA_REGEX =
  /\b[A-Z]{6}[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{3}[A-Z]\b/i;
const CF_SOCIETA_REGEX = /\b[0-9]{11}\b/;

function normalizeTextForParsing(input: string): string {
  return String(input || "")
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeLine(line: string): string {
  return String(line || "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function normalizeSearchText(value: string): string {
  return normalizeLine(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function splitUsefulLines(text: string): string[] {
  return normalizeTextForParsing(text)
    .split("\n")
    .map(normalizeLine)
    .filter(Boolean)
    .filter((line) => !/^Pag\.?\s*\d+/i.test(line))
    .filter((line) => !/^Visura ordinaria/i.test(line))
    .filter((line) => !/^Documento n\./i.test(line))
    .filter((line) => !/^Camera di Commercio/i.test(line));
}

function extractIdentificativoFiscale(text: string): string | null {
  const persona = text.match(CF_PERSONA_REGEX);
  if (persona) return persona[0].toUpperCase().trim();
  const societa = text.match(CF_SOCIETA_REGEX);
  return societa ? societa[0].trim() : null;
}

function decodeBirthDateFromCodiceFiscale(
  codiceFiscale?: string | null
): string | null {
  if (!codiceFiscale) return null;
  const cf = codiceFiscale.toUpperCase().replace(/[^A-Z0-9]/g, "").trim();
  if (cf.length !== 16) return null;

  const yearNum = Number(cf.slice(6, 8));
  const monthCode = cf.slice(8, 9);
  let dayNum = Number(cf.slice(9, 11));
  if (Number.isNaN(yearNum) || Number.isNaN(dayNum)) return null;

  const monthMap: Record<string, number> = {
    A: 1, B: 2, C: 3, D: 4, E: 5, H: 6,
    L: 7, M: 8, P: 9, R: 10, S: 11, T: 12,
  };
  const monthNum = monthMap[monthCode];
  if (!monthNum) return null;
  if (dayNum > 40) dayNum -= 40;
  if (dayNum < 1 || dayNum > 31) return null;

  const currentYear = new Date().getFullYear() % 100;
  const fullYear = yearNum <= currentYear ? 2000 + yearNum : 1900 + yearNum;
  return `${String(dayNum).padStart(2, "0")}/${String(monthNum).padStart(2, "0")}/${fullYear}`;
}

function toDatabaseDate(value: string | null | undefined): string | null {
  const text = String(value || "").trim();
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const match = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [, giorno, mese, anno] = match;
  return `${anno}-${mese}-${giorno}`;
}

function extractDataNomina(text: string): string | null {
  const patterns = [
    /data\s+nomina\s*:?\s*(\d{2}\/\d{2}\/\d{4})/i,
    /data\s+atto\s*:?\s*(\d{2}\/\d{2}\/\d{4})/i,
    /nominat[oa]\s+con\s+atto\s+del\s+(\d{2}\/\d{2}\/\d{4})/i,
    /dal\s+(\d{2}\/\d{2}\/\d{4})/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return toDatabaseDate(match[1]);
  }
  return null;
}

function isSectionHeader(line: string): boolean {
  const upper = normalizeLine(line).toUpperCase();
  return [
    "AMMINISTRATORI",
    "ORGANI AMMINISTRATIVI",
    "ORGANI DI CONTROLLO",
    "COLLEGIO SINDACALE",
    "REVISIONE LEGALE",
    "REVISORI",
    "ELENCO SOCI",
    "ELENCO DEI SOCI",
    "SOCI E TITOLARI DI DIRITTI",
    "TITOLARI DI DIRITTI SU AZIONI",
    "TRASFERIMENTI D'AZIENDA",
    "ATTIVITA",
    "SEDI SECONDARIE",
    "STORIA DELLE MODIFICHE",
    "INFORMAZIONI PATRIMONIALI",
    "CAPITALE SOCIALE",
  ].some((value) => upper.includes(value));
}

function getSections(lines: string[]): Record<SezioneVisura, string[]> {
  const sections: Record<SezioneVisura, string[]> = {
    ROOT: [], SOCI: [], AMMINISTRATORI: [], ORGANI_CONTROLLO: [], OTHER: [],
  };
  let currentSection: SezioneVisura = "ROOT";

  for (const line of lines) {
    const upper = line.toUpperCase();

    if (upper.includes("AMMINISTRATORI") || upper.includes("ORGANI AMMINISTRATIVI")) {
      currentSection = "AMMINISTRATORI";
      continue;
    }

    if (
      upper.includes("ORGANI DI CONTROLLO") ||
      upper.includes("COLLEGIO SINDACALE") ||
      upper === "SINDACI" ||
      upper.includes("SINDACI, MEMBRI ORGANI DI CONTROLLO") ||
      upper.includes("REVISIONE LEGALE") ||
      upper.includes("REVISORI")
    ) {
      currentSection = "ORGANI_CONTROLLO";
      continue;
    }

    if (
      upper === "SOCI" ||
      upper.includes("ELENCO SOCI") ||
      upper.includes("ELENCO DEI SOCI") ||
      upper.includes("ELENCO DEI SOCI E DEGLI ALTRI TITOLARI") ||
      upper.includes("SOCI E TITOLARI DI DIRITTI SU AZIONI E QUOTE") ||
      upper.includes("TITOLARI DI DIRITTI SU AZIONI O QUOTE SOCIALI") ||
      upper.includes("TITOLARI DI DIRITTI SU AZIONI E QUOTE SOCIALI")
    ) {
      currentSection = "SOCI";
      continue;
    }

    if (isSectionHeader(line)) {
      currentSection = "OTHER";
      continue;
    }

    sections[currentSection].push(line);
  }

  return sections;
}

function cleanPersonName(value: string): string {
  return normalizeLine(value)
    .replace(/^(sindaco|sindaca|socio|titolare)\s+/i, "")
    .replace(/\b(amministratore|amministratrice|consigliere|presidente|procuratore|liquidatore|revisore)\b/gi, "")
    .replace(/\b(rappresentante dell['’]impresa|rappresentante legale|responsabile tecnico)\b/gi, "")
    .replace(CF_PERSONA_REGEX, "")
    .replace(CF_SOCIETA_REGEX, "")
    .replace(/\b\d{1,3}(?:[.,]\d+)?\s*%\b/g, "")
    .replace(/\b(propriet[aà]|piena propriet[aà]|nuda propriet[aà]|usufrutto|pegno|sequestro|intestazione fiduciaria)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/^[,;.\- ]+|[,;.\- ]+$/g, "")
    .trim();
}

function isLikelyName(value: string): boolean {
  const cleaned = cleanPersonName(value);
  if (!cleaned || cleaned.length < 3) return false;

  const normalized = normalizeSearchText(cleaned);
  const excluded = [
    "registro imprese",
    "archivio ufficiale della cciaa",
    "soggetti a deposito",
    "soggetto a deposito",
    "codice fiscale",
    "documento n",
    "estratto dal registro imprese",
    "camera di commercio",
    "capitale sociale",
    "proprieta",
    "valore",
    "tipo diritto",
  ];

  if (excluded.some((item) => normalized === item || normalized.startsWith(`${item} `))) {
    return false;
  }
  if (/\d{2,}/.test(cleaned)) return false;

  const words = cleaned.split(/\s+/).filter(Boolean);
  return words.length >= 1 && words.length <= 8 && words.every((word) =>
    /^[A-ZÀ-ÖØ-Ý0-9'`&.\-]+$/i.test(word)
  );
}

function extractQualificaFromText(
  text: string,
  tipo: TipoSoggettoVisura
): string | null {
  const normalized = normalizeSearchText(text);
  const patterns: Array<{ label: string; test: RegExp }> = [
    { label: "presidente del collegio sindacale", test: /\bpresidente\s+(del\s+)?collegio\s+sindacale\b/i },
    { label: "sindaco unico", test: /\bsindaco\s+unico\b/i },
    { label: "sindaco supplente", test: /\bsindaco\s+(supplente|membro supplente)\b/i },
    { label: "sindaco effettivo", test: /\bsindaco\s+(effettivo|membro effettivo)\b/i },
    { label: "revisore", test: /\b(revisore|revisione legale|societa di revisione)\b/i },
    { label: "presidente del consiglio di amministrazione", test: /\bpresidente\s+(del\s+)?consiglio\s+di\s+amministrazione\b/i },
    { label: "amministratore delegato", test: /\bamministrat(?:ore|rice)\s+delegat[oa]\b/i },
    { label: "amministratore unico", test: /\bamministrat(?:ore|rice)\s+unic[oa]\b/i },
    { label: "liquidatore", test: /\bliquidatore\b/i },
    { label: "consigliere", test: /\bconsigliere\b/i },
    { label: "presidente", test: /\bpresidente\b/i },
    { label: "amministratore", test: /\bamministratore\b/i },
  ];

  for (const pattern of patterns) {
    if (pattern.test.test(normalized)) return pattern.label;
  }
  if (tipo === "socio") return "socio";
  if (tipo === "organo_controllo") return "sindaco effettivo";
  return null;
}

function parsePersonFromBlock(
  blockLines: string[],
  tipo: Exclude<TipoSoggettoVisura, "socio">
): VisuraRappresentante | null {
  const blockText = blockLines.join(" ").replace(/\s+/g, " ").trim();
  const codiceFiscale = extractIdentificativoFiscale(blockText);
  if (!codiceFiscale) return null;

  const cfLineIndex = blockLines.findIndex((line) =>
    line.toUpperCase().includes(codiceFiscale.toUpperCase())
  );

  let nome = "";
  if (cfLineIndex >= 0) {
    const sameLine = cleanPersonName(blockLines[cfLineIndex]);
    if (isLikelyName(sameLine)) nome = sameLine;

    if (!nome) {
      for (let index = cfLineIndex - 1; index >= Math.max(0, cfLineIndex - 4); index--) {
        const candidate = cleanPersonName(blockLines[index]);
        if (isLikelyName(candidate)) {
          nome = candidate;
          break;
        }
      }
    }
  }

  if (!nome) {
    for (const line of blockLines) {
      const candidate = cleanPersonName(line);
      if (isLikelyName(candidate)) {
        nome = candidate;
        break;
      }
    }
  }

  if (!nome) return null;

  return {
    nome_cognome: nome,
    codice_fiscale: codiceFiscale,
    qualifica: extractQualificaFromText(blockText, tipo),
    tipo_soggetto: tipo,
    data_nomina: extractDataNomina(blockText),
    luogo_nascita: null,
    data_nascita: decodeBirthDateFromCodiceFiscale(codiceFiscale),
    citta_residenza: null,
    indirizzo_residenza: null,
    CAP: null,
    nazionalita: null,
  };
}

function parsePeopleFromSection(
  lines: string[],
  tipo: Exclude<TipoSoggettoVisura, "socio">
): VisuraRappresentante[] {
  const results: VisuraRappresentante[] = [];

  for (let index = 0; index < lines.length; index++) {
    const currentWindow = lines.slice(index, index + 14);
    const codiceFiscale = extractIdentificativoFiscale(currentWindow.join(" "));
    if (!codiceFiscale) continue;

    const parsed = parsePersonFromBlock(currentWindow, tipo);
    if (!parsed) continue;

    const key = [parsed.codice_fiscale, parsed.qualifica, parsed.tipo_soggetto].join("|");
    const exists = results.some((item) =>
      [item.codice_fiscale, item.qualifica, item.tipo_soggetto].join("|") === key
    );
    if (!exists) results.push(parsed);

    const cfRelativeIndex = currentWindow.findIndex((line) =>
      line.toUpperCase().includes(codiceFiscale.toUpperCase())
    );
    if (cfRelativeIndex >= 0) index += Math.max(1, cfRelativeIndex);
  }

  return results;
}

function parsePercentage(text: string): number | null {
  const match = text.match(/\b(\d{1,3}(?:[.,]\d+)?)\s*%/);
  if (!match) return null;
  const value = Number(match[1].replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

function parseTitoloPossesso(text: string): TitoloPossessoVisura {
  const normalized = normalizeSearchText(text);
  if (normalized.includes("nuda proprieta")) return "nuda_proprieta";
  if (normalized.includes("usufrutto")) return "usufrutto";
  if (normalized.includes("pegno")) return "pegno";
  if (normalized.includes("sequestro")) return "sequestro";
  if (normalized.includes("intestazione fiduciaria")) return "intestazione_fiduciaria";
  if (normalized.includes("altro")) return "altro";
  return "piena_proprieta";
}

function extractSocioName(
  blockLines: string[],
  codiceFiscale: string
): string | null {
  for (const line of blockLines) {
    if (!line.includes(codiceFiscale)) continue;
    const sameLine = cleanPersonName(line.replace(codiceFiscale, ""));
    if (isLikelyName(sameLine)) return sameLine;
  }

  const cfIndex = blockLines.findIndex((line) => line.includes(codiceFiscale));
  if (cfIndex >= 0) {
    for (let index = cfIndex - 1; index >= Math.max(0, cfIndex - 3); index--) {
      const candidate = cleanPersonName(blockLines[index]);
      if (isLikelyName(candidate)) return candidate;
    }
  }

  return null;
}

function parseSociDaTabellaRiepilogo(
  rawText: string
): VisuraRappresentante[] {
  const lines = normalizeTextForParsing(rawText)
    .split("\n")
    .map(normalizeLine)
    .filter(Boolean);

  const results: VisuraRappresentante[] = [];
  const headerIndex = lines.findIndex((_line, index) => {
    const windowText = lines.slice(index, index + 8).map(normalizeSearchText).join(" ");
    return (
      windowText.includes("socio") &&
      windowText.includes("valore") &&
      windowText.includes("%") &&
      windowText.includes("tipo diritto")
    );
  });

  if (headerIndex === -1) return [];
  const tableLines = lines.slice(headerIndex + 1);

  for (let index = 0; index < tableLines.length; index++) {
    const blockLines = tableLines.slice(index, index + 8);
    const blockText = blockLines.join(" ");
    const codiceFiscale = extractIdentificativoFiscale(blockText);
    const percentuale = parsePercentage(blockText);

    if (!codiceFiscale || percentuale == null) continue;

    const nome = extractSocioName(blockLines, codiceFiscale);
    if (!nome) continue;

    results.push({
      nome_cognome: nome,
      codice_fiscale: codiceFiscale,
      qualifica: "socio",
      tipo_soggetto: "socio",
      percentuale_partecipazione: percentuale,
      titolo_possesso: parseTitoloPossesso(blockText),
      data_nomina: null,
      luogo_nascita: null,
      data_nascita: decodeBirthDateFromCodiceFiscale(codiceFiscale),
      citta_residenza: null,
      indirizzo_residenza: null,
      CAP: null,
      nazionalita: null,
    });

    index += 2;
  }

  return dedupeByCodiceFiscale(results);
}

function dedupeRappresentanti(
  items: VisuraRappresentante[]
): VisuraRappresentante[] {
  const map = new Map<string, VisuraRappresentante>();
  for (const item of items) {
    const key = [
      (item.codice_fiscale || "").toUpperCase().trim(),
      item.tipo_soggetto,
      normalizeSearchText(item.qualifica || ""),
    ].join("|");
    if (!map.has(key)) map.set(key, item);
  }
  return Array.from(map.values());
}

export function dedupeByCodiceFiscale(
  items: VisuraRappresentante[]
): VisuraRappresentante[] {
  const map = new Map<string, VisuraRappresentante>();

  for (const item of items) {
    const cf = (item.codice_fiscale || "").toUpperCase().trim();
    if (!cf) continue;

    const existing = map.get(cf);
    if (!existing) {
      map.set(cf, item);
      continue;
    }

    const existingScore =
      Number(existing.percentuale_partecipazione != null) * 3 +
      Number(!!existing.qualifica) * 2 +
      Number(!!existing.data_nomina);
    const currentScore =
      Number(item.percentuale_partecipazione != null) * 3 +
      Number(!!item.qualifica) * 2 +
      Number(!!item.data_nomina);

    if (currentScore > existingScore) {
      map.set(cf, { ...existing, ...item });
    }
  }

  return Array.from(map.values());
}

export function parseVisuraRappresentanti(
  rawText: string
): VisuraRappresentante[] {
  const text = normalizeTextForParsing(rawText);
  const lines = splitUsefulLines(text);
  const sections = getSections(lines);

  const soci = parseSociDaTabellaRiepilogo(rawText);
  const amministratori = parsePeopleFromSection(
    sections.AMMINISTRATORI,
    "amministratore"
  );
  const organiControllo = parsePeopleFromSection(
    sections.ORGANI_CONTROLLO,
    "organo_controllo"
  );

  return dedupeRappresentanti([
    ...soci,
    ...amministratori,
    ...organiControllo,
  ]);
}

export function mapVisuraRappresentanti(
  rawText: string
): VisuraRappresentanteImportabile[] {
  return parseVisuraRappresentanti(rawText).map((item) => ({
    ...item,
    selected: true,
  }));
}
