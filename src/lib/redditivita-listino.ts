export type ListinoModalita = "unitario" | "mensile" | "orario";

export type ListinoPersistito = {
  prezzo_minimo: number;
  prezzo_massimo: number;
  modalita_prezzo: ListinoModalita;
  gruppo_listino: string;
  listino_attivo: boolean;
};

export type ServizioListinoInput = {
  attivita?: {
    codice?: string | null;
    area?: string | null;
    descrizione?: string | null;
    prezzo_minimo?: number | string | null;
    prezzo_massimo?: number | string | null;
    modalita_prezzo?: string | null;
    gruppo_listino?: string | null;
    listino_attivo?: boolean | null;
    note?: string | null;
  } | null;
  codice?: string | null;
  area?: string | null;
  descrizione?: string | null;
  prezzo_minimo?: number | string | null;
  prezzo_massimo?: number | string | null;
  modalita_prezzo?: string | null;
  gruppo_listino?: string | null;
  listino_attivo?: boolean | null;
  note?: string | null;
  quantita_driver?: number | string | null;
  coefficiente_complessita?: number | string | null;
  ore_equivalenti?: number | string | null;
  costo_stimato?: number | string | null;
};

export const LISTINO_NOTE_PREFIX = "[[SMP_LISTINO]]";

function n(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function round(value: number, digits = 2) {
  const f = Math.pow(10, digits);
  return Math.round((value + Number.EPSILON) * f) / f;
}

export function leggiListinoDaNote(note: unknown): ListinoPersistito | null {
  const text = String(note || "");
  const idx = text.lastIndexOf(LISTINO_NOTE_PREFIX);
  if (idx < 0) return null;
  const raw = text.slice(idx + LISTINO_NOTE_PREFIX.length).trim();
  try {
    const parsed = JSON.parse(raw);
    const modalitaRaw = String(parsed?.modalita_prezzo || "unitario").toLowerCase();
    const modalita: ListinoModalita = modalitaRaw === "mensile" || modalitaRaw === "orario" ? modalitaRaw : "unitario";
    const minimo = Math.max(0, n(parsed?.prezzo_minimo));
    const massimo = Math.max(minimo, n(parsed?.prezzo_massimo));
    return {
      prezzo_minimo: minimo,
      prezzo_massimo: massimo,
      modalita_prezzo: modalita,
      gruppo_listino: String(parsed?.gruppo_listino || "").trim().toUpperCase(),
      listino_attivo: parsed?.listino_attivo !== false,
    };
  } catch {
    return null;
  }
}

export function scriviListinoInNote(note: unknown, listino: Partial<ListinoPersistito>) {
  const text = String(note || "");
  const idx = text.lastIndexOf(LISTINO_NOTE_PREFIX);
  const base = (idx >= 0 ? text.slice(0, idx) : text).trim();
  const modalitaRaw = String(listino.modalita_prezzo || "unitario").toLowerCase();
  const modalita: ListinoModalita = modalitaRaw === "mensile" || modalitaRaw === "orario" ? modalitaRaw : "unitario";
  const minimo = Math.max(0, n(listino.prezzo_minimo));
  const massimo = Math.max(minimo, n(listino.prezzo_massimo));
  const payload: ListinoPersistito = {
    prezzo_minimo: minimo,
    prezzo_massimo: massimo,
    modalita_prezzo: modalita,
    gruppo_listino: String(listino.gruppo_listino || "").trim().toUpperCase(),
    listino_attivo: listino.listino_attivo !== false,
  };
  return `${base}${base ? "\n" : ""}${LISTINO_NOTE_PREFIX}${JSON.stringify(payload)}`;
}

export function attivitaConListinoFallback<T extends Record<string, any>>(attivita: T): T & ListinoPersistito {
  const fallback = leggiListinoDaNote(attivita?.note);
  if (fallback) return { ...attivita, ...fallback };

  const modalitaRaw = String(attivita?.modalita_prezzo || "unitario").toLowerCase();
  const modalita: ListinoModalita = modalitaRaw === "mensile" || modalitaRaw === "orario" ? modalitaRaw : "unitario";
  const minimo = Math.max(0, n(attivita?.prezzo_minimo));
  const massimo = Math.max(minimo, n(attivita?.prezzo_massimo));
  return {
    ...attivita,
    prezzo_minimo: minimo,
    prezzo_massimo: massimo,
    modalita_prezzo: modalita,
    gruppo_listino: String(attivita?.gruppo_listino || "").trim().toUpperCase(),
    listino_attivo: attivita?.listino_attivo !== false,
  };
}

export function difficoltaNormalizzata(value: unknown) {
  return Math.min(5, Math.max(1, n(value) || 3));
}

export function interpolaListino(minimo: number, massimo: number, difficoltaRaw: unknown) {
  const min = Math.max(0, n(minimo));
  const max = Math.max(min, n(massimo));
  const difficolta = difficoltaNormalizzata(difficoltaRaw);
  const posizione = (difficolta - 1) / 4;
  return round(min + (max - min) * posizione, 2);
}

function datiAttivita(servizio: ServizioListinoInput) {
  const raw = (servizio.attivita || servizio) as Record<string, any>;
  const a = attivitaConListinoFallback(raw);
  const modalitaRaw = String(a.modalita_prezzo || "unitario").trim().toLowerCase();
  const modalita: ListinoModalita = modalitaRaw === "mensile" || modalitaRaw === "orario" ? modalitaRaw : "unitario";
  return {
    codice: String(a.codice || "").trim(),
    area: String(a.area || "").trim(),
    descrizione: String(a.descrizione || "").trim(),
    minimo: Math.max(0, n(a.prezzo_minimo)),
    massimo: Math.max(0, n(a.prezzo_massimo)),
    modalita,
    gruppo: String(a.gruppo_listino || "").trim().toUpperCase(),
    attivo: a.listino_attivo !== false,
  };
}

function moltiplicatore(modalita: ListinoModalita, quantitaRaw: unknown) {
  const quantita = Math.max(0, n(quantitaRaw));
  if (modalita === "mensile") return 12;
  if (modalita === "orario") return quantita;
  return Math.max(1, quantita);
}

export function prezzoListinoServizio(servizio: ServizioListinoInput) {
  const dati = datiAttivita(servizio);
  const configurato = dati.attivo && dati.minimo > 0 && dati.massimo >= dati.minimo;
  const inclusoGruppo = configurato && Boolean(dati.gruppo);

  if (!configurato) {
    return {
      codice: dati.codice,
      trovato: false,
      incluso_coge: false,
      incluso_gruppo: false,
      gruppo: dati.gruppo,
      minimo: 0,
      massimo: 0,
      prezzo: 0,
      unita: dati.modalita === "mensile" ? "mese" : dati.modalita === "orario" ? "ora" : "unità",
      modalita: dati.modalita,
    };
  }

  if (inclusoGruppo) {
    return {
      codice: dati.codice,
      trovato: true,
      incluso_coge: dati.gruppo === "COGE",
      incluso_gruppo: true,
      gruppo: dati.gruppo,
      minimo: dati.minimo,
      massimo: dati.massimo,
      prezzo: interpolaListino(dati.minimo, dati.massimo, servizio.coefficiente_complessita),
      unita: dati.modalita === "mensile" ? "mese" : dati.modalita === "orario" ? "ora" : "unità",
      modalita: dati.modalita,
    };
  }

  const mult = moltiplicatore(dati.modalita, servizio.quantita_driver);
  return {
    codice: dati.codice,
    trovato: true,
    incluso_coge: false,
    incluso_gruppo: false,
    gruppo: "",
    minimo: round(dati.minimo * mult, 2),
    massimo: round(dati.massimo * mult, 2),
    prezzo: round(interpolaListino(dati.minimo, dati.massimo, servizio.coefficiente_complessita) * mult, 2),
    unita: dati.modalita === "mensile" ? "mese" : dati.modalita === "orario" ? "ora" : "unità",
    modalita: dati.modalita,
  };
}

function difficoltaPonderata(servizi: ServizioListinoInput[]) {
  const ore = servizi.reduce((sum, s) => sum + Math.max(0, n(s.ore_equivalenti)), 0);
  if (ore > 0) {
    return servizi.reduce(
      (sum, s) => sum + difficoltaNormalizzata(s.coefficiente_complessita) * Math.max(0, n(s.ore_equivalenti)),
      0
    ) / ore;
  }
  return servizi.length
    ? servizi.reduce((sum, s) => sum + difficoltaNormalizzata(s.coefficiente_complessita), 0) / servizi.length
    : 3;
}

export function calcolaEconomiaListino(servizi: ServizioListinoInput[], margineRaw: unknown) {
  const margine = Math.min(95, Math.max(0, n(margineRaw)));
  const costoPieno = round(servizi.reduce((sum, s) => sum + n(s.costo_stimato), 0), 2);
  const ore = round(servizi.reduce((sum, s) => sum + n(s.ore_equivalenti), 0), 4);

  let listinoMinimo = 0;
  let listinoMassimo = 0;
  let prezzoListino = 0;
  let serviziSenzaListino = 0;

  const gruppi = new Map<string, ServizioListinoInput[]>();
  const singoli: ServizioListinoInput[] = [];

  for (const servizio of servizi) {
    const dati = datiAttivita(servizio);
    const configurato = dati.attivo && dati.minimo > 0 && dati.massimo >= dati.minimo;
    if (!configurato) {
      serviziSenzaListino += 1;
      continue;
    }
    if (dati.gruppo) {
      const righe = gruppi.get(dati.gruppo) || [];
      righe.push(servizio);
      gruppi.set(dati.gruppo, righe);
    } else {
      singoli.push(servizio);
    }
  }

  for (const servizio of singoli) {
    const riga = prezzoListinoServizio(servizio);
    if (!riga.trovato) continue;
    listinoMinimo += riga.minimo;
    listinoMassimo += riga.massimo;
    prezzoListino += riga.prezzo;
  }

  for (const [, righe] of gruppi) {
    const datiRighe = righe.map(datiAttivita);
    const minimoBase = Math.max(...datiRighe.map((d) => d.minimo));
    const massimoBase = Math.max(...datiRighe.map((d) => d.massimo));
    const modalita = datiRighe.find((d) => d.modalita === "mensile")?.modalita || datiRighe[0]?.modalita || "unitario";
    const difficolta = difficoltaPonderata(righe);
    const mult = modalita === "mensile" ? 12 : modalita === "orario"
      ? Math.max(0, righe.reduce((sum, s) => sum + n(s.quantita_driver), 0))
      : 1;

    listinoMinimo += minimoBase * mult;
    listinoMassimo += massimoBase * mult;
    prezzoListino += interpolaListino(minimoBase, massimoBase, difficolta) * mult;
  }

  listinoMinimo = round(listinoMinimo, 2);
  listinoMassimo = round(listinoMassimo, 2);
  prezzoListino = round(prezzoListino, 2);

  const minimoEconomico = margine < 100
    ? round(costoPieno / (1 - margine / 100), 2)
    : costoPieno;

  const ricavoMinimo = round(Math.max(listinoMinimo, minimoEconomico), 2);
  const ricavoPrevisto = round(Math.max(prezzoListino, ricavoMinimo), 2);
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
    ricavo_minimo: ricavoMinimo,
    compenso_minimo: ricavoMinimo,
    compenso_obiettivo: ricavoPrevisto,
    ricavo_previsto: ricavoPrevisto,
    margine_previsto: marginePrevisto,
    margine_previsto_percentuale: marginePrevistoPercentuale,
    fuori_fascia: listinoMassimo > 0 && minimoEconomico > listinoMassimo,
    servizi_senza_listino: serviziSenzaListino,
  };
}
