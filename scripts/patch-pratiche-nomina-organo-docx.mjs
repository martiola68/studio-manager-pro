import fs from "node:fs";

const path = "src/app/api/pratiche/[id]/genera-documento/route.ts";
let source = fs.readFileSync(path, "utf8");

const oldQuery = `const { data: soggetti } = await supabaseAdmin\n  .from("tbpratiche_soggetti")\n  .select("*")\n  .eq("pratica_id", id);`;

const newQuery = `const { data: soggetti } = await supabaseAdmin\n  .from("tbpratiche_soggetti")\n  .select(\`\n    *,\n    nominativo:tbpratiche_nominativi (\n      id,\n      nome_cognome,\n      codice_fiscale,\n      indirizzo,\n      citta,\n      provincia,\n      cap\n    )\n  \`)\n  .eq("pratica_id", id);`;

if (source.includes(oldQuery)) {
  source = source.replace(oldQuery, newQuery);
}

if (!source.includes("const organiConfermati = righeNominaOrgano")) {
  const anchor = `const liquidatore =\n  soggetti?.find(\n    (s: any) =>\n      String(s.carica || "")\n        .toLowerCase()\n        .includes("liquidatore")\n  ) || null;`;

  if (!source.includes(anchor)) {
    throw new Error("[nomina organo docx] anchor liquidatore non trovato");
  }

  const block = `${anchor}\n\nfunction parseMetaSoggetto(value: any) {\n  if (!value || typeof value !== "string") return {};\n  try {\n    const parsed = JSON.parse(value);\n    return parsed && typeof parsed === "object" ? parsed : {};\n  } catch {\n    return {};\n  }\n}\n\nfunction formatEuro(value: any) {\n  const numero = Number(value || 0);\n  if (!Number.isFinite(numero) || numero <= 0) return "—";\n  return new Intl.NumberFormat("it-IT", {\n    minimumFractionDigits: 2,\n    maximumFractionDigits: 2,\n  }).format(numero);\n}\n\nfunction scadenzaNomina(meta: any) {\n  if (meta?.durata_tipo === "DATA_FINE") {\n    return meta?.data_fine ? \`fino al \${formatDataBreveIt(meta.data_fine)}\` : "";\n  }\n  if (meta?.durata_tipo === "ANNI") {\n    return meta?.durata_anni ? \`\${meta.durata_anni} anni\` : "";\n  }\n  if (meta?.durata_tipo === "APPROVAZIONE_BILANCIO") {\n    return meta?.bilancio_chiuso_al\n      ? \`fino all'approvazione del bilancio chiuso al \${formatDataBreveIt(meta.bilancio_chiuso_al)}\`\n      : "";\n  }\n  if (meta?.data_fine) return \`fino al \${formatDataBreveIt(meta.data_fine)}\`;\n  return "";\n}\n\nconst righeNominaOrgano = (soggetti || [])\n  .map((row: any) => ({ row, meta: parseMetaSoggetto(row.note) }))\n  .filter(\n    ({ row, meta }: any) =>\n      String(row.tipo_soggetto || "") === "organo_controllo" &&\n      meta.workflow === "nomina_organo_controllo"\n  );\n\nfunction mappaRigaOrgano(entry: any) {\n  const row = entry.row || {};\n  const meta = entry.meta || {};\n  const nome = row.nominativo?.nome_cognome || "";\n  const codiceFiscale = row.nominativo?.codice_fiscale || meta.partita_iva || "";\n  const qualifica = String(meta.qualifica || "").trim();\n  const motivo = String(meta.motivo || "").trim();\n\n  return {\n    NOME: nome,\n    NOME_COGNOME: nome,\n    CODICE_FISCALE: codiceFiscale,\n    PARTITA_IVA: meta.partita_iva || "",\n    CARICA: row.carica || "",\n    QUALIFICA: qualifica,\n    QUALIFICA_TESTO: qualifica ? \` – \${qualifica}\` : "",\n    DATA_INIZIO: meta.data_inizio ? formatDataBreveIt(meta.data_inizio) : "",\n    DATA_EFFETTO: meta.data_effetto ? formatDataBreveIt(meta.data_effetto) : "",\n    SCADENZA: scadenzaNomina(meta),\n    COMPENSO: formatEuro(meta.compenso_lordo),\n    MOTIVO: motivo,\n    MOTIVO_TESTO: motivo ? \` – \${motivo}\` : "",\n    INDIRIZZO_RESIDENZA: row.nominativo?.indirizzo || "",\n    CAP_RESIDENZA: row.nominativo?.cap || "",\n    CITTA_RESIDENZA: row.nominativo?.citta || "",\n    PROVINCIA_RESIDENZA: row.nominativo?.provincia || "",\n    TIPO_SCADENZA_CARICA: meta.durata_tipo || "",\n    DATA_SCADENZA_CARICA:\n      meta.durata_tipo === "DATA_FINE" && meta.data_fine\n        ? formatDataIt(meta.data_fine)\n        : meta.durata_tipo === "APPROVAZIONE_BILANCIO" && meta.bilancio_chiuso_al\n        ? \`Approvazione bilancio chiuso al \${formatDataBreveIt(meta.bilancio_chiuso_al)}\`\n        : meta.durata_tipo === "ANNI" && meta.durata_anni\n        ? \`\${meta.durata_anni} anni\`\n        : "",\n  };\n}\n\nconst organiConfermati = righeNominaOrgano\n  .filter(({ meta }: any) => meta.azione === "conferma")\n  .map(mappaRigaOrgano);\n\nconst organiRimossi = righeNominaOrgano\n  .filter(({ meta }: any) => meta.azione === "rimozione")\n  .map(mappaRigaOrgano);\n\nconst nuoveNomineTutte = righeNominaOrgano\n  .filter(({ meta }: any) => meta.azione === "nomina")\n  .map(mappaRigaOrgano);\n\nconst revisoriNominati = nuoveNomineTutte.filter((item: any) =>\n  String(item.CARICA || "").toLowerCase().includes("revisor")\n);\n\nconst nuoveNomineControllo = nuoveNomineTutte.filter(\n  (item: any) => !String(item.CARICA || "").toLowerCase().includes("revisor")\n);\n\nconst compensiOrgano = nuoveNomineTutte.filter(\n  (item: any) => item.COMPENSO && item.COMPENSO !== "—"\n);`;

  source = source.replace(anchor, block);
}

if (!source.includes("for (const nuovaCarica of nuoveNomineTutte)")) {
  const anchor = `if (codiceModello === "ACCETTAZIONE_CARICHE" && nominatoNome) {\n  cariche.push({`;
  if (!source.includes(anchor)) {
    throw new Error("[nomina organo docx] anchor cariche non trovato");
  }

  const insertAfter = `if (codiceModello === "ACCETTAZIONE_CARICHE" && nominatoNome) {\n  cariche.push({`;
  // La nuova logica viene inserita dopo il blocco legacy, usando un anchor stabile successivo.
  const afterLegacy = `  });\n}\n    const { data: motivoLiquidazione }`;
  if (!source.includes(afterLegacy)) {
    throw new Error("[nomina organo docx] fine blocco cariche legacy non trovata");
  }

  const replacement = `  });\n}\n\nif (codiceModello === "ACCETTAZIONE_CARICHE") {\n  for (const nuovaCarica of nuoveNomineTutte) {\n    cariche.push({\n      NOME_COGNOME: nuovaCarica.NOME_COGNOME,\n      CODICE_FISCALE: nuovaCarica.CODICE_FISCALE,\n      LUOGO_NASCITA: "",\n      DATA_NASCITA: "",\n      INDIRIZZO_RESIDENZA: nuovaCarica.INDIRIZZO_RESIDENZA,\n      CAP_RESIDENZA: nuovaCarica.CAP_RESIDENZA,\n      CITTA_RESIDENZA: nuovaCarica.CITTA_RESIDENZA,\n      PROVINCIA_RESIDENZA: nuovaCarica.PROVINCIA_RESIDENZA,\n      CARICA: nuovaCarica.CARICA,\n      TIPO_SCADENZA_CARICA: nuovaCarica.TIPO_SCADENZA_CARICA,\n      DATA_SCADENZA_CARICA: nuovaCarica.DATA_SCADENZA_CARICA,\n    });\n  }\n}\n    const { data: motivoLiquidazione }`;

  source = source.replace(afterLegacy, replacement);
}

if (!source.includes("SEZIONE_CONFERME:")) {
  const anchor = `IMPORTO_DIVIDENDO_TOTALE:\n  Number(`;
  if (!source.includes(anchor)) {
    throw new Error("[nomina organo docx] anchor valori non trovato");
  }

  const values = `SEZIONE_CONFERME:\n  organiConfermati.length > 0\n    ? [{ ORGANI: organiConfermati }]\n    : [],\n\nSEZIONE_RIMOZIONI:\n  organiRimossi.length > 0\n    ? [{ ORGANI: organiRimossi }]\n    : [],\n\nSEZIONE_NOMINE_CONTROLLO:\n  nuoveNomineControllo.length > 0\n    ? [{ ORGANI: nuoveNomineControllo }]\n    : [],\n\nSEZIONE_NOMINA_REVISORE:\n  revisoriNominati.length > 0\n    ? [{ ORGANI: revisoriNominati }]\n    : [],\n\nSEZIONE_REVISIONE_ORGANO: [],\n\nSEZIONE_COMPENSI:\n  compensiOrgano.length > 0\n    ? [{ ORGANI: compensiOrgano }]\n    : [],\n\nORGANI_CONFERMATI: organiConfermati,\nORGANI_RIMOSSI: organiRimossi,\nNUOVE_NOMINE: nuoveNomineTutte,\nNUOVE_NOMINE_CONTROLLO: nuoveNomineControllo,\nREVISORI_NOMINATI: revisoriNominati,\nCOMPENSI_ORGANO: compensiOrgano,\n\n${anchor}`;
  source = source.replace(anchor, values);
}

fs.writeFileSync(path, source, "utf8");
console.log("✓ Verbale nomina organo controllo: merge fields per conferme, rimozioni, nomine, revisori, compensi e accettazioni");
