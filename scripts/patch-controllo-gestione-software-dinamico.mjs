import fs from "node:fs";

const indexPath = "src/pages/controllo-gestione/piani-conti/index.tsx";
const creaPath = "src/pages/controllo-gestione/piani-conti/crea-master.tsx";
const apiPath = "src/pages/api/controllo-gestione/crea-master-generico.ts";

function replaceRequired(source, from, to, label) {
  if (source.includes(to)) return source;
  if (!source.includes(from)) {
    throw new Error(`[software dinamico] Anchor non trovato: ${label}`);
  }
  return source.replace(from, to);
}

function replaceRegexRequired(source, regex, to, label) {
  if (!regex.test(source)) {
    throw new Error(`[software dinamico] Anchor regex non trovato: ${label}`);
  }
  return source.replace(regex, to);
}

// -----------------------------------------------------------------------------
// PAGINA ELENCO: software dinamici + Nuovo software / Altro
// -----------------------------------------------------------------------------
let index = fs.readFileSync(indexPath, "utf8");

index = replaceRequired(
  index,
  `function softwareLabel(value: string) {\n  return (\n    softwareDisponibili.find((item) => item.value === value)?.label ||\n    value ||\n    "Altro"\n  );\n}`,
  `function softwareLabel(value: string) {\n  const noto = softwareDisponibili.find((item) => item.value === value)?.label;\n  if (noto) return noto;\n\n  const pulito = String(value || "")\n    .trim()\n    .replace(/[_-]+/g, " ")\n    .replace(/\\s+/g, " ");\n\n  if (!pulito) return "Altro";\n\n  return pulito\n    .split(" ")\n    .map((parte) => parte ? parte.charAt(0).toUpperCase() + parte.slice(1) : parte)\n    .join(" ");\n}\n\nfunction softwareKey(value: string) {\n  return String(value || "")\n    .trim()\n    .toLowerCase()\n    .normalize("NFD")\n    .replace(/[\\u0300-\\u036f]/g, "")\n    .replace(/[^a-z0-9]+/g, "_")\n    .replace(/^_+|_+$/g, "");\n}`,
  "helper software dinamico"
);

index = replaceRequired(
  index,
  `  const [softwareNuovo, setSoftwareNuovo] = useState("datev_koinos");\n  const [ricerca, setRicerca] = useState("");`,
  `  const [softwareNuovo, setSoftwareNuovo] = useState("datev_koinos");\n  const [nuovoSoftwareNome, setNuovoSoftwareNome] = useState("");\n  const [ricerca, setRicerca] = useState("");`,
  "stato nuovo software"
);

index = replaceRequired(
  index,
  `  const modelliAttivi = modelli.filter((modello) => modello.attivo).length;`,
  `  const softwareMenu = useMemo(() => {\n    const mappa = new Map(softwareDisponibili.map((item) => [item.value, item.label]));\n\n    for (const modello of modelli) {\n      const value = String(modello.software_contabile || "").trim();\n      if (value && !mappa.has(value)) {\n        mappa.set(value, softwareLabel(value));\n      }\n    }\n\n    return Array.from(mappa.entries())\n      .map(([value, label]) => ({ value, label }))\n      .sort((a, b) => a.label.localeCompare(b.label, "it"));\n  }, [modelli]);\n\n  function apriNuovoModello() {\n    setErrore("");\n\n    let softwareFinale = softwareNuovo;\n\n    if (softwareNuovo === "__nuovo__") {\n      softwareFinale = softwareKey(nuovoSoftwareNome);\n\n      if (!softwareFinale) {\n        setErrore("Inserisci il nome del nuovo software contabile.");\n        return;\n      }\n    }\n\n    void router.push(\n      \`/controllo-gestione/piani-conti/crea-master?software=\${encodeURIComponent(softwareFinale)}\`\n    );\n  }\n\n  const modelliAttivi = modelli.filter((modello) => modello.attivo).length;`,
  "menu software dinamico"
);

index = replaceRequired(
  index,
  `              {softwareDisponibili.map((software) => (\n                <option key={software.value} value={software.value}>\n                  {software.label}\n                </option>\n              ))}\n            </select>\n\n            <button`,
  `              {softwareMenu.map((software) => (\n                <option key={software.value} value={software.value}>\n                  {software.label}\n                </option>\n              ))}\n              <option value="__nuovo__">+ Nuovo software / Altro</option>\n            </select>\n\n            {softwareNuovo === "__nuovo__" && (\n              <input\n                value={nuovoSoftwareNome}\n                onChange={(event) => setNuovoSoftwareNome(event.target.value)}\n                placeholder="Es. PROFIS, B.Point, Mexal..."\n                style={{ ...searchStyle, width: 220 }}\n                aria-label="Nome nuovo software contabile"\n                autoFocus\n              />\n            )}\n\n            <button`,
  "opzione nuovo software"
);

index = replaceRegexRequired(
  index,
  /onClick=\{\(\) =>\s*router\.push\(\s*`\/controllo-gestione\/piani-conti\/crea-master\?software=\$\{encodeURIComponent\(\s*softwareNuovo\s*\)\}`\s*\)\s*\}/m,
  `onClick={apriNuovoModello}`,
  "azione nuovo modello dinamica"
);

fs.writeFileSync(indexPath, index, "utf8");

// -----------------------------------------------------------------------------
// CREAZIONE MODELLO: accetta qualsiasi software non vuoto
// -----------------------------------------------------------------------------
let crea = fs.readFileSync(creaPath, "utf8");

crea = replaceRegexRequired(
  crea,
  /type Software =\s*\| "datev_koinos"\s*\| "zucchetti"\s*\| "teamsystem"\s*\| "ipsoa";\s*/m,
  "",
  "rimozione union software chiusa"
);

crea = replaceRequired(
  crea,
  `    case "zucchetti":\n      return "Zucchetti";`,
  `    case "datev_koinos":\n      return "DATEV KOINOS";\n\n    case "zucchetti":\n      return "Zucchetti";`,
  "label DATEV"
);

crea = replaceRequired(
  crea,
  `    default:\n      return software;`,
  `    default:\n      return String(software || "")\n        .trim()\n        .replace(/[_-]+/g, " ")\n        .replace(/\\s+/g, " ")\n        .split(" ")\n        .map((parte) => parte ? parte.charAt(0).toUpperCase() + parte.slice(1) : parte)\n        .join(" ");`,
  "label software custom"
);

crea = replaceRegexRequired(
  crea,
  /const software =\s*\[\s*"datev_koinos",\s*"zucchetti",\s*"teamsystem",\s*"ipsoa",\s*\]\.includes\(softwareQuery\)\s*\? \(softwareQuery as Software\)\s*:\s*null;/m,
  `const software = softwareQuery.trim() || null;`,
  "software libero da query"
);

crea = crea.replaceAll("Crea piano dei conti", "Crea modello di raccordo");
crea = crea.replaceAll("Crea il master contabile dello studio partendo da un file reale del gestionale.", "Crea un modello di raccordo riutilizzabile partendo da un piano dei conti reale del software sorgente.");
crea = crea.replaceAll("Nome master", "Nome modello");
crea = crea.replaceAll("nome del master", "nome del modello");
crea = crea.replaceAll("Master creato correttamente", "Modello di raccordo creato correttamente");

fs.writeFileSync(creaPath, crea, "utf8");

// -----------------------------------------------------------------------------
// API: software_contabile diventa stringa libera, validata solo come non vuota
// -----------------------------------------------------------------------------
let api = fs.readFileSync(apiPath, "utf8");

api = replaceRegexRequired(
  api,
  /software_contabile:\s*\| "zucchetti"\s*\| "teamsystem"\s*\| "ipsoa";/m,
  `software_contabile: string;`,
  "tipo API software libero"
);

api = replaceRegexRequired(
  api,
  /\n\s*if \(\s*!\[\s*"zucchetti",\s*"teamsystem",\s*"ipsoa",\s*\]\.includes\(\s*software_contabile\s*\)\s*\) \{[\s\S]*?"Software contabile non supportato",[\s\S]*?\}\);\s*\}\n/m,
  "\n",
  "rimozione whitelist API"
);

api = replaceRequired(
  api,
  `        software_contabile,\n\n        nome:`,
  `        software_contabile: String(software_contabile).trim(),\n\n        nome:`,
  "normalizzazione software API"
);

api = api.replaceAll("Esiste già un master con questo nome per il software selezionato", "Esiste già un modello di raccordo con questo nome per il software selezionato");
api = api.replaceAll("Nome master obbligatorio", "Nome modello obbligatorio");
api = api.replaceAll("Master creato da file per", "Modello di raccordo creato da file per");

fs.writeFileSync(apiPath, api, "utf8");

// Verifiche finali.
const indexCheck = fs.readFileSync(indexPath, "utf8");
const creaCheck = fs.readFileSync(creaPath, "utf8");
const apiCheck = fs.readFileSync(apiPath, "utf8");

if (!indexCheck.includes('+ Nuovo software / Altro')) {
  throw new Error("[software dinamico] Opzione Nuovo software non applicata");
}
if (!indexCheck.includes("softwareMenu")) {
  throw new Error("[software dinamico] Menu dinamico non applicato");
}
if (creaCheck.includes("as Software")) {
  throw new Error("[software dinamico] La pagina creazione usa ancora il tipo software chiuso");
}
if (apiCheck.includes("Software contabile non supportato")) {
  throw new Error("[software dinamico] Whitelist API ancora presente");
}

console.log("✓ Controllo di gestione: software dinamici e Nuovo software / Altro abilitati");
