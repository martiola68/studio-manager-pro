import fs from "node:fs";

const path = "src/components/pratiche/forms/FormNominaOrganoControllo.tsx";
let source = fs.readFileSync(path, "utf8");

if (!source.includes('origine_azione?: "nomina" | "conferma";')) {
  source = source.replace(
    `  compenso_lordo: string;\n};`,
    `  compenso_lordo: string;\n  source_organo_id?: string;\n  origine_azione?: "nomina" | "conferma";\n};`
  );
}

if (!source.includes(`origine_azione: "nomina"`)) {
  source = source.replace(
    `    compenso_lordo: "",\n  };`,
    `    compenso_lordo: "",\n    source_organo_id: "",\n    origine_azione: "nomina",\n  };`
  );
}

if (!source.includes("function handleDecisioneOrganoChange")) {
  const anchor = `  function applicaNominativo(id: string) {`;
  if (!source.includes(anchor)) throw new Error("[conferma prefill] anchor applicaNominativo non trovato");

  const helpers = `  function normalizzaCaricaEsistente(organo: any) {\n    const testo = String(\`${'${organo?.carica || ""} ${organo?.ruolo || ""}'}\`).toLowerCase();\n    if (testo.includes("presidente") && testo.includes("sindac")) return "Presidente del collegio sindacale";\n    if (testo.includes("supplente")) return "Sindaco supplente";\n    if (testo.includes("sindaco unico")) return "Sindaco unico";\n    if (testo.includes("sindac")) return "Sindaco effettivo";\n    if (testo.includes("società") && testo.includes("revis")) return "Società di revisione";\n    if (testo.includes("societa") && testo.includes("revis")) return "Società di revisione";\n    if (testo.includes("revis")) return "Revisore legale";\n    return "Revisore legale";\n  }\n\n  function precompilaConferma(organo: any) {\n    const sourceId = String(organo?.id || "");\n    const giaInserita = nomine.find(\n      (item) => item.origine_azione === "conferma" && item.source_organo_id === sourceId\n    );\n\n    if (giaInserita) {\n      setNuovaNomina(giaInserita);\n      return;\n    }\n\n    const nome =\n      organo?.nominativo_nome ||\n      organo?.soggetto_cliente?.ragione_sociale ||\n      "";\n    const codiceFiscale =\n      organo?.nominativo_codice_fiscale ||\n      organo?.soggetto_cliente?.codice_fiscale ||\n      "";\n    const partitaIva = organo?.soggetto_cliente?.partita_iva || "";\n    const durataAnni = organo?.durata_carica_anni\n      ? String(organo.durata_carica_anni)\n      : "";\n    const dataScadenza = organo?.data_scadenza || "";\n\n    setNuovaNomina({\n      id: "",\n      nominativo_id: String(organo?.soggetto_cliente_id || ""),\n      nome,\n      codice_fiscale: codiceFiscale,\n      partita_iva: partitaIva,\n      qualifica: organo?.qualifica || "",\n      carica: normalizzaCaricaEsistente(organo),\n      data_inizio: organo?.data_nomina || form.data_atto || "",\n      durata_tipo: durataAnni ? "ANNI" : dataScadenza ? "DATA_FINE" : "APPROVAZIONE_BILANCIO",\n      data_fine: dataScadenza,\n      bilancio_chiuso_al: "",\n      durata_anni: durataAnni,\n      compenso_lordo: organo?.compenso_lordo ? String(organo.compenso_lordo) : "",\n      source_organo_id: sourceId,\n      origine_azione: "conferma",\n    });\n  }\n\n  function handleDecisioneOrganoChange(organo: any, azione: AzioneOrgano) {\n    const organoId = String(organo.id);\n    const precedente = decisioni[organoId];\n    setDecisione(organoId, {\n      azione,\n      data_effetto:\n        azione === "RIMOZIONE"\n          ? precedente?.data_effetto || form.data_atto || ""\n          : precedente?.data_effetto || "",\n    });\n\n    if (azione === "CONFERMA") {\n      precompilaConferma(organo);\n    }\n  }\n\n`;
  source = source.replace(anchor, helpers + anchor);
}

source = source.replace(
  /onChange=\{\(e\) => setDecisione\(String\(o\.id\), \{ azione: e\.target\.value as AzioneOrgano, data_effetto: e\.target\.value === "RIMOZIONE" \? decisione\.data_effetto \|\| form\.data_atto : decisione\.data_effetto \}\)\}/g,
  `onChange={(e) => handleDecisioneOrganoChange(o, e.target.value as AzioneOrgano)}`
);

const oldAdd = `    setNomine((prev) => [...prev, { ...nuovaNomina, id: crypto.randomUUID() }]);\n    setNuovaNomina(nuovaNominaVuota());`;
const newAdd = `    const voce = { ...nuovaNomina, id: nuovaNomina.id || crypto.randomUUID() };\n\n    if (voce.origine_azione === "conferma" && voce.source_organo_id) {\n      setNomine((prev) => [\n        ...prev.filter(\n          (item) =>\n            !(\n              item.origine_azione === "conferma" &&\n              item.source_organo_id === voce.source_organo_id\n            )\n        ),\n        voce,\n      ]);\n    } else {\n      setNomine((prev) => [...prev, voce]);\n    }\n\n    setNuovaNomina(nuovaNominaVuota());`;
if (source.includes(oldAdd)) source = source.replace(oldAdd, newAdd);

const oldMetaStart = `      const nominativoId = await assicuraNominativo(nome, cf);\n      const meta: MetaSoggetto = {\n        workflow: "nomina_organo_controllo",\n        azione: decisione.azione === "CONFERMA" ? "conferma" : "rimozione",`;
const newMetaStart = `      const nominativoId = await assicuraNominativo(nome, cf);\n      const dettaglioConferma = nomine.find(\n        (item) =>\n          item.origine_azione === "conferma" &&\n          item.source_organo_id === String(organo.id)\n      );\n      const meta: MetaSoggetto = {\n        workflow: "nomina_organo_controllo",\n        azione: decisione.azione === "CONFERMA" ? "conferma" : "rimozione",`;
if (source.includes(oldMetaStart)) source = source.replace(oldMetaStart, newMetaStart);

source = source.replace(
  `        data_inizio: organo.data_nomina || "",\n        data_effetto:\n          decisione.azione === "RIMOZIONE"\n            ? decisione.data_effetto || form.data_atto || ""\n            : "",\n        motivo: decisione.motivo || "",\n        durata_tipo: organo.durata_carica === "anni" ? "ANNI" : undefined,\n        data_fine: organo.data_scadenza || "",\n        durata_anni: organo.durata_carica_anni ? String(organo.durata_carica_anni) : "",`,
  `        qualifica: dettaglioConferma?.qualifica || "",\n        data_inizio: dettaglioConferma?.data_inizio || organo.data_nomina || "",\n        data_effetto:\n          decisione.azione === "RIMOZIONE"\n            ? decisione.data_effetto || form.data_atto || ""\n            : "",\n        motivo: decisione.motivo || "",\n        durata_tipo:\n          dettaglioConferma?.durata_tipo ||\n          (organo.durata_carica_anni\n            ? "ANNI"\n            : organo.data_scadenza\n            ? "DATA_FINE"\n            : undefined),\n        data_fine: dettaglioConferma?.data_fine || organo.data_scadenza || "",\n        bilancio_chiuso_al: dettaglioConferma?.bilancio_chiuso_al || "",\n        durata_anni:\n          dettaglioConferma?.durata_anni ||\n          (organo.durata_carica_anni ? String(organo.durata_carica_anni) : ""),\n        compenso_lordo: dettaglioConferma?.compenso_lordo || "",`
);

source = source.replace(
  `    for (const nomina of nomine) {`,
  `    for (const nomina of nomine.filter((item) => item.origine_azione !== "conferma")) {`
);

source = source.replace(
  `          compenso_lordo: meta.compenso_lordo || "",\n        });`,
  `          compenso_lordo: meta.compenso_lordo || "",\n          source_organo_id: "",\n          origine_azione: "nomina",\n        });`
);

source = source.replace(
  `}}>Aggiungi nominato</button>`,
  `}}>{nuovaNomina.origine_azione === "conferma" ? "Aggiorna conferma" : "Aggiungi nominato"}</button>`
);

const accStart = source.indexOf(`  async function generaAccettazioni() {`);
const returnStart = source.indexOf(`\n\n  return (`, accStart);
if (accStart >= 0 && returnStart > accStart) {
  const newAcceptance = `  async function generaAccettazioni() {\n    const haCariche =\n      nomine.some((item) => item.origine_azione !== "conferma") ||\n      Object.values(decisioni).some((d) => d.azione === "CONFERMA");\n\n    if (!haCariche) {\n      alert("Non ci sono cariche da inserire nel modello di accettazione.");\n      return;\n    }\n\n    const ok = confirm("Generare il documento di accettazione carica/cariche?");\n    if (!ok) return;\n\n    const salvato = await salvaDatiDocumento();\n    if (!salvato) return;\n\n    const res = await fetch(\n      \`/api/pratiche/\${encodeURIComponent(String(praticaId))}/genera-documento\`,\n      {\n        method: "POST",\n        headers: { "Content-Type": "application/json" },\n        body: JSON.stringify({ codice_modello: "ACCETTAZIONE_CARICHE" }),\n      }\n    );\n\n    const data = await res.json();\n\n    if (!res.ok) {\n      alert(data.error || "Errore generazione accettazione carica/cariche");\n      return;\n    }\n\n    alert("Accettazione carica/cariche generata correttamente");\n    await caricaDocumenti();\n  }`;
  source = source.slice(0, accStart) + newAcceptance + source.slice(returnStart);
}

if (!source.includes("handleDecisioneOrganoChange")) {
  throw new Error("[conferma prefill] helper conferma non inserito");
}
if (!source.includes("Accettazione carica/cariche generata correttamente")) {
  throw new Error("[conferma prefill] generazione accettazione non allineata");
}

fs.writeFileSync(path, source, "utf8");
console.log("✓ Pratiche Revisore/Sindaci: conferma precompilata e generazione documenti allineata alla liquidazione");
