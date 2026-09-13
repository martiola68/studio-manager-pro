export type ListinoModalita =
  | "unitario"
  | "mensile"
  | "ore_mensili"
  | "orario"
  | "incluso_coge";

export type ListinoVoce = {
  codice: string;
  descrizione: string;
  minimo: number;
  massimo: number;
  modalita: ListinoModalita;
  unita: string;
};

export type ServizioListinoInput = {
  attivita?: {
    codice?: string | null;
    area?: string | null;
    descrizione?: string | null;
  } | null;
  codice?: string | null;
  area?: string | null;
  descrizione?: string | null;
  quantita_driver?: number | string | null;
  coefficiente_complessita?: number | string | null;
  ore_equivalenti?: number | string | null;
  costo_stimato?: number | string | null;
};

export const LISTINO_COGE: ListinoVoce = {
  codice: "COGE_FORFAIT",
  descrizione: "Contabilità generale - forfait mensile",
  minimo: 250,
  massimo: 1000,
  modalita: "mensile",
  unita: "mese",
};

export const LISTINO_REDDITIVITA: Record<string, ListinoVoce> = {
  CONT_MOV_IVA: {
    codice: "CONT_MOV_IVA",
    descrizione: "Registrazione movimenti IVA",
    minimo: 0,
    massimo: 0,
    modalita: "incluso_coge",
    unita: "forfait COGE",
  },
  CONT_MOV_CONT: {
    codice: "CONT_MOV_CONT",
    descrizione: "Registrazione movimenti contabili",
    minimo: 0,
    massimo: 0,
    modalita: "incluso_coge",
    unita: "forfait COGE",
  },
  CONT_RICONC: {
    codice: "CONT_RICONC",
    descrizione: "Riconciliazioni bancarie",
    minimo: 0,
    massimo: 0,
    modalita: "incluso_coge",
    unita: "forfait COGE",
  },
  CONT_LIQ_IVA: {
    codice: "CONT_LIQ_IVA",
    descrizione: "Liquidazione IVA periodica",
    minimo: 0,
    massimo: 0,
    modalita: "incluso_coge",
    unita: "forfait COGE",
  },
  BIL_BILANCIO: {
    codice: "BIL_BILANCIO",
    descrizione: "Bilancio annuale e chiusure",
    minimo: 500,
    massimo: 2000,
    modalita: "unitario",
    unita: "bilancio",
  },
  BIL_RETT: {
    codice: "BIL_RETT",
    descrizione: "Rettifiche e assestamenti",
    minimo: 100,
    massimo: 500,
    modalita: "unitario",
    unita: "intervento",
  },
  DICH_REDDITI: {
    codice: "DICH_REDDITI",
    descrizione: "Dichiarazione redditi",
    minimo: 150,
    massimo: 300,
    modalita: "unitario",
    unita: "dichiarazione",
  },
  DICH_IVA: {
    codice: "DICH_IVA",
    descrizione: "Dichiarazione IVA annuale",
    minimo: 150,
    massimo: 300,
    modalita: "unitario",
    unita: "dichiarazione",
  },
  DICH_770: {
    codice: "DICH_770",
    descrizione: "Modello 770",
    minimo: 150,
    massimo: 300,
    modalita: "unitario",
    unita: "modello",
  },
  DICH_CU: {
    codice: "DICH_CU",
    descrizione: "Certificazione Unica (CU)",
    minimo: 150,
    massimo: 300,
    modalita: "unitario",
    unita: "adempimento",
  },
  DICH_IRAP: {
    codice: "DICH_IRAP",
    descrizione: "Dichiarazione IRAP",
    minimo: 150,
    massimo: 300,
    modalita: "unitario",
    unita: "dichiarazione",
  },
  CONS_ORE: {
    codice: "CONS_ORE",
    descrizione: "Consulenza professionale",
    minimo: 100,
    massimo: 250,
    modalita: "ore_mensili",
    unita: "ora",
  },
  SOC_PRAT: {
    codice: "SOC_PRAT",
    descrizione: "Pratiche societarie",
    minimo: 300,
    massimo: 1500,
    modalita: "unitario",
    unita: "pratica",
  },
  REV_ORE: {
    codice: "REV_ORE",
    descrizione: "Attività di revisione / controllo",
    minimo: 100,
    massimo: 250,
    modalita: "orario",
    unita: "ora",
  },
};

function n(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function round(value: number, digits = 2) {
  const f = Math.pow(10, digits);
  return Math.round((value + Number.EPSILON) * f) / f;
}

export function difficoltaNormalizzata(value: unknown) {
  return Math.min(5, Math.max(1, n(value) || 3));
}

export function interpolaListino(minimo: number, massimo: number, difficoltaRaw: unknown) {
  const difficolta = difficoltaNormalizzata(difficoltaRaw);
  const posizione = (difficolta - 1) / 4;
  return round(minimo + (massimo - minimo) * posizione, 2);
}

function datiAttivita(servizio: ServizioListinoInput) {
  return {
    codice: String(servizio.attivita?.codice || servizio.codice || "").trim(),
    area: String(servizio.attivita?.area || servizio.area || "").trim(),
    descrizione: String(servizio.attivita?.descrizione || servizio.descrizione || "").trim(),
  };
}

function moltiplicatore(voce: ListinoVoce, quantitaRaw: unknown) {
  const quantita = Math.max(0, n(quantitaRaw));
  if (voce.modalita === "mensile") return 12;
  if (voce.modalita === "ore_mensili") return quantita * 12;
  if (voce.modalita === "orario") return quantita;
  if (voce.modalita === "unitario") return Math.max(1, quantita);
  return 0;
}

export function prezzoListinoServizio(servizio: ServizioListinoInput) {
  const { codice } = datiAttivita(servizio);
  const voce = LISTINO_REDDITIVITA[codice];
  if (!voce) {
    return {
      codice,
      trovato: false,
      incluso_coge: false,
      minimo: 0,
      massimo: 0,
      prezzo: 0,
      unita: "",
      modalita: null as ListinoModalita | null,
    };
  }

  if (voce.modalita === "incluso_coge") {
    return {
      codice,
      trovato: true,
      incluso_coge: true,
      minimo: 0,
      massimo: 0,
      prezzo: 0,
      unita: voce.unita,
      modalita: voce.modalita,
    };
  }

  const mult = moltiplicatore(voce, servizio.quantita_driver);
  return {
    codice,
    trovato: true,
    incluso_coge: false,
    minimo: round(voce.minimo * mult, 2),
    massimo: round(voce.massimo * mult, 2),
    prezzo: round(interpolaListino(voce.minimo, voce.massimo, servizio.coefficiente_complessita) * mult, 2),
    unita: voce.unita,
    modalita: voce.modalita,
  };
}

export function calcolaEconomiaListino(servizi: ServizioListinoInput[], margineRaw: unknown) {
  const margine = Math.min(95, Math.max(0, n(margineRaw)));
  const costoPieno = round(servizi.reduce((sum, s) => sum + n(s.costo_stimato), 0), 2);
  const ore = round(servizi.reduce((sum, s) => sum + n(s.ore_equivalenti), 0), 4);

  let listinoMinimo = 0;
  let listinoMassimo = 0;
  let prezzoListino = 0;

  const serviziCoge = servizi.filter((s) => {
    const { codice, area } = datiAttivita(s);
    return codice.startsWith("CONT_") || area.toLowerCase() === "contabilità";
  });

  if (serviziCoge.length > 0) {
    const oreCoge = serviziCoge.reduce((sum, s) => sum + Math.max(0, n(s.ore_equivalenti)), 0);
    const difficoltaCoge = oreCoge > 0
      ? serviziCoge.reduce(
          (sum, s) => sum + difficoltaNormalizzata(s.coefficiente_complessita) * Math.max(0, n(s.ore_equivalenti)),
          0
        ) / oreCoge
      : Math.max(...serviziCoge.map((s) => difficoltaNormalizzata(s.coefficiente_complessita)));

    listinoMinimo += LISTINO_COGE.minimo * 12;
    listinoMassimo += LISTINO_COGE.massimo * 12;
    prezzoListino += interpolaListino(LISTINO_COGE.minimo, LISTINO_COGE.massimo, difficoltaCoge) * 12;
  }

  for (const servizio of servizi) {
    const riga = prezzoListinoServizio(servizio);
    if (!riga.trovato || riga.incluso_coge) continue;
    listinoMinimo += riga.minimo;
    listinoMassimo += riga.massimo;
    prezzoListino += riga.prezzo;
  }

  listinoMinimo = round(listinoMinimo, 2);
  listinoMassimo = round(listinoMassimo, 2);
  prezzoListino = round(prezzoListino, 2);

  const minimoEconomico = margine < 100
    ? round(costoPieno / (1 - margine / 100), 2)
    : costoPieno;

  const compensoMinimo = round(Math.max(listinoMinimo, costoPieno), 2);
  const ricavoPrevisto = round(Math.max(prezzoListino, minimoEconomico), 2);
  const marginePrevisto = round(ricavoPrevisto - costoPieno, 2);
  const marginePrevistoPercentuale = ricavoPrevisto > 0
    ? round((marginePrevisto / ricavoPrevisto) * 100, 2)
    : 0;

  return {
    ore_equivalenti_totali: ore,
    costo_pieno: costoPieno,
    listino_minimo: listinoMinimo,
    listino_massimo: listinoMassimo,
    prezzo_listino: prezzoListino,
    minimo_economico: minimoEconomico,
    compenso_minimo: compensoMinimo,
    compenso_obiettivo: ricavoPrevisto,
    ricavo_previsto: ricavoPrevisto,
    margine_previsto: marginePrevisto,
    margine_previsto_percentuale: marginePrevistoPercentuale,
    fuori_fascia: listinoMassimo > 0 && minimoEconomico > listinoMassimo,
  };
}
