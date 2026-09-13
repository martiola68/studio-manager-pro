import fs from "node:fs";

const apiFile = "src/pages/api/controllo-gestione/redditivita-studio.ts";
const pageFile = "src/pages/controllo-gestione/redditivita-studio.tsx";
const clientiFile = "src/components/controllo-gestione/RedditivitaClientiTab.tsx";

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function write(file, source) {
  fs.writeFileSync(file, source, "utf8");
}

function replaceOrFail(source, label, from, to) {
  if (!source.includes(from)) {
    throw new Error(`[redditivita-settori] pattern not found: ${label}`);
  }
  return source.replace(from, to);
}

function replaceSection(source, startMarker, endMarker, transform, label) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) throw new Error(`[redditivita-settori] section not found: ${label}`);
  const section = source.slice(start, end);
  const next = transform(section);
  return source.slice(0, start) + next + source.slice(end);
}

// -----------------------------------------------------------------------------
// API: classificazione operatori e metriche per Fiscale / Consulenza / Lavoro.
// -----------------------------------------------------------------------------
let api = read(apiFile);

if (!api.includes("function settoriOperatoreDaDati")) {
  const anchor = "export default async function handler(req: NextApiRequest, res: NextApiResponse) {";
  const helpers = `type SettoreRedditivita = "Fiscale" | "Consulenza" | "Lavoro";\n\nfunction settoreDaAreaAttivita(areaRaw: unknown): SettoreRedditivita {\n  const area = String(areaRaw || "").trim().toLowerCase();\n  if (area === "payroll" || area === "lavoro") return "Lavoro";\n  if (area === "consulenza") return "Consulenza";\n  return "Fiscale";\n}\n\nfunction settoriOperatoreDaDati(utente: any, ruoloRaw: unknown): SettoreRedditivita[] {\n  const ruolo = String(ruoloRaw || "").trim();\n  const result = new Set<SettoreRedditivita>();\n\n  if (ruolo.includes("·")) {\n    const [profiloRaw = "", areeRaw = ""] = ruolo.split("·");\n    const profilo = profiloRaw.trim().toLowerCase();\n    const profiloAmmesso = [\n      "dipendente",\n      "professionista collaboratore",\n      "professionista socio",\n      "altro",\n    ].includes(profilo);\n    if (!profiloAmmesso) return [];\n\n    const aree = areeRaw\n      .split("+")\n      .map((area) => area.trim().toLowerCase())\n      .filter(Boolean);\n    if (aree.includes("contabilità e fiscale")) result.add("Fiscale");\n    if (aree.includes("consulenza")) result.add("Consulenza");\n    if (aree.includes("payroll")) result.add("Lavoro");\n    return Array.from(result);\n  }\n\n  const rapporto = String(utente?.tipo_rapporto || "").trim().toLowerCase();\n  const profiloAmmesso = ["dipendente", "collaboratore", "socio", "altro"].includes(rapporto);\n  if (!profiloAmmesso) return [];\n\n  const settore = String(utente?.settore || "").trim().toLowerCase();\n  if (settore === "fiscale") result.add("Fiscale");\n  if (settore === "consulenza") result.add("Consulenza");\n  if (settore === "lavoro" || settore === "payroll") result.add("Lavoro");\n  return Array.from(result);\n}\n\nasync function mappaSettoriOperatori(studioId: string) {\n  const [{ data: utenti, error: utentiError }, { data: ruoli, error: ruoliError }] = await Promise.all([\n    supabaseAdmin\n      .from("tbutenti")\n      .select("id,settore,tipo_rapporto,ruolo_operatore_id,attivo")\n      .eq("studio_id", studioId),\n    supabaseAdmin\n      .from("tbroperatore")\n      .select("id,ruolo")\n      .eq("studio_id", studioId),\n  ]);\n  if (utentiError) throw utentiError;\n  if (ruoliError) throw ruoliError;\n\n  const ruoloById = new Map<string, string>((ruoli || []).map((r: any) => [String(r.id), String(r.ruolo || "")]));\n  const settoriByUser = new Map<string, SettoreRedditivita[]>();\n  const idsAmmessi = new Set<string>();\n\n  for (const u of utenti || []) {\n    if (u.attivo === false) continue;\n    const settori = settoriOperatoreDaDati(u, ruoloById.get(String(u.ruolo_operatore_id || "")) || "");\n    if (!settori.length) continue;\n    const id = String(u.id);\n    settoriByUser.set(id, settori);\n    idsAmmessi.add(id);\n  }\n\n  return { settoriByUser, idsAmmessi };\n}\n\n`;
  api = replaceOrFail(api, "api helper anchor", anchor, helpers + anchor);
}

// Capacità: comprende gli operatori ammessi dei tre settori, una sola volta per persona.
api = replaceSection(
  api,
  "async function capacitaOperatoriStudio(studioId: string, esercizio: number) {",
  "async function costoOrarioMedioStudio",
  (section) => {
    if (!section.includes("const mappaSettoriCapacita = await mappaSettoriOperatori")) {
      section = section.replace(
        "async function capacitaOperatoriStudio(studioId: string, esercizio: number) {\n  const [",
        "async function capacitaOperatoriStudio(studioId: string, esercizio: number) {\n  const mappaSettoriCapacita = await mappaSettoriOperatori(studioId);\n  const ["
      );
    }
    section = section.replace(
      "    if (!userId) continue;\n    const oreGiorno =",
      "    if (!userId || !mappaSettoriCapacita.idsAmmessi.has(userId)) continue;\n    const oreGiorno ="
    );
    section = section.replace(
      "    if (!userId || byUser.has(userId)) continue;",
      "    if (!userId || !mappaSettoriCapacita.idsAmmessi.has(userId) || byUser.has(userId)) continue;"
    );
    return section;
  },
  "capacita operatori"
);

// Dettaglio cliente: espone tutti gli operatori ammessi, con i settori associati.
api = replaceSection(
  api,
  "      if (clienteId) {",
  "      const scope = typeof req.query.scope",
  (section) => {
    if (!section.includes("const mappaSettoriCliente = await mappaSettoriOperatori")) {
      section = replaceOrFail(
        section,
        "client sector map",
        "        if (costiOperatoriResult.error) throw costiOperatoriResult.error;\n\n        const attivitaMap =",
        "        if (costiOperatoriResult.error) throw costiOperatoriResult.error;\n\n        const mappaSettoriCliente = await mappaSettoriOperatori(studioId);\n        const utentiAmmessiCliente = (utentiResult.data || []).filter((u: any) =>\n          mappaSettoriCliente.idsAmmessi.has(String(u.id))\n        );\n\n        const attivitaMap ="
      );
    }
    section = section.replace(
      "const utentiMap = new Map((utentiResult.data || []).map((u: any) => [u.id, u]));",
      "const utentiMap = new Map(utentiAmmessiCliente.map((u: any) => [u.id, u]));"
    );
    section = section.replace(
      "const operatoriCliente = (utentiResult.data || []).map((u: any) => {",
      "const operatoriCliente = utentiAmmessiCliente.map((u: any) => {"
    );
    section = section.replace(
      "          ...u,\n            costo:",
      "          ...u,\n            settori: mappaSettoriCliente.settoriByUser.get(String(u.id)) || [],\n            costo:"
    );
    section = section.replaceAll(
      "          if (!key) continue;",
      "          if (!key || !mappaSettoriCliente.idsAmmessi.has(key)) continue;"
    );
    return section;
  },
  "dettaglio cliente"
);

// Overview rapido Clienti: sostituiamo il blocco con una versione settoriale.
const scopeStart = api.indexOf('      if (scope === "clienti") {');
const heavyStart = api.indexOf("      const [parametriResult, utentiResult", scopeStart);
if (scopeStart < 0 || heavyStart < 0) throw new Error("[redditivita-settori] scope clienti non trovato");

const fastClientiBlock = `      if (scope === "clienti") {\n        const [parametriClientiResult, utentiClientiResult, ruoliClientiResult, clientiFastResult, serviziFastResult, catalogoFastResult] = await Promise.all([\n          supabaseAdmin\n            .from("tbcdg_studio_parametri")\n            .select("margine_obiettivo_percentuale")\n            .eq("studio_id", studioId)\n            .eq("esercizio", esercizio)\n            .maybeSingle(),\n          supabaseAdmin\n            .from("tbutenti")\n            .select("id,nome,cognome,email,settore,tipo_rapporto,ruolo_operatore_id,attivo")\n            .eq("studio_id", studioId)\n            .eq("attivo", true)\n            .order("cognome", { ascending: true })\n            .order("nome", { ascending: true }),\n          supabaseAdmin\n            .from("tbroperatore")\n            .select("id,ruolo")\n            .eq("studio_id", studioId),\n          supabaseAdmin\n            .from("tbclienti")\n            .select("id,ragione_sociale,codice_fiscale,utente_operatore_id,utente_payroll_id")\n            .eq("studio_id", studioId)\n            .eq("cliente", true)\n            .eq("attivo", true)\n            .order("ragione_sociale", { ascending: true }),\n          supabaseAdmin\n            .from("tbcdg_cliente_servizi")\n            .select("cliente_id,attivita_id,quantita_driver,ore_equivalenti,costo_stimato")\n            .eq("studio_id", studioId)\n            .eq("esercizio", esercizio)\n            .eq("attivo", true),\n          supabaseAdmin\n            .from("tbcdg_attivita_catalogo")\n            .select("id,area")\n            .eq("studio_id", studioId),\n        ]);\n\n        if (parametriClientiResult.error) throw parametriClientiResult.error;\n        if (utentiClientiResult.error) throw utentiClientiResult.error;\n        if (ruoliClientiResult.error) throw ruoliClientiResult.error;\n        if (clientiFastResult.error) throw clientiFastResult.error;\n        if (serviziFastResult.error) throw serviziFastResult.error;\n        if (catalogoFastResult.error) throw catalogoFastResult.error;\n\n        const ruoloById = new Map<string, string>((ruoliClientiResult.data || []).map((r: any) => [String(r.id), String(r.ruolo || "")]));\n        const operatori = (utentiClientiResult.data || [])\n          .map((u: any) => ({\n            ...u,\n            settori: settoriOperatoreDaDati(u, ruoloById.get(String(u.ruolo_operatore_id || "")) || ""),\n          }))\n          .filter((u: any) => u.settori.length > 0);\n        const operatoriById = new Map<string, any>(operatori.map((u: any) => [String(u.id), u]));\n        const areaByAttivita = new Map<string, string>((catalogoFastResult.data || []).map((a: any) => [String(a.id), String(a.area || "")]));\n\n        const emptyMetric = () => ({ servizi: 0, operazioni: 0, ore: 0, costo: 0 });\n        const summary = new Map<string, Record<SettoreRedditivita, { servizi: number; operazioni: number; ore: number; costo: number }>>();\n\n        for (const s of serviziFastResult.data || []) {\n          const clienteKey = String(s.cliente_id || "");\n          if (!clienteKey) continue;\n          const settore = settoreDaAreaAttivita(areaByAttivita.get(String(s.attivita_id || "")) || "");\n          const current = summary.get(clienteKey) || { Fiscale: emptyMetric(), Consulenza: emptyMetric(), Lavoro: emptyMetric() };\n          current[settore].servizi += 1;\n          current[settore].operazioni += n(s.quantita_driver);\n          current[settore].ore += n(s.ore_equivalenti);\n          current[settore].costo += n(s.costo_stimato);\n          summary.set(clienteKey, current);\n        }\n\n        const nomeOperatore = (id: unknown) => {\n          const u = id ? operatoriById.get(String(id)) : null;\n          if (!u) return "";\n          return (\`${'${u.nome || ""} ${u.cognome || ""}'}\`.trim() || u.email || "");\n        };\n\n        const linkSettore = (c: any, settore: SettoreRedditivita) => {\n          const candidati = settore === "Lavoro"\n            ? [c.utente_payroll_id, c.utente_operatore_id]\n            : [c.utente_operatore_id];\n          for (const candidate of candidati) {\n            if (!candidate) continue;\n            const u = operatoriById.get(String(candidate));\n            if (u && Array.isArray(u.settori) && u.settori.includes(settore)) {\n              return { id: String(u.id), nome: nomeOperatore(u.id) };\n            }\n          }\n          return null;\n        };\n\n        const clienti = (clientiFastResult.data || []).map((c: any) => {\n          const metriche = summary.get(String(c.id)) || { Fiscale: emptyMetric(), Consulenza: emptyMetric(), Lavoro: emptyMetric() };\n          const operatoriSettore = {\n            Fiscale: linkSettore(c, "Fiscale"),\n            Consulenza: linkSettore(c, "Consulenza"),\n            Lavoro: linkSettore(c, "Lavoro"),\n          };\n          const settoriCliente = (["Fiscale", "Consulenza", "Lavoro"] as SettoreRedditivita[]).filter((s) => Boolean(operatoriSettore[s]));\n          const totale = (["Fiscale", "Consulenza", "Lavoro"] as SettoreRedditivita[]).reduce(\n            (acc, s) => ({\n              servizi: acc.servizi + metriche[s].servizi,\n              operazioni: acc.operazioni + metriche[s].operazioni,\n              ore: acc.ore + metriche[s].ore,\n              costo: acc.costo + metriche[s].costo,\n            }),\n            emptyMetric()\n          );\n          return {\n            ...c,\n            settori_cliente: settoriCliente,\n            operatori_settore: operatoriSettore,\n            metriche_settore: metriche,\n            operatore_nome: operatoriSettore.Fiscale?.nome || operatoriSettore.Consulenza?.nome || operatoriSettore.Lavoro?.nome || "",\n            servizi_attivi: totale.servizi,\n            numero_operazioni: totale.operazioni,\n            ore_equivalenti: totale.ore,\n            costo_stimato: totale.costo,\n          };\n        });\n\n        return res.status(200).json({\n          success: true,\n          parametri: parametriClientiResult.data || null,\n          operatori,\n          clienti,\n        });\n      }\n\n`;
api = api.slice(0, scopeStart) + fastClientiBlock + api.slice(heavyStart);

// Overview generale: tutti gli operatori ammessi, annotati col/i settore/i.
if (!api.includes("const mappaSettoriStudio = await mappaSettoriOperatori(studioId);")) {
  api = replaceOrFail(
    api,
    "studio sector map",
    "      if (serviziClientiResult.error) throw serviziClientiResult.error;\n\n      const costiMap =",
    "      if (serviziClientiResult.error) throw serviziClientiResult.error;\n\n      const mappaSettoriStudio = await mappaSettoriOperatori(studioId);\n      const utentiAmmessiStudio = (utentiResult.data || []).filter((u: any) =>\n        mappaSettoriStudio.idsAmmessi.has(String(u.id))\n      );\n\n      const costiMap ="
  );
}
api = api.replace(
  "      const operatori = (utentiResult.data || []).map((u: any) => {",
  "      const operatori = utentiAmmessiStudio.map((u: any) => {"
);
api = api.replace(
  "          ...u,\n          costo,\n          payroll_capacita:",
  "          ...u,\n          settori: mappaSettoriStudio.settoriByUser.get(String(u.id)) || [],\n          costo,\n          payroll_capacita:"
);
api = api.replace(
  "        if (!key) continue;\n        const current = carichiMap.get(key)",
  "        if (!key || !mappaSettoriStudio.idsAmmessi.has(key)) continue;\n        const current = carichiMap.get(key)"
);

write(apiFile, api);

// -----------------------------------------------------------------------------
// Pagina Operatori: filtro Fiscale / Consulenza / Lavoro e percentuali sul settore.
// -----------------------------------------------------------------------------
let page = read(pageFile);

if (!page.includes('type SettoreRedditivita = "Fiscale" | "Consulenza" | "Lavoro";')) {
  page = page.replace(
    'type TabKey = "dashboard" | "costi" | "operatori" | "attivita" | "clienti" | "contratti" | "incassi" | "consuntivo";',
    'type TabKey = "dashboard" | "costi" | "operatori" | "attivita" | "clienti" | "contratti" | "incassi" | "consuntivo";\ntype SettoreRedditivita = "Fiscale" | "Consulenza" | "Lavoro";'
  );
}
if (!page.includes("  settori?: SettoreRedditivita[];")) {
  page = page.replace(
    "  settore?: string | null;\n",
    "  settore?: string | null;\n  settori?: SettoreRedditivita[];\n  ore_carico?: number;\n"
  );
}
if (!page.includes('const [settoreOperatori, setSettoreOperatori]')) {
  page = page.replace(
    '  const [operatori, setOperatori] = useState<Operatore[]>([]);',
    '  const [operatori, setOperatori] = useState<Operatore[]>([]);\n  const [settoreOperatori, setSettoreOperatori] = useState<SettoreRedditivita>("Fiscale");'
  );
}
if (!page.includes("const operatoriVisibili = useMemo")) {
  const anchor = "  const operatoriConfigurati = operatori.filter((o) => num(o.costo?.ore_produttive) > 0).length;";
  const derived = `  const operatoriVisibili = useMemo(() => {\n    const elenco = operatori.filter((o) => (o.settori || []).includes(settoreOperatori));\n    const totaleOperazioniSettore = elenco.reduce((sum, o) => sum + num(o.numero_operazioni), 0);\n    const totaleOreSettore = elenco.reduce((sum, o) => sum + num(o.ore_carico), 0);\n    return elenco.map((o) => ({\n      ...o,\n      percentuale_operazioni_studio: totaleOperazioniSettore > 0 ? (num(o.numero_operazioni) / totaleOperazioniSettore) * 100 : 0,\n      percentuale_carico_studio: totaleOreSettore > 0 ? (num(o.ore_carico) / totaleOreSettore) * 100 : 0,\n    }));\n  }, [operatori, settoreOperatori]);\n\n`;
  page = replaceOrFail(page, "operator derived", anchor, derived + anchor);
}

page = replaceSection(
  page,
  '          {tab === "operatori" && (',
  '          {tab === "attivita" && (',
  (section) => {
    if (!section.includes("Settore di analisi")) {
      const tableAnchor = '              <div className="overflow-x-auto">';
      const filter = `              <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/60 px-5 py-4 sm:flex-row sm:items-end sm:justify-between">\n                <label className="w-full max-w-xs text-sm font-semibold text-slate-700">Settore di analisi\n                  <select value={settoreOperatori} onChange={(e) => setSettoreOperatori(e.target.value as SettoreRedditivita)} className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-sky-600">\n                    <option value="Fiscale">Fiscale</option>\n                    <option value="Consulenza">Consulenza</option>\n                    <option value="Lavoro">Lavoro</option>\n                  </select>\n                </label>\n                <div className="text-sm text-slate-500">{operatoriVisibili.length} operatori · percentuali calcolate sul 100% del settore</div>\n              </div>\n`;
      section = replaceOrFail(section, "operator filter ui", tableAnchor, filter + tableAnchor);
    }
    section = section.replace("{operatori.length === 0 ? (", "{operatoriVisibili.length === 0 ? (");
    section = section.replace(" ) : operatori.map((o) => {", " ) : operatoriVisibili.map((o) => {");
    section = section.replace(") : operatori.map((o) => {", ") : operatoriVisibili.map((o) => {");
    section = section.replace(
      "Operatori e capacità produttiva</h2>",
      "Operatori e capacità produttiva</h2>"
    );
    return section;
  },
  "operatori ui"
);

write(pageFile, page);

// -----------------------------------------------------------------------------
// Clienti: filtro settore, società collegate e costi/ricavi sul singolo settore.
// -----------------------------------------------------------------------------
let clienti = read(clientiFile);

if (!clienti.includes('type SettoreRedditivita = "Fiscale" | "Consulenza" | "Lavoro";')) {
  clienti = clienti.replace(
    "type Props = {",
    'type SettoreRedditivita = "Fiscale" | "Consulenza" | "Lavoro";\n\ntype Props = {'
  );
}

if (!clienti.includes("  settori_cliente?: SettoreRedditivita[];")) {
  clienti = clienti.replace(
    "  codice_fiscale?: string | null;\n",
    `  codice_fiscale?: string | null;\n  utente_operatore_id?: string | null;\n  utente_payroll_id?: string | null;\n  operatore_nome?: string | null;\n  settori_cliente?: SettoreRedditivita[];\n  operatori_settore?: Partial<Record<SettoreRedditivita, { id: string; nome: string } | null>>;\n  metriche_settore?: Partial<Record<SettoreRedditivita, { servizi: number; operazioni: number; ore: number; costo: number }>>;\n`
  );
  // Evita duplicati eventualmente introdotti dalle patch precedenti.
  clienti = clienti.replace("  utente_operatore_id?: string | null;\n  utente_operatore_id?: string | null;\n", "  utente_operatore_id?: string | null;\n");
  clienti = clienti.replace("  operatore_nome?: string | null;\n  operatore_nome?: string | null;\n", "  operatore_nome?: string | null;\n");
}

if (!clienti.includes("  settori?: SettoreRedditivita[];")) {
  clienti = clienti.replace(
    "  email?: string | null;\n",
    "  email?: string | null;\n  settori?: SettoreRedditivita[];\n"
  );
}

if (!clienti.includes('const [settoreClienti, setSettoreClienti]')) {
  clienti = clienti.replace(
    '  const [filtroOperatore, setFiltroOperatore] = useState("");',
    '  const [filtroOperatore, setFiltroOperatore] = useState("");\n  const [settoreClienti, setSettoreClienti] = useState<SettoreRedditivita>("Fiscale");'
  );
}

if (!clienti.includes("function settoreDaAreaCliente")) {
  const helperAnchor = "function n(value: unknown) {";
  const helper = `function settoreDaAreaCliente(areaRaw: unknown): SettoreRedditivita {\n  const area = String(areaRaw || "").trim().toLowerCase();\n  if (area === "payroll" || area === "lavoro") return "Lavoro";\n  if (area === "consulenza") return "Consulenza";\n  return "Fiscale";\n}\n\n`;
  clienti = replaceOrFail(clienti, "client sector helper", helperAnchor, helper + helperAnchor);
}

// Ricostruisce filtri società/operatori in funzione del settore selezionato.
const lookupRegex = /  const operatoreLookup = useMemo\([\s\S]*?\n  const marginePercentuale =/m;
if (!lookupRegex.test(clienti)) throw new Error("[redditivita-settori] filtro operatori Clienti non trovato");
clienti = clienti.replace(
  lookupRegex,
  `  const clientiSettore = useMemo(() => {\n    return clienti\n      .filter((c) => (c.settori_cliente || []).includes(settoreClienti))\n      .map((c) => {\n        const metriche = c.metriche_settore?.[settoreClienti] || { servizi: 0, operazioni: 0, ore: 0, costo: 0 };\n        const operatore = c.operatori_settore?.[settoreClienti] || null;\n        return {\n          ...c,\n          operatore_nome: operatore?.nome || "",\n          operatore_settore_id: operatore?.id || "",\n          servizi_attivi: metriche.servizi,\n          numero_operazioni: metriche.operazioni,\n          ore_equivalenti: metriche.ore,\n          costo_stimato: metriche.costo,\n        };\n      });\n  }, [clienti, settoreClienti]);\n\n  const operatoriFiltro = useMemo(() => {\n    const ids = new Set(clientiSettore.map((c) => String(c.operatore_settore_id || "")).filter(Boolean));\n    return operatoriOverview\n      .filter((o) => (o.settori || []).includes(settoreClienti) && ids.has(String(o.id)))\n      .map((o) => ({ id: String(o.id), nome: \`${'${o.nome || ""} ${o.cognome || ""}'}\`.trim() || o.email || "" }))\n      .filter((o) => o.nome)\n      .sort((a, b) => a.nome.localeCompare(b.nome, "it"));\n  }, [clientiSettore, operatoriOverview, settoreClienti]);\n\n  const clientiFiltrati = useMemo(() => {\n    const q = filtroClienti.trim().toLowerCase();\n    return clientiSettore.filter((c) => {\n      const matchTesto = !q || [c.ragione_sociale, c.codice_fiscale].filter(Boolean).some((v) => String(v).toLowerCase().includes(q));\n      const matchOperatore = !filtroOperatore || String(c.operatore_settore_id || "") === filtroOperatore;\n      return matchTesto && matchOperatore;\n    });\n  }, [clientiSettore, filtroClienti, filtroOperatore]);\n\n  const marginePercentuale =`
);

// Servizi, attività e operatori del dettaglio sono anch'essi limitati al settore corrente.
const detailStart = clienti.indexOf("  const attivitaDisponibili = useMemo(() => {");
const detailEnd = clienti.indexOf("  async function salvaServizio()", detailStart);
if (detailStart < 0 || detailEnd < 0) throw new Error("[redditivita-settori] dettaglio servizi Clienti non trovato");
const detailBlock = `  const serviziSettore = useMemo(\n    () => servizi.filter((s) => settoreDaAreaCliente(s.attivita?.area) === settoreClienti),\n    [servizi, settoreClienti]\n  );\n\n  const operatoriSettoreCliente = useMemo(\n    () => operatori.filter((o) => (o.settori || []).includes(settoreClienti)),\n    [operatori, settoreClienti]\n  );\n\n  const attivitaDisponibili = useMemo(() => {\n    const used = new Set(servizi.map((s) => s.attivita_id));\n    return attivita.filter((a) => a.attiva && settoreDaAreaCliente(a.area) === settoreClienti && !used.has(a.id));\n  }, [attivita, servizi, settoreClienti]);\n\n  const totali = useMemo(() => ({\n    operazioni: serviziSettore.reduce((s, x) => s + n(x.quantita_driver), 0),\n    ore: serviziSettore.reduce((s, x) => s + n(x.ore_equivalenti), 0),\n    costo: serviziSettore.reduce((s, x) => s + n(x.costo_stimato), 0),\n  }), [serviziSettore]);\n\n`;
clienti = clienti.slice(0, detailStart) + detailBlock + clienti.slice(detailEnd);

// Inserisce il selettore Settore prima del filtro Operatore.
if (!clienti.includes("Settore economico")) {
  const opLabel = '          <label className="block text-sm font-semibold text-slate-700">Operatore';
  const sectorLabel = `          <label className="block text-sm font-semibold text-slate-700">Settore economico\n            <select value={settoreClienti} onChange={(e) => {\n              const settore = e.target.value as SettoreRedditivita;\n              setSettoreClienti(settore);\n              setFiltroOperatore("");\n              setSelectedId("");\n              setCliente(null);\n              setServizi([]);\n              setOperatori([]);\n              if (typeof window !== "undefined") window.sessionStorage.removeItem(SELECTED_CLIENT_KEY);\n            }} className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-sky-600">\n              <option value="Fiscale">Fiscale</option>\n              <option value="Consulenza">Consulenza</option>\n              <option value="Lavoro">Lavoro</option>\n            </select>\n          </label>\n`;
  clienti = replaceOrFail(clienti, "client sector select", opLabel, sectorLabel + opLabel);
}

// Usa solo i servizi e gli operatori del settore nel dettaglio.
clienti = clienti.replaceAll("servizi.length === 0", "serviziSettore.length === 0");
clienti = clienti.replaceAll("servizi.map((s) => <ServiceRow", "serviziSettore.map((s) => <ServiceRow");
clienti = clienti.replaceAll("operatori.filter((o) => n(o.numero_operazioni)", "operatoriSettoreCliente.filter((o) => n(o.numero_operazioni)");
clienti = clienti.replaceAll("{operatori.map((o) => (", "{operatoriSettoreCliente.map((o) => (");

// Conteggio società e testo esplicativo sul settore.
clienti = clienti.replaceAll("${clienti.length} clienti attivi disponibili", "${clientiFiltrati.length} clienti attivi disponibili");
clienti = clienti.replaceAll("${clienti.length} clienti disponibili", "${clientiFiltrati.length} clienti disponibili");
clienti = clienti.replace(
  '<Summary label="Costo stimato" value={euro(riepilogoFiltrato.costo)} />',
  '<Summary label={`Costo ${settoreClienti}`} value={euro(riepilogoFiltrato.costo)} />'
);
clienti = clienti.replace(
  '<Summary label="Ricavi stimati" value={euro(riepilogoFiltrato.ricavi)} />',
  '<Summary label={`Ricavo previsto ${settoreClienti}`} value={euro(riepilogoFiltrato.ricavi)} />'
);
clienti = clienti.replace(
  '<Summary label="Margine stimato" value={euro(riepilogoFiltrato.margine)} />',
  '<Summary label={`Margine ${settoreClienti}`} value={euro(riepilogoFiltrato.margine)} />'
);

write(clientiFile, clienti);

console.log("✓ Redditività Studio: filtri Fiscale/Consulenza/Lavoro e percentuali economiche per settore applicati");
