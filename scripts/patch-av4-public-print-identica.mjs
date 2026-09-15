import fs from "node:fs";
import path from "node:path";

const normalPrintPath = "src/pages/antiriciclaggio/stampa-av4.tsx";
const publicFormPath = "src/pages/compilazione-av4/[token].tsx";
const publicPrintPath = "src/pages/compilazione-av4/stampa/[token].tsx";

const normalSource = fs.readFileSync(normalPrintPath, "utf8");
let publicFormSource = fs.readFileSync(publicFormPath, "utf8");
let publicPrintSource = normalSource;

function replaceOnce(source, from, to, label) {
  if (source.includes(to)) return source;
  if (!source.includes(from)) {
    throw new Error(`[AV4 public print] Anchor non trovato: ${label}`);
  }
  return source.replace(from, to);
}

// -----------------------------------------------------------------------------
// STAMPA PUBBLICA: copia reale del format della stampa AV4 normale.
// Non modifica e non richiama la pagina interna /antiriciclaggio/stampa-av4.
// Cambia esclusivamente la sorgente dati: token pubblico -> API pubblica sicura.
// -----------------------------------------------------------------------------
publicPrintSource = publicPrintSource.replace(
  'import { useEffect, useMemo, useState } from "react";',
  'import { useEffect, useMemo, useRef, useState } from "react";'
);

publicPrintSource = publicPrintSource.replace(
  'import { getSupabaseClient } from "@/lib/supabaseClient";\n',
  ""
);

publicPrintSource = replaceOnce(
  publicPrintSource,
  `export default function StampaAV4Page() {`,
  `export default function StampaAV4PubblicoPage() {`,
  "nome componente stampa pubblica"
);

publicPrintSource = replaceOnce(
  publicPrintSource,
  `  const { id } = router.query;`,
  `  const token = typeof router.query.token === "string" ? router.query.token : "";`,
  "token route stampa pubblica"
);

publicPrintSource = replaceOnce(
  publicPrintSource,
  `  const [error, setError] = useState<string | null>(null);`,
  `  const [error, setError] = useState<string | null>(null);\n  const autoPrintStarted = useRef(false);`,
  "stato auto stampa"
);

const effectStart = `  useEffect(() => {\n    if (!router.isReady || !id) return;`;
const effectEnd = `  }, [router.isReady, id]);`;
const startIndex = publicPrintSource.indexOf(effectStart);
const endIndex = publicPrintSource.indexOf(effectEnd, startIndex);

if (startIndex < 0 || endIndex < 0) {
  throw new Error("[AV4 public print] Blocco caricamento stampa normale non trovato");
}

const publicEffect = `  useEffect(() => {\n    if (!router.isReady || !token) return;\n\n    const load = async () => {\n      setLoading(true);\n      setError(null);\n\n      try {\n        const response = await fetch(\n          \`/api/public/av4/stampa?token=\${encodeURIComponent(token)}\`,\n          { cache: "no-store" }\n        );\n        const payload = await response.json();\n\n        if (!response.ok || !payload?.ok || !payload?.av4) {\n          setError(payload?.error || "Record AV4 pubblico non trovato.");\n          return;\n        }\n\n        setRecord(payload.av4 as AV4Row);\n        setCliente((payload.cliente as ClienteRow) || null);\n        setRappresentante((payload.rappresentante as RappresentanteRow) || null);\n        setTitolari((payload.titolari as TitolareRow[]) || []);\n      } catch (err: any) {\n        setError(err?.message || "Errore caricamento stampa AV4 pubblico.");\n      } finally {\n        setLoading(false);\n      }\n    };\n\n    void load();\n  }, [router.isReady, token]);`;

publicPrintSource =
  publicPrintSource.slice(0, startIndex) +
  publicEffect +
  publicPrintSource.slice(endIndex + effectEnd.length);

// Appena i dati sono caricati, apre direttamente la finestra nativa di stampa.
// Dopo Salva o Annulla chiude la scheda di stampa e torna al form AV4 rimasto aperto.
const renderAnchor = `  if (loading) {`;
const autoPrintEffect = `  useEffect(() => {\n    if (loading || error || !record || !token || autoPrintStarted.current) return;\n\n    autoPrintStarted.current = true;\n\n    const tornaAlModello = () => {\n      window.removeEventListener("afterprint", tornaAlModello);\n\n      // La pagina è stata aperta da "Stampa / Salva PDF": chiudendola\n      // il browser torna automaticamente alla scheda del modello AV4 pubblico.\n      window.close();\n\n      // Fallback per browser che impediscono window.close().\n      window.setTimeout(() => {\n        if (!window.closed) {\n          window.location.replace(\n            \`/compilazione-av4/\${encodeURIComponent(token)}\`\n          );\n        }\n      }, 250);\n    };\n\n    window.addEventListener("afterprint", tornaAlModello);\n\n    const timer = window.setTimeout(() => {\n      window.print();\n    }, 150);\n\n    return () => {\n      window.clearTimeout(timer);\n      window.removeEventListener("afterprint", tornaAlModello);\n    };\n  }, [loading, error, record, token]);\n\n`;

if (!publicPrintSource.includes(autoPrintEffect)) {
  const renderIndex = publicPrintSource.indexOf(renderAnchor);
  if (renderIndex < 0) {
    throw new Error("[AV4 public print] Anchor render/loading non trovato");
  }
  publicPrintSource =
    publicPrintSource.slice(0, renderIndex) +
    autoPrintEffect +
    publicPrintSource.slice(renderIndex);
}

// Nella copia pubblica non serve il secondo toolbar con Indietro/Stampa:
// il dialogo di stampa viene aperto automaticamente.
const toolbarStart = `        <div className="no-print mx-auto flex max-w-6xl items-center justify-between p-4">`;
const printAreaStart = `        <div id="print-area"`;
const toolbarIndex = publicPrintSource.indexOf(toolbarStart);
const printAreaIndex = publicPrintSource.indexOf(printAreaStart, toolbarIndex);
if (toolbarIndex >= 0 && printAreaIndex > toolbarIndex) {
  publicPrintSource =
    publicPrintSource.slice(0, toolbarIndex) +
    publicPrintSource.slice(printAreaIndex);
}

fs.mkdirSync(path.dirname(publicPrintPath), { recursive: true });
fs.writeFileSync(publicPrintPath, publicPrintSource, "utf8");

// -----------------------------------------------------------------------------
// FORM PUBBLICO: il pulsante apre la COPIA PUBBLICA del documento, non l'area AML.
// La pagina di stampa lancerà subito il dialogo nativo Salva/Annulla.
// -----------------------------------------------------------------------------
publicFormSource = replaceOnce(
  publicFormSource,
  `  function handlePrintPdf() {\n    window.print();\n  }`,
  `  function handlePrintPdf() {\n    if (!token) {\n      alert("Link pubblico AV4 non valido.");\n      return;\n    }\n\n    window.open(\n      \`/compilazione-av4/stampa/\${encodeURIComponent(token)}\`,\n      "_blank",\n      "noopener,noreferrer"\n    );\n  }`,
  "pulsante stampa pubblico"
);

fs.writeFileSync(publicFormPath, publicFormSource, "utf8");

// Verifiche di sicurezza e comportamento.
const normalAfter = fs.readFileSync(normalPrintPath, "utf8");
if (normalAfter !== normalSource) {
  throw new Error("[AV4 public print] La stampa AV4 normale è stata modificata: operazione annullata");
}
if (publicFormSource.includes("/antiriciclaggio/stampa-av4?token=")) {
  throw new Error("[AV4 public print] Il form pubblico punta ancora alla stampa AML interna");
}
if (!publicPrintSource.includes("/api/public/av4/stampa?token=")) {
  throw new Error("[AV4 public print] La copia pubblica non usa l'API token dedicata");
}
if (!publicPrintSource.includes("window.print();")) {
  throw new Error("[AV4 public print] Auto-apertura dialogo stampa non applicata");
}
if (publicPrintSource.includes('className="no-print mx-auto flex max-w-6xl')) {
  throw new Error("[AV4 public print] Toolbar intermedio ancora presente nella stampa pubblica");
}

console.log("✓ AV4 pubblico: un click apre direttamente il dialogo stampa; alla chiusura torna al modello AV4");
