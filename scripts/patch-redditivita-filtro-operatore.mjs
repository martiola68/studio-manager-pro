import fs from "node:fs";

function patch(file, fn) {
  const src = fs.readFileSync(file, "utf8");
  const out = fn(src);
  if (out === src) {
    console.log(`↷ ${file} già aggiornato`);
    return;
  }
  fs.writeFileSync(file, out, "utf8");
  console.log(`✓ ${file}`);
}

patch("src/pages/api/controllo-gestione/redditivita-studio.ts", (source) => {
  // Gli operatori del cliente arrivano da tbclienti.utente_operatore_id.
  // Rendiamo il lookup robusto sia su tbutenti.id sia su tbutenti.user_id.
  source = source.replaceAll(
    'select("id,nome,cognome,email,tipo_rapporto,settore,studio_id")',
    'select("id,user_id,nome,cognome,email,tipo_rapporto,settore,studio_id")'
  );
  source = source.replaceAll(
    'select("id,nome,cognome,email,tipo_rapporto,settore")',
    'select("id,user_id,nome,cognome,email,tipo_rapporto,settore")'
  );

  const marker = 'const clienti = (clientiResult.data || []).map((c: any) => {';
  if (source.includes(marker) && !source.includes('const utentiPerClienteMap = new Map<string, string>()')) {
    source = source.replace(
      marker,
      `const utentiPerClienteMap = new Map<string, string>();\n      for (const u of utentiResult.data || []) {\n        const nome = \`${'${u.nome || ""} ${u.cognome || ""}'}\`.trim() || u.email || "";\n        if (u.id) utentiPerClienteMap.set(String(u.id), nome);\n        if (u.user_id) utentiPerClienteMap.set(String(u.user_id), nome);\n      }\n\n      ${marker}`
    );
  }

  const returnAnchor = `        return {\n          ...c,\n          servizi_attivi: s.servizi,`;
  if (source.includes(returnAnchor) && !source.includes('operatore_nome: c.utente_operatore_id')) {
    source = source.replace(
      returnAnchor,
      `        return {\n          ...c,\n          operatore_nome: c.utente_operatore_id ? (utentiPerClienteMap.get(String(c.utente_operatore_id)) || "") : "",\n          servizi_attivi: s.servizi,`
    );
  }

  return source;
});

patch("src/components/controllo-gestione/RedditivitaClientiTab.tsx", (source) => {
  if (!source.includes('operatore_nome?: string | null;')) {
    source = source.replace(
      '  utente_operatore_id?: string | null;\n',
      '  utente_operatore_id?: string | null;\n  operatore_nome?: string | null;\n'
    );
  }

  if (!source.includes('  user_id?: string | null;')) {
    source = source.replace(
      'type Operatore = {\n  id: string;\n',
      'type Operatore = {\n  id: string;\n  user_id?: string | null;\n'
    );
  }

  if (!source.includes('const [filtroOperatore, setFiltroOperatore]')) {
    source = source.replace(
      '  const [filtroClienti, setFiltroClienti] = useState("");',
      '  const [filtroClienti, setFiltroClienti] = useState("");\n  const [filtroOperatore, setFiltroOperatore] = useState("");'
    );
  }

  if (!source.includes('const [operatoriOverview, setOperatoriOverview]')) {
    source = source.replace(
      '  const [operatori, setOperatori] = useState<Operatore[]>([]);',
      '  const [operatori, setOperatori] = useState<Operatore[]>([]);\n  const [operatoriOverview, setOperatoriOverview] = useState<Operatore[]>([]);\n  const [margineObiettivo, setMargineObiettivo] = useState(30);'
    );
  }

  // L'overview restituisce già operatori e parametri: usiamoli direttamente per risolvere utente_operatore_id.
  const overviewSet = '      setAttivita(Array.isArray(json?.attivita) ? json.attivita : []);';
  if (source.includes(overviewSet) && !source.includes('setOperatoriOverview(Array.isArray(json?.operatori)')) {
    source = source.replace(
      overviewSet,
      `${overviewSet}\n      setOperatoriOverview(Array.isArray(json?.operatori) ? json.operatori : []);\n      setMargineObiettivo(n(json?.parametri?.margine_obiettivo_percentuale || 30));`
    );
  }

  const oldFilter = `  const clientiFiltrati = useMemo(() => {\n    const q = filtroClienti.trim().toLowerCase();\n    if (!q) return clienti;\n    return clienti.filter((c) => [c.ragione_sociale, c.codice_fiscale].filter(Boolean).some((v) => String(v).toLowerCase().includes(q)));\n  }, [clienti, filtroClienti]);`;

  const newFilter = `  const operatoreLookup = useMemo(() => {\n    const map = new Map<string, string>();\n    for (const o of operatoriOverview) {\n      const nome = \`${'${o.nome || ""} ${o.cognome || ""}'}\`.trim() || o.email || "";\n      if (o.id) map.set(String(o.id), nome);\n      if (o.user_id) map.set(String(o.user_id), nome);\n    }\n    return map;\n  }, [operatoriOverview]);\n\n  const clientiConOperatore = useMemo(() => clienti.map((c) => ({\n    ...c,\n    operatore_nome: c.utente_operatore_id ? (operatoreLookup.get(String(c.utente_operatore_id)) || c.operatore_nome || "") : (c.operatore_nome || ""),\n  })), [clienti, operatoreLookup]);\n\n  const operatoriFiltro = useMemo(() => {\n    const map = new Map<string, string>();\n    for (const c of clientiConOperatore) {\n      const id = String(c.utente_operatore_id || "").trim();\n      const nome = String(c.operatore_nome || "").trim();\n      if (id && nome) map.set(id, nome);\n    }\n    return Array.from(map.entries()).map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome, "it"));\n  }, [clientiConOperatore]);\n\n  const clientiFiltrati = useMemo(() => {\n    const q = filtroClienti.trim().toLowerCase();\n    return clientiConOperatore.filter((c) => {\n      const matchTesto = !q || [c.ragione_sociale, c.codice_fiscale].filter(Boolean).some((v) => String(v).toLowerCase().includes(q));\n      const matchOperatore = !filtroOperatore || String(c.utente_operatore_id || "") === filtroOperatore;\n      return matchTesto && matchOperatore;\n    });\n  }, [clientiConOperatore, filtroClienti, filtroOperatore]);\n\n  const marginePercentuale = Math.min(95, Math.max(0, n(margineObiettivo)));\n  const ricavoDaCosto = (costo: unknown) => marginePercentuale < 100 ? n(costo) / (1 - marginePercentuale / 100) : 0;\n  const riepilogoFiltrato = useMemo(() => {\n    const costo = clientiFiltrati.reduce((s, c) => s + n(c.costo_stimato), 0);\n    const ricavi = marginePercentuale < 100 ? costo / (1 - marginePercentuale / 100) : 0;\n    return { costo, ricavi, margine: ricavi - costo };\n  }, [clientiFiltrati, marginePercentuale]);`;

  if (source.includes(oldFilter)) source = source.replace(oldFilter, newFilter);

  const searchBlock = `<label className="block text-sm font-semibold text-slate-700">Cerca cliente\n            <input type="text" value={filtroClienti} onChange={(e) => setFiltroClienti(e.target.value)} placeholder="Ragione sociale o codice fiscale" className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-sky-600" />\n          </label>`;
  if (source.includes(searchBlock) && !source.includes('value={filtroOperatore}')) {
    source = source.replace(
      searchBlock,
      searchBlock + `\n          <label className="block text-sm font-semibold text-slate-700">Operatore\n            <select value={filtroOperatore} onChange={(e) => setFiltroOperatore(e.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-sky-600">\n              <option value="">Tutti gli operatori</option>\n              {operatoriFiltro.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}\n            </select>\n          </label>`
    );
  }

  // Colonna operatore nel riepilogo generale.
  source = source.replace(
    '<tr><th className="px-4 py-3">Cliente</th><th className="px-4 py-3 text-right">Servizi</th>',
    '<tr><th className="px-4 py-3">Cliente</th><th className="px-4 py-3">Operatore</th><th className="px-4 py-3 text-right">Servizi</th>'
  );
  source = source.replace(
    '<td className="px-4 py-3"><div className="font-semibold text-slate-900">{c.ragione_sociale || "—"}</div><div className="text-xs text-slate-500">{c.codice_fiscale || ""}</div></td>\n                    <td className="px-4 py-3 text-right">{n(c.servizi_attivi)}</td>',
    '<td className="px-4 py-3"><div className="font-semibold text-slate-900">{c.ragione_sociale || "—"}</div><div className="text-xs text-slate-500">{c.codice_fiscale || ""}</div></td>\n                    <td className="px-4 py-3">{c.operatore_nome || "—"}</td>\n                    <td className="px-4 py-3 text-right">{n(c.servizi_attivi)}</td>'
  );

  // Card economiche sul riepilogo generale.
  const generalAnchor = '      {!selectedId ? (';
  if (source.includes(generalAnchor) && !source.includes('label="Ricavi stimati"')) {
    source = source.replace(
      generalAnchor,
      `      {!selectedId && (\n        <div className="grid gap-4 md:grid-cols-4">\n          <Summary label="Clienti visualizzati" value={clientiFiltrati.length.toLocaleString("it-IT")} />\n          <Summary label="Costo stimato" value={euro(riepilogoFiltrato.costo)} />\n          <Summary label="Ricavi stimati" value={euro(riepilogoFiltrato.ricavi)} />\n          <Summary label="Margine stimato" value={euro(riepilogoFiltrato.margine)} />\n        </div>\n      )}\n\n${generalAnchor}`
    );
  }

  // Card economiche anche sul singolo cliente.
  const selectedCards = `<div className="grid gap-4 md:grid-cols-3">\n            <Summary label="Operazioni / driver" value={totali.operazioni.toLocaleString("it-IT", { maximumFractionDigits: 2 })} />\n            <Summary label="Ore equivalenti" value={totali.ore.toLocaleString("it-IT", { maximumFractionDigits: 2 })} />\n            <Summary label="Costo stimato" value={euro(totali.costo)} />\n          </div>`;
  if (source.includes(selectedCards)) {
    source = source.replace(
      selectedCards,
      `<div className="grid gap-4 md:grid-cols-5">\n            <Summary label="Operazioni / driver" value={totali.operazioni.toLocaleString("it-IT", { maximumFractionDigits: 2 })} />\n            <Summary label="Ore equivalenti" value={totali.ore.toLocaleString("it-IT", { maximumFractionDigits: 2 })} />\n            <Summary label="Costo stimato" value={euro(totali.costo)} />\n            <Summary label="Ricavo stimato" value={euro(ricavoDaCosto(totali.costo))} />\n            <Summary label="Margine stimato" value={euro(ricavoDaCosto(totali.costo) - totali.costo)} />\n          </div>`
    );
  }

  return source;
});

console.log("✓ Redditività Studio: operatore associato, filtro per utente_operatore_id e card ricavi applicati");
