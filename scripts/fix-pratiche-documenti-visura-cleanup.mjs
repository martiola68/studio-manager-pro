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

  const importButtonStart = source.indexOf(
    `      <div>\n        <button\n          type="button"\n          onClick={() => fileInputRef.current?.click()}`
  );
  if (importButtonStart >= 0) {
    const saveButtonsStart = source.indexOf(
      `      <div className="flex items-center gap-3">`,
      importButtonStart
    );
    if (saveButtonsStart < 0) {
      throw new Error("[visura cleanup] blocco pulsanti salva non trovato");
    }
    source = source.slice(0, importButtonStart) + source.slice(saveButtonsStart);
  }

  const previewStart = source.indexOf(
    `      <Dialog open={visuraPreviewOpen} onOpenChange={setVisuraPreviewOpen}>`
  );
  if (previewStart >= 0) {
    const dialogSbloccoMarker = `      \n{/* DIALOG SBLOCCO */}`;
    const previewEnd = source.indexOf(dialogSbloccoMarker, previewStart);
    if (previewEnd < 0) {
      throw new Error("[visura cleanup] fine dialog anteprima visura non trovata");
    }
    source = source.slice(0, previewStart) + `\n{/* DIALOG SBLOCCO */}` + source.slice(previewEnd + dialogSbloccoMarker.length);
  }

  const residui = [
    `/api/import-visura`,
    `handleImportVisura`,
    `importingVisura`,
    `fileInputRef`,
    `visuraPreviewOpen`,
    `visuraClienteFields`,
    `mapVisuraText`,
    `inferTipoClienteDaCf`,
    `estraiNumeroReaDaTesto`,
  ].filter((token) => source.includes(token));

  if (residui.length > 0) {
    throw new Error(`[visura cleanup] residui import visura ancora presenti: ${residui.join(", ")}`);
  }

  fs.writeFileSync(path, source, "utf8");
  console.log("✓ Clienti: rimossi in modo sicuro handler, pulsante e dialog legacy Importa visura");
}

patchNominaOrgano();
cleanupClientiVisura();
