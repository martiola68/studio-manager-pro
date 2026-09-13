import fs from "node:fs";

function patch(file, fn) {
  const src = fs.readFileSync(file, "utf8");
  const out = fn(src);
  fs.writeFileSync(file, out, "utf8");
  console.log(`✓ ${file}`);
}

function replaceOrFail(source, label, from, to) {
  if (!source.includes(from)) throw new Error(`[listino-db] pattern not found: ${label}`);
  return source.replace(from, to);
}

patch("src/pages/api/controllo-gestione/redditivita-studio.ts", (source) => {
  if (!source.includes("const prezzoMinimo = Math.max(0, n(req.body?.prezzo_minimo));")) {
    source = replaceOrFail(
      source,
      "parse listino salva attività",
      "        const ordinamento = Math.trunc(n(req.body?.ordinamento));\n        const attiva = req.body?.attiva !== false;",
      "        const ordinamento = Math.trunc(n(req.body?.ordinamento));\n        const attiva = req.body?.attiva !== false;\n        const prezzoMinimo = Math.max(0, n(req.body?.prezzo_minimo));\n        const prezzoMassimo = Math.max(0, n(req.body?.prezzo_massimo));\n        const modalitaPrezzo = String(req.body?.modalita_prezzo || \"unitario\").trim().toLowerCase();\n        const gruppoListino = String(req.body?.gruppo_listino || \"\").trim().toUpperCase() || null;\n        const listinoAttivo = req.body?.listino_attivo !== false;"
    );

    source = replaceOrFail(
      source,
      "validate listino salva attività",
      "        if (coefficienteBase <= 0) return res.status(400).json({ success: false, error: \"Il coefficiente base deve essere maggiore di zero\" });",
      "        if (coefficienteBase <= 0) return res.status(400).json({ success: false, error: \"Il coefficiente base deve essere maggiore di zero\" });\n        if (prezzoMassimo < prezzoMinimo) return res.status(400).json({ success: false, error: \"Il prezzo massimo non può essere inferiore al prezzo minimo\" });\n        if (![\"unitario\", \"mensile\", \"orario\"].includes(modalitaPrezzo)) return res.status(400).json({ success: false, error: \"Modalità prezzo non valida\" });"
    );

    source = replaceOrFail(
      source,
      "payload listino salva attività",
      "          coefficiente_base: coefficienteBase,\n          ordinamento,\n          attiva,",
      "          coefficiente_base: coefficienteBase,\n          prezzo_minimo: prezzoMinimo,\n          prezzo_massimo: prezzoMassimo,\n          modalita_prezzo: modalitaPrezzo,\n          gruppo_listino: gruppoListino,\n          listino_attivo: listinoAttivo,\n          ordinamento,\n          attiva,"
    );
  }

  // Messaggio esplicito se il codice è stato deployato prima della migration Supabase.
  const genericCatch = '  } catch (error: any) {\n    console.error("Errore API Redditivita Studio:", error);\n    return res.status(500).json({ success: false, error: error?.message || "Errore interno server" });\n  }';
  if (source.includes(genericCatch) && !source.includes("Schema listino non inizializzato")) {
    source = source.replace(
      genericCatch,
      '  } catch (error: any) {\n    console.error("Errore API Redditivita Studio:", error);\n    const schemaMessage = String(error?.message || "");\n    if (String(error?.code || "") === "PGRST204" && /prezzo_minimo|prezzo_massimo|modalita_prezzo|gruppo_listino|listino_attivo/i.test(schemaMessage)) {\n      return res.status(503).json({ success: false, error: "Schema listino non inizializzato: applicare la migration Supabase 20260913213000_redditivita_listino_db.sql" });\n    }\n    return res.status(500).json({ success: false, error: error?.message || "Errore interno server" });\n  }'
    );
  }
  return source;
});

patch("src/pages/controllo-gestione/redditivita-studio.tsx", (source) => {
  if (!source.includes("prezzo_minimo: number | string;")) {
    source = replaceOrFail(
      source,
      "type Attivita listino",
      "  coefficiente_base: number | string;\n  attiva: boolean;",
      "  coefficiente_base: number | string;\n  prezzo_minimo: number | string;\n  prezzo_massimo: number | string;\n  modalita_prezzo: string;\n  gruppo_listino?: string | null;\n  listino_attivo?: boolean;\n  attiva: boolean;"
    );
  }

  if (!source.includes("prezzo_minimo: number;")) {
    source = replaceOrFail(
      source,
      "type AttivitaDraft listino",
      "  coefficiente_base: number;\n  ordinamento: number;",
      "  coefficiente_base: number;\n  prezzo_minimo: number;\n  prezzo_massimo: number;\n  modalita_prezzo: string;\n  gruppo_listino: string;\n  listino_attivo: boolean;\n  ordinamento: number;"
    );
  }

  if (!source.includes('modalita_prezzo: "unitario"')) {
    source = replaceOrFail(
      source,
      "emptyAttivita listino",
      "  coefficiente_base: 1,\n  ordinamento: 0,",
      "  coefficiente_base: 1,\n  prezzo_minimo: 0,\n  prezzo_massimo: 0,\n  modalita_prezzo: \"unitario\",\n  gruppo_listino: \"\",\n  listino_attivo: true,\n  ordinamento: 0,"
    );
  }

  if (!source.includes("prezzo_minimo: num(a.prezzo_minimo)")) {
    source = replaceOrFail(
      source,
      "modificaAttivita listino",
      "      coefficiente_base: num(a.coefficiente_base) || 1,\n      ordinamento: num(a.ordinamento),",
      "      coefficiente_base: num(a.coefficiente_base) || 1,\n      prezzo_minimo: num(a.prezzo_minimo),\n      prezzo_massimo: num(a.prezzo_massimo),\n      modalita_prezzo: a.modalita_prezzo || \"unitario\",\n      gruppo_listino: a.gruppo_listino || \"\",\n      listino_attivo: a.listino_attivo !== false,\n      ordinamento: num(a.ordinamento),"
    );
  }

  // Validazione immediata prima della POST.
  if (!source.includes("Il prezzo massimo deve essere maggiore o uguale al prezzo minimo")) {
    source = replaceOrFail(
      source,
      "validazione form listino",
      "  async function salvaAttivita() {\n    if (!studioId) return;\n    try {",
      "  async function salvaAttivita() {\n    if (!studioId) return;\n    if (num(attivitaDraft.prezzo_massimo) < num(attivitaDraft.prezzo_minimo)) {\n      setMessage(\"Il prezzo massimo deve essere maggiore o uguale al prezzo minimo.\");\n      return;\n    }\n    try {"
    );
  }

  // Tabella catalogo: prezzi e modalità sono editabili aprendo Modifica.
  if (!source.includes("Min. listino")) {
    source = source.replace(
      '<th className="px-4 py-3 text-right">Min./unità</th><th className="px-4 py-3 text-right">Coeff.</th><th className="px-4 py-3">Stato</th>',
      '<th className="px-4 py-3 text-right">Min./unità</th><th className="px-4 py-3 text-right">Coeff.</th><th className="px-4 py-3 text-right">Min. listino</th><th className="px-4 py-3 text-right">Max. listino</th><th className="px-4 py-3">Modalità</th><th className="px-4 py-3">Gruppo</th><th className="px-4 py-3">Stato</th>'
    );
    source = source.replace(
      '<tr><td colSpan={9} className="px-4 py-12 text-center text-slate-400">Nessuna attività configurata. Crea il primo driver di lavoro.</td></tr>',
      '<tr><td colSpan={13} className="px-4 py-12 text-center text-slate-400">Nessuna attività configurata. Crea il primo driver di lavoro.</td></tr>'
    );
    source = source.replace(
      '<td className="px-4 py-3 text-right">{num(a.coefficiente_base).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>\n                          <td className="px-4 py-3"><span',
      '<td className="px-4 py-3 text-right">{num(a.coefficiente_base).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>\n                          <td className="px-4 py-3 text-right font-semibold">{euro2(num(a.prezzo_minimo))}</td>\n                          <td className="px-4 py-3 text-right font-semibold">{euro2(num(a.prezzo_massimo))}</td>\n                          <td className="px-4 py-3">{a.modalita_prezzo === "mensile" ? "Mensile" : a.modalita_prezzo === "orario" ? "Orario" : "Unitario"}</td>\n                          <td className="px-4 py-3">{a.gruppo_listino || "—"}</td>\n                          <td className="px-4 py-3"><span'
    );
  }

  if (!source.includes("Prezzo minimo listino")) {
    const coeff = '<NumberField label="Coefficiente base" value={attivitaDraft.coefficiente_base} onChange={(v) => setAttivitaDraft((p) => ({ ...p, coefficiente_base: num(v) }))} />';
    const listinoFields = `${coeff}\n              <div className="md:col-span-2 grid gap-4 md:grid-cols-2 rounded-lg border border-slate-200 bg-slate-50 p-4">\n                <MoneyField label="Prezzo minimo listino" value={attivitaDraft.prezzo_minimo} onChange={(v) => setAttivitaDraft((p) => ({ ...p, prezzo_minimo: num(v) }))} />\n                <MoneyField label="Prezzo massimo listino" value={attivitaDraft.prezzo_massimo} onChange={(v) => setAttivitaDraft((p) => ({ ...p, prezzo_massimo: num(v) }))} />\n              </div>\n              <label className="text-sm font-semibold text-slate-700">Modalità prezzo<select value={attivitaDraft.modalita_prezzo} onChange={(e) => setAttivitaDraft((p) => ({ ...p, modalita_prezzo: e.target.value }))} className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-sky-600"><option value="unitario">Unitario × quantità</option><option value="mensile">Mensile × 12</option><option value="orario">Orario × quantità/ore</option></select></label>\n              <div><TextField label="Gruppo listino (opzionale)" value={attivitaDraft.gruppo_listino} onChange={(v) => setAttivitaDraft((p) => ({ ...p, gruppo_listino: v.toUpperCase() }))} placeholder="es. COGE" /><p className="mt-1 text-xs text-slate-500">Usalo solo per prestazioni valorizzate una sola volta come gruppo.</p></div>\n              <label className="flex items-center gap-3 pt-7 text-sm font-semibold text-slate-700"><input type="checkbox" checked={attivitaDraft.listino_attivo} onChange={(e) => setAttivitaDraft((p) => ({ ...p, listino_attivo: e.target.checked }))} className="h-4 w-4" />Listino attivo</label>`;
    source = replaceOrFail(source, "form listino attività", coeff, listinoFields);
  }

  if (!source.includes("Come vengono calcolati costo e ricavi")) {
    const title = '<h2 className="text-xl font-semibold text-slate-900">Catalogo attività e tempi standard</h2>';
    const explain = `${title}\n                    <div className="mt-3 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm leading-6 text-slate-700"><strong>Come vengono calcolati costo e ricavi:</strong> Costo stimato = ore equivalenti × costo orario pieno dello studio. Ricavo minimo = maggiore tra listino minimo e costo stimato/(1−margine obiettivo). Ricavo previsto = maggiore tra ricavo minimo e prezzo interpolato fra minimo e massimo in base alla difficoltà 1–5. Le attività con lo stesso <strong>Gruppo listino</strong> vengono valorizzate una sola volta.</div>`;
    source = replaceOrFail(source, "spiegazione formule attività", title, explain);
  }

  return source;
});

patch("src/components/controllo-gestione/RedditivitaClientiTab.tsx", (source) => {
  source = source.replaceAll('<Summary label="Listino minimo" value={euro(economiaSettore.listino_minimo)} />', '<Summary label="Ricavo minimo" value={euro(economiaSettore.ricavo_minimo)} />');

  if (!source.includes("Formula costo stimato")) {
    const marker = '<div className="grid gap-3 md:grid-cols-6">';
    const formula = `<div className="mb-4 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm leading-6 text-slate-700"><div><strong>Formula costo stimato:</strong> ore equivalenti × costo orario pieno dello studio.</div><div><strong>Ricavo minimo:</strong> max(listino minimo, costo stimato ÷ (1 − margine obiettivo)).</div><div><strong>Ricavo previsto:</strong> max(ricavo minimo, listino interpolato tra minimo e massimo secondo la difficoltà 1–5).</div></div>\n          ${marker}`;
    if (source.includes(marker)) source = source.replace(marker, formula);
  }

  // Sulla singola riga distinguiamo chiaramente costo e fascia listino.
  source = source.replaceAll("Listino {euro(tariffa.minimo)}–{euro(tariffa.massimo)} · previsto {euro(tariffa.prezzo)}", "Listino {euro(tariffa.minimo)}–{euro(tariffa.massimo)} · da difficoltà {euro(tariffa.prezzo)}");
  return source;
});

console.log("✓ Redditività: listino DB modificabile, form validato e formule economiche rese esplicite");