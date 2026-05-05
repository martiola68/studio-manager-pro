export function mapVisuraText(text: string) {
  const clean = text.replace(/\s+/g, " ").trim();

  const get = (regex: RegExp) => {
    const m = clean.match(regex);
    return m?.[1] ? String(m[1]).trim() : "";
  };

  const denominazione =
    get(/Denominazione:\s*([A-Z0-9\s\.\-&'\/]+?)(?=\s(?:Codice fiscale|Partita IVA|Forma giuridica|Data atto di costituzione))/i) ||
    get(/Denominazione:\s*([A-Z0-9\s\.\-&'\/]+)/i);

  const sedeLegaleFull =
    get(/Indirizzo\s+Sede legale\s+([A-Z\s]+?\([A-Z]{2}\)\s+VIA\s+[A-Z0-9\s'\.\-]+?\s+CAP\s+\d{5})/i) ||
    get(/Sede legale\s+([A-Z\s]+?\([A-Z]{2}\)\s+VIA\s+[A-Z0-9\s'\.\-]+?\s+CAP\s+\d{5})/i);

  const provincia = get(/\(([A-Z]{2})\)/i);

  const cap = get(/CAP\s+(\d{5})/i);

  const citta =
    get(/Indirizzo\s+Sede legale\s+([A-Z\s]+?)\s*\([A-Z]{2}\)/i) ||
    get(/^([A-Z\s]+?)\s*\([A-Z]{2}\)/i);

  const indirizzo =
    get(/\([A-Z]{2}\)\s+(VIA\s+[A-Z0-9\s'\.\-]+?)\s+CAP\s+\d{5}/i);

  const partita_iva =
    get(/Partita IVA\s+(\d{11})/i);

  const codice_fiscale =
    get(/Codice fiscale(?:\s+e n\.iscr\.\s+al\s+Registro\s+Imprese)?\s+(\d{11,16})/i);

  const amministratori = [...clean.matchAll(/Amministratore\s+([A-Z\s]+?)(?=\s+Rappresentante dell'Impresa|\s+Amministratore|\s+informazioni costitutive|$)/gi)]
    .map((m) => ({
      nome_cognome: m[1].trim(),
      ruolo: "Amministratore",
    }))
    .filter((x) => x.nome_cognome);

  const sociPersoneFisiche = [...clean.matchAll(/Socio\s+([A-Z\s]+?)(?=\s+Socio|\s+quote|\s+capitale|\s+amministratore|$)/gi)]
    .map((m) => ({
      nome_cognome: m[1].trim(),
      ruolo: "Socio",
    }))
    .filter((x) => x.nome_cognome);

return {
  cliente: [
    {
      key: "ragione_sociale",
      label: "Ragione sociale",
      value: denominazione,
      selected: !!denominazione,
    },
    {
      key: "partita_iva",
      label: "Partita IVA",
      value: partita_iva,
      selected: !!partita_iva,
    },
    {
      key: "codice_fiscale",
      label: "Codice fiscale",
      value: codice_fiscale,
      selected: !!codice_fiscale,
    },
    {
      key: "indirizzo",
      label: "Indirizzo",
      value: indirizzo,
      selected: !!indirizzo,
    },
    {
      key: "cap",
      label: "CAP",
      value: cap,
      selected: !!cap,
    },
    {
      key: "citta",
      label: "Città",
      value: citta,
      selected: !!citta,
    },
    {
      key: "provincia",
      label: "Provincia",
      value: provincia,
      selected: !!provincia,
    },
    {
      key: "sede_legale_completa",
      label: "Sede legale completa",
      value: sedeLegaleFull,
      selected: !!sedeLegaleFull,
    },
  ],

  rappresentanti: amministratori.map((a) => ({
    ...a,
    selected: true,
  })),

  sociPersoneFisiche: sociPersoneFisiche.map((s) => ({
    ...s,
    selected: true,
  })),
};
