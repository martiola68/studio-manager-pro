import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function patchFile(relPath, patcher) {
  const file = path.join(root, relPath);
  let source = fs.readFileSync(file, "utf8");
  const next = patcher(source);
  fs.writeFileSync(file, next, "utf8");
  console.log(`✓ ${relPath}`);
}

patchFile("src/pages/api/controllo-gestione/redditivita-studio.ts", (source) => {
  if (!source.includes("CATALOGO_BASE_REDDITIVITA")) {
    const anchor = "export default async function handler(req: NextApiRequest, res: NextApiResponse) {";
    const helper = `const CATALOGO_BASE_REDDITIVITA = [
  { codice: "CONT_MOV_IVA", area: "Contabilità", descrizione: "Registrazione movimenti IVA", driver: "Numero movimenti IVA", unita_misura: "mov.", tempo_standard_minuti: 1.5, coefficiente_base: 1, ordinamento: 10, attiva: true },
  { codice: "CONT_MOV_CONT", area: "Contabilità", descrizione: "Registrazione movimenti contabili", driver: "Numero movimenti contabili", unita_misura: "mov.", tempo_standard_minuti: 1.0, coefficiente_base: 1, ordinamento: 20, attiva: true },
  { codice: "CONT_RICONC", area: "Contabilità", descrizione: "Riconciliazioni bancarie", driver: "Numero riconciliazioni / conti", unita_misura: "n.", tempo_standard_minuti: 15, coefficiente_base: 1, ordinamento: 30, attiva: true },
  { codice: "CONT_LIQ_IVA", area: "Contabilità", descrizione: "Liquidazione IVA periodica", driver: "Numero liquidazioni", unita_misura: "n.", tempo_standard_minuti: 25, coefficiente_base: 1, ordinamento: 40, attiva: true },
  { codice: "BIL_BILANCIO", area: "Bilancio", descrizione: "Bilancio annuale e chiusure", driver: "Numero bilanci", unita_misura: "n.", tempo_standard_minuti: 240, coefficiente_base: 1, ordinamento: 100, attiva: true },
  { codice: "BIL_RETT", area: "Bilancio", descrizione: "Rettifiche e assestamenti", driver: "Numero rettifiche significative", unita_misura: "n.", tempo_standard_minuti: 20, coefficiente_base: 1, ordinamento: 110, attiva: true },
  { codice: "DICH_REDDITI", area: "Dichiarativi", descrizione: "Dichiarazione redditi", driver: "Numero dichiarazioni", unita_misura: "n.", tempo_standard_minuti: 180, coefficiente_base: 1, ordinamento: 200, attiva: true },
  { codice: "DICH_IVA", area: "Dichiarativi", descrizione: "Dichiarazione IVA annuale", driver: "Numero dichiarazioni", unita_misura: "n.", tempo_standard_minuti: 90, coefficiente_base: 1, ordinamento: 210, attiva: true },
  { codice: "DICH_770", area: "Dichiarativi", descrizione: "Modello 770", driver: "Numero modelli", unita_misura: "n.", tempo_standard_minuti: 75, coefficiente_base: 1, ordinamento: 220, attiva: true },
  { codice: "CONS_ORE", area: "Consulenza", descrizione: "Consulenza professionale", driver: "Ore di consulenza", unita_misura: "ore", tempo_standard_minuti: 60, coefficiente_base: 1, ordinamento: 300, attiva: true },
  { codice: "SOC_PRAT", area: "Societario", descrizione: "Pratiche societarie", driver: "Numero pratiche", unita_misura: "n.", tempo_standard_minuti: 120, coefficiente_base: 1, ordinamento: 400, attiva: true },
  { codice: "REV_ORE", area: "Revisione", descrizione: "Attività di revisione / controllo", driver: "Ore di attività", unita_misura: "ore", tempo_standard_minuti: 60, coefficiente_base: 1, ordinamento: 500, attiva: true },
];

async function assicuraCatalogoBase(studioId: string) {
  const { count, error: countError } = await supabaseAdmin
    .from("tbcdg_attivita_catalogo")
    .select("id", { count: "exact", head: true })
    .eq("studio_id", studioId);
  if (countError) throw countError;
  if ((count || 0) > 0) return;

  const righe = CATALOGO_BASE_REDDITIVITA.map((r) => ({ ...r, studio_id: studioId }));
  const { error } = await supabaseAdmin.from("tbcdg_attivita_catalogo").insert(righe);
  if (error && String(error.code) !== "23505") throw error;
}

`;
    if (!source.includes(anchor)) throw new Error("Anchor handler Redditivita API non trovato");
    source = source.replace(anchor, helper + anchor);
  }

  const getAnchor = `    if (req.method === "GET") {\n      const clienteId = typeof req.query.cliente_id === "string" ? req.query.cliente_id.trim() : "";`;
  if (!source.includes("await assicuraCatalogoBase(studioId);")) {
    if (!source.includes(getAnchor)) throw new Error("Anchor GET Redditivita API non trovato");
    source = source.replace(getAnchor, `    if (req.method === "GET") {\n      await assicuraCatalogoBase(studioId);\n      const clienteId = typeof req.query.cliente_id === "string" ? req.query.cliente_id.trim() : "";`);
  }

  source = source.replace(
    `.from("tbutenti").select("id,nome,cognome,email,tipo_rapporto,settore,studio_id").eq("studio_id", studioId).order("cognome", { ascending: true })`,
    `.from("tbutenti").select("id,nome,cognome,email,tipo_rapporto,settore,studio_id").eq("studio_id", studioId).eq("attivo", true).order("cognome", { ascending: true })`
  );
  source = source.replace(
    `.from("tbclienti").select("id,ragione_sociale,codice_fiscale").eq("studio_id", studioId).order("ragione_sociale", { ascending: true })`,
    `.from("tbclienti").select("id,ragione_sociale,codice_fiscale,attivo,settore_fiscale,settore_consulenza,settore_lavoro").eq("studio_id", studioId).eq("attivo", true).order("ragione_sociale", { ascending: true })`
  );

  return source;
});

patchFile("src/components/controllo-gestione/RedditivitaClientiTab.tsx", (source) => {
  if (!source.includes("filtroClienti")) {
    source = source.replace(
      `  const [selectedId, setSelectedId] = useState("");`,
      `  const [selectedId, setSelectedId] = useState("");\n  const [filtroClienti, setFiltroClienti] = useState("");`
    );
    source = source.replace(
      `  const attivitaDisponibili = useMemo(() => {`,
      `  const clientiFiltrati = useMemo(() => {\n    const q = filtroClienti.trim().toLowerCase();\n    if (!q) return clienti;\n    return clienti.filter((c) => [c.ragione_sociale, c.codice_fiscale].filter(Boolean).some((v) => String(v).toLowerCase().includes(q)));\n  }, [clienti, filtroClienti]);\n\n  const attivitaDisponibili = useMemo(() => {`
    );
  }

  source = source.replace(
    `<label className="w-full max-w-2xl text-sm font-semibold text-slate-700">\n            Cliente`,
    `<div className="w-full max-w-2xl space-y-3">\n          <label className="block text-sm font-semibold text-slate-700">Cerca cliente\n            <input type="text" value={filtroClienti} onChange={(e) => setFiltroClienti(e.target.value)} placeholder="Ragione sociale o codice fiscale" className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-sky-600" />\n          </label>\n          <label className="block text-sm font-semibold text-slate-700">\n            Cliente`
  );

  const oldCounter = '          </label>\n          <div className="text-sm text-slate-500">{loading ? "Caricamento..." : `${clienti.length} clienti disponibili`}</div>';
  const newCounter = '          </label>\n          </div>\n          <div className="text-sm text-slate-500">{loading ? "Caricamento..." : `${clientiFiltrati.length} clienti attivi disponibili`}</div>';
  source = source.replace(oldCounter, newCounter);

  source = source.replaceAll(`{clienti.map((c) =>`, `{clientiFiltrati.map((c) =>`);

  source = source.replaceAll("Coeff. cliente", "Difficoltà");
  source = source.replaceAll("Coefficiente complessità cliente", "Difficoltà / complessità cliente");
  source = source.replaceAll("Quantità driver", "Numero operazioni / quantità");
  source = source.replace(
    `<div className="grid gap-4 p-6 md:grid-cols-2">`,
    `<div className="grid gap-4 p-6 md:grid-cols-2">\n            <div className="md:col-span-2 rounded-lg border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-slate-700"><strong>Come si compila:</strong> scegli l'attività (es. movimenti IVA), inserisci il numero di operazioni e indica la difficoltà. Valori consigliati: 0,85 semplice; 1,00 ordinaria; 1,25 complessa; 1,60 critica.</div>`
  );

  return source;
});

console.log("✓ Redditivita Studio operational patch complete");
