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

const draftKeyExpr = '`av4-public-print-draft:${token}`';

// -----------------------------------------------------------------------------
// STAMPA PUBBLICA: copia reale del format della stampa AV4 normale.
// Cambia solo la sorgente dati: token pubblico -> API pubblica sicura.
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

const publicEffect = `  useEffect(() => {\n    if (!router.isReady || !token) return;\n\n    const load = async () => {\n      setLoading(true);\n      setError(null);\n\n      try {\n        const response = await fetch(\n          \`/api/public/av4/stampa?token=\${encodeURIComponent(token)}\`,\n          { cache: "no-store" }\n        );\n        const payload = await response.json();\n\n        if (!response.ok || !payload?.ok || !payload?.av4) {\n          setError(payload?.error || "Record AV4 pubblico non trovato.");\n          return;\n        }\n\n        let recordForPrint = payload.av4 as AV4Row;\n        try {\n          const rawDraft = window.sessionStorage.getItem(${draftKeyExpr});\n          if (rawDraft) {\n            const draft = JSON.parse(rawDraft);\n            recordForPrint = { ...recordForPrint, ...draft } as AV4Row;\n          }\n        } catch (draftError) {\n          console.warn("Impossibile leggere il draft AV4 per la stampa:", draftError);\n        }\n\n        setRecord(recordForPrint);\n        setCliente((payload.cliente as ClienteRow) || null);\n        setRappresentante((payload.rappresentante as RappresentanteRow) || null);\n        setTitolari((payload.titolari as TitolareRow[]) || []);\n      } catch (err: any) {\n        setError(err?.message || "Errore caricamento stampa AV4 pubblico.");\n      } finally {\n        setLoading(false);\n      }\n    };\n\n    void load();\n  }, [router.isReady, token]);`;

publicPrintSource =
  publicPrintSource.slice(0, startIndex) +
  publicEffect +
  publicPrintSource.slice(endIndex + effectEnd.length);

// Appena i dati sono caricati apre direttamente il dialogo nativo di stampa.
// Dopo Salva o Annulla torna al modello AV4 NELLA STESSA SCHEDA.
const renderAnchor = `  if (loading) {`;
const autoPrintEffect = `  useEffect(() => {\n    if (loading || error || !record || !token || autoPrintStarted.current) return;\n\n    autoPrintStarted.current = true;\n\n    const tornaAlModello = () => {\n      window.removeEventListener("afterprint", tornaAlModello);\n      window.location.replace(\n        \`/compilazione-av4/\${encodeURIComponent(token)}\`\n      );\n    };\n\n    window.addEventListener("afterprint", tornaAlModello);\n\n    const timer = window.setTimeout(() => {\n      window.print();\n    }, 150);\n\n    return () => {\n      window.clearTimeout(timer);\n      window.removeEventListener("afterprint", tornaAlModello);\n    };\n  }, [loading, error, record, token]);\n\n`;

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

// Nessuna toolbar/pagina intermedia: il dialogo stampa parte automaticamente.
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
// FORM PUBBLICO: salva temporaneamente i dati non ancora confermati, poi naviga
// alla stampa NELLA STESSA SCHEDA. Al ritorno il draft viene ripristinato.
// -----------------------------------------------------------------------------
publicFormSource = replaceOnce(
  publicFormSource,
  `        const mapped = mapDbRowToForm(data);\n       setForm(mapped);`,
  `        const mapped = mapDbRowToForm(data);\n        let restored = mapped;\n\n        try {\n          const rawDraft = window.sessionStorage.getItem(${draftKeyExpr});\n          if (rawDraft) {\n            const draft = JSON.parse(rawDraft);\n            restored = {\n              ...mapped,\n              ...draft,\n              id: mapped.id,\n              public_token: mapped.public_token,\n              public_enabled: mapped.public_enabled,\n              studio_id: mapped.studio_id,\n              cliente_id: mapped.cliente_id,\n              av1_id: mapped.av1_id,\n              compilato_da_cliente: mapped.compilato_da_cliente,\n              public_opened_at: mapped.public_opened_at,\n              public_submitted_at: mapped.public_submitted_at,\n              pdf_firmato_cliente: mapped.pdf_firmato_cliente,\n              allegato_pdf_cliente: mapped.allegato_pdf_cliente,\n            };\n          }\n        } catch (draftError) {\n          console.warn("Impossibile ripristinare il draft AV4 dopo la stampa:", draftError);\n        }\n\n        setForm(restored);`,
  "ripristino draft pubblico dopo stampa"
);

publicFormSource = replaceOnce(
  publicFormSource,
  `  function handlePrintPdf() {\n    window.print();\n  }`,
  `  function handlePrintPdf() {\n    if (!token) {\n      alert("Link pubblico AV4 non valido.");\n      return;\n    }\n\n    try {\n      window.sessionStorage.setItem(${draftKeyExpr}, JSON.stringify(form));\n    } catch (draftError) {\n      console.warn("Impossibile salvare temporaneamente il modello AV4:", draftError);\n    }\n\n    window.location.assign(\n      \`/compilazione-av4/stampa/\${encodeURIComponent(token)}\`\n    );\n  }`,
  "pulsante stampa pubblico stessa scheda"
);

// Quando il modello viene completato definitivamente, il draft temporaneo non serve più.
publicFormSource = replaceOnce(
  publicFormSource,
  `      alert("AV4 completato correttamente. Il link non è più riutilizzabile.");\n      setNotFound(true);`,
  `      try {\n        window.sessionStorage.removeItem(${draftKeyExpr});\n      } catch {}\n\n      alert("AV4 completato correttamente. Il link non è più riutilizzabile.");\n      setNotFound(true);`,
  "pulizia draft dopo salva e chiudi"
);

fs.writeFileSync(publicFormPath, publicFormSource, "utf8");

// Verifiche di sicurezza e comportamento.
const normalAfter = fs.readFileSync(normalPrintPath, "utf8");
if (normalAfter !== normalSource) {
  throw new Error("[AV4 public print] La stampa AV4 normale è stata modificata: operazione annullata");
}
if (publicFormSource.includes("window.open(")) {
  throw new Error("[AV4 public print] È ancora presente window.open: la stampa aprirebbe una nuova scheda");
}
if (!publicFormSource.includes("window.location.assign(")) {
  throw new Error("[AV4 public print] Navigazione stessa scheda non applicata");
}
if (!publicPrintSource.includes("window.location.replace(")) {
  throw new Error("[AV4 public print] Ritorno al modello nella stessa scheda non applicato");
}
if (!publicPrintSource.includes("window.print();")) {
  throw new Error("[AV4 public print] Auto-apertura dialogo stampa non applicata");
}
if (publicPrintSource.includes('className="no-print mx-auto flex max-w-6xl')) {
  throw new Error("[AV4 public print] Toolbar intermedio ancora presente nella stampa pubblica");
}

console.log("✓ AV4 pubblico: stampa e ritorno al modello nella stessa scheda, con draft preservato");
