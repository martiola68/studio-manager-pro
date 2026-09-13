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

// 1) Pagina principale: le tab con loader proprio non devono restare bloccate
// nello stato loading della pagina padre. Inoltre il backfill dei default non va
// eseguito ad ogni apertura del modulo.
patch("src/pages/controllo-gestione/redditivita-studio.tsx", (source) => {
  source = source.replace(
    /  useEffect\(\(\) => \{\n    if \(!studioId \|\| !tabReady\) return;\n    const key = studioId \+ ":" \+ anno;[\s\S]*?inizializza_default_clienti[\s\S]*?\n  \}, \[studioId, anno, tabReady\]\);/m,
    `  useEffect(() => {\n    if (!studioId || !tabReady) return;\n    // I servizi standard sono già persistiti nel database. Il backfill resta\n    // disponibile lato API, ma non deve essere eseguito ad ogni apertura.\n    setDefaultsReady(true);\n  }, [studioId, anno, tabReady]);`
  );

  const oldLoaderEffect = `  useEffect(() => {\n    if (!studioId || !tabReady) return;\n    if (!["dashboard", "costi", "operatori", "attivita"].includes(tab)) return;\n    const key = studioId + ":" + anno + ":" + tab;\n    if (autoLoadKeyRef.current === key) return;\n    autoLoadKeyRef.current = key;\n    caricaDati(studioId, anno);\n  }, [studioId, anno, tab, tabReady]);`;

  const newLoaderEffect = `  useEffect(() => {\n    if (!studioId || !tabReady) return;\n    if (!["dashboard", "costi", "operatori", "attivita"].includes(tab)) {\n      // Clienti, Compensi e Incassi hanno un loader autonomo: non devono\n      // ereditare loading=true dalla pagina padre.\n      setLoading(false);\n      return;\n    }\n    const key = studioId + ":" + anno + ":" + tab;\n    if (autoLoadKeyRef.current === key) {\n      setLoading(false);\n      return;\n    }\n    autoLoadKeyRef.current = key;\n    caricaDati(studioId, anno);\n  }, [studioId, anno, tab, tabReady]);`;

  if (source.includes(oldLoaderEffect)) source = source.replace(oldLoaderEffect, newLoaderEffect);

  return source;
});

// 2) API: per la scheda Clienti usiamo un overview leggero. Nessun carico operatori,
// nessun costo operatore e nessun catalogo completo finché non si apre il singolo cliente.
patch("src/pages/api/controllo-gestione/redditivita-studio.ts", (source) => {
  const getAnchor = `    if (req.method === "GET") {`;
  if (source.includes(getAnchor) && !source.includes('res.setHeader("Cache-Control", "no-store')) {
    source = source.replace(
      getAnchor,
      `${getAnchor}\n      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");`
    );
  }

  const heavyAnchor = `      const [parametriResult, utentiResult, costiOperatoriResult, carichiResult, attivitaResult, clientiResult, serviziClientiResult] = await Promise.all([`;

  if (source.includes(heavyAnchor) && !source.includes('scope === "clienti"')) {
    const fastBlock = `      const scope = typeof req.query.scope === "string" ? req.query.scope : "";\n\n      if (scope === "clienti") {\n        const [parametriClientiResult, utentiClientiResult, clientiFastResult, serviziFastResult] = await Promise.all([\n          supabaseAdmin\n            .from("tbcdg_studio_parametri")\n            .select("margine_obiettivo_percentuale")\n            .eq("studio_id", studioId)\n            .eq("esercizio", esercizio)\n            .maybeSingle(),\n          supabaseAdmin\n            .from("tbutenti")\n            .select("id,nome,cognome,email")\n            .eq("studio_id", studioId)\n            .eq("attivo", true)\n            .order("cognome", { ascending: true })\n            .order("nome", { ascending: true }),\n          supabaseAdmin\n            .from("tbclienti")\n            .select("id,ragione_sociale,codice_fiscale,utente_operatore_id")\n            .eq("studio_id", studioId)\n            .eq("cliente", true)\n            .eq("attivo", true)\n            .order("ragione_sociale", { ascending: true }),\n          supabaseAdmin\n            .from("tbcdg_cliente_servizi")\n            .select("cliente_id,quantita_driver,ore_equivalenti,costo_stimato")\n            .eq("studio_id", studioId)\n            .eq("esercizio", esercizio)\n            .eq("attivo", true),\n        ]);\n\n        if (parametriClientiResult.error) throw parametriClientiResult.error;\n        if (utentiClientiResult.error) throw utentiClientiResult.error;\n        if (clientiFastResult.error) throw clientiFastResult.error;\n        if (serviziFastResult.error) throw serviziFastResult.error;\n\n        const utentiById = new Map<string, any>((utentiClientiResult.data || []).map((u: any) => [String(u.id), u]));\n        const summary = new Map<string, { servizi: number; operazioni: number; ore: number; costo: number }>();\n\n        for (const s of serviziFastResult.data || []) {\n          const key = String(s.cliente_id || "");\n          if (!key) continue;\n          const current = summary.get(key) || { servizi: 0, operazioni: 0, ore: 0, costo: 0 };\n          current.servizi += 1;\n          current.operazioni += n(s.quantita_driver);\n          current.ore += n(s.ore_equivalenti);\n          current.costo += n(s.costo_stimato);\n          summary.set(key, current);\n        }\n\n        const clienti = (clientiFastResult.data || []).map((c: any) => {\n          const s = summary.get(String(c.id)) || { servizi: 0, operazioni: 0, ore: 0, costo: 0 };\n          const u = c.utente_operatore_id ? utentiById.get(String(c.utente_operatore_id)) : null;\n          const operatoreNome = u ? (\`${'${u.nome || ""} ${u.cognome || ""}'}\`.trim() || u.email || "") : "";\n          return {\n            ...c,\n            operatore_nome: operatoreNome,\n            servizi_attivi: s.servizi,\n            numero_operazioni: s.operazioni,\n            ore_equivalenti: s.ore,\n            costo_stimato: s.costo,\n          };\n        });\n\n        return res.status(200).json({\n          success: true,\n          parametri: parametriClientiResult.data || null,\n          operatori: utentiClientiResult.data || [],\n          clienti,\n        });\n      }\n\n`;
    source = source.replace(heavyAnchor, fastBlock + heavyAnchor);
  }

  return source;
});

// 3) UI Clienti: filtro basato sulla FK reale tbclienti.utente_operatore_id -> tbutenti.id.
patch("src/components/controllo-gestione/RedditivitaClientiTab.tsx", (source) => {
  source = source.replace(
    'fetch(`/api/controllo-gestione/redditivita-studio?studio_id=${encodeURIComponent(studioId)}&esercizio=${encodeURIComponent(anno)}`)',
    'fetch(`/api/controllo-gestione/redditivita-studio?studio_id=${encodeURIComponent(studioId)}&esercizio=${encodeURIComponent(anno)}&scope=clienti`, { cache: "no-store" })'
  );

  source = source.replace(
    'fetch(`/api/controllo-gestione/redditivita-studio?studio_id=${encodeURIComponent(studioId)}&esercizio=${encodeURIComponent(anno)}&cliente_id=${encodeURIComponent(clienteId)}`)',
    'fetch(`/api/controllo-gestione/redditivita-studio?studio_id=${encodeURIComponent(studioId)}&esercizio=${encodeURIComponent(anno)}&cliente_id=${encodeURIComponent(clienteId)}`, { cache: "no-store" })'
  );

  const lookupRegex = /  const operatoreLookup = useMemo\([\s\S]*?\n  const marginePercentuale =/m;
  if (lookupRegex.test(source)) {
    source = source.replace(
      lookupRegex,
      `  const operatoreLookup = useMemo(() => {\n    const map = new Map<string, string>();\n    for (const o of operatoriOverview) {\n      const nome = \`${'${o.nome || ""} ${o.cognome || ""}'}\`.trim() || o.email || "";\n      if (o.id) map.set(String(o.id), nome);\n    }\n    return map;\n  }, [operatoriOverview]);\n\n  const clientiConOperatore = useMemo(() => clienti.map((c) => ({\n    ...c,\n    operatore_nome: c.utente_operatore_id\n      ? (operatoreLookup.get(String(c.utente_operatore_id)) || c.operatore_nome || "")\n      : (c.operatore_nome || ""),\n  })), [clienti, operatoreLookup]);\n\n  const operatoriFiltro = useMemo(() => {\n    const ids = new Set(clientiConOperatore.map((c) => String(c.utente_operatore_id || "")).filter(Boolean));\n    return operatoriOverview\n      .filter((o) => ids.has(String(o.id)))\n      .map((o) => ({ id: String(o.id), nome: \`${'${o.nome || ""} ${o.cognome || ""}'}\`.trim() || o.email || "" }))\n      .filter((o) => o.nome)\n      .sort((a, b) => a.nome.localeCompare(b.nome, "it"));\n  }, [clientiConOperatore, operatoriOverview]);\n\n  const clientiFiltrati = useMemo(() => {\n    const q = filtroClienti.trim().toLowerCase();\n    return clientiConOperatore.filter((c) => {\n      const matchTesto = !q || [c.ragione_sociale, c.codice_fiscale].filter(Boolean).some((v) => String(v).toLowerCase().includes(q));\n      const matchOperatore = !filtroOperatore || String(c.utente_operatore_id || "") === filtroOperatore;\n      return matchTesto && matchOperatore;\n    });\n  }, [clientiConOperatore, filtroClienti, filtroOperatore]);\n\n  const marginePercentuale =`
    );
  }

  // Se una versione precedente aveva lasciato user_id nel tipo, non viene più usato.
  source = source.replace('  user_id?: string | null;\n', '');

  return source;
});

console.log("✓ Redditività Clienti: loading padre sbloccato, overview rapido, filtro operatore su FK reale");
