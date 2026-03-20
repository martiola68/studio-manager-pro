export type VisuraPersonaFisica = {
  nome_cognome: string;
  codice_fiscale?: string;
  luogo_nascita?: string;
  data_nascita?: string;
  indirizzo_residenza?: string;
  citta_residenza?: string;
  CAP?: string;
  nazionalita?: string;
  ruolo?: string;
};

export type VisuraClienteMapped = {
  cliente: {
    ragione_sociale?: string;
    codice_fiscale?: string;
    partita_iva?: string;
    indirizzo?: string;
    cap?: string;
    citta?: string;
    provincia?: string;
  };
  rappresentante?: VisuraPersonaFisica | null;
  sociPersoneFisiche: VisuraPersonaFisica[];
};

export function mapVisuraText(text: string): VisuraClienteMapped {
  const normalized = text.replace(/\r/g, "");

  const cliente = {
    ragione_sociale: "",
    codice_fiscale: "",
    partita_iva: "",
    indirizzo: "",
    cap: "",
    citta: "",
    provincia: "",
  };

  let rappresentante: VisuraPersonaFisica | null = null;
  const sociPersoneFisiche: VisuraPersonaFisica[] = [];

  // =========================
  // QUI resta la tua logica già esistente
  // per estrarre i dati del cliente
  // e del rappresentante legale
  // =========================

  // ESEMPIO placeholder:
  // rappresentante = {
  //   nome_cognome: "Mario Rossi",
  //   codice_fiscale: "RSSMRA80A01H501X",
  //   luogo_nascita: "Roma",
  //   data_nascita: "1980-01-01",
  //   indirizzo_residenza: "Via Roma 1",
  //   citta_residenza: "Roma",
  //   CAP: "00100",
  //   nazionalita: "Italiana",
  //   ruolo: "Rappresentante legale",
  // };

  // =========================
  // NUOVA LOGICA SOCI PERSONE FISICHE
  // =========================
  // Devi intercettare la sezione soci della visura
  // e aggiungere solo persone fisiche, non società.

  const righe = normalized.split("\n").map((r) => r.trim()).filter(Boolean);

  for (const riga of righe) {
    const lower = riga.toLowerCase();

    const sembraSocio =
      lower.includes("socio") ||
      lower.includes("quota") ||
      lower.includes("titolare di quote");

    const sembraSocieta =
      lower.includes("s.r.l.") ||
      lower.includes("srl") ||
      lower.includes("s.p.a.") ||
      lower.includes("spa") ||
      lower.includes("società") ||
      lower.includes("societa") ||
      lower.includes("soc. ");

    const contieneCodiceFiscale = /[A-Z]{6}[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{3}[A-Z]/i.test(riga);

    if (sembraSocio && !sembraSocieta && contieneCodiceFiscale) {
      const cfMatch = riga.match(/[A-Z]{6}[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{3}[A-Z]/i);
      const codice_fiscale = cfMatch?.[0]?.toUpperCase() || "";

      let nome_cognome = riga
        .replace(codice_fiscale, "")
        .replace(/socio/gi, "")
        .replace(/quota/gi, "")
        .replace(/titolare di quote/gi, "")
        .replace(/[:,-]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      if (nome_cognome) {
        sociPersoneFisiche.push({
          nome_cognome,
          codice_fiscale,
          ruolo: "Socio",
        });
      }
    }
  }

  // deduplica per codice fiscale
  const sociDeduplicati = Array.from(
    new Map(
      sociPersoneFisiche
        .filter((s) => s.nome_cognome && s.codice_fiscale)
        .map((s) => [s.codice_fiscale, s])
    ).values()
  );

  return {
    cliente,
    rappresentante,
    sociPersoneFisiche: sociDeduplicati,
  };
}
