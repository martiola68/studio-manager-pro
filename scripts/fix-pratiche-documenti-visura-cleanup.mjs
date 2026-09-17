import fs from "node:fs";

function patchNominaOrgano() {
  const path = "src/components/pratiche/forms/FormNominaOrganoControllo.tsx";
  let source = fs.readFileSync(path, "utf8");

  source = source.replace(
    `        nome_cognome: nome.trim(),\n        codice_fiscale: codiceFiscale.trim().toUpperCase(),`,
    `        nome_cognome: nome.trim(),\n        codice_fiscale: codiceFiscale.trim().toUpperCase(),\n        pratica_id: praticaId,`
  );

  const archiveAnchor = `        {documenti.length > 0 && <table`;
  if (!source.includes(`Archivio documenti generati`)) {
    if (!source.includes(archiveAnchor)) {
      throw new Error("[documenti pratica] anchor archivio documenti non trovato");
    }

    const archiveHeader = `        <div style={{ marginTop: 24, paddingTop: 18, borderTop: "1px solid #e5e7eb" }}>\n          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#111827" }}>Archivio documenti generati</h3>\n          <p style={{ margin: "6px 0 0", fontSize: 13, color: "#64748b" }}>Da qui puoi scaricare il DOCX generato, ricaricare la versione modificata oppure eliminare il file prima di rigenerarlo.</p>\n          {documenti.length === 0 && (\n            <div style={{ marginTop: 14, border: "1px dashed #cbd5e1", borderRadius: 8, padding: 18, color: "#64748b", background: "#f8fafc" }}>\n              Nessun documento ancora generato. Usa i pulsanti sopra per creare il verbale o l'accettazione carica/cariche.\n            </div>\n          )}\n        </div>\n\n`;

    source = source.replace(archiveAnchor, archiveHeader + archiveAnchor);
  }

  if (!source.includes(`pratica_id: praticaId`)) {
    throw new Error("[documenti pratica] pratica_id non aggiunto alla risoluzione nominativi");
  }
  if (!source.includes(`Archivio documenti generati`)) {
    throw new Error("[documenti pratica] archivio documenti non inserito");
  }

  fs.writeFileSync(path, source, "utf8");
  console.log("✓ Pratiche: nominativi multi-studio + archivio download/upload sempre visibile");
}

function cleanupClientiVisura() {
  const path = "src/pages/clienti/index.tsx";
  let source = fs.readFileSync(path, "utf8");

  source = source.replace(
    `import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";`,
    `import React, { useCallback, useEffect, useMemo, useState } from "react";`
  );
  source = source.replace(`import { mapVisuraText } from "@/utils/visuraMapper";\n`, "");

  const helperStart = source.indexOf(`function inferTipoClienteDaCf(`);
  const pageStart = source.indexOf(`export default function ClientiPage() {`, helperStart);
  if (helperStart >= 0 && pageStart > helperStart) {
    source = source.slice(0, helperStart) + source.slice(pageStart);
  }

  const visuraStateStart = source.indexOf(`const [importingVisura, setImportingVisura]`);
  const filtroStart = source.indexOf(` const [filtroClienti`, visuraStateStart);
  if (visuraStateStart >= 0 && filtroStart > visuraStateStart) {
    source = source.slice(0, visuraStateStart) + source.slice(filtroStart);
  }

  source = source.replace(
    `const [visuraPreviewOpen, setVisuraPreviewOpen] = useState(false);\nconst [visuraClienteFields, setVisuraClienteFields] = useState<VisuraClienteField[]>([]);\n`,
    ""
  );

  const importFnStart = source.indexOf(`async function handleImportVisura(`);
  const clientiStateStart = source.indexOf(` const [clienti, setClienti]`, importFnStart);
  if (importFnStart >= 0 && clientiStateStart > importFnStart) {
    source = source.slice(0, importFnStart) + source.slice(clientiStateStart);
  }

  source = source.replace(
    /\n\s*<div>\s*<button\s+type="button"\s+onClick=\{\(\) => fileInputRef\.current\?\.click\(\)\}[\s\S]*?<input[\s\S]*?onChange=\{handleImportVisura\}[\s\S]*?<\/div>/m,
    ""
  );

  const previewStart = source.indexOf(`<Dialog open={visuraPreviewOpen}`);
  if (previewStart >= 0) {
    const nextDialog = source.indexOf(`<Dialog`, previewStart + 10);
    if (nextDialog > previewStart) {
      source = source.slice(0, previewStart) + source.slice(nextDialog);
    } else {
      const closeMarker = source.indexOf(`</Dialog>`, previewStart);
      if (closeMarker > previewStart) {
        source = source.slice(0, previewStart) + source.slice(closeMarker + `</Dialog>`.length);
      }
    }
  }

  if (source.includes(`/api/import-visura`) || source.includes(`handleImportVisura`) || source.includes(`importingVisura`)) {
    throw new Error("[visura cleanup] residui import visura ancora presenti in Clienti");
  }

  fs.writeFileSync(path, source, "utf8");
  console.log("✓ Clienti: rimossi handler, pulsante e dialog legacy Importa visura");
}

patchNominaOrgano();
cleanupClientiVisura();
