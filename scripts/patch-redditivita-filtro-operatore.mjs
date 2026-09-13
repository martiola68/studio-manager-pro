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
  // L'overview ha già utenti e clienti: arricchiamo il cliente con il nominativo dell'operatore associato.
  const marker = 'const clienti = (clientiResult.data || []).map((c: any) => {';
  if (source.includes(marker) && !source.includes('const utentiPerClienteMap = new Map')) {
    source = source.replace(
      marker,
      'const utentiPerClienteMap = new Map((utentiResult.data || []).map((u: any) => [String(u.id), `${u.nome || ""} ${u.cognome || ""}`.trim() || u.email || ""]));\n\n      ' + marker
    );
  }

  const returnAnchor = `        return {\n          ...c,\n          servizi_attivi: s.servizi,`;
  if (source.includes(returnAnchor) && !source.includes('operatore_nome: utentiPerClienteMap')) {
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

  if (!source.includes('const [filtroOperatore, setFiltroOperatore]')) {
    source = source.replace(
      '  const [filtroClienti, setFiltroClienti] = useState("");',
      '  const [filtroClienti, setFiltroClienti] = useState("");\n  const [filtroOperatore, setFiltroOperatore] = useState("");'
    );
  }

  // Ricrea il filtro clienti includendo anche l'operatore.
  const oldFilter = `  const clientiFiltrati = useMemo(() => {\n    const q = filtroClienti.trim().toLowerCase();\n    if (!q) return clienti;\n    return clienti.filter((c) => [c.ragione_sociale, c.codice_fiscale].filter(Boolean).some((v) => String(v).toLowerCase().includes(q)));\n  }, [clienti, filtroClienti]);`;
  const newFilter = `  const operatoriFiltro = useMemo(() => Array.from(new Set(clienti.map((c) => String(c.operatore_nome || "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, "it")), [clienti]);\n\n  const clientiFiltrati = useMemo(() => {\n    const q = filtroClienti.trim().toLowerCase();\n    return clienti.filter((c) => {\n      const matchTesto = !q || [c.ragione_sociale, c.codice_fiscale].filter(Boolean).some((v) => String(v).toLowerCase().includes(q));\n      const matchOperatore = !filtroOperatore || String(c.operatore_nome || "") === filtroOperatore;\n      return matchTesto && matchOperatore;\n    });\n  }, [clienti, filtroClienti, filtroOperatore]);`;
  if (source.includes(oldFilter)) source = source.replace(oldFilter, newFilter);

  // Aggiunge il filtro accanto alla ricerca cliente.
  const searchBlock = `<label className="block text-sm font-semibold text-slate-700">Cerca cliente\n            <input type="text" value={filtroClienti} onChange={(e) => setFiltroClienti(e.target.value)} placeholder="Ragione sociale o codice fiscale" className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-sky-600" />\n          </label>`;
  if (source.includes(searchBlock) && !source.includes('value={filtroOperatore}')) {
    source = source.replace(
      searchBlock,
      searchBlock + `\n          <label className="block text-sm font-semibold text-slate-700">Operatore\n            <select value={filtroOperatore} onChange={(e) => setFiltroOperatore(e.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-sky-600">\n              <option value="">Tutti gli operatori</option>\n              {operatoriFiltro.map((nome) => <option key={nome} value={nome}>{nome}</option>)}\n            </select>\n          </label>`
    );
  }

  // Colonna nell'elenco generale clienti.
  source = source.replace(
    '<tr><th className="px-4 py-3">Cliente</th><th className="px-4 py-3 text-right">Servizi</th>',
    '<tr><th className="px-4 py-3">Cliente</th><th className="px-4 py-3">Operatore</th><th className="px-4 py-3 text-right">Servizi</th>'
  );
  source = source.replace(
    '<td className="px-4 py-3"><div className="font-semibold text-slate-900">{c.ragione_sociale || "—"}</div><div className="text-xs text-slate-500">{c.codice_fiscale || ""}</div></td>\n                    <td className="px-4 py-3 text-right">{n(c.servizi_attivi)}</td>',
    '<td className="px-4 py-3"><div className="font-semibold text-slate-900">{c.ragione_sociale || "—"}</div><div className="text-xs text-slate-500">{c.codice_fiscale || ""}</div></td>\n                    <td className="px-4 py-3">{c.operatore_nome || "—"}</td>\n                    <td className="px-4 py-3 text-right">{n(c.servizi_attivi)}</td>'
  );

  return source;
});

console.log("✓ Redditività Studio: filtro e colonna operatore aggiunti");
