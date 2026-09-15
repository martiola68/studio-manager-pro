import fs from "node:fs";

const printPath = "src/pages/antiriciclaggio/stampa-av4.tsx";
const publicPath = "src/pages/compilazione-av4/[token].tsx";

let printSource = fs.readFileSync(printPath, "utf8");
let publicSource = fs.readFileSync(publicPath, "utf8");

function replaceOnce(source, from, to, label) {
  if (source.includes(to)) return source;
  if (!source.includes(from)) {
    throw new Error(`[AV4 public print] Anchor non trovato: ${label}`);
  }
  return source.replace(from, to);
}

printSource = replaceOnce(
  printSource,
  `  const { id } = router.query;`,
  `  const { id } = router.query;\n  const publicToken = typeof router.query.token === "string" ? router.query.token : "";`,
  "token query stampa normale"
);

printSource = replaceOnce(
  printSource,
  `    if (!router.isReady || !id) return;`,
  `    if (!router.isReady || (!id && !publicToken)) return;`,
  "guard stampa normale/pubblica"
);

const tryAnchor = `      try {\n        const supabase = getSupabaseClient() as any;`;
const tryReplacement = `      try {\n        if (publicToken) {\n          const response = await fetch(\`/api/public/av4/stampa?token=\${encodeURIComponent(publicToken)}\`, {\n            cache: "no-store",\n          });\n          const payload = await response.json();\n\n          if (!response.ok || !payload?.ok || !payload?.av4) {\n            setError(payload?.error || "Record AV4 pubblico non trovato.");\n            return;\n          }\n\n          setRecord(payload.av4 as AV4Row);\n          setCliente((payload.cliente as ClienteRow) || null);\n          setRappresentante((payload.rappresentante as RappresentanteRow) || null);\n          setTitolari((payload.titolari as TitolareRow[]) || []);\n          return;\n        }\n\n        const supabase = getSupabaseClient() as any;`;
printSource = replaceOnce(
  printSource,
  tryAnchor,
  tryReplacement,
  "caricamento token pubblico nella stampa normale"
);

printSource = replaceOnce(
  printSource,
  `  }, [router.isReady, id]);`,
  `  }, [router.isReady, id, publicToken]);`,
  "dipendenze useEffect stampa"
);

publicSource = replaceOnce(
  publicSource,
  `  function handlePrintPdf() {\n    window.print();\n  }`,
  `  function handlePrintPdf() {\n    if (!token) {\n      alert("Link pubblico AV4 non valido.");\n      return;\n    }\n\n    window.open(\n      \`/antiriciclaggio/stampa-av4?token=\${encodeURIComponent(token)}\`,\n      "_blank",\n      "noopener,noreferrer"\n    );\n  }`,
  "pulsante stampa pubblico"
);

fs.writeFileSync(printPath, printSource, "utf8");
fs.writeFileSync(publicPath, publicSource, "utf8");

console.log("✓ AV4 pubblico: la stampa usa esattamente il format della stampa AV4 normale");
