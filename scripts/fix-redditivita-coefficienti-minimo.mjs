import fs from "node:fs";

const path = "src/lib/redditivita-listino.ts";
let source = fs.readFileSync(path, "utf8");

const oldInterpola = `export function interpolaListino(minimo: number, massimo: number, difficoltaRaw: unknown) {
  const min = Math.max(0, n(minimo));
  const max = Math.max(min, n(massimo));
  const difficolta = difficoltaNormalizzata(difficoltaRaw);
  const posizione = (difficolta - 1) / 4;
  return round(min + (max - min) * posizione, 2);
}`;

const newInterpola = `export function coefficienteRedditivita(difficoltaRaw: unknown) {
  const difficolta = difficoltaNormalizzata(difficoltaRaw);
  const coefficienti: Record<number, number> = {
    1: 1.00,
    2: 1.25,
    3: 1.50,
    4: 1.75,
    5: 2.00,
  };
  return coefficienti[difficolta] || 1.50;
}

export function coefficienteCoge(difficoltaRaw: unknown) {
  const difficolta = difficoltaNormalizzata(difficoltaRaw);
  const coefficienti: Record<number, number> = {
    1: 1.00,
    2: 1.00,
    3: 1.05,
    4: 1.10,
    5: 1.15,
  };
  return coefficienti[difficolta] || 1.05;
}

export function interpolaListino(minimo: number, _massimo: number, difficoltaRaw: unknown) {
  const min = Math.max(0, n(minimo));
  return round(min * coefficienteRedditivita(difficoltaRaw), 2);
}`;

if (!source.includes(oldInterpola)) {
  throw new Error("[redditivita-minimo] interpolaListino non trovato");
}
source = source.replace(oldInterpola, newInterpola);

const cogeRegex = /export function fasciaDimensionaleCoge[\s\S]*?\n}\n\nexport function prezzoListinoServizio/;
const cogeReplacement = `export function calcolaCogeMensile(
  minimoRaw: unknown,
  _massimoRaw: unknown,
  operazioniRaw: unknown,
  difficoltaRaw: unknown
) {
  const quotaBaseMensile = Math.max(0, n(minimoRaw)) || 250;
  const operazioni = Math.max(0, n(operazioniRaw));
  const difficolta = difficoltaNormalizzata(difficoltaRaw);
  const coefficiente = coefficienteCoge(difficolta);

  // Scaglioni marginali progressivi: ogni fascia valorizza solo l'eccedenza.
  const q1 = Math.min(operazioni, 1000);
  const q2 = Math.min(Math.max(operazioni - 1000, 0), 4000);
  const q3 = Math.min(Math.max(operazioni - 5000, 0), 5000);
  const q4 = Math.max(operazioni - 10000, 0);

  // Soglie cumulative: 1.000 / 5.000 / 10.000 / oltre 10.000.
  const s1 = quotaBaseMensile * (q1 / 1000);
  const s2 = quotaBaseMensile * (q2 / 5000);
  const s3 = quotaBaseMensile * (q3 / 10000);
  const s4 = quotaBaseMensile * (q4 / 10000);

  // I primi 1.000 movimenti non subiscono MAI maggiorazioni.
  // Il coefficiente COGE si applica esclusivamente alla quota maturata oltre 1.000.
  const quotaOltreMille = s2 + s3 + s4;
  const baseMensile = round(s1 + quotaOltreMille, 2);
  const prezzoMensile = round(s1 + quotaOltreMille * coefficiente, 2);

  const fascia = operazioni <= 1000
    ? "Fino a 1.000"
    : operazioni <= 5000
      ? "1.001–5.000"
      : operazioni <= 10000
        ? "5.001–10.000"
        : "Oltre 10.000";

  return {
    fascia,
    operazioni,
    difficolta,
    coefficiente_redditivita: coefficiente,
    base_mensile: baseMensile,
    quota_primi_1000_mensile: round(s1, 2),
    quota_oltre_1000_mensile: round(quotaOltreMille, 2),
    minimo_mensile: baseMensile,
    massimo_mensile: baseMensile,
    prezzo_mensile: prezzoMensile,
    minimo_annuo: round(baseMensile * 12, 2),
    massimo_annuo: round(baseMensile * 12, 2),
    prezzo_annuo: round(prezzoMensile * 12, 2),
    scaglioni: [
      { etichetta: "1–1.000", soglia: 1000, quantita: q1, quota_mensile: round(s1, 2), coefficiente: 1.00 },
      { etichetta: "1.001–5.000", soglia: 5000, quantita: q2, quota_mensile: round(s2, 2), coefficiente },
      { etichetta: "5.001–10.000", soglia: 10000, quantita: q3, quota_mensile: round(s3, 2), coefficiente },
      { etichetta: "Oltre 10.000", soglia: 10000, quantita: q4, quota_mensile: round(s4, 2), coefficiente },
    ],
  };
}

export function prezzoListinoServizio`;

if (!cogeRegex.test(source)) {
  throw new Error("[redditivita-minimo] blocco COGE non trovato");
}
source = source.replace(cogeRegex, cogeReplacement);

// Il massimo resta solo per compatibilità dati/UI: i calcoli usano esclusivamente il minimo.
source = source.replaceAll(
  "massimo: dati.massimo,\n      prezzo: interpolaListino(dati.minimo, dati.massimo, servizio.coefficiente_complessita),",
  "massimo: dati.minimo,\n      prezzo: interpolaListino(dati.minimo, dati.minimo, servizio.coefficiente_complessita),"
);

source = source.replaceAll(
  "massimo: round(dati.massimo * mult, 2),\n    prezzo: round(interpolaListino(dati.minimo, dati.massimo, servizio.coefficiente_complessita) * mult, 2),",
  "massimo: round(dati.minimo * mult, 2),\n    prezzo: round(interpolaListino(dati.minimo, dati.minimo, servizio.coefficiente_complessita) * mult, 2),"
);

source = source.replace(
  "    const massimoBase = Math.max(...datiRighe.map((d) => d.massimo));",
  "    const massimoBase = minimoBase;"
);
source = source.replace(
  "    prezzoListino += interpolaListino(minimoBase, massimoBase, difficolta) * mult;",
  "    prezzoListino += interpolaListino(minimoBase, minimoBase, difficolta) * mult;"
);

fs.writeFileSync(path, source, "utf8");
console.log("✓ Redditività: COGE 1,00/1,00/1,05/1,10/1,15 solo oltre 1.000; altre attività invarianti");
