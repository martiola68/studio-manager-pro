import fs from "node:fs";

const generatorPath = "src/app/api/pratiche/[id]/genera-documento/route.ts";
let source = fs.readFileSync(generatorPath, "utf8");

source = source.replace(
  `  const nome = row.nominativo?.nome_cognome || row.nominativo?.ragione_sociale || "";
  const codiceFiscale = row.nominativo?.codice_fiscale || meta.partita_iva || "";`,
  `  const nome =
    row.nominativo?.nome_cognome ||
    row.nominativo?.ragione_sociale ||
    row.nome_cognome ||
    meta.nominativo_nome ||
    "";
  const codiceFiscale =
    row.nominativo?.codice_fiscale ||
    row.codice_fiscale ||
    meta.nominativo_codice_fiscale ||
    meta.nominativo_partita_iva ||
    meta.partita_iva ||
    "";`
);

source = source.replace(
  `    PARTITA_IVA: row.nominativo?.partita_iva || meta.partita_iva || "",`,
  `    PARTITA_IVA:
      row.nominativo?.partita_iva ||
      meta.nominativo_partita_iva ||
      meta.partita_iva ||
      "",`
);

source = source.replace(
  `    INDIRIZZO_RESIDENZA: row.nominativo?.indirizzo || "",
    CAP_RESIDENZA: row.nominativo?.cap || "",
    CITTA_RESIDENZA: row.nominativo?.citta || "",
    PROVINCIA_RESIDENZA: row.nominativo?.provincia || "",`,
  `    INDIRIZZO_RESIDENZA:
      row.nominativo?.indirizzo || meta.nominativo_indirizzo || "",
    CAP_RESIDENZA:
      row.nominativo?.cap || meta.nominativo_cap || "",
    CITTA_RESIDENZA:
      row.nominativo?.citta || meta.nominativo_citta || "",
    PROVINCIA_RESIDENZA:
      row.nominativo?.provincia || meta.nominativo_provincia || "",`
);

if (!source.includes("normalizzaLoopNominaOrgano")) {
  const zipAnchor = `const zip = new PizZip(modelloBuffer);`;
  if (!source.includes(zipAnchor)) {
    throw new Error("[nomina organo persist] anchor PizZip non trovato");
  }

  source = source.replace(
    zipAnchor,
    `const zip = new PizZip(modelloBuffer);

if (codiceModello === "VERBALE_NOMINA_ORGANO_CONTROLLO") {
  const documentXmlFile = zip.file("word/document.xml");
  if (documentXmlFile) {
    let documentXml = documentXmlFile.asText();
    const loopTags = [
      "SEZIONE_CONFERME",
      "SEZIONE_RIMOZIONI",
      "SEZIONE_NOMINE_CONTROLLO",
      "SEZIONE_NOMINA_REVISORE",
      "SEZIONE_REVISIONE_ORGANO",
      "SEZIONE_COMPENSI",
      "ORGANI",
    ];

    for (const tag of loopTags) {
      documentXml = documentXml.replaceAll(\`[\${tag}]\`, \`[#\${tag}]\`);
    }

    zip.file("word/document.xml", documentXml);
  }
}

// normalizzaLoopNominaOrgano`
  );
}

fs.writeFileSync(generatorPath, source, "utf8");
console.log("✓ Pratiche Revisore/Sindaci: fallback anagrafica pratica + loop DOCX normalizzati");
