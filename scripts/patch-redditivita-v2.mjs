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

patch("src/pages/api/controllo-gestione/redditivita-studio.ts", (source) => {
  if (!source.includes("async function costoOrarioMedioStudio")) {
    const anchor = "export default async function handler(req: NextApiRequest, res: NextApiResponse) {";
    const helper = `async function costoOrarioMedioStudio(studioId: string, esercizio: number) {\n  const [{ data: p, error: pError }, { data: operatori, error: oError }] = await Promise.all([\n    supabaseAdmin.from("tbcdg_studio_parametri").select("costo_personale,costo_collaboratori_diretti,costo_affitto,costo_software,costo_assicurazioni,costo_utenze,altri_costi_generali").eq("studio_id", studioId).eq("esercizio", esercizio).maybeSingle(),\n    supabaseAdmin.from("tbcdg_operatori_costi").select("ore_produttive").eq("studio_id", studioId).eq("esercizio", esercizio),\n  ]);\n  if (pError) throw pError;\n  if (oError) throw oError;\n  const totaleCosti = n(p?.costo_personale) + n(p?.costo_collaboratori_diretti) + n(p?.costo_affitto) + n(p?.costo_software) + n(p?.costo_assicurazioni) + n(p?.costo_utenze) + n(p?.altri_costi_generali);\n  const oreProduttive = (operatori || []).reduce((s: number, r: any) => s + n(r.ore_produttive), 0);\n  return { totaleCosti, oreProduttive, costoOrario: oreProduttive > 0 ? totaleCosti / oreProduttive : 0 };\n}\n\nasync function operatoreCliente(studioId: string, clienteId: string) {\n  const { data, error } = await supabaseAdmin.from("tbclienti").select("utente_operatore_id").eq("id", clienteId).eq("studio_id", studioId).eq("cliente", true).eq("attivo", true).maybeSingle();\n  if (error) throw error;\n  return data?.utente_operatore_id ? String(data.utente_operatore_id) : null;\n}\n\nasync function assegnaServizioOperatoreCliente(servizio: any) {\n  const operatoreId = await operatoreCliente(String(servizio.studio_id), String(servizio.cliente_id));\n  if (!operatoreId) return null;\n  const { data: utente, error: utenteError } = await supabaseAdmin.from("tbutenti").select("id").eq("id", operatoreId).eq("studio_id", servizio.studio_id).eq("attivo", true).maybeSingle();\n  if (utenteError) throw utenteError;\n  if (!utente) return null;\n  const medio = await costoOrarioMedioStudio(String(servizio.studio_id), Number(servizio.esercizio));\n  const costo = round(n(servizio.ore_equivalenti) * medio.costoOrario, 2);\n  const { error: deleteError } = await supabaseAdmin.from("tbcdg_cliente_attivita_operatori").delete().eq("studio_id", servizio.studio_id).eq("cliente_servizio_id", servizio.id);\n  if (deleteError) throw deleteError;\n  const { error: insertError } = await supabaseAdmin.from("tbcdg_cliente_attivita_operatori").insert({\n    studio_id: servizio.studio_id,\n    esercizio: servizio.esercizio,\n    cliente_id: servizio.cliente_id,\n    cliente_servizio_id: servizio.id,\n    operatore_id: operatoreId,\n    percentuale_ripartizione_attivita: 100,\n    numero_operazioni_attribuite: n(servizio.quantita_driver),\n    ore_attribuite: n(servizio.ore_equivalenti),\n    costo_attribuito: costo,\n  });\n  if (insertError) throw insertError;\n  const { data: finale, error: updateError } = await supabaseAdmin.from("tbcdg_cliente_servizi").update({ costo_stimato: costo }).eq("id", servizio.id).eq("studio_id", servizio.studio_id).select("*").single();\n  if (updateError) throw updateError;\n  return finale;\n}\n\n`;
    if (!source.includes(anchor)) throw new Error("Handler Redditivita non trovato");
    source = source.replace(anchor, helper + anchor);
  }

  source = source.replaceAll(
    '.select("id,ragione_sociale,codice_fiscale")\n            .eq("id", clienteId)\n            .eq("studio_id", studioId)',
    '.select("id,ragione_sociale,codice_fiscale,utente_operatore_id")\n            .eq("id", clienteId)\n            .eq("studio_id", studioId)\n            .eq("cliente", true)\n            .eq("attivo", true)'
  );

  source = source.replace(
    'supabaseAdmin.from("tbcdg_studio_parametri").select("*").eq("studio_id", studioId).eq("esercizio", esercizio).maybeSingle(),',
    'supabaseAdmin.from("tbcdg_studio_parametri").select("*").eq("studio_id", studioId).eq("esercizio", esercizio).maybeSingle(),'
  );

  const oldClientQuery = 'supabaseAdmin.from("tbclienti").select("id,ragione_sociale,codice_fiscale,attivo,settore_fiscale,settore_consulenza,settore_lavoro").eq("studio_id", studioId).eq("attivo", true).order("ragione_sociale", { ascending: true })';
  const newClientQuery = 'supabaseAdmin.from("tbclienti").select("id,ragione_sociale,codice_fiscale,attivo,cliente,utente_operatore_id,settore_fiscale,settore_consulenza,settore_lavoro").eq("studio_id", studioId).eq("cliente", true).eq("attivo", true).order("ragione_sociale", { ascending: true })';
  source = source.replace(oldClientQuery, newClientQuery);

  source = source.replace(
    '          costo_personale: n(req.body?.costo_personale),\n          costo_affitto: n(req.body?.costo_affitto),',
    '          costo_personale: n(req.body?.costo_personale),\n          costo_collaboratori_diretti: n(req.body?.costo_collaboratori_diretti),\n          costo_affitto: n(req.body?.costo_affitto),'
  );

  source = source.replace(
    '          ore_produttive_studio: n(req.body?.ore_produttive_studio),',
    '          ore_produttive_studio: 0,'
  );

  const startOperatore = source.indexOf('      if (action === "salva_operatore") {');
  const endOperatore = source.indexOf('      if (action === "salva_attivita") {', startOperatore);
  if (startOperatore >= 0 && endOperatore > startOperatore && !source.slice(startOperatore, endOperatore).includes('costo_annuo: 0,')) {
    const block = source.slice(startOperatore, endOperatore);
    let next = block;
    next = next.replace('        const costoAnnuo = n(req.body?.costo_annuo);\n', '');
    next = next.replace(/        const \{ data: parametri,[\s\S]*?const costoOrarioPieno = costoOrarioDiretto \+ overheadOrario;\n\n/, '');
    next = next.replace('          costo_annuo: costoAnnuo,', '          costo_annuo: 0,');
    next = next.replace('          costo_orario_diretto: costoOrarioDiretto,\n          quota_costi_generali: quotaCostiGenerali,\n          costo_orario_pieno: costoOrarioPieno,', '          costo_orario_diretto: 0,\n          quota_costi_generali: 0,\n          costo_orario_pieno: 0,');
    source = source.slice(0, startOperatore) + next + source.slice(endOperatore);
  }

  const serviceReturn = '        return res.status(200).json({ success: true, data: servizioFinale });';
  if (source.includes(serviceReturn) && !source.includes('data: servizioAssegnato || servizioFinale')) {
    source = source.replace(serviceReturn, '        const servizioAssegnato = await assegnaServizioOperatoreCliente(servizioFinale);\n        return res.status(200).json({ success: true, data: servizioAssegnato || servizioFinale });');
  }

  return source;
});

patch("src/pages/controllo-gestione/redditivita-studio.tsx", (source) => {
  source = source.replace(
    '  personale: number;\n  affitto: number;',
    '  personale: number;\n  collaboratoriDiretti: number;\n  affitto: number;'
  );
  source = source.replace(
    '  personale: 0,\n  affitto: 0,',
    '  personale: 0,\n  collaboratoriDiretti: 0,\n  affitto: 0,'
  );
  source = source.replace(
    '    () => costi.personale + costi.affitto + costi.software + costi.assicurazioni + costi.utenze + costi.altri,',
    '    () => costi.personale + costi.collaboratoriDiretti + costi.affitto + costi.software + costi.assicurazioni + costi.utenze + costi.altri,'
  );
  source = source.replace(
    '    [costi]\n  );\n  const costoOrario = costi.oreProduttive > 0 ? totaleCosti / costi.oreProduttive : 0;',
    '    [costi]\n  );\n  const oreProduttiveStudio = useMemo(() => operatori.reduce((sum, o) => sum + num(o.costo?.ore_produttive), 0), [operatori]);\n  const costoOrario = oreProduttiveStudio > 0 ? totaleCosti / oreProduttiveStudio : 0;'
  );
  source = source.replace(
    '              personale: num(p.costo_personale),\n              affitto: num(p.costo_affitto),',
    '              personale: num(p.costo_personale),\n              collaboratoriDiretti: num(p.costo_collaboratori_diretti),\n              affitto: num(p.costo_affitto),'
  );
  source = source.replace(
    '              oreProduttive: num(p.ore_produttive_studio),',
    '              oreProduttive: 0,'
  );
  source = source.replace(
    '          costo_personale: costi.personale,\n          costo_affitto: costi.affitto,',
    '          costo_personale: costi.personale,\n          costo_collaboratori_diretti: costi.collaboratoriDiretti,\n          costo_affitto: costi.affitto,'
  );
  source = source.replace(
    '          ore_produttive_studio: costi.oreProduttive,\n',
    ''
  );
  source = source.replace(
    '                  <MoneyField label="Costo personale" value={costi.personale} onChange={(v) => updateCost("personale", v)} />',
    '                  <MoneyField label="Personale dipendente" value={costi.personale} onChange={(v) => updateCost("personale", v)} />\n                  <MoneyField label="Collaboratori diretti" value={costi.collaboratoriDiretti} onChange={(v) => updateCost("collaboratoriDiretti", v)} />'
  );
  source = source.replace(
    '                  <NumberField label="Ore produttive annue studio" value={costi.oreProduttive} onChange={(v) => updateCost("oreProduttive", v)} />\n',
    ''
  );
  source = source.replaceAll('value={costi.oreProduttive.toLocaleString("it-IT")}', 'value={oreProduttiveStudio.toLocaleString("it-IT")}');
  source = source.replaceAll('note="Su ore produttive studio"', 'note="Ore produttive operatori"');

  source = source.replace(
    '<th className="px-3 py-3">Operatore</th><th className="px-3 py-3">Costo annuo</th><th className="px-3 py-3">Ore teoriche</th><th className="px-3 py-3">Ore non prod.</th><th className="px-3 py-3">Ore produttive</th><th className="px-3 py-3">Costo/h pieno</th><th className="px-3 py-3">Operazioni</th>',
    '<th className="px-3 py-3">Operatore</th><th className="px-3 py-3">Ore teoriche</th><th className="px-3 py-3">Ore non produttive</th><th className="px-3 py-3">Ore produttive</th><th className="px-3 py-3">Operazioni</th>'
  );
  source = source.replace(
    '<td className="px-3 py-3"><TableNumber value={d.costo_annuo} onChange={(v) => updateOperatore(o.id, "costo_annuo", v)} /></td>\n                          <td className="px-3 py-3"><TableNumber value={d.ore_teoriche}',
    '<td className="px-3 py-3"><TableNumber value={d.ore_teoriche}'
  );
  source = source.replace(/\n\s*<td className="whitespace-nowrap px-3 py-3 font-semibold text-slate-800">\{euro2\(num\(o\.costo\?\.costo_orario_pieno\)\)\}<\/td>/g, '');
  source = source.replace('colSpan={11}', 'colSpan={9}');
  source = source.replace(
    '<p className="mt-1 text-sm text-slate-500">Il peso % viene mostrato sia per numero operazioni sia per carico ponderato in ore equivalenti.</p>',
    '<p className="mt-1 text-sm text-slate-500">Le ore teoriche sono le ore annue disponibili. Le ore non produttive sono ferie, permessi, formazione e attività interne. Le ore produttive sono la capacità realmente disponibile per i clienti. Il costo del lavoro è gestito solo a livello complessivo nei Costi Studio.</p>'
  );

  return source;
});

patch("src/components/controllo-gestione/RedditivitaClientiTab.tsx", (source) => {
  if (!source.includes('utente_operatore_id?: string | null;')) {
    source = source.replace('  codice_fiscale?: string | null;\n', '  codice_fiscale?: string | null;\n  utente_operatore_id?: string | null;\n');
  }
  source = source.replace(
    '<th className="px-3 py-3">Ripartizione</th>',
    '<th className="px-3 py-3">Operatore</th>'
  );
  source = source.replace(
    'servizi.map((s) => <ServiceRow key={s.id} servizio={s} onSave={aggiornaServizio} onRipartisci={apriRipartizione} onRemove={rimuoviServizio} />)',
    'servizi.map((s) => <ServiceRow key={s.id} servizio={s} operatori={operatori} onSave={aggiornaServizio} onRemove={rimuoviServizio} />)'
  );
  const oldSig = 'function ServiceRow({ servizio, onSave, onRipartisci, onRemove }: { servizio: Servizio; onSave: (s: Servizio, q: number, c: number) => void; onRipartisci: (s: Servizio) => void; onRemove: (s: Servizio) => void }) {';
  const newSig = 'function ServiceRow({ servizio, operatori, onSave, onRemove }: { servizio: Servizio; operatori: Operatore[]; onSave: (s: Servizio, q: number, c: number) => void; onRemove: (s: Servizio) => void }) {';
  source = source.replace(oldSig, newSig);
  source = source.replace(
    '<button type="button" onClick={() => onRipartisci(servizio)} className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-800">Assegna</button>',
    '<span className="text-xs font-semibold text-slate-700">{(() => { const id = servizio.ripartizione?.[0]?.operatore_id; const o = operatori.find((x) => x.id === id); return o ? ([o.nome, o.cognome].filter(Boolean).join(" ") || o.email || "Operatore") : "Nessun operatore in anagrafica"; })()}</span>'
  );
  return source;
});

console.log("✓ Redditività Studio v2 applicata");
