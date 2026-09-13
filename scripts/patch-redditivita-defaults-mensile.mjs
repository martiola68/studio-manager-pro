import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function patch(rel, fn) {
  const file = path.join(root, rel);
  const src = fs.readFileSync(file, "utf8");
  const out = fn(src);
  if (out === src) {
    console.log(`↷ ${rel} già aggiornato`);
    return;
  }
  fs.writeFileSync(file, out, "utf8");
  console.log(`✓ ${rel}`);
}

// 1) API: catalogo CU/IRAP, default per tipo cliente e consulenza mensile.
patch("src/pages/api/controllo-gestione/redditivita-studio.ts", (source) => {
  const actionAnchor = '      if (action === "salva_costi_studio") {';
  if (!source.includes('action === "inizializza_default_clienti"')) {
    if (!source.includes(actionAnchor)) throw new Error("Anchor salva_costi_studio non trovato");
    const block = `      if (action === "inizializza_default_clienti") {\n        // Manteniamo il catalogo fiscale minimo del modulo senza sovrascrivere personalizzazioni già esistenti.\n        const codiciNuovi = [\n          { codice: "DICH_CU", area: "Dichiarativi", descrizione: "Certificazione Unica (CU)", driver: "Numero adempimenti CU", unita_misura: "n.", tempo_standard_minuti: 60, coefficiente_base: 1, ordinamento: 90, attiva: true },\n          { codice: "DICH_IRAP", area: "Dichiarativi", descrizione: "Dichiarazione IRAP", driver: "Numero dichiarazioni", unita_misura: "n.", tempo_standard_minuti: 90, coefficiente_base: 1, ordinamento: 95, attiva: true },\n        ];\n\n        const { data: catalogoPresente, error: catPreError } = await supabaseAdmin\n          .from("tbcdg_attivita_catalogo")\n          .select("codice")\n          .eq("studio_id", studioId)\n          .in("codice", codiciNuovi.map((x) => x.codice));\n        if (catPreError) throw catPreError;\n        const presenti = new Set((catalogoPresente || []).map((x: any) => String(x.codice)));\n        const daCreare = codiciNuovi.filter((x) => !presenti.has(x.codice)).map((x) => ({ studio_id: studioId, ...x }));\n        if (daCreare.length) {\n          const { error: insertCatalogoError } = await supabaseAdmin.from("tbcdg_attivita_catalogo").insert(daCreare);\n          if (insertCatalogoError) throw insertCatalogoError;\n        }\n\n        // CONS_ORE cambia significato: il dato inserito è la previsione media mensile del singolo cliente.\n        const { error: consulenzaLabelError } = await supabaseAdmin\n          .from("tbcdg_attivita_catalogo")\n          .update({ driver: "Ore mensili di consulenza", unita_misura: "ore/mese" })\n          .eq("studio_id", studioId)\n          .eq("codice", "CONS_ORE")\n          .eq("driver", "Ore di consulenza");\n        if (consulenzaLabelError) throw consulenzaLabelError;\n\n        const codiciDefault = ["BIL_BILANCIO", "DICH_REDDITI", "DICH_IVA", "DICH_CU", "DICH_IRAP"];\n        const [catalogoResult, clientiResult, serviziResult, medio] = await Promise.all([\n          supabaseAdmin.from("tbcdg_attivita_catalogo").select("id,codice,tempo_standard_minuti,coefficiente_base").eq("studio_id", studioId).eq("attiva", true).in("codice", codiciDefault),\n          supabaseAdmin.from("tbclienti").select("id,tipo_cliente,codice_fiscale,utente_operatore_id").eq("studio_id", studioId).eq("cliente", true).eq("attivo", true),\n          supabaseAdmin.from("tbcdg_cliente_servizi").select("cliente_id,attivita_id").eq("studio_id", studioId).eq("esercizio", esercizio),\n          costoOrarioMedioStudio(studioId, esercizio),\n        ]);\n        if (catalogoResult.error) throw catalogoResult.error;\n        if (clientiResult.error) throw clientiResult.error;\n        if (serviziResult.error) throw serviziResult.error;\n\n        const catalogoByCodice = new Map((catalogoResult.data || []).map((a: any) => [String(a.codice), a]));\n        const esistenti = new Set((serviziResult.data || []).map((s: any) => String(s.cliente_id) + ":" + String(s.attivita_id)));\n        const clientiById = new Map((clientiResult.data || []).map((c: any) => [String(c.id), c]));\n        const righe: any[] = [];\n\n        for (const cliente of clientiResult.data || []) {\n          const tipo = String(cliente.tipo_cliente || "").trim().toLowerCase();\n          const cf = String(cliente.codice_fiscale || "").trim().toUpperCase();\n          const personaFisica = tipo === "persona fisica" || (!tipo && /^[A-Z0-9]{16}$/.test(cf));\n          const defaults = personaFisica\n            ? [{ codice: "DICH_REDDITI", quantita: 1 }]\n            : [\n                { codice: "BIL_BILANCIO", quantita: 1 },\n                { codice: "DICH_REDDITI", quantita: 2 },\n                { codice: "DICH_IVA", quantita: 1 },\n                { codice: "DICH_CU", quantita: 1 },\n                { codice: "DICH_IRAP", quantita: 1 },\n              ];\n\n          for (const d of defaults) {\n            const a: any = catalogoByCodice.get(d.codice);\n            if (!a) continue;\n            const key = String(cliente.id) + ":" + String(a.id);\n            if (esistenti.has(key)) continue;\n            const ore = round(d.quantita * n(a.tempo_standard_minuti) / 60 * n(a.coefficiente_base || 1), 4);\n            righe.push({\n              studio_id: studioId,\n              esercizio,\n              cliente_id: cliente.id,\n              attivita_id: a.id,\n              attivo: true,\n              quantita_driver: d.quantita,\n              coefficiente_complessita: 3,\n              ore_equivalenti: ore,\n              costo_stimato: round(ore * medio.costoOrario, 2),\n            });\n            esistenti.add(key);\n          }\n        }\n\n        const inseriti: any[] = [];\n        for (let i = 0; i < righe.length; i += 300) {\n          const { data, error } = await supabaseAdmin.from("tbcdg_cliente_servizi").insert(righe.slice(i, i + 300)).select("*");\n          if (error) throw error;\n          inseriti.push(...(data || []));\n        }\n\n        if (inseriti.length) {\n          const operatorIds = Array.from(new Set((clientiResult.data || []).map((c: any) => c.utente_operatore_id).filter(Boolean).map(String)));\n          let operatoriValidi = new Set<string>();\n          if (operatorIds.length) {\n            const { data: utenti, error: utentiError } = await supabaseAdmin.from("tbutenti").select("id").eq("studio_id", studioId).eq("attivo", true).in("id", operatorIds);\n            if (utentiError) throw utentiError;\n            operatoriValidi = new Set((utenti || []).map((u: any) => String(u.id)));\n          }\n          const assegnazioni = inseriti.flatMap((s: any) => {\n            const c: any = clientiById.get(String(s.cliente_id));\n            const operatoreId = c?.utente_operatore_id ? String(c.utente_operatore_id) : "";\n            if (!operatoreId || !operatoriValidi.has(operatoreId)) return [];\n            return [{\n              studio_id: studioId,\n              esercizio,\n              cliente_id: s.cliente_id,\n              cliente_servizio_id: s.id,\n              operatore_id: operatoreId,\n              percentuale_ripartizione_attivita: 100,\n              numero_operazioni_attribuite: n(s.quantita_driver),\n              ore_attribuite: n(s.ore_equivalenti),\n              costo_attribuito: n(s.costo_stimato),\n            }];\n          });\n          for (let i = 0; i < assegnazioni.length; i += 300) {\n            const { error } = await supabaseAdmin.from("tbcdg_cliente_attivita_operatori").insert(assegnazioni.slice(i, i + 300));\n            if (error) throw error;\n          }\n        }\n\n        return res.status(200).json({ success: true, creati: inseriti.length, clienti: (clientiResult.data || []).length });\n      }\n\n`;
    source = source.replace(actionAnchor, block + actionAnchor);
  }

  // La regola "quantità intera" resta per i driver numerici; CONS_ORE accetta frazioni di ora.
  source = source.replace(
    '        if (!Number.isInteger(quantitaDriver) || quantitaDriver < 0) {\n          return res.status(400).json({ success: false, error: "Il numero operazioni / quantità deve essere un numero intero" });\n        }\n',
    ''
  );

  const attivitaCheck = '        if (!attivitaResult.data) return res.status(404).json({ success: false, error: "Attività non appartenente allo studio" });';
  if (source.includes(attivitaCheck) && !source.includes('const isConsulenzaMensile = String(attivitaResult.data.codice')) {
    source = source.replace(
      attivitaCheck,
      attivitaCheck + '\n\n        const isConsulenzaMensile = String(attivitaResult.data.codice || "") === "CONS_ORE";\n        if (quantitaDriver < 0 || (!isConsulenzaMensile && !Number.isInteger(quantitaDriver))) {\n          return res.status(400).json({ success: false, error: isConsulenzaMensile ? "Le ore mensili non possono essere negative" : "Il numero operazioni / quantità deve essere un numero intero" });\n        }'
    );
  }

  const oldOre = `        const oreEquivalenti = round(\n          quantitaDriver * n(attivitaResult.data.tempo_standard_minuti) / 60 * n(attivitaResult.data.coefficiente_base || 1) * coefficienteDifficolta(coefficienteComplessita),\n          4\n        );`;
  const newOre = `        const oreEquivalenti = isConsulenzaMensile\n          ? round(quantitaDriver * 12, 4)\n          : round(\n              quantitaDriver * n(attivitaResult.data.tempo_standard_minuti) / 60 * n(attivitaResult.data.coefficiente_base || 1) * coefficienteDifficolta(coefficienteComplessita),\n              4\n            );`;
  if (source.includes(oldOre)) source = source.replace(oldOre, newOre);
  source = source.replace(
    '          coefficiente_complessita: coefficienteComplessita,\n          ore_equivalenti: oreEquivalenti,',
    '          coefficiente_complessita: isConsulenzaMensile ? 3 : coefficienteComplessita,\n          ore_equivalenti: oreEquivalenti,'
  );

  return source;
});

// 2) Pagina principale: inizializza una sola volta per studio/esercizio e non ricarica al ritorno del focus.
patch("src/pages/controllo-gestione/redditivita-studio.tsx", (source) => {
  source = source.replace('import { useEffect, useMemo, useState } from "react";', 'import { useEffect, useMemo, useRef, useState } from "react";');

  if (!source.includes('const [defaultsReady, setDefaultsReady]')) {
    source = source.replace(
      '  const [tabReady, setTabReady] = useState(false);',
      '  const [tabReady, setTabReady] = useState(false);\n  const [defaultsReady, setDefaultsReady] = useState(false);\n  const defaultsKeyRef = useRef("");\n  const autoLoadKeyRef = useRef("");'
    );
  }

  const oldEffect = `  useEffect(() => {\n    if (!studioId || !tabReady) return;\n    if (!["dashboard", "costi", "operatori", "attivita"].includes(tab)) return;\n    caricaDati(studioId, anno);\n  }, [studioId, anno, tab, tabReady]);`;
  const newEffects = `  useEffect(() => {\n    if (!studioId || !tabReady) return;\n    const key = studioId + ":" + anno;\n    if (defaultsKeyRef.current === key) { setDefaultsReady(true); return; }\n    defaultsKeyRef.current = key;\n    setDefaultsReady(false);\n    (async () => {\n      try {\n        const r = await fetch("/api/controllo-gestione/redditivita-studio", {\n          method: "POST",\n          headers: { "Content-Type": "application/json" },\n          body: JSON.stringify({ action: "inizializza_default_clienti", studio_id: studioId, esercizio: Number(anno) }),\n        });\n        const j = await r.json();\n        if (!r.ok) throw new Error(j?.error || "Errore inizializzazione servizi standard");\n      } catch (e: any) {\n        setMessage(e?.message || "Errore inizializzazione servizi standard");\n      } finally {\n        setDefaultsReady(true);\n      }\n    })();\n  }, [studioId, anno, tabReady]);\n\n  useEffect(() => {\n    if (!studioId || !tabReady || !defaultsReady) return;\n    if (!["dashboard", "costi", "operatori", "attivita"].includes(tab)) return;\n    const key = studioId + ":" + anno + ":" + tab;\n    if (autoLoadKeyRef.current === key) return;\n    autoLoadKeyRef.current = key;\n    caricaDati(studioId, anno);\n  }, [studioId, anno, tab, tabReady, defaultsReady]);`;
  if (source.includes(oldEffect)) source = source.replace(oldEffect, newEffects);

  source = source.replace('{loading ? (', '{loading || !defaultsReady ? (');
  return source;
});

// 3) Clienti: consulenza = ore mensili della singola società; caricamento automatico una volta sola.
patch("src/components/controllo-gestione/RedditivitaClientiTab.tsx", (source) => {
  source = source.replace('import { useEffect, useMemo, useState } from "react";', 'import { useEffect, useMemo, useRef, useState } from "react";');
  if (!source.includes('const autoLoadKeyRef = useRef("");')) {
    source = source.replace(
      '  const SELECTED_CLIENT_KEY = `smp:redditivita-studio:cliente:${studioId}:${anno}`;',
      '  const SELECTED_CLIENT_KEY = `smp:redditivita-studio:cliente:${studioId}:${anno}`;\n  const autoLoadKeyRef = useRef("");'
    );
  }

  source = source.replace(
    '  useEffect(() => {\n    if (!studioId) return;\n    let active = true;\n    (async () => {',
    '  useEffect(() => {\n    if (!studioId) return;\n    const loadKey = studioId + ":" + anno;\n    if (autoLoadKeyRef.current === loadKey) return;\n    autoLoadKeyRef.current = loadKey;\n    let active = true;\n    (async () => {'
  );

  // Modale nuovo servizio: per CONS_ORE il valore è mensile e può essere frazionario.
  const integerModal = '<IntegerField label="Numero operazioni / quantità" value={serviceDraft.quantita_driver} onChange={(v) => setServiceDraft((p) => ({ ...p, quantita_driver: v }))} />';
  const monthlyModal = '{attivita.find((a) => a.id === serviceDraft.attivita_id)?.codice === "CONS_ORE" ? <DecimalField label="Ore mensili di consulenza" value={serviceDraft.quantita_driver} onChange={(v) => setServiceDraft((p) => ({ ...p, quantita_driver: v, coefficiente_complessita: 3 }))} /> : <IntegerField label="Numero operazioni / quantità" value={serviceDraft.quantita_driver} onChange={(v) => setServiceDraft((p) => ({ ...p, quantita_driver: v }))} />}';
  if (source.includes(integerModal)) source = source.replace(integerModal, monthlyModal);

  const difficultyModal = '<DifficultyField value={serviceDraft.coefficiente_complessita} onChange={(v) => setServiceDraft((p) => ({ ...p, coefficiente_complessita: v }))} />';
  const monthlyDifficulty = '{attivita.find((a) => a.id === serviceDraft.attivita_id)?.codice === "CONS_ORE" ? <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900"><strong>Consulenza:</strong> le ore sono effettive/previste per mese e vengono annualizzate × 12. La difficoltà non moltiplica le ore.</div> : <DifficultyField value={serviceDraft.coefficiente_complessita} onChange={(v) => setServiceDraft((p) => ({ ...p, coefficiente_complessita: v }))} />}';
  if (source.includes(difficultyModal)) source = source.replace(difficultyModal, monthlyDifficulty);

  if (!source.includes('function DecimalField(')) {
    source = source.replace(
      'function IntegerField({ label, value, onChange }:',
      'function DecimalField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {\n  return <label className="text-sm font-semibold text-slate-700">{label}<input type="number" min="0" step="0.25" inputMode="decimal" value={Number.isFinite(value) ? value : 0} onChange={(e) => onChange(Math.max(0, n(e.target.value)))} className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-sky-600" /><span className="mt-1 block text-xs font-normal text-slate-500">Valore mensile del singolo cliente · annualizzato automaticamente × 12</span></label>;\n}\n\nfunction IntegerField({ label, value, onChange }:'
    );
  }

  // Riga servizio già esistente.
  source = source.replace(
    '  const [c, setC] = useState(n(servizio.coefficiente_complessita));',
    '  const [c, setC] = useState(n(servizio.coefficiente_complessita));\n  const isConsulenzaMensile = servizio.attivita?.codice === "CONS_ORE";'
  );
  source = source.replace(
    '<input type="number" min="0" step="1" inputMode="numeric" value={q || ""} onChange={(e) => setQ(Math.max(0, Math.trunc(n(e.target.value))))} className="h-9 w-24 rounded-md border border-slate-300 px-2 text-right" />',
    '<input type="number" min="0" step={isConsulenzaMensile ? "0.25" : "1"} inputMode={isConsulenzaMensile ? "decimal" : "numeric"} value={q || ""} onChange={(e) => setQ(isConsulenzaMensile ? Math.max(0, n(e.target.value)) : Math.max(0, Math.trunc(n(e.target.value))))} className="h-9 w-24 rounded-md border border-slate-300 px-2 text-right" />'
  );
  source = source.replace(
    '{servizio.attivita?.driver || "—"}<div className="text-xs">{servizio.attivita?.unita_misura || ""}</div>',
    '{isConsulenzaMensile ? "Ore mensili di consulenza" : (servizio.attivita?.driver || "—")}<div className="text-xs">{isConsulenzaMensile ? "ore/mese" : (servizio.attivita?.unita_misura || "")}</div>'
  );
  source = source.replace(
    '<select value={c || 3} onChange={(e) => setC(n(e.target.value))} className="h-9 w-36 rounded-md border border-slate-300 bg-white px-2 text-xs"><option value="1">1 · Molto semplice</option>',
    '{isConsulenzaMensile ? <span className="text-xs font-semibold text-slate-500">Non applicata</span> : <select value={c || 3} onChange={(e) => setC(n(e.target.value))} className="h-9 w-36 rounded-md border border-slate-300 bg-white px-2 text-xs"><option value="1">1 · Molto semplice</option>'
  );
  source = source.replace(
    '<option value="5">5 · Critica</option></select>',
    '<option value="5">5 · Critica</option></select>}',
  );
  source = source.replaceAll('onSave(servizio, q, c)', 'onSave(servizio, q, isConsulenzaMensile ? 3 : c)');

  return source;
});

// 4) Compensi & Contratti: filtro cliente/CF e nessun auto-refresh duplicato.
patch("src/components/controllo-gestione/RedditivitaCompensiTab.tsx", (source) => {
  source = source.replace('import { useEffect, useMemo, useState } from "react";', 'import { useEffect, useMemo, useRef, useState } from "react";');
  if (!source.includes('const [filtro, setFiltro]')) {
    source = source.replace(
      '  const [clienti, setClienti] = useState<ClienteRow[]>([]);',
      '  const [clienti, setClienti] = useState<ClienteRow[]>([]);\n  const [filtro, setFiltro] = useState("");\n  const autoLoadKeyRef = useRef("");'
    );
  }
  source = source.replace(
    '  useEffect(() => {\n    if (!studioId) return;\n    let active = true;\n    (async () => {',
    '  useEffect(() => {\n    if (!studioId) return;\n    const loadKey = studioId + ":" + anno;\n    if (autoLoadKeyRef.current === loadKey) return;\n    autoLoadKeyRef.current = loadKey;\n    let active = true;\n    (async () => {'
  );
  if (!source.includes('const clientiFiltrati = useMemo')) {
    source = source.replace(
      '  async function loadOverview() {',
      '  const clientiFiltrati = useMemo(() => {\n    const q = filtro.trim().toLowerCase();\n    if (!q) return clienti;\n    return clienti.filter((c) => `${c.ragione_sociale || ""} ${c.codice_fiscale || ""}`.toLowerCase().includes(q));\n  }, [clienti, filtro]);\n\n  async function loadOverview() {'
    );
  }
  const header = '<div className="border-b border-slate-200 p-5">\n            <h2 className="text-xl font-semibold text-slate-900">Compensi e contratti</h2>\n            <p className="mt-1 text-sm text-slate-500">Confronto tra costo pieno, compenso tecnico, contratto attuale e marginalità.</p>\n          </div>';
  const headerFiltered = '<div className="border-b border-slate-200 p-5">\n            <h2 className="text-xl font-semibold text-slate-900">Compensi e contratti</h2>\n            <p className="mt-1 text-sm text-slate-500">Confronto tra costo pieno, compenso tecnico, contratto attuale e marginalità.</p>\n            <div className="mt-4 max-w-xl"><label className="text-xs font-semibold text-slate-600">Cerca cliente<input type="search" value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Ragione sociale o codice fiscale" className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-sky-600" /></label></div>\n          </div>';
  if (source.includes(header)) source = source.replace(header, headerFiltered);
  source = source.replaceAll('{clienti.map((c) => (', '{clientiFiltrati.map((c) => (');
  source = source.replace('{!clienti.length && <tr>', '{!clientiFiltrati.length && <tr>');
  return source;
});

// 5) Incassi: evita la stessa riattivazione automatica al ritorno del focus.
patch("src/components/controllo-gestione/RedditivitaIncassiTab.tsx", (source) => {
  source = source.replace('import { useEffect, useMemo, useState } from "react";', 'import { useEffect, useMemo, useRef, useState } from "react";');
  if (!source.includes('const autoLoadKeyRef = useRef("");')) {
    source = source.replace(
      '  const INCASSI_SELECTED_KEY = `smp:redditivita-studio:incassi:${studioId}:${anno}`;',
      '  const INCASSI_SELECTED_KEY = `smp:redditivita-studio:incassi:${studioId}:${anno}`;\n  const autoLoadKeyRef = useRef("");'
    );
  }
  source = source.replace(
    '  useEffect(() => {\n    if (!studioId) return;\n    let active = true;\n    (async () => {',
    '  useEffect(() => {\n    if (!studioId) return;\n    const loadKey = studioId + ":" + anno;\n    if (autoLoadKeyRef.current === loadKey) return;\n    autoLoadKeyRef.current = loadKey;\n    let active = true;\n    (async () => {'
  );
  return source;
});

console.log("✓ Redditività Studio: default fiscali, CU/IRAP, consulenza mensile, filtri e stabilità focus applicati");
