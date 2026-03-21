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
    .replace(/\b(amministratore|amministratrice)\b/gi, "")
    .replace(/\b(rappresentante dell['’]impresa)\b/gi, "")
    .replace(/\b(titolare|socio|consigliere|presidente|procuratore|liquidatore|revisore)\b/gi, "")
    .replace(/\b(carica|qualifica)\b/gi, "")
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

function extractCodiceFiscale(text: string): string | null {
  const match = text.match(/\b[A-Z]{6}[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{3}[A-Z]\b/i);
  return match ? match[0].toUpperCase() : null;
}

function extractDate(text: string): string | null {
  const m = text.match(/\b(\d{2}\/\d{2}\/\d{4})\b/);
  return m ? m[1] : null;
}

function normalizeCap(value: string | null | undefined): string | null {
  if (!value) return null;
  const m = value.match(/\b\d{5}\b/);
  return m ? m[0] : null;
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

function extractResidence(block: string): {
  citta_residenza: string | null;
  indirizzo_residenza: string | null;
  CAP: string | null;
} {
  const normalized = block.replace(/\s+/g, " ").trim();

  const viaMatch = normalized.match(
    /\b(via|viale|piazza|corso|largo|vicolo|contrada|strada)\s+([^,;]+?)(?=(\s+\d{5}\b)|,|;|$)/i
  );

  const capMatch = normalized.match(/\b\d{5}\b/);

  let citta: string | null = null;

  if (capMatch?.index != null) {
    const afterCap = normalized.slice(capMatch.index + 5).trim();
    const cityMatch = afterCap.match(/^([A-ZÀ-ÖØ-Ý][A-Za-zÀ-ÖØ-öø-ÿ'`\- ]{1,40})/);
    if (cityMatch) citta = cityMatch[1].trim();
  }

  if (!citta) {
    const resMatch = normalized.match(
      /\bresidenza(?:\s*[:\-])?\s*([A-ZÀ-ÖØ-Ý][A-Za-zÀ-ÖØ-öø-ÿ'`\- ]{1,40})/i
    );
    if (resMatch) citta = resMatch[1].trim();
  }

  return {
    citta_residenza: citta,
    indirizzo_residenza: viaMatch
      ? `${viaMatch[1]} ${viaMatch[2]}`.replace(/\s+/g, " ").trim()
      : null,
    CAP: normalizeCap(capMatch?.[0] || null),
  };
}

function extractBirthData(block: string): {
  luogo_nascita: string | null;
  data_nascita: string | null;
  nazionalita: string | null;
} {
  const normalized = block.replace(/\s+/g, " ").trim();

  const natoMatch = normalized.match(
    /\bnat[oa]\s+a\s+([A-ZÀ-ÖØ-Ý][A-Za-zÀ-ÖØ-öø-ÿ'`\- ]{1,40})\s+il\s+(\d{2}\/\d{2}\/\d{4})/i
  );

  const nazionalitaMatch = normalized.match(
    /\b(cittadinanza|nazionalità)\s*[:\-]?\s*([A-ZÀ-ÖØ-Ý][A-Za-zÀ-ÖØ-öø-ÿ'`\- ]{2,30})/i
  );

  return {
    luogo_nascita: natoMatch ? natoMatch[1].trim() : null,
    data_nascita: natoMatch ? natoMatch[2].trim() : extractDate(normalized),
    nazionalita: nazionalitaMatch ? nazionalitaMatch[2].trim() : null,
  };
}

function parseSubjectBlock(
  blockLines: string[],
  tipo: "amministratore" | "socio"
): VisuraRappresentante | null {
  const blockText = blockLines.join(" ").replace(/\s+/g, " ").trim();
  const codiceFiscale = extractCodiceFiscale(blockText);

  if (!codiceFiscale) return null;

  const cleanedLines = blockLines.map((l) => cleanPersonName(l)).filter(Boolean);

  const nomeLine =
    cleanedLines.find((l) => isLikelyPersonName(l)) ||
    cleanPersonName(
      (blockText.match(/\b([A-ZÀ-ÖØ-Ý'`.-]+(?:\s+[A-ZÀ-ÖØ-Ý'`.-]+){1,3})\b/) || [])[1] || ""
    );

  if (!nomeLine || !isLikelyPersonName(nomeLine)) return null;

  const qualificaMatch = blockText.match(
    /\b(amministratore|presidente|consigliere|socio|titolare|procuratore|liquidatore|revisore)\b/i
  );

  const birth = extractBirthData(blockText);
  const residence = extractResidence(blockText);

  return {
    nome_cognome: nomeLine,
    codice_fiscale: codiceFiscale,
    qualifica: qualificaMatch ? qualificaMatch[1] : null,
    tipo_soggetto: tipo,
    luogo_nascita: birth.luogo_nascita,
    data_nascita: birth.data_nascita,
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
    const windowSizes = tipo === "socio" ? [10, 8, 6] : [8, 6];

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

      i += Math.max(1, usedWindow - 3);
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

  return dedupeRappresentanti([...amministratori, ...soci]);
}

export function mapVisuraRappresentanti(rawText: string): VisuraRappresentante[] {
  return parseVisuraRappresentanti(rawText);
}
