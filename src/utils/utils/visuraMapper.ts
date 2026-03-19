// src/utils/visuraMapper.ts

export type VisuraImportResult = {
  cliente: {
    ragione_sociale: string;
    codice_fiscale: string;
    partita_iva: string;
    indirizzo: string;
    cap: string;
    citta: string;
    provincia: string;
  };
  rapp_legale: {
    nome_cognome: string;
    codice_fiscale: string;
    luogo_nascita: string;
    data_nascita: string; // YYYY-MM-DD
    citta_residenza: string;
    indirizzo_residenza: string;
    CAP: string;
    nazionalita: string;
  };
  raw: {
    denominazione?: string;
    sede_legale?: string;
    rappresentante?: string;
  };
};

function cleanText(input: string): string {
  return input
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function normalizeDateToISO(value: string): string {
  const m = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return "";
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function extractMatch(text: string, regexes: RegExp[]): string {
  for (const regex of regexes) {
    const match = text.match(regex);
    if (match?.[1]) return match[1].trim();
  }
  return "";
}

function splitItalianAddress(line: string): {
  indirizzo: string;
  cap: string;
  citta: string;
  provincia: string;
} {
  const normalized = line.replace(/\s+/g, " ").trim();

  const capMatch = normalized.match(/\b(\d{5})\b/);
  const provinciaMatch = normalized.match(/\(([A-Z]{2})\)/);

  let cap = capMatch?.[1] || "";
  let provincia = provinciaMatch?.[1] || "";

  let citta = "";
  const cityMatch = normalized.match(/^([A-ZÀ-Ü'`\s]+)\s*\(([A-Z]{2})\)/i);
  if (cityMatch?.[1]) citta = cityMatch[1].trim();

  let indirizzo = normalized;

  if (citta) {
    indirizzo = indirizzo.replace(/^([A-ZÀ-Ü'`\s]+)\s*\(([A-Z]{2})\)\s*/i, "");
  }
  if (cap) {
    indirizzo = indirizzo.replace(new RegExp(`\\b${cap}\\b`), "").trim();
  }
  indirizzo = indirizzo.replace(/\s{2,}/g, " ").trim();

  return {
    indirizzo,
    cap,
    citta,
    provincia,
  };
}

function parseSedeLegale(text: string) {
  const sede = extractMatch(text, [
    /Sede legale:\s*([^\n]+)/i,
    /indirizzo sede legale\s*([^\n]+)/i,
  ]);

  if (!sede) {
    return {
      indirizzo: "",
      cap: "",
      citta: "",
      provincia: "",
      raw: "",
    };
  }

  const parsed = splitItalianAddress(sede);
  return {
    ...parsed,
    raw: sede,
  };
}

function parseRappresentante(text: string) {
  const blocco = extractMatch(text, [
    /Rappresentante dell'impresa\s*([\s\S]{0,500})/i,
    /Amministratore Unico\s*([\s\S]{0,500})/i,
    /Amministratrice Unica\s*([\s\S]{0,500})/i,
  ]);

  const source = blocco || text;

  const nome = extractMatch(source, [
    /([A-ZÀ-Ü'`]+\s+[A-ZÀ-Ü'`\s]+)\s+Codice fiscale/i,
    /Rappresentante dell'impresa[:\s]+([A-ZÀ-Ü'`\s]+)/i,
  ]);

  const codiceFiscale = extractMatch(source, [
    /Codice fiscale[:\s]*([A-Z0-9]{16})/i,
  ]);

  const luogoNascita = extractMatch(source, [
    /Nata? a\s+([A-ZÀ-Ü'`\s]+)\s*\(([A-Z]{2})\)/i,
    /Luogo di nascita[:\s]*([A-ZÀ-Ü'`\s]+)/i,
  ]);

  const dataNascitaRaw = extractMatch(source, [
    /il\s+(\d{2}\/\d{2}\/\d{4})/i,
    /Data nascita[:\s]*(\d{2}\/\d{2}\/\d{4})/i,
  ]);

  const residenzaLine = extractMatch(source, [
    /Residenza[:\s]*([^\n]+)/i,
    /Domicilio[:\s]*([^\n]+)/i,
    /ROMA\s*\(RM\)\s*[A-ZÀ-Ü0-9'`\s.,-]+\s+CAP\s+\d{5}/i,
  ]);

  const res = splitItalianAddress(residenzaLine);

  return {
    nome_cognome: nome,
    codice_fiscale: codiceFiscale,
    luogo_nascita: luogoNascita,
    data_nascita: normalizeDateToISO(dataNascitaRaw),
    citta_residenza: res.citta,
    indirizzo_residenza: res.indirizzo,
    CAP: res.cap,
    nazionalita: "",
    raw: blocco,
  };
}

export function mapVisuraTextToEntities(rawText: string): VisuraImportResult {
  const text = cleanText(rawText);

  const ragioneSociale = extractMatch(text, [
    /Denominazione[:\s]*([^\n]+)/i,
    /^([A-Z0-9&'`.,\-\s]+SOCIETA['’]?\s+A\s+RESPONSABILITA['’]?\s+LIMITATA)/im,
    /^([A-Z0-9&'`.,\-\s]+S\.R\.L\.)/im,
  ]);

  const codiceFiscale = extractMatch(text, [
    /Codice fiscale[:\s]*([0-9A-Z]{11,16})/i,
  ]);

  const partitaIva = extractMatch(text, [
    /Partita IVA[:\s]*([0-9]{11})/i,
    /P\.IVA[:\s]*([0-9]{11})/i,
  ]) || codiceFiscale;

  const sede = parseSedeLegale(text);
  const rapp = parseRappresentante(text);

  return {
    cliente: {
      ragione_sociale: ragioneSociale,
      codice_fiscale: codiceFiscale,
      partita_iva: partitaIva,
      indirizzo: sede.indirizzo,
      cap: sede.cap,
      citta: sede.citta,
      provincia: sede.provincia,
    },
    rapp_legale: {
      nome_cognome: rapp.nome_cognome,
      codice_fiscale: rapp.codice_fiscale,
      luogo_nascita: rapp.luogo_nascita,
      data_nascita: rapp.data_nascita,
      citta_residenza: rapp.citta_residenza,
      indirizzo_residenza: rapp.indirizzo_residenza,
      CAP: rapp.CAP,
      nazionalita: rapp.nazionalita,
    },
    raw: {
      denominazione: ragioneSociale,
      sede_legale: sede.raw,
      rappresentante: rapp.raw,
    },
  };
}
