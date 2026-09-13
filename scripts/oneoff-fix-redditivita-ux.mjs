import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
function patch(rel, fn) {
  const file = path.join(root, rel);
  const src = fs.readFileSync(file, "utf8");
  const out = fn(src);
  if (out === src) throw new Error(`Nessuna modifica applicata a ${rel}`);
  fs.writeFileSync(file, out, "utf8");
  console.log(`✓ ${rel}`);
}

patch("src/pages/controllo-gestione/redditivita-studio.tsx", (source) => {
  if (!source.includes('smp:redditivita-studio:tab')) {
    source = source.replace(
      '  const [tab, setTab] = useState<TabKey>("dashboard");',
      '  const [tab, setTab] = useState<TabKey>("dashboard");\n  const TAB_STORAGE_KEY = "smp:redditivita-studio:tab";'
    );
    source = source.replace(
      '  useEffect(() => {\n    (async () => {',
      '  useEffect(() => {\n    const savedTab = window.sessionStorage.getItem(TAB_STORAGE_KEY) as TabKey | null;\n    if (savedTab && tabs.some((item) => item.key === savedTab)) setTab(savedTab);\n  }, []);\n\n  useEffect(() => {\n    if (typeof window !== "undefined") window.sessionStorage.setItem(TAB_STORAGE_KEY, tab);\n  }, [tab]);\n\n  useEffect(() => {\n    (async () => {'
    );
  }
  return source;
});

patch("src/pages/api/controllo-gestione/redditivita-studio.ts", (source) => {
  if (!source.includes("function coefficienteDifficolta")) {
    source = source.replace(
      'function round(value: number, digits = 4) {\n  const factor = Math.pow(10, digits);\n  return Math.round((value + Number.EPSILON) * factor) / factor;\n}',
      `function round(value: number, digits = 4) {\n  const factor = Math.pow(10, digits);\n  return Math.round((value + Number.EPSILON) * factor) / factor;\n}\n\nfunction coefficienteDifficolta(scoreRaw: unknown) {\n  const score = Math.min(5, Math.max(1, n(scoreRaw || 3)));\n  const punti = [\n    { score: 1, coeff: 0.8 },\n    { score: 2, coeff: 0.9 },\n    { score: 3, coeff: 1.0 },\n    { score: 4, coeff: 1.25 },\n    { score: 5, coeff: 1.5 },\n  ];\n  const low = Math.floor(score);\n  const high = Math.ceil(score);\n  if (low === high) return punti[low - 1].coeff;\n  const c1 = punti[low - 1].coeff;\n  const c2 = punti[high - 1].coeff;\n  return c1 + (c2 - c1) * (score - low);\n}`
    );
  }

  source = source.replace(
    '        const coefficienteComplessita = n(req.body?.coefficiente_complessita || 1);',
    '        const coefficienteComplessita = n(req.body?.coefficiente_complessita || 3);'
  );
  source = source.replace(
    '        if (coefficienteComplessita <= 0) {\n          return res.status(400).json({ success: false, error: "Il coefficiente di complessità deve essere maggiore di zero" });\n        }',
    '        if (coefficienteComplessita < 1 || coefficienteComplessita > 5) {\n          return res.status(400).json({ success: false, error: "La difficoltà deve essere compresa tra 1 e 5" });\n        }'
  );
  source = source.replace(
    '          quantitaDriver * n(attivitaResult.data.tempo_standard_minuti) / 60 * n(attivitaResult.data.coefficiente_base || 1) * coefficienteComplessita,',
    '          quantitaDriver * n(attivitaResult.data.tempo_standard_minuti) / 60 * n(attivitaResult.data.coefficiente_base || 1) * coefficienteDifficolta(coefficienteComplessita),'
  );
  return source;
});

patch("src/components/controllo-gestione/RedditivitaClientiTab.tsx", (source) => {
  source = source.replace(
    '  const [serviceDraft, setServiceDraft] = useState({ attivita_id: "", quantita_driver: 0, coefficiente_complessita: 1 });',
    '  const [serviceDraft, setServiceDraft] = useState({ attivita_id: "", quantita_driver: 0, coefficiente_complessita: 3 });'
  );
  source = source.replaceAll(
    'setServiceDraft({ attivita_id: "", quantita_driver: 0, coefficiente_complessita: 1 })',
    'setServiceDraft({ attivita_id: "", quantita_driver: 0, coefficiente_complessita: 3 })'
  );
  source = source.replaceAll('Coeff. cliente', 'Difficoltà (1-5)');
  source = source.replaceAll('Difficoltà / complessità cliente', 'Difficoltà cliente (1-5)');
  source = source.replaceAll('Coefficiente complessità cliente', 'Difficoltà cliente (1-5)');
  source = source.replaceAll('Quantità driver', 'Numero operazioni / quantità');

  const modalFieldVariants = [
    '<NumberField label="Difficoltà cliente (1-5)" value={serviceDraft.coefficiente_complessita} onChange={(v) => setServiceDraft((p) => ({ ...p, coefficiente_complessita: n(v) }))} />',
    '<NumberField label="Difficoltà / complessità cliente" value={serviceDraft.coefficiente_complessita} onChange={(v) => setServiceDraft((p) => ({ ...p, coefficiente_complessita: n(v) }))} />',
  ];
  for (const field of modalFieldVariants) {
    source = source.replace(
      field,
      '<DifficultyField value={serviceDraft.coefficiente_complessita} onChange={(v) => setServiceDraft((p) => ({ ...p, coefficiente_complessita: v }))} />'
    );
  }

  source = source.replace(
    '<input type="number" min="0.01" step="0.01" value={c || ""} onChange={(e) => setC(n(e.target.value))} className="h-9 w-20 rounded-md border border-slate-300 px-2 text-right" />',
    '<select value={c || 3} onChange={(e) => setC(n(e.target.value))} className="h-9 w-36 rounded-md border border-slate-300 bg-white px-2 text-xs"><option value="1">1 · Molto semplice</option><option value="1.5">1,5</option><option value="2">2 · Semplice</option><option value="2.5">2,5</option><option value="3">3 · Ordinaria</option><option value="3.5">3,5</option><option value="4">4 · Complessa</option><option value="4.5">4,5</option><option value="5">5 · Critica</option></select>'
  );

  if (!source.includes('function DifficultyField(')) {
    source = source.replace(
      'function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: string) => void }) {',
      `function DifficultyField({ value, onChange }: { value: number; onChange: (value: number) => void }) {\n  return <label className="text-sm font-semibold text-slate-700">Difficoltà cliente (1-5)<select value={value || 3} onChange={(e) => onChange(n(e.target.value))} className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-sky-600"><option value="1">1 · Molto semplice</option><option value="1.5">1,5</option><option value="2">2 · Semplice</option><option value="2.5">2,5</option><option value="3">3 · Ordinaria</option><option value="3.5">3,5</option><option value="4">4 · Complessa</option><option value="4.5">4,5</option><option value="5">5 · Critica</option></select><span className="mt-1 block text-xs font-normal text-slate-500">Min 1 · Max 5 · riferimento normale 3</span></label>;\n}\n\nfunction NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: string) => void }) {`
    );
  }
  return source;
});

patch("src/components/TopNavBar.tsx", (source) => {
  const anchor = '        { label: "Controllo di Gestione", href: "/guide/Manuale_Controllo_di_Gestione_SMP.pdf", icon: <BriefcaseBusiness className="h-4 w-4" /> },';
  if (!source.includes('label: "Redditività Studio"')) {
    if (!source.includes(anchor)) throw new Error("Anchor manuali TopNavBar non trovato");
    source = source.replace(anchor, anchor + '\n        { label: "Redditività Studio", href: "/guide/redditivita-studio", icon: <BarChart3 className="h-4 w-4" /> },');
  }
  return source;
});

console.log("✓ one-off Redditivita UX fixes applied");
