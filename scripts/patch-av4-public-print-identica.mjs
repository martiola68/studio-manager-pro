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

// Testo caricamento specifico, senza alterare il format grafico/documentale.
publicPrintSource = publicPrintSource.replace(
  "Caricamento stampa AV4...",
  "Caricamento stampa AV4..."
);

fs.mkdirSync(path.dirname(publicPrintPath), { recursive: true });
fs.writeFileSync(publicPrintPath, publicPrintSource, "utf8");

// -----------------------------------------------------------------------------
// FORM PUBBLICO: il pulsante apre la COPIA PUBBLICA del documento, non l'area AML.
// -----------------------------------------------------------------------------
publicFormSource = replaceOnce(
  publicFormSource,
  `  function handlePrintPdf() {\n    window.print();\n  }`,
  `  function handlePrintPdf() {\n    if (!token) {\n      alert("Link pubblico AV4 non valido.");\n      return;\n    }\n\n    window.open(\n      \`/compilazione-av4/stampa/\${encodeURIComponent(token)}\`,\n      "_blank",\n      "noopener,noreferrer"\n    );\n  }`,
  "pulsante stampa pubblico"
);

fs.writeFileSync(publicFormPath, publicFormSource, "utf8");

// Verifiche di sicurezza: la pagina interna deve restare intatta e il pubblico
// non deve mai puntare a /antiriciclaggio/stampa-av4.
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

console.log("✓ AV4 pubblico: format copiato dalla stampa normale in pagina pubblica autonoma, senza controllo licenza AML");
