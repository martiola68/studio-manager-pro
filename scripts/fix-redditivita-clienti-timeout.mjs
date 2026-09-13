import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function patch(rel, fn) {
  const file = path.join(root, rel);
  const src = fs.readFileSync(file, "utf8");
  const out = fn(src);
  if (out === src) {
    console.log(`↷ ${rel} già ottimizzato`);
    return;
  }
  fs.writeFileSync(file, out, "utf8");
  console.log(`✓ ${rel}`);
}

// La pagina principale non deve caricare il pesante overview quando la scheda attiva
// ha già un proprio endpoint/loader (Clienti, Compensi, Incassi).
patch("src/pages/controllo-gestione/redditivita-studio.tsx", (source) => {
  const oldEffect = `  useEffect(() => {\n    if (!studioId) return;\n    caricaDati(studioId, anno);\n  }, [studioId, anno]);`;
  const newEffect = `  useEffect(() => {\n    if (!studioId || !tabReady) return;\n    if (!["dashboard", "costi", "operatori", "attivita"].includes(tab)) return;\n    caricaDati(studioId, anno);\n  }, [studioId, anno, tab, tabReady]);`;
  if (source.includes(oldEffect)) source = source.replace(oldEffect, newEffect);
  return source;
});

// Clienti: prima carica l'elenco; solo dopo ricarica il cliente memorizzato.
// Dopo i salvataggi evita Promise.all sullo stesso endpoint.
patch("src/components/controllo-gestione/RedditivitaClientiTab.tsx", (source) => {
  const concurrentEffect = `  useEffect(() => {\n    if (!studioId) return;\n    const saved = typeof window !== "undefined" ? window.sessionStorage.getItem(SELECTED_CLIENT_KEY) || "" : "";\n    loadOverview();\n    if (saved) {\n      setSelectedId(saved);\n      loadCliente(saved);\n    }\n  }, [studioId, anno]);`;
  const sequentialEffect = `  useEffect(() => {\n    if (!studioId) return;\n    let active = true;\n    (async () => {\n      const saved = typeof window !== "undefined" ? window.sessionStorage.getItem(SELECTED_CLIENT_KEY) || "" : "";\n      await loadOverview();\n      if (active && saved) {\n        setSelectedId(saved);\n        await loadCliente(saved, true);\n      }\n    })();\n    return () => { active = false; };\n  }, [studioId, anno]);`;
  if (source.includes(concurrentEffect)) source = source.replace(concurrentEffect, sequentialEffect);

  source = source.replace(
    `  async function refresh() {\n    await Promise.all([loadOverview(true), selectedId ? loadCliente(selectedId, true) : Promise.resolve()]);\n  }`,
    `  async function refresh() {\n    await loadOverview(true);\n    if (selectedId) await loadCliente(selectedId, true);\n  }`
  );
  return source;
});

// Compensi: niente doppia chiamata overview + dettaglio simultanea.
patch("src/components/controllo-gestione/RedditivitaCompensiTab.tsx", (source) => {
  const concurrentEffect = `  useEffect(() => {\n    if (!studioId) return;\n    const saved = typeof window !== "undefined" ? window.sessionStorage.getItem(COMPENSI_SELECTED_KEY) || "" : "";\n    loadOverview();\n    if (saved) loadDetail(saved);\n  }, [studioId, anno]);`;
  const sequentialEffect = `  useEffect(() => {\n    if (!studioId) return;\n    let active = true;\n    (async () => {\n      const saved = typeof window !== "undefined" ? window.sessionStorage.getItem(COMPENSI_SELECTED_KEY) || "" : "";\n      await loadOverview();\n      if (active && saved) await loadDetail(saved);\n    })();\n    return () => { active = false; };\n  }, [studioId, anno]);`;
  if (source.includes(concurrentEffect)) source = source.replace(concurrentEffect, sequentialEffect);

  source = source.replace(
    `      await Promise.all([loadDetail(selectedId), loadOverview()]);`,
    `      await loadOverview();\n      await loadDetail(selectedId);`
  );
  return source;
});

// Incassi: stesso criterio, una richiesta alla volta.
patch("src/components/controllo-gestione/RedditivitaIncassiTab.tsx", (source) => {
  const concurrentEffect = `  useEffect(() => {\n    if (!studioId) return;\n    const saved = typeof window !== "undefined" ? window.sessionStorage.getItem(INCASSI_SELECTED_KEY) || "" : "";\n    loadOverview();\n    if (saved) loadContratto(saved);\n  }, [studioId, anno]);`;
  const sequentialEffect = `  useEffect(() => {\n    if (!studioId) return;\n    let active = true;\n    (async () => {\n      const saved = typeof window !== "undefined" ? window.sessionStorage.getItem(INCASSI_SELECTED_KEY) || "" : "";\n      await loadOverview();\n      if (active && saved) await loadContratto(saved);\n    })();\n    return () => { active = false; };\n  }, [studioId, anno]);`;
  if (source.includes(concurrentEffect)) source = source.replace(concurrentEffect, sequentialEffect);

  source = source.replace(
    `  async function refresh() {\n    await Promise.all([loadOverview(), selectedId ? loadContratto(selectedId) : Promise.resolve()]);\n  }`,
    `  async function refresh() {\n    await loadOverview();\n    if (selectedId) await loadContratto(selectedId);\n  }`
  );
  return source;
});

console.log("✓ Redditività Studio: eliminate richieste duplicate e timeout clienti");
