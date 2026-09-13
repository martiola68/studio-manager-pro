import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function patch(rel, fn) {
  const file = path.join(root, rel);
  const src = fs.readFileSync(file, "utf8");
  const out = fn(src);
  if (out === src) {
    console.log(`↷ ${rel} già collegato al Payroll`);
    return;
  }
  fs.writeFileSync(file, out, "utf8");
  console.log(`✓ ${rel}`);
}

patch("src/pages/api/controllo-gestione/redditivita-studio.ts", (source) => {
  if (!source.includes("function giorniLavorativiPayroll")) {
    const anchor = "async function costoOrarioMedioStudio(studioId: string, esercizio: number) {";
    if (!source.includes(anchor)) throw new Error("Helper costoOrarioMedioStudio non trovato");

    const helpers = `function dataUtc(value: unknown) {\n  const text = String(value || "").trim();\n  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(text)) return null;\n  const [y, m, d] = text.split("-").map(Number);\n  return new Date(Date.UTC(y, m - 1, d));\n}\n\nfunction giorniLavorativiPayroll(esercizio: number, assunzione?: unknown, cessazione?: unknown) {\n  const inizioAnno = new Date(Date.UTC(esercizio, 0, 1));\n  const fineAnno = new Date(Date.UTC(esercizio, 11, 31));\n  const dataAssunzione = dataUtc(assunzione);\n  const dataCessazione = dataUtc(cessazione);\n  const start = dataAssunzione && dataAssunzione > inizioAnno ? dataAssunzione : inizioAnno;\n  const end = dataCessazione && dataCessazione < fineAnno ? dataCessazione : fineAnno;\n  if (end < start) return 0;\n  let giorni = 0;\n  for (let cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {\n    const day = cursor.getUTCDay();\n    if (day !== 0 && day !== 6) giorni += 1;\n  }\n  return giorni;\n}\n\ntype CapacitaOperatore = {\n  collegatoPayroll: boolean;\n  orarioGiornaliero: number;\n  giorniLavorativi: number;\n  oreTeoriche: number;\n  oreNonProduttive: number;\n  oreProduttive: number;\n  dataAssunzione: string | null;\n  dataCessazione: string | null;\n};\n\nasync function capacitaOperatoriStudio(studioId: string, esercizio: number) {\n  const [{ data: payroll, error: payrollError }, { data: costi, error: costiError }] = await Promise.all([\n    supabaseAdmin\n      .from("tbdipendenti")\n      .select("utente_id,orario_giornaliero,data_assunzione,data_cessazione,attivo")\n      .eq("studio_id", studioId)\n      .eq("attivo", true),\n    supabaseAdmin\n      .from("tbcdg_operatori_costi")\n      .select("operatore_id,ore_teoriche,ore_non_produttive,ore_produttive")\n      .eq("studio_id", studioId)\n      .eq("esercizio", esercizio),\n  ]);\n  if (payrollError) throw payrollError;\n  if (costiError) throw costiError;\n\n  const costiMap = new Map<string, any>((costi || []).map((r: any) => [String(r.operatore_id), r]));\n  const byUser = new Map<string, CapacitaOperatore>();\n\n  for (const p of payroll || []) {\n    const userId = String(p.utente_id || "").trim();\n    if (!userId) continue;\n    const oreGiorno = Math.max(0, n(p.orario_giornaliero));\n    const giorni = giorniLavorativiPayroll(esercizio, p.data_assunzione, p.data_cessazione);\n    const oreTeoriche = round(oreGiorno * giorni, 2);\n    const costo = costiMap.get(userId);\n    const oreNonProduttive = Math.max(0, n(costo?.ore_non_produttive));\n    const oreProduttive = Math.max(0, round(oreTeoriche - oreNonProduttive, 2));\n    byUser.set(userId, {\n      collegatoPayroll: true,\n      orarioGiornaliero: oreGiorno,\n      giorniLavorativi: giorni,\n      oreTeoriche,\n      oreNonProduttive,\n      oreProduttive,\n      dataAssunzione: p.data_assunzione || null,\n      dataCessazione: p.data_cessazione || null,\n    });\n  }\n\n  // Collaboratori e altri operatori non presenti nel Payroll restano manuali.\n  for (const c of costi || []) {\n    const userId = String(c.operatore_id || "").trim();\n    if (!userId || byUser.has(userId)) continue;\n    byUser.set(userId, {\n      collegatoPayroll: false,\n      orarioGiornaliero: 0,\n      giorniLavorativi: 0,\n      oreTeoriche: Math.max(0, n(c.ore_teoriche)),\n      oreNonProduttive: Math.max(0, n(c.ore_non_produttive)),\n      oreProduttive: Math.max(0, n(c.ore_produttive)),\n      dataAssunzione: null,\n      dataCessazione: null,\n    });\n  }\n\n  const totaleOreProduttive = Array.from(byUser.values()).reduce((sum, c) => sum + c.oreProduttive, 0);\n  return { byUser, totaleOreProduttive: round(totaleOreProduttive, 2) };\n}\n\n`;
    source = source.replace(anchor, helpers + anchor);
  }

  // Il costo orario usa la capacità Payroll + capacità manuale dei non dipendenti.
  source = source.replace(
    /async function costoOrarioMedioStudio\(studioId: string, esercizio: number\) \{[\s\S]*?\n\}\n\nasync function ricalcolaCostiServiziStudio/m,
    `async function costoOrarioMedioStudio(studioId: string, esercizio: number) {\n  const [{ data: p, error }, capacita] = await Promise.all([\n    supabaseAdmin\n      .from("tbcdg_studio_parametri")\n      .select("costo_personale,costo_collaboratori_diretti,costo_affitto,costo_software,costo_assicurazioni,costo_utenze,altri_costi_generali")\n      .eq("studio_id", studioId)\n      .eq("esercizio", esercizio)\n      .maybeSingle(),\n    capacitaOperatoriStudio(studioId, esercizio),\n  ]);\n  if (error) throw error;\n\n  const totaleCosti =\n    n(p?.costo_personale) +\n    n(p?.costo_collaboratori_diretti) +\n    n(p?.costo_affitto) +\n    n(p?.costo_software) +\n    n(p?.costo_assicurazioni) +\n    n(p?.costo_utenze) +\n    n(p?.altri_costi_generali);\n  const oreProduttive = capacita.totaleOreProduttive;\n  const configurato = oreProduttive > 0 && totaleCosti > 0;\n\n  return {\n    totaleCosti,\n    oreProduttive,\n    costoOrario: configurato ? totaleCosti / oreProduttive : 0,\n    configurato,\n  };\n}\n\nasync function ricalcolaCostiServiziStudio`
  );

  // Arricchisce gli operatori con i dati Payroll e usa le ore automatiche per saturazione.
  const operatorMapAnchor = '      const operatori = (utentiResult.data || []).map((u: any) => {';
  if (source.includes(operatorMapAnchor) && !source.includes('const capacitaOperatoriCorrente = await capacitaOperatoriStudio')) {
    source = source.replace(
      operatorMapAnchor,
      '      const capacitaOperatoriCorrente = await capacitaOperatoriStudio(studioId, esercizio);\n\n' + operatorMapAnchor
    );
  }

  source = source.replace(
    '        const costo = costiMap.get(u.id) || null;\n        const carico = carichiMap.get(u.id) || { operazioni: 0, ore: 0, costo: 0 };',
    `        const costoDb = costiMap.get(u.id) || null;\n        const capacita = capacitaOperatoriCorrente.byUser.get(String(u.id)) || null;\n        const costo = capacita\n          ? {\n              ...(costoDb || {}),\n              ore_teoriche: capacita.oreTeoriche,\n              ore_non_produttive: capacita.oreNonProduttive,\n              ore_produttive: capacita.oreProduttive,\n            }\n          : costoDb;\n        const carico = carichiMap.get(u.id) || { operazioni: 0, ore: 0, costo: 0 };`
  );

  source = source.replace(
    '          ...u,\n          costo,\n          numero_operazioni: carico.operazioni,',
    `          ...u,\n          costo,\n          payroll_capacita: capacita ? {\n            collegato: capacita.collegatoPayroll,\n            orario_giornaliero: capacita.orarioGiornaliero,\n            giorni_lavorativi: capacita.giorniLavorativi,\n            data_assunzione: capacita.dataAssunzione,\n            data_cessazione: capacita.dataCessazione,\n          } : null,\n          numero_operazioni: carico.operazioni,`
  );

  // L'overview espone le ore complessive automatiche come parametro dello studio.
  source = source.replace(
    '        parametri: parametriResult.data || null,\n        operatori,',
    '        parametri: { ...(parametriResult.data || {}), ore_produttive_studio: capacitaOperatoriCorrente.totaleOreProduttive },\n        operatori,'
  );

  // Salvataggio costi: non accetta più ore produttive arbitrarie, usa Payroll/manuali operatori.
  source = source.replace(
    '      if (action === "salva_costi_studio") {\n        const payload = {',
    '      if (action === "salva_costi_studio") {\n        const capacitaStudioSalvataggio = await capacitaOperatoriStudio(studioId, esercizio);\n        const payload = {'
  );
  source = source.replace(
    '          ore_produttive_studio: Math.max(0, n(req.body?.ore_produttive_studio)),',
    '          ore_produttive_studio: capacitaStudioSalvataggio.totaleOreProduttive,'
  );
  source = source.replace(
    '          ore_produttive_studio: n(req.body?.ore_produttive_studio),',
    '          ore_produttive_studio: capacitaStudioSalvataggio.totaleOreProduttive,'
  );

  // Dopo il salvataggio delle ore non produttive di un operatore, riallinea i costi cliente.
  const operatorReturn = '        if (error) throw error;\n        return res.status(200).json({ success: true, data });\n      }\n\n      if (action === "salva_attivita") {';
  if (source.includes(operatorReturn)) {
    source = source.replace(
      operatorReturn,
      '        if (error) throw error;\n        await ricalcolaCostiServiziStudio(studioId, esercizio);\n        return res.status(200).json({ success: true, data });\n      }\n\n      if (action === "salva_attivita") {'
    );
  }

  return source;
});

patch("src/pages/controllo-gestione/redditivita-studio.tsx", (source) => {
  if (!source.includes('payroll_capacita?:')) {
    source = source.replace(
      '  saturazione_percentuale?: number;\n};',
      `  saturazione_percentuale?: number;\n  payroll_capacita?: {\n    collegato?: boolean;\n    orario_giornaliero?: number | string | null;\n    giorni_lavorativi?: number | null;\n    data_assunzione?: string | null;\n    data_cessazione?: string | null;\n  } | null;\n};`
    );
  }

  // Le ore complessive in Costi Studio sono calcolate, non digitabili.
  source = source.replace(
    '<NumberField label="Ore produttive annue complessive dello studio" value={costi.oreProduttive} onChange={(v) => updateCost("oreProduttive", v)} />',
    '<label className="text-sm font-semibold text-slate-700">Ore produttive annue complessive (automatiche)<input value={costi.oreProduttive.toLocaleString("it-IT", { maximumFractionDigits: 2 })} readOnly className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-slate-100 px-3 text-sm font-semibold text-slate-800" /><span className="mt-1 block text-xs font-normal text-slate-500">Dipendenti: Payroll · altri operatori: capacità manuale</span></label>'
  );

  // Aggiunge ore/giorno Payroll alla tabella operatori.
  source = source.replace(
    '<th className="px-3 py-3">Operatore</th><th className="px-3 py-3">Ore teoriche</th><th className="px-3 py-3">Ore non produttive</th><th className="px-3 py-3">Ore produttive</th><th className="px-3 py-3">Operazioni</th>',
    '<th className="px-3 py-3">Operatore</th><th className="px-3 py-3">Ore/giorno Payroll</th><th className="px-3 py-3">Ore teoriche</th><th className="px-3 py-3">Ore non produttive</th><th className="px-3 py-3">Ore produttive</th><th className="px-3 py-3">Operazioni</th>'
  );

  const operatorCell = '<td className="whitespace-nowrap px-3 py-3"><div className="font-semibold text-slate-900">{[o.nome, o.cognome].filter(Boolean).join(" ") || o.email}</div><div className="text-xs text-slate-500">{o.tipo_rapporto || o.settore || ""}</div></td>';
  if (source.includes(operatorCell) && !source.includes('o.payroll_capacita?.orario_giornaliero')) {
    source = source.replace(
      operatorCell,
      operatorCell + '\n                          <td className="px-3 py-3 text-center"><div className="font-semibold text-slate-800">{o.payroll_capacita?.collegato ? num(o.payroll_capacita?.orario_giornaliero).toLocaleString("it-IT", { maximumFractionDigits: 2 }) : "—"}</div><div className="text-[11px] text-slate-500">{o.payroll_capacita?.collegato ? "Payroll" : "Manuale"}</div></td>'
    );
  }

  // Dipendenti Payroll: ore teoriche e produttive in sola lettura; non produttive restano modificabili.
  source = source.replace(
    '<td className="px-3 py-3"><TableNumber value={d.ore_teoriche} onChange={(v) => updateOperatore(o.id, "ore_teoriche", v)} /></td>',
    '<td className="px-3 py-3">{o.payroll_capacita?.collegato ? <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-2 text-right font-semibold">{d.ore_teoriche.toLocaleString("it-IT", { maximumFractionDigits: 2 })}</div> : <TableNumber value={d.ore_teoriche} onChange={(v) => updateOperatore(o.id, "ore_teoriche", v)} />}</td>'
  );
  source = source.replace(
    '<td className="px-3 py-3"><TableNumber value={d.ore_produttive} onChange={(v) => updateOperatore(o.id, "ore_produttive", v)} /></td>',
    '<td className="px-3 py-3">{o.payroll_capacita?.collegato ? <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-2 text-right font-semibold">{d.ore_produttive.toLocaleString("it-IT", { maximumFractionDigits: 2 })}</div> : <TableNumber value={d.ore_produttive} onChange={(v) => updateOperatore(o.id, "ore_produttive", v)} />}</td>'
  );

  source = source.replace('colSpan={9}', 'colSpan={10}');

  // Ricalcolo immediato a video quando cambia il tempo non produttivo di un dipendente Payroll.
  const updateRegex = /  function updateOperatore\(id: string, key: keyof OperatoreDraft, value: string\) \{[\s\S]*?\n  \}/m;
  if (updateRegex.test(source)) {
    source = source.replace(
      updateRegex,
      `  function updateOperatore(id: string, key: keyof OperatoreDraft, value: string) {\n    const parsed = Number(String(value).replace(",", "."));\n    const numeric = Number.isFinite(parsed) ? parsed : 0;\n    const operatore = operatori.find((o) => o.id === id);\n    setDraftOperatori((prev) => {\n      const current = prev[id] || { costo_annuo: 0, ore_teoriche: 0, ore_non_produttive: 0, ore_produttive: 0 };\n      const next = { ...current, [key]: numeric };\n      if (operatore?.payroll_capacita?.collegato && key === "ore_non_produttive") {\n        next.ore_produttive = Math.max(0, next.ore_teoriche - numeric);\n      }\n      return { ...prev, [id]: next };\n    });\n  }`
    );
  }

  source = source.replace(
    'Le ore teoriche sono le ore annue disponibili. Le ore non produttive sono ferie, permessi, formazione e attività interne. Le ore produttive sono la capacità realmente disponibile per i clienti.',
    'Per i dipendenti le ore/giorno arrivano direttamente dal Payroll. Le ore teoriche sono calcolate sui giorni lavorativi dell’esercizio considerando assunzione e cessazione. Le ore non produttive sono ferie, permessi, formazione e attività interne; le ore produttive sono il residuo realmente disponibile per i clienti.'
  );

  return source;
});

console.log("✓ Redditività Studio: capacità dipendenti derivata automaticamente dal Payroll");
