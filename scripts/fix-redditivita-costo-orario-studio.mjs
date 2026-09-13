import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function patch(rel, fn) {
  const file = path.join(root, rel);
  const src = fs.readFileSync(file, "utf8");
  const out = fn(src);
  if (out === src) {
    console.log(`↷ ${rel} già corretto`);
    return;
  }
  fs.writeFileSync(file, out, "utf8");
  console.log(`✓ ${rel}`);
}

patch("src/pages/api/controllo-gestione/redditivita-studio.ts", (source) => {
  // Il costo medio orario deve usare la capacità produttiva COMPLESSIVA dello studio,
  // non la somma delle sole ore operatore eventualmente compilate.
  source = source.replace(
    /async function costoOrarioMedioStudio\(studioId: string, esercizio: number\) \{[\s\S]*?\n\}\n\nasync function operatoreCliente/m,
    `async function costoOrarioMedioStudio(studioId: string, esercizio: number) {\n  const { data: p, error } = await supabaseAdmin\n    .from("tbcdg_studio_parametri")\n    .select("costo_personale,costo_collaboratori_diretti,costo_affitto,costo_software,costo_assicurazioni,costo_utenze,altri_costi_generali,ore_produttive_studio")\n    .eq("studio_id", studioId)\n    .eq("esercizio", esercizio)\n    .maybeSingle();\n  if (error) throw error;\n\n  const totaleCosti =\n    n(p?.costo_personale) +\n    n(p?.costo_collaboratori_diretti) +\n    n(p?.costo_affitto) +\n    n(p?.costo_software) +\n    n(p?.costo_assicurazioni) +\n    n(p?.costo_utenze) +\n    n(p?.altri_costi_generali);\n  const oreProduttive = n(p?.ore_produttive_studio);\n\n  return {\n    totaleCosti,\n    oreProduttive,\n    costoOrario: oreProduttive > 0 ? totaleCosti / oreProduttive : 0,\n  };\n}\n\nasync function ricalcolaCostiServiziStudio(studioId: string, esercizio: number) {\n  const medio = await costoOrarioMedioStudio(studioId, esercizio);\n  const pageSize = 500;\n  const costiByServizio = new Map<string, number>();\n\n  for (let from = 0; ; from += pageSize) {\n    const { data, error } = await supabaseAdmin\n      .from("tbcdg_cliente_servizi")\n      .select("id,studio_id,esercizio,cliente_id,attivita_id,attivo,quantita_driver,coefficiente_complessita,ore_equivalenti,costo_stimato,note")\n      .eq("studio_id", studioId)\n      .eq("esercizio", esercizio)\n      .order("id", { ascending: true })\n      .range(from, from + pageSize - 1);\n    if (error) throw error;\n    const rows = data || [];\n    if (!rows.length) break;\n\n    const aggiornate = rows.map((r: any) => {\n      const costo = round(n(r.ore_equivalenti) * medio.costoOrario, 2);\n      costiByServizio.set(String(r.id), costo);\n      return { ...r, costo_stimato: costo };\n    });\n\n    const { error: upsertError } = await supabaseAdmin\n      .from("tbcdg_cliente_servizi")\n      .upsert(aggiornate, { onConflict: "id" });\n    if (upsertError) throw upsertError;\n    if (rows.length < pageSize) break;\n  }\n\n  // Allinea anche il costo attribuito all'operatore del cliente.\n  for (let from = 0; ; from += pageSize) {\n    const { data, error } = await supabaseAdmin\n      .from("tbcdg_cliente_attivita_operatori")\n      .select("id,studio_id,esercizio,cliente_id,cliente_servizio_id,operatore_id,percentuale_ripartizione_attivita,numero_operazioni_attribuite,ore_attribuite,costo_attribuito,note")\n      .eq("studio_id", studioId)\n      .eq("esercizio", esercizio)\n      .order("id", { ascending: true })\n      .range(from, from + pageSize - 1);\n    if (error) throw error;\n    const rows = data || [];\n    if (!rows.length) break;\n\n    const aggiornate = rows.map((r: any) => {\n      const costoServizio = costiByServizio.get(String(r.cliente_servizio_id)) || 0;\n      const percentuale = Math.max(0, Math.min(100, n(r.percentuale_ripartizione_attivita)));\n      return { ...r, costo_attribuito: round(costoServizio * percentuale / 100, 2) };\n    });\n\n    const { error: upsertError } = await supabaseAdmin\n      .from("tbcdg_cliente_attivita_operatori")\n      .upsert(aggiornate, { onConflict: "id" });\n    if (upsertError) throw upsertError;\n    if (rows.length < pageSize) break;\n  }\n\n  return medio;\n}\n\nasync function operatoreCliente`
  );

  // Ripristina il salvataggio delle ore produttive complessive studio.
  source = source.replace(
    '          ore_produttive_studio: 0,',
    '          ore_produttive_studio: Math.max(0, n(req.body?.ore_produttive_studio)),'
  );

  // Validazione economica: con costi > 0 devono essere indicate ore complessive.
  const marginCheck = `        if (payload.margine_obiettivo_percentuale < 0 || payload.margine_obiettivo_percentuale >= 100) {\n          return res.status(400).json({ success: false, error: "Il margine obiettivo deve essere compreso tra 0 e 99,99%" });\n        }`;
  if (source.includes(marginCheck) && !source.includes("Ore produttive annue complessive dello studio obbligatorie")) {
    source = source.replace(
      marginCheck,
      marginCheck + `\n\n        const totaleCostiInput = n(payload.costo_personale) + n(payload.costo_collaboratori_diretti) + n(payload.costo_affitto) + n(payload.costo_software) + n(payload.costo_assicurazioni) + n(payload.costo_utenze) + n(payload.altri_costi_generali);\n        if (totaleCostiInput > 0 && n(payload.ore_produttive_studio) <= 0) {\n          return res.status(400).json({ success: false, error: "Ore produttive annue complessive dello studio obbligatorie per calcolare il costo orario" });\n        }`
    );
  }

  // Dopo il salvataggio dei costi, riallinea tutti i clienti al nuovo costo medio.
  const saveReturn = `        if (error) throw error;\n        return res.status(200).json({ success: true, data });\n      }\n\n      if (action === "salva_operatore") {`;
  if (source.includes(saveReturn) && !source.includes("medio_ricalcolato")) {
    source = source.replace(
      saveReturn,
      `        if (error) throw error;\n        const medioRicalcolato = await ricalcolaCostiServiziStudio(studioId, esercizio);\n        return res.status(200).json({ success: true, data, medio_ricalcolato: medioRicalcolato });\n      }\n\n      if (action === "salva_operatore") {`
    );
  }

  return source;
});

patch("src/pages/controllo-gestione/redditivita-studio.tsx", (source) => {
  // Il costo orario UI deve usare il parametro studio, non le ore dei singoli operatori.
  source = source.replace(
    /  const oreProduttiveStudio = useMemo\(\(\) => operatori\.reduce\([\s\S]*?\);\n  const costoOrario = oreProduttiveStudio > 0 \? totaleCosti \/ oreProduttiveStudio : 0;/,
    '  const costoOrario = costi.oreProduttive > 0 ? totaleCosti / costi.oreProduttive : 0;'
  );

  source = source.replace(
    '              oreProduttive: 0,',
    '              oreProduttive: num(p.ore_produttive_studio),'
  );

  // Rimetti il parametro nel payload di salvataggio.
  const payloadAnchor = '          altri_costi_generali: costi.altri,\n          margine_obiettivo_percentuale: costi.margineObiettivo,';
  if (source.includes(payloadAnchor)) {
    source = source.replace(
      payloadAnchor,
      '          altri_costi_generali: costi.altri,\n          ore_produttive_studio: costi.oreProduttive,\n          margine_obiettivo_percentuale: costi.margineObiettivo,'
    );
  }

  // Ripristina il campo nella sezione Costi Studio se il patch v2 lo aveva rimosso.
  if (!source.includes('label="Ore produttive annue complessive dello studio"')) {
    const marginField = '<NumberField label="Margine obiettivo %" value={costi.margineObiettivo} onChange={(v) => updateCost("margineObiettivo", v)} />';
    if (source.includes(marginField)) {
      source = source.replace(
        marginField,
        '<NumberField label="Ore produttive annue complessive dello studio" value={costi.oreProduttive} onChange={(v) => updateCost("oreProduttive", v)} />\n                  ' + marginField
      );
    }
  }

  // La card deve mostrare il parametro economico dello studio.
  source = source.replaceAll('value={oreProduttiveStudio.toLocaleString("it-IT")}', 'value={costi.oreProduttive.toLocaleString("it-IT")}');
  source = source.replaceAll('note="Ore produttive operatori"', 'note="Capacità produttiva complessiva studio"');

  // Spiegazione esplicita per evitare di inserire le ore di un solo operatore.
  const costSubtitle = '<p className="mt-1 text-sm text-slate-500">I valori vengono salvati nello snapshot annuale dello studio.</p>';
  if (source.includes(costSubtitle) && !source.includes('Non inserire le ore di un singolo operatore')) {
    source = source.replace(
      costSubtitle,
      costSubtitle + '\n                <div className="mt-3 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-slate-700"><strong>Ore produttive studio:</strong> inserire la capacità annua complessiva di tutto il personale e dei collaboratori diretti impiegati sui clienti. Non inserire le ore di un singolo operatore. Le ore individuali nella scheda Operatori servono solo per peso e saturazione.</div>'
    );
  }

  return source;
});

console.log("✓ Redditività: costo medio su ore produttive complessive studio e ricalcolo clienti");
