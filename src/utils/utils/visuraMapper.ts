export type VisuraClienteData = {
  ragione_sociale: string;
  codice_fiscale: string;
  partita_iva: string;
  indirizzo: string;
  cap: string;
  citta: string;
  provincia: string;
};

export type VisuraRappLegaleData = {
  nome_cognome: string;
  codice_fiscale: string;
  luogo_nascita: string;
  data_nascita: string;
  citta_residenza: string;
  indirizzo_residenza: string;
  CAP: string;
};

export type VisuraImportData = {
  cliente: VisuraClienteData;
  rappresentante: VisuraRappLegaleData;
};

function cleanText(input: string): string {
  return input
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function extract(text: string, patterns: RegExp[]): string {
  for (const p of patterns) {
    const m = text.match(p);
    if (m?.[1]) return m[1].trim();
  }
  return "";
}

function normalizeDate(value: string): string {
  const m = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return "";
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function parseAddressLine(line: string) {
  const normalized = line.replace(/\s+/g, " ").trim();

  const cityMatch = normalized.match(/^([A-ZÀ-Ú'`\s]+)\s*\(([A-Z]{2})\)/i);
  const capMatch = normalized.match(/\b(\d{5})\b/);

  const citta = cityMatch?.[1]?.trim() || "";
  const provincia = cityMatch?.[2]?.trim() || "";
  const cap = capMatch?.[1] || "";

  let indirizzo = normalized;
  if (cityMatch) {
    indirizzo = indirizzo.replace(cityMatch[0], "").trim();
  }
  indirizzo = indirizzo.replace(/\bCAP\b/i, "").replace(/\b\d{5}\b/, "").trim();
  indirizzo = indirizzo.replace(/\s+/g, " ").trim();

  return { indirizzo, cap, citta, provincia };
}

export function mapVisuraText(rawText: string): VisuraImportData {
  const text = cleanText(rawText);

  const ragioneSociale = extract(text, [
    /Denominazione[:\s]*([^\n]+)/i,
    /^([A-Z0-9&'.,\-\s]+SOCIETA['’]?\s+A\s+RESPONSABILITA['’]?\s+LIMITATA)/im,
    /^([A-Z0-9&'.,\-\s]+S\.R\.L\.)/im,
  ]);

  const codiceFiscale = extract(text, [
    /Codice fiscale[:\s]*([0-9A-Z]{11,16})/i,
  ]);

  const partitaIva =
    extract(text, [
      /Partita IVA[:\s]*([0-9]{11})/i,
      /P\.IVA[:\s]*([0-9]{11})/i,
    ]) || codiceFiscale;

  const sedeRaw = extract(text, [
    /Sede legale[:\s]*([^\n]+)/i,
  ]);
  const sede = parseAddressLine(sedeRaw);

  const nomeRapp = extract(text, [
    /Rappresentante dell'impresa[:\s]*([A-ZÀ-Ú'`\s]+)/i,
    /Amministratrice Unica[:\s]*([A-ZÀ-Ú'`\s]+)/i,
    /Amministratore Unico[:\s]*([A-ZÀ-Ú'`\s]+)/i,
    /([A-ZÀ-Ú'`\s]+)\s+Rappresentante dell'impresa/i,
  ]);

  const cfRapp = extract(text, [
    /Codice fiscale[:\s]*([A-Z0-9]{16})/i,
  ]);

  const luogoNascita = extract(text, [
    /Nata? a\s+([A-ZÀ-Ú'`\s]+)\s*\([A-Z]{2}\)/i,
    /Luogo di nascita[:\s]*([^\n]+)/i,
  ]);

  const dataNascitaRaw = extract(text, [
    /il\s+(\d{2}\/\d{2}\/\d{4})/i,
    /Data nascita[:\s]*(\d{2}\/\d{2}\/\d{4})/i,
  ]);

  const residenzaRaw = extract(text, [
    /Residenza[:\s]*([^\n]+)/i,
    /Domicilio[:\s]*([^\n]+)/i,
  ]);
  const residenza = parseAddressLine(residenzaRaw);

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
    rappresentante: {
      nome_cognome: nomeRapp,
      codice_fiscale: cfRapp,
      luogo_nascita: luogoNascita,
      data_nascita: normalizeDate(dataNascitaRaw),
      citta_residenza: residenza.citta,
      indirizzo_residenza: residenza.indirizzo,
      CAP: residenza.cap,
    },
  };
}
