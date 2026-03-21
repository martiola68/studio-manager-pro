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

function cleanPersonName(name: string): string {
  return name
    .replace(/\s{2,}/g, " ")
    .replace(/^[,;.\- ]+|[,;.\- ]+$/g, "")
    .trim();
}

function isLikelyPersonName(value: string): boolean {
  const v = cleanPersonName(value);

  if (!v) return false;
  if (v.length < 5) return false;
  if (/\d{3,}/.test(v)) return false;

  const words = v.split(" ").filter(Boolean);
  if (words.length < 2) return false;

  const validWords = words.filter((w) => /^[A-ZÀ-ÖØ-Ý'`.-]+$/i.test(w));
  return validWords.length >= 2;
}

function extractCodiceFiscale(text: string): string | null {
  const match = text.match(/\b[A-Z]{6}[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{3}[A-Z]\b/i);
  return match ? match[0].toUpperCase() : null;
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

function getSections(lines: string[]): Record<string, string[]> {
  const sections: Record<string, string[]> = {};
  let currentSection = "ROOT";
  sections[currentSection] = [];

  for (const line of lines) {
    const upper = line.toUpperCase();

    if (upper.includes("AMMINISTRATORI") || upper.includes("ORGANI AMMINISTRATIVI")) {
      currentSection = "AMMINISTRATORI";
      if (!sections[currentSection]) sections[currentSection] = [];
      continue;
    }

    if (upper.includes("TITOLARI DI ALTRE CARICHE O QUALIFICHE")) {
      currentSection = "ALTRE_CARICHE";
      if (!sections[currentSection]) sections[currentSection] = [];
      continue;
    }

    if (
      upper === "SOCI" ||
      upper.includes("ELENCO SOCI") ||
      upper.includes("SOCI E TITOLARI DI DIRITTI SU AZIONI E QUOTE")
    ) {
      currentSection = "SOCI";
      if (!sections[currentSection]) sections[currentSection] = [];
      continue;
    }

    if (isLikelySectionHeader(line)) {
      currentSection = "OTHER";
      if (!sections[currentSection]) sections[currentSection] = [];
      continue;
    }

    sections[currentSection] ??= [];
    sections[currentSection].push(line);
  }

  return sections;
}

function parsePeopleFromSection(
  lines: string[],
  tipo: "amministratore" | "socio"
): VisuraRappresentante[] {
  const results: VisuraRappresentante[] = [];

  for (let i = 0; i < lines.length; i++) {
    const current = lines[i] || "";
    const next = lines[i + 1] || "";
    const next2 = lines[i + 2] || "";
    const next3 = lines[i + 3] || "";

    const windowText = [current, next, next2, next3].filter(Boolean).join(" | ");
    const cf = extractCodiceFiscale(windowText);

    if (isLikelyPersonName(current)) {
      const nome = cleanPersonName(current);

      let qualifica: string | null = null;
      const qualificaCandidate = [next, next2]
        .map(normalizeLine)
        .find((l) =>
          /(amministratore|presidente|consigliere|socio|titolare|procuratore|liquidatore|revisore)/i.test(l)
        );

      if (qualificaCandidate) qualifica = qualificaCandidate;

     results.push({
  nome_cognome: nome,
  codice_fiscale: cf,
  qualifica,
  tipo_soggetto: tipo,
  luogo_nascita: null,
  data_nascita: null,
  citta_residenza: null,
  indirizzo_residenza: null,
  CAP: null,
  nazionalita: null,
});

      continue;
    }

    const mergedName = cleanPersonName(`${current} ${next}`);
    if (isLikelyPersonName(mergedName)) {
      let qualifica: string | null = null;

      const qualificaCandidate = [next2, next3]
        .map(normalizeLine)
        .find((l) =>
          /(amministratore|presidente|consigliere|socio|titolare|procuratore|liquidatore|revisore)/i.test(l)
        );

      if (qualificaCandidate) qualifica = qualificaCandidate;

    results.push({
  nome_cognome: mergedName,
  codice_fiscale: cf,
  qualifica,
  tipo_soggetto: tipo,
  luogo_nascita: null,
  data_nascita: null,
  citta_residenza: null,
  indirizzo_residenza: null,
  CAP: null,
  nazionalita: null,
});
      i += 1;
      continue;
    }

    const inlineMatch = windowText.match(
      /\b([A-ZÀ-ÖØ-Ý'`.-]+(?:\s+[A-ZÀ-ÖØ-Ý'`.-]+){1,4})\b.*?\b([A-Z]{6}[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{3}[A-Z])\b/i
    );

    if (inlineMatch) {
      const nome = cleanPersonName(inlineMatch[1]);

      results.push({
  nome_cognome: nome,
  codice_fiscale: inlineMatch[2].toUpperCase(),
  qualifica: null,
  tipo_soggetto: tipo,
  luogo_nascita: null,
  data_nascita: null,
  citta_residenza: null,
  indirizzo_residenza: null,
  CAP: null,
  nazionalita: null,
});
      }
    }
  }

  return results;
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

  return dedupeRappresentanti([...amministratori, ...soci]);
}

export function mapVisuraRappresentanti(rawText: string): VisuraRappresentante[] {
  return parseVisuraRappresentanti(rawText);
}
