export type VisuraRappresentante = {
  nome_cognome: string;
  codice_fiscale?: string | null;
  qualifica?: string | null;
  tipo_soggetto: "amministratore" | "socio";
  luogo_nascita?: string | null;
  data_nascita?: string | null;
  citta_residenza?: string | null;
  indirizzo_residenza?: string | null;
  CAP?: string | null;
  nazionalita?: string | null;
};

function normalizeTextForParsing(input: string): string {
  return input
    .replace(/\r/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeLine(line: string): string {
  return line
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function splitUsefulLines(text: string): string[] {
  return normalizeTextForParsing(text)
    .split("\n")
    .map(normalizeLine)
    .filter(Boolean)
    .filter((line) => !/^Pag\.?\s*\d+/i.test(line))
    .filter((line) => !/^Visura/i.test(line))
    .filter((line) => !/^Documento n\./i.test(line))
    .filter((line) => !/^Camera di Commercio/i.test(line));
}

function isLikelySectionHeader(line: string): boolean {
  const l = normalizeLine(line).toUpperCase();
  if (!l) return false;

  return [
    "AMMINISTRATORI",
    "ORGANI AMMINISTRATIVI",
    "TITOLARI DI ALTRE CARICHE O QUALIFICHE",
    "SOCI",
    "ELENCO SOCI",
    "SOCI E TITOLARI DI DIRITTI SU AZIONI E QUOTE",
    "TRASFERIMENTI D'AZIENDA, FUSIONI, SCISSIONI, SUBENTRI",
    "ATTIVITA",
    "SEDI SECONDARIE",
    "STORIA DELLE MODIFICHE",
    "INFORMAZIONI PATRIMONIALI",
    "CAPITALE SOCIALE",
  ].some((h) => l.includes(h));
}

function getSections(lines: string[]): Record<string, string[]> {
  const sections: Record<string, string[]> = {};
  let currentSection = "ROOT";
  sections[currentSection] = [];

  for (const line of lines) {
    const upper = line.toUpperCase();

    if (upper.includes("AMMINISTRATORI") || upper.includes("ORGANI AMMINISTRATIVI")) {
      currentSection = "AMMINISTRATORI";
      sections[currentSection] ??= [];
      continue;
    }

    if (upper.includes("TITOLARI DI ALTRE CARICHE O QUALIFICHE")) {
      currentSection = "ALTRE_CARICHE";
      sections[currentSection] ??= [];
      continue;
    }

    if (
      upper === "SOCI" ||
      upper.includes("ELENCO SOCI") ||
      upper.includes("SOCI E TITOLARI DI DIRITTI SU AZIONI E QUOTE")
    ) {
      currentSection = "SOCI";
      sections[currentSection] ??= [];
      continue;
    }

    if (isLikelySectionHeader(line)) {
      currentSection = "OTHER";
      sections[currentSection] ??= [];
      continue;
    }

    sections[currentSection] ??= [];
    sections[currentSection].push(line);
  }

  return sections;
}

function extractCodiceFiscale(text: string): string | null {
  const match = text.match(/\b[A-Z]{6}[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{3}[A-Z]\b/i);
  return match ? match[0].toUpperCase() : null;
}

function decodeBirthDateFromCodiceFiscale(
  codiceFiscale?: string | null
): string | null {
  if (!codiceFiscale) return null;

  const cf = codiceFiscale.toUpperCase().trim();

  if (!/^[A-Z0-9]{16}$/.test(cf)) return null;

  const yearPart = cf.slice(6, 8);
  const monthPart = cf.slice(8, 9);
  const dayPart = cf.slice(9, 11);

  const yearNum = Number(yearPart);
  let dayNum = Number(dayPart);

  if (Number.isNaN(yearNum) || Number.isNaN(dayNum)) return null;

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

  const monthNum = monthMap[monthPart];
  if (!monthNum) return null;

  if (dayNum > 40) {
    dayNum -= 40;
  }

  if (dayNum < 1 || dayNum > 31) return null;

  const currentYear = new Date().getFullYear() % 100;

  // regola pratica:
  // se le ultime due cifre sono <= anno corrente -> 2000+
  // altrimenti -> 1900+
  const fullYear = yearNum <= currentYear ? 2000 + yearNum : 1900 + yearNum;

  const yyyy = String(fullYear);
  const mm = String(monthNum).padStart(2, "0");
  const dd = String(dayNum).padStart(2, "0");

  return `${dd}/${mm}/${yyyy}`;
}

function cleanPersonName(name: string): string {
  return name
    .replace(/\b(amministratore|amministratrice)\b/gi, "")
    .replace(/\b(rappresentante dell['’]impresa)\b/gi, "")
    .replace(/\b(responsabile tecnico)\b/gi, "")
    .replace(/\b(titolare|socio|consigliere|presidente|procuratore|liquidatore|revisore)\b/gi, "")
    .replace(/\b(del documento|documento allegato|documento|allegato)\b/gi, "")
    .replace(/\b(quota|quote|percentuale|diritti|propriet[aà]|capitale sociale)\b/gi, "")
    .replace(/\b[A-Z]{6}[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{3}[A-Z]\b/gi, "")
    .replace(/\b\d{1,3}(?:[.,]\d{1,2})?\s*%\b/g, "")
    .replace(/^['`’"\s]+/, "")
    .replace(/['`’"]+$/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/^[,;.\- ]+|[,;.\- ]+$/g, "")
    .trim();
}

function isLikelyPersonName(value: string): boolean {
  const v = cleanPersonName(value);

  if (!v) return false;
  if (v.length < 5) return false;
  if (/\d{2,}/.test(v)) return false;
  if (/[|]/.test(v)) return false;

  const words = v.split(" ").filter(Boolean);
  if (words.length < 2 || words.length > 4) return false;

  return words.every((w) => /^[A-ZÀ-ÖØ-Ý'`.-]+$/i.test(w));
}

function extractBirthDataStrict(_block: string): {
  luogo_nascita: string | null;
  data_nascita: string | null;
  nazionalita: string | null;
} {
  return {
    luogo_nascita: null,
    data_nascita: null,
    nazionalita: null,
  };
}

function extractResidenceStrict(_block: string): {
  citta_residenza: string | null;
  indirizzo_residenza: string | null;
  CAP: string | null;
} {
  return {
    citta_residenza: null,
    indirizzo_residenza: null,
    CAP: null,
  };
}

function candidateNamesFromText(text: string): string[] {
  const matches =
    text.match(/\b[A-ZÀ-ÖØ-Ý'`.-]+(?:\s+[A-ZÀ-ÖØ-Ý'`.-]+){1,3}\b/g) || [];

  return matches
    .map((m) => cleanPersonName(m))
    .filter((m) => isLikelyPersonName(m));
}

function parseSubjectBlock(
  blockLines: string[],
  tipo: "amministratore" | "socio"
): VisuraRappresentante | null {
  const blockText = blockLines.join(" ").replace(/\s+/g, " ").trim();
  const codiceFiscale = extractCodiceFiscale(blockText);

  if (!codiceFiscale) return null;

  const cleanedLines = blockLines
    .map((l) => cleanPersonName(l))
    .filter(Boolean);

  let nomeLine =
    cleanedLines.find((l) => isLikelyPersonName(l)) ||
    null;

  if (!nomeLine) {
    const cfIndex = blockText.toUpperCase().indexOf(codiceFiscale.toUpperCase());

    if (cfIndex >= 0) {
      const beforeCf = blockText.slice(Math.max(0, cfIndex - 120), cfIndex);
      const candidates = candidateNamesFromText(beforeCf);
      nomeLine = candidates.length ? candidates[candidates.length - 1] : null;
    }
  }

  if (!nomeLine) return null;

  const qualificaMatch = blockText.match(
    /\b(amministratore|presidente|consigliere|socio|titolare|procuratore|liquidatore|revisore)\b/i
  );

  const birth = extractBirthDataStrict(blockText);
  const residence = extractResidenceStrict(blockText);

  return {
    nome_cognome: nomeLine,
    codice_fiscale: codiceFiscale,
    qualifica: qualificaMatch ? qualificaMatch[1] : tipo === "socio" ? "socio" : null,
    tipo_soggetto: tipo,
    luogo_nascita: birth.luogo_nascita,
    data_nascita: birth.data_nascita || decodeBirthDateFromCodiceFiscale(codiceFiscale),
    citta_residenza: residence.citta_residenza,
    indirizzo_residenza: residence.indirizzo_residenza,
    CAP: residence.CAP,
    nazionalita: birth.nazionalita,
  };
}

function parsePeopleFromSection(
  lines: string[],
  tipo: "amministratore" | "socio"
): VisuraRappresentante[] {
  const results: VisuraRappresentante[] = [];

  for (let i = 0; i < lines.length; i++) {
    const windowSizes = tipo === "socio" ? [12, 10, 8, 6] : [8, 6];

    let parsedSubject: VisuraRappresentante | null = null;
    let usedWindow = 0;

    for (const size of windowSizes) {
      const blockLines = lines.slice(i, i + size).filter(Boolean);
      const blockText = blockLines.join(" | ");
      const cf = extractCodiceFiscale(blockText);

      if (!cf) continue;

      const parsed = parseSubjectBlock(blockLines, tipo);
      if (parsed) {
        parsedSubject = parsed;
        usedWindow = size;
        break;
      }
    }

    if (parsedSubject) {
      const alreadyExists = results.some(
        (r) =>
          (r.codice_fiscale || "").toUpperCase().trim() ===
          (parsedSubject!.codice_fiscale || "").toUpperCase().trim()
      );

      if (!alreadyExists) {
        results.push(parsedSubject);
      }

      i += Math.max(1, usedWindow - 4);
    }
  }

  return results;
}

function parseFallbackNameByCf(rawText: string): VisuraRappresentante[] {
  const results: VisuraRappresentante[] = [];
  const normalized = normalizeTextForParsing(rawText).replace(/\n/g, " ");
  const cfRegex = /\b[A-Z]{6}[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{3}[A-Z]\b/gi;
  const matches = [...normalized.matchAll(cfRegex)];

  for (const match of matches) {
    const cf = (match[0] || "").toUpperCase().trim();
    const index = match.index ?? -1;
    if (!cf || index < 0) continue;

    const start = Math.max(0, index - 100);
    const beforeCf = normalized.slice(start, index);
    const candidates = candidateNamesFromText(beforeCf);
    const candidateName = candidates.length ? candidates[candidates.length - 1] : null;

    if (!candidateName) continue;

    results.push({
      nome_cognome: candidateName,
      codice_fiscale: cf,
      qualifica: null,
      tipo_soggetto: "socio",
      luogo_nascita: null,
      data_nascita: null,
      citta_residenza: null,
      indirizzo_residenza: null,
      CAP: null,
      nazionalita: null,
    });
  }

  return dedupeByCodiceFiscale(results);
}

function dedupeRappresentanti(items: VisuraRappresentante[]): VisuraRappresentante[] {
  const map = new Map<string, VisuraRappresentante>();

  for (const item of items) {
    const key = [
      item.nome_cognome.toUpperCase().replace(/\s+/g, " ").trim(),
      (item.codice_fiscale || "").toUpperCase().trim(),
      item.tipo_soggetto,
    ].join("|");

    if (!map.has(key)) {
      map.set(key, item);
    }
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

    if (!map.has(cf)) {
      map.set(cf, item);
    }
  }

  return Array.from(map.values());
}

export function parseVisuraRappresentanti(rawText: string): VisuraRappresentante[] {
  const text = normalizeTextForParsing(rawText);
  const lines = splitUsefulLines(text);
  const sections = getSections(lines);

  const amministratori = [
    ...(sections.AMMINISTRATORI
      ? parsePeopleFromSection(sections.AMMINISTRATORI, "amministratore")
      : []),
    ...(sections.ALTRE_CARICHE
      ? parsePeopleFromSection(sections.ALTRE_CARICHE, "amministratore")
      : []),
  ];

  const soci = sections.SOCI ? parsePeopleFromSection(sections.SOCI, "socio") : [];

  const merged = [...amministratori, ...soci];
  const fallback = parseFallbackNameByCf(rawText);

  for (const fallbackItem of fallback) {
    const cf = (fallbackItem.codice_fiscale || "").toUpperCase().trim();
    if (!cf) continue;

    const existingIndex = merged.findIndex(
      (x) => (x.codice_fiscale || "").toUpperCase().trim() === cf
    );

    if (existingIndex === -1) {
      merged.push(fallbackItem);
      continue;
    }

    const existing = merged[existingIndex];

    merged[existingIndex] = {
      ...existing,
      nome_cognome:
        existing.nome_cognome && existing.nome_cognome.trim()
          ? existing.nome_cognome
          : fallbackItem.nome_cognome,
    };
  }

  return dedupeRappresentanti(merged);
}

export function mapVisuraRappresentanti(rawText: string): VisuraRappresentante[] {
  return parseVisuraRappresentanti(rawText);
}
