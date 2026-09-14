import fs from "node:fs";

function patch(path, fn) {
  const source = fs.readFileSync(path, "utf8");
  const next = fn(source);
  if (next === source) {
    console.log(`• ${path}: nessuna modifica necessaria`);
  } else {
    fs.writeFileSync(path, next, "utf8");
    console.log(`✓ ${path}`);
  }
}

// -----------------------------------------------------------------------------
// 1) Motore listino: COGE a scaglioni marginali progressivi, stile IRPEF.
// -----------------------------------------------------------------------------
patch("src/lib/redditivita-listino.ts", (source) => {
  const functionsRegex = /export function fasciaDimensionaleCoge[\s\S]*?\n}\n\nexport function prezzoListinoServizio/;

  const progressiveFunctions = `export function coefficienteDifficoltaCoge(value: unknown) {
  const difficolta = difficoltaNormalizzata(value);
  const coefficienti: Record<number, number> = {
    1: 1.0,
    2: 1.1,
    3: 1.2,
    4: 1.3,
    5: 1.4,
  };
  return coefficienti[difficolta] || 1.2;
}

export function calcolaCogeProgressiva(
  quotaBloccoMensileRaw: unknown,
  operazioniRaw: unknown,
  difficoltaRaw: unknown
) {
  const quotaBloccoMensile = Math.max(0, n(quotaBloccoMensileRaw)) || 250;
  const operazioni = Math.max(0, n(operazioniRaw));
  const difficolta = difficoltaNormalizzata(difficoltaRaw);
  const coefficienteDifficolta = coefficienteDifficoltaCoge(difficolta);

  // Scaglioni marginali: ogni passaggio di fascia valorizza SOLO l'eccedenza.
  const q1 = Math.min(operazioni, 1000);
  const q2 = Math.min(Math.max(operazioni - 1000, 0), 4000);
  const q3 = Math.min(Math.max(operazioni - 5000, 0), 5000);
  const q4 = Math.max(operazioni - 10000, 0);

  // Ogni blocco pieno aggiunge la stessa quota mensile base.
  // Oltre 10.000: una quota piena ogni ulteriori 10.000 operazioni.
  const r1 = quotaBloccoMensile / 1000;
  const r2 = quotaBloccoMensile / 4000;
  const r3 = quotaBloccoMensile / 5000;
  const r4 = quotaBloccoMensile / 10000;

  const s1 = round(q1 * r1, 4);
  const s2 = round(q2 * r2, 4);
  const s3 = round(q3 * r3, 4);
  const s4 = round(q4 * r4, 4);
  const baseMensile = round(s1 + s2 + s3 + s4, 2);

  const prezzoMensile = round(baseMensile * coefficienteDifficolta, 2);
  const minimoMensile = round(baseMensile * 1.0, 2);
  const massimoMensile = round(baseMensile * 1.4, 2);

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
    coefficiente_difficolta: coefficienteDifficolta,
    quota_blocco_mensile: quotaBloccoMensile,
    base_mensile: baseMensile,
    minimo_mensile: minimoMensile,
    massimo_mensile: massimoMensile,
    prezzo_mensile: prezzoMensile,
    minimo_annuo: round(minimoMensile * 12, 2),
    massimo_annuo: round(massimoMensile * 12, 2),
    prezzo_annuo: round(prezzoMensile * 12, 2),
    scaglioni: [
      { da: 1, a: 1000, quantita: q1, quota_mensile: s1 },
      { da: 1001, a: 5000, quantita: q2, quota_mensile: s2 },
      { da: 5001, a: 10000, quantita: q3, quota_mensile: s3 },
      { da: 10001, a: null, quantita: q4, quota_mensile: s4 },
    ],
  };
}

export function prezzoListinoServizio`;

  if (!functionsRegex.test(source)) {
    throw new Error("[COGE progressiva] blocco funzioni COGE non trovato");
  }
  source = source.replace(functionsRegex, progressiveFunctions);

  const oldCall = /const coge = calcolaCogeMensile\(\s*dati\.minimo,\s*dati\.massimo,\s*servizio\.quantita_driver,\s*servizio\.coefficiente_complessita\s*\);/;
  if (!oldCall.test(source)) {
    throw new Error("[COGE progressiva] chiamata calcolaCogeMensile non trovata");
  }
  source = source.replace(
    oldCall,
    `const coge = calcolaCogeProgressiva(\n      dati.minimo || 250,\n      servizio.quantita_driver,\n      servizio.coefficiente_complessita\n    );`
  );

  source = source.replace(
    "// COGE: la quantità serve SOLO a determinare la fascia dimensionale.\n  // Non viene mai moltiplicata per il listino.",
    "// COGE: scaglioni marginali progressivi. La quantità valorizza solo la quota del proprio scaglione."
  );

  return source;
});

// -----------------------------------------------------------------------------
// 2) Clienti: CONT_MOV_IVA non deve più comparire né essere selezionabile.
// -----------------------------------------------------------------------------
patch("src/components/controllo-gestione/RedditivitaClientiTab.tsx", (source) => {
  source = source.replaceAll(
    "setAttivita(Array.isArray(json?.attivita) ? json.attivita : []);",
    "setAttivita((Array.isArray(json?.attivita) ? json.attivita : []).filter((a: any) => String(a?.codice || \"\").trim().toUpperCase() !== \"CONT_MOV_IVA\"));"
  );

  source = source.replaceAll(
    "setServizi(Array.isArray(json?.servizi) ? json.servizi : []);",
    "setServizi((Array.isArray(json?.servizi) ? json.servizi : []).filter((s: any) => String(s?.attivita?.codice || \"\").trim().toUpperCase() !== \"CONT_MOV_IVA\"));"
  );

  source = source.replace(
    "return attivita.filter((a) => a.attiva && !used.has(a.id));",
    "return attivita.filter((a) => a.attiva && String(a.codice || \"\").trim().toUpperCase() !== \"CONT_MOV_IVA\" && !used.has(a.id));"
  );

  return source;
});

// -----------------------------------------------------------------------------
// 3) Catalogo attività: nascondi definitivamente il vecchio driver IVA.
// -----------------------------------------------------------------------------
patch("src/pages/controllo-gestione/redditivita-studio.tsx", (source) => {
  source = source.replaceAll(
    "setAttivita(Array.isArray(json?.attivita) ? json.attivita : []);",
    "setAttivita((Array.isArray(json?.attivita) ? json.attivita : []).filter((a: any) => String(a?.codice || \"\").trim().toUpperCase() !== \"CONT_MOV_IVA\"));"
  );
  return source;
});

// -----------------------------------------------------------------------------
// 4) API: non restituire e non consentire di reinserire CONT_MOV_IVA.
//    I record storici restano nel DB ma sono dismessi dal modello operativo.
// -----------------------------------------------------------------------------
patch("src/pages/api/controllo-gestione/redditivita-studio.ts", (source) => {
  // Escludi il codice dalla lista attività restituita, sia con che senza fallback listino.
  source = source.replaceAll(
    "attivita: attivitaResult.data || [],",
    "attivita: (attivitaResult.data || []).filter((a: any) => String(a?.codice || \"\").trim().toUpperCase() !== \"CONT_MOV_IVA\"),"
  );
  source = source.replaceAll(
    "attivita: (attivitaResult.data || []).map((a: any) => attivitaConListinoFallback(a)),",
    "attivita: (attivitaResult.data || []).filter((a: any) => String(a?.codice || \"\").trim().toUpperCase() !== \"CONT_MOV_IVA\").map((a: any) => attivitaConListinoFallback(a)),"
  );

  // Se la patch fallback ha creato attivitaIdratate, filtra prima della Map.
  source = source.replaceAll(
    "const attivitaIdratate = (attivitaResult.data || []).map((a: any) => attivitaConListinoFallback(a));",
    "const attivitaIdratate = (attivitaResult.data || []).filter((a: any) => String(a?.codice || \"\").trim().toUpperCase() !== \"CONT_MOV_IVA\").map((a: any) => attivitaConListinoFallback(a));"
  );

  // Caso base senza idratazione fallback.
  source = source.replaceAll(
    "const attivitaMap = new Map((attivitaResult.data || []).map((a: any) => [a.id, a]));",
    "const attivitaMap = new Map((attivitaResult.data || []).filter((a: any) => String(a?.codice || \"\").trim().toUpperCase() !== \"CONT_MOV_IVA\").map((a: any) => [a.id, a]));"
  );

  // Non lasciare in dettaglio servizi che puntano all'attività dismessa.
  source = source.replace(
    "            ripartizione: ripartizioniByServizio.get(s.id) || [],\n          }))\n          .sort((a: any, b: any) => {",
    "            ripartizione: ripartizioniByServizio.get(s.id) || [],\n          }))\n          .filter((s: any) => Boolean(s.attivita))\n          .sort((a: any, b: any) => {"
  );

  // L'overview deve conoscere attivita_id per poter escludere i servizi IVA dismessi.
  source = source.replaceAll(
    '.select("cliente_id,attivo,quantita_driver,ore_equivalenti,costo_stimato")',
    '.select("cliente_id,attivita_id,attivo,quantita_driver,ore_equivalenti,costo_stimato")'
  );

  const summaryAnchor = "      const clientiSummary = new Map<string, { servizi: number; operazioni: number; ore: number; costo: number }>();\n      for (const s of serviziClientiResult.data || []) {";
  if (source.includes(summaryAnchor) && !source.includes("attivitaIvaDismesse")) {
    source = source.replace(
      summaryAnchor,
      "      const attivitaIvaDismesse = new Set((attivitaResult.data || []).filter((a: any) => String(a?.codice || \"\").trim().toUpperCase() === \"CONT_MOV_IVA\").map((a: any) => String(a.id)));\n      const clientiSummary = new Map<string, { servizi: number; operazioni: number; ore: number; costo: number }>();\n      for (const s of serviziClientiResult.data || []) {\n        if (attivitaIvaDismesse.has(String((s as any).attivita_id || \"\"))) continue;"
    );
  }

  // Impedisci la ricreazione del vecchio codice dal catalogo.
  const salvaAttivitaAnchor = "        if (!codice || !area || !descrizione || !driver) {";
  if (source.includes(salvaAttivitaAnchor) && !source.includes("CONT_MOV_IVA è stata dismessa")) {
    source = source.replace(
      salvaAttivitaAnchor,
      "        if (codice === \"CONT_MOV_IVA\") {\n          return res.status(400).json({ success: false, error: \"CONT_MOV_IVA è stata dismessa: i movimenti IVA sono inclusi nella COGE progressiva.\" });\n        }\n\n" + salvaAttivitaAnchor
    );
  }

  // Impedisci di associare a un cliente un eventuale record storico ancora presente nel DB.
  const activityFoundAnchor = "        if (!attivitaResult.data) return res.status(404).json({ success: false, error: \"Attività non appartenente allo studio\" });";
  if (source.includes(activityFoundAnchor) && !source.includes("Attività IVA dismessa")) {
    source = source.replace(
      activityFoundAnchor,
      activityFoundAnchor + "\n        if (String(attivitaResult.data?.codice || \"\").trim().toUpperCase() === \"CONT_MOV_IVA\") {\n          return res.status(400).json({ success: false, error: \"Attività IVA dismessa: usare Registrazione movimenti contabili (COGE).\" });\n        }"
    );
  }

  return source;
});

console.log("✓ Redditività: COGE progressiva marginale attiva e CONT_MOV_IVA dismessa");
