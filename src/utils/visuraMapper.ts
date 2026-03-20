export function mapVisuraText(text: string) {
  const clean = text.replace(/\s+/g, " ");

  const match = (regex: RegExp) => {
    const m = clean.match(regex);
    return m ? m[1].trim() : "";
  };

  return {
    cliente: {
      ragione_sociale: match(/(Denominazione|Ragione sociale)[:\s]+([A-Z0-9\s\.\-]+)/i) || "",
      partita_iva: match(/Partita IVA[:\s]+([0-9]{11})/i),
      codice_fiscale: match(/Codice Fiscale[:\s]+([A-Z0-9]{11,16})/i),
      indirizzo: match(/Indirizzo[:\s]+([A-Z0-9\s,\.\-]+)/i),
      cap: match(/CAP[:\s]+([0-9]{5})/i),
      citta: match(/Comune[:\s]+([A-Z\s]+)/i),
      provincia: match(/\b([A-Z]{2})\b/),
    },

    rappresentante: {
      nome_cognome: match(/Rappresentante[^:]*:\s*([A-Z\s]+)/i),
      codice_fiscale: match(/Codice Fiscale Rappresentante[:\s]+([A-Z0-9]+)/i),
    },

    sociPersoneFisiche: [],
  };
}
