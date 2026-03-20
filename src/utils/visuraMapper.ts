export function mapVisuraText(text: string) {
  const clean = text.replace(/\s+/g, " ");

const get = (regex: RegExp) => {
  const m = clean.match(regex);
  return m?.[1] ? String(m[1]).trim() : "";
};
  
  // 👉 RAGIONE SOCIALE (fix: evita "Denominazione")
  const ragioneSociale = get(/(?:Denominazione|Ragione sociale)[:\s]+([A-Z0-9\s\.\-&]+)/i);

  // 👉 PIVA / CF
  const piva = get(/Partita IVA[:\s]+([0-9]{11})/i);
  const cf = get(/Codice Fiscale[:\s]+([A-Z0-9]{11,16})/i);

  // 👉 INDIRIZZO (fix: pulisce "Sede legale")
  const indirizzoRaw = get(/Sede legale[:\s]+([A-Z0-9\s,]+)/i);
  const indirizzo = indirizzoRaw.replace(/^Sede legale\s*/i, "").trim();

  // 👉 CAP / CITTA / PROVINCIA (fix serio)
  const cap = get(/\b([0-9]{5})\b/);
  const citta = get(/(?:Comune|Città)[:\s]+([A-Z\s]+)/i);
  const provincia = get(/Provincia[:\s]+([A-Z]{2})/i);

  // 👉 RAPPRESENTANTE (amministratore)
  const rappresentanteNome = get(/Amministratore[^:]*:\s*([A-Z\s]+)/i);
  const rappresentanteCF = get(/Codice Fiscale[^:]*:\s*([A-Z0-9]{11,16})/i);

  return {
    cliente: {
      ragione_sociale: ragioneSociale,
      partita_iva: piva,
      codice_fiscale: cf,
      indirizzo,
      cap,
      citta,
      provincia,
    },

    rappresentante: {
      nome_cognome: rappresentanteNome,
      codice_fiscale: rappresentanteCF,
    },

    sociPersoneFisiche: [],
  };
}
