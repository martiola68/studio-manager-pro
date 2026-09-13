import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function patch(rel, fn) {
  const file = path.join(root, rel);
  const src = fs.readFileSync(file, "utf8");
  const out = fn(src);
  if (out === src) {
    console.log(`↷ ${rel} già stabile`);
    return;
  }
  fs.writeFileSync(file, out, "utf8");
  console.log(`✓ ${rel}`);
}

// 1) Mantieni la scheda del modulo e non smontare visivamente tutta la pagina durante i salvataggi.
patch("src/pages/controllo-gestione/redditivita-studio.tsx", (source) => {
  if (!source.includes("const [tabReady, setTabReady]")) {
    source = source.replace(
      '  const [tab, setTab] = useState<TabKey>("dashboard");',
      '  const [tab, setTab] = useState<TabKey>("dashboard");\n  const [tabReady, setTabReady] = useState(false);'
    );
  }

  const oldStorage = `  useEffect(() => {\n    const savedTab = window.sessionStorage.getItem(TAB_STORAGE_KEY) as TabKey | null;\n    if (savedTab && tabs.some((item) => item.key === savedTab)) setTab(savedTab);\n  }, []);\n\n  useEffect(() => {\n    if (typeof window !== "undefined") window.sessionStorage.setItem(TAB_STORAGE_KEY, tab);\n  }, [tab]);`;
  const newStorage = `  useEffect(() => {\n    if (typeof window === "undefined") return;\n    const savedTab = window.sessionStorage.getItem(TAB_STORAGE_KEY) as TabKey | null;\n    if (savedTab && tabs.some((item) => item.key === savedTab)) setTab(savedTab);\n    setTabReady(true);\n  }, []);\n\n  useEffect(() => {\n    if (!tabReady || typeof window === "undefined") return;\n    window.sessionStorage.setItem(TAB_STORAGE_KEY, tab);\n  }, [tab, tabReady]);`;
  if (source.includes(oldStorage)) source = source.replace(oldStorage, newStorage);

  source = source.replace(
    '  async function caricaDati(id: string, esercizio: string) {\n    try {\n      setLoading(true);',
    '  async function caricaDati(id: string, esercizio: string, silent = false) {\n    try {\n      if (!silent) setLoading(true);'
  );
  source = source.replace(
    '    } finally {\n      setLoading(false);\n    }\n  }\n\n  const updateCost',
    '    } finally {\n      if (!silent) setLoading(false);\n    }\n  }\n\n  const updateCost'
  );
  source = source.replaceAll('await caricaDati(studioId, anno);', 'await caricaDati(studioId, anno, true);');

  return source;
});

// 2) Quantità intere + persistenza del cliente selezionato + refresh silenzioso.
patch("src/components/controllo-gestione/RedditivitaClientiTab.tsx", (source) => {
  if (!source.includes("SELECTED_CLIENT_KEY")) {
    source = source.replace(
      '  const [selectedId, setSelectedId] = useState("");',
      '  const [selectedId, setSelectedId] = useState("");\n  const SELECTED_CLIENT_KEY = `smp:redditivita-studio:cliente:${studioId}:${anno}`;'
    );
  }

  const oldEffect = `  useEffect(() => {\n    if (!studioId) return;\n    loadOverview();\n  }, [studioId, anno]);`;
  const newEffect = `  useEffect(() => {\n    if (!studioId) return;\n    const saved = typeof window !== "undefined" ? window.sessionStorage.getItem(SELECTED_CLIENT_KEY) || "" : "";\n    loadOverview();\n    if (saved) {\n      setSelectedId(saved);\n      loadCliente(saved);\n    }\n  }, [studioId, anno]);`;
  if (source.includes(oldEffect)) source = source.replace(oldEffect, newEffect);

  source = source.replace(
    '  async function loadOverview() {\n    try {\n      setLoading(true);',
    '  async function loadOverview(silent = false) {\n    try {\n      if (!silent) setLoading(true);'
  );
  source = source.replace(
    '  async function loadCliente(clienteId: string) {',
    '  async function loadCliente(clienteId: string, silent = false) {'
  );
  source = source.replace(
    '    try {\n      setLoading(true);\n      setMessage("");\n      const res = await fetch(`/api/controllo-gestione/redditivita-studio?studio_id=${encodeURIComponent(studioId)}&esercizio=${encodeURIComponent(anno)}&cliente_id=${encodeURIComponent(clienteId)}`);',
    '    try {\n      if (!silent) setLoading(true);\n      setMessage("");\n      const res = await fetch(`/api/controllo-gestione/redditivita-studio?studio_id=${encodeURIComponent(studioId)}&esercizio=${encodeURIComponent(anno)}&cliente_id=${encodeURIComponent(clienteId)}`);'
  );

  // I due loader hanno ciascuno il proprio finally: rendili silenziosi senza cambiare lo stato visivo durante salvataggi.
  source = source.replaceAll('    } finally {\n      setLoading(false);\n    }', '    } finally {\n      if (!silent) setLoading(false);\n    }');
  source = source.replace(
    '  async function refresh() {\n    await Promise.all([loadOverview(), selectedId ? loadCliente(selectedId) : Promise.resolve()]);\n  }',
    '  async function refresh() {\n    await Promise.all([loadOverview(true), selectedId ? loadCliente(selectedId, true) : Promise.resolve()]);\n  }'
  );

  // Memorizza il cliente corrente, così cambiando scheda e tornando non si riparte dalla lista iniziale.
  source = source.replace(
    '                setSelectedId(id);\n                loadCliente(id);',
    '                setSelectedId(id);\n                if (typeof window !== "undefined") { if (id) window.sessionStorage.setItem(SELECTED_CLIENT_KEY, id); else window.sessionStorage.removeItem(SELECTED_CLIENT_KEY); }\n                loadCliente(id);'
  );
  source = source.replaceAll(
    'setSelectedId(c.id); loadCliente(c.id);',
    'setSelectedId(c.id); if (typeof window !== "undefined") window.sessionStorage.setItem(SELECTED_CLIENT_KEY, c.id); loadCliente(c.id);'
  );

  // Il driver/quantità deve essere sempre un intero.
  source = source.replace(
    '<NumberField label="Numero operazioni / quantità" value={serviceDraft.quantita_driver} onChange={(v) => setServiceDraft((p) => ({ ...p, quantita_driver: n(v) }))} />',
    '<IntegerField label="Numero operazioni / quantità" value={serviceDraft.quantita_driver} onChange={(v) => setServiceDraft((p) => ({ ...p, quantita_driver: v }))} />'
  );
  source = source.replace(
    '<input type="number" min="0" step="0.01" value={q || ""} onChange={(e) => setQ(n(e.target.value))} className="h-9 w-24 rounded-md border border-slate-300 px-2 text-right" />',
    '<input type="number" min="0" step="1" inputMode="numeric" value={q || ""} onChange={(e) => setQ(Math.max(0, Math.trunc(n(e.target.value))))} className="h-9 w-24 rounded-md border border-slate-300 px-2 text-right" />'
  );

  if (!source.includes("function IntegerField(")) {
    source = source.replace(
      'function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: string) => void }) {',
      'function IntegerField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {\n  return <label className="text-sm font-semibold text-slate-700">{label}<input type="number" min="0" step="1" inputMode="numeric" value={Number.isFinite(value) ? Math.trunc(value) : 0} onChange={(e) => onChange(Math.max(0, Math.trunc(n(e.target.value))))} className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-sky-600" /></label>;\n}\n\nfunction NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: string) => void }) {'
    );
  }

  return source;
});

// 3) Validazione server: nessun decimale può essere salvato anche forzando la chiamata API.
patch("src/pages/api/controllo-gestione/redditivita-studio.ts", (source) => {
  source = source.replace(
    '        const quantitaDriver = Math.max(0, n(req.body?.quantita_driver));',
    '        const quantitaDriver = n(req.body?.quantita_driver);'
  );
  if (!source.includes('"Il numero operazioni / quantità deve essere un numero intero"')) {
    source = source.replace(
      '        if (!clienteId || !attivitaId) {\n          return res.status(400).json({ success: false, error: "Cliente e attività sono obbligatori" });\n        }',
      '        if (!clienteId || !attivitaId) {\n          return res.status(400).json({ success: false, error: "Cliente e attività sono obbligatori" });\n        }\n        if (!Number.isInteger(quantitaDriver) || quantitaDriver < 0) {\n          return res.status(400).json({ success: false, error: "Il numero operazioni / quantità deve essere un numero intero" });\n        }'
    );
  }
  return source;
});

// 4) Compensi: conserva il cliente scelto e fai i ricaricamenti post-salvataggio senza flash della pagina.
patch("src/components/controllo-gestione/RedditivitaCompensiTab.tsx", (source) => {
  if (!source.includes("COMPENSI_SELECTED_KEY")) {
    source = source.replace(
      '  const [selectedId, setSelectedId] = useState("");',
      '  const [selectedId, setSelectedId] = useState("");\n  const COMPENSI_SELECTED_KEY = `smp:redditivita-studio:compensi:${studioId}:${anno}`;'
    );
  }
  source = source.replace(
    '  useEffect(() => {\n    if (studioId) loadOverview();\n  }, [studioId, anno]);',
    '  useEffect(() => {\n    if (!studioId) return;\n    const saved = typeof window !== "undefined" ? window.sessionStorage.getItem(COMPENSI_SELECTED_KEY) || "" : "";\n    loadOverview();\n    if (saved) loadDetail(saved);\n  }, [studioId, anno]);'
  );
  source = source.replace(
    '      setDetail(j);\n      setSelectedId(id);',
    '      setDetail(j);\n      setSelectedId(id);\n      if (typeof window !== "undefined") window.sessionStorage.setItem(COMPENSI_SELECTED_KEY, id);'
  );
  return source;
});

// 5) Incassi: conserva il contratto selezionato quando si cambia scheda e si ritorna.
patch("src/components/controllo-gestione/RedditivitaIncassiTab.tsx", (source) => {
  if (!source.includes("INCASSI_SELECTED_KEY")) {
    source = source.replace(
      '  const [selectedId, setSelectedId] = useState("");',
      '  const [selectedId, setSelectedId] = useState("");\n  const INCASSI_SELECTED_KEY = `smp:redditivita-studio:incassi:${studioId}:${anno}`;'
    );
  }
  source = source.replace(
    '  useEffect(() => {\n    if (!studioId) return;\n    loadOverview();\n  }, [studioId, anno]);',
    '  useEffect(() => {\n    if (!studioId) return;\n    const saved = typeof window !== "undefined" ? window.sessionStorage.getItem(INCASSI_SELECTED_KEY) || "" : "";\n    loadOverview();\n    if (saved) loadContratto(saved);\n  }, [studioId, anno]);'
  );
  source = source.replace(
    '  async function loadContratto(id: string) {\n    setSelectedId(id);',
    '  async function loadContratto(id: string) {\n    setSelectedId(id);\n    if (typeof window !== "undefined") { if (id) window.sessionStorage.setItem(INCASSI_SELECTED_KEY, id); else window.sessionStorage.removeItem(INCASSI_SELECTED_KEY); }'
  );
  return source;
});

console.log("✓ Redditività Studio: stabilità UI e quantità intere applicate");
