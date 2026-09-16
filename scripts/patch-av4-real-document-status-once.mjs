import fs from "node:fs";

function replaceOnce(source, before, after, label) {
  if (!source.includes(before)) throw new Error(`Pattern not found: ${label}`);
  return source.replace(before, after);
}

// 1) Elenco AML: AV4 verde/confermato SOLO se esiste realmente AV4 firmato nel fascicolo.
{
  const file = "src/pages/antiriciclaggio/index.tsx";
  let s = fs.readFileSync(file, "utf8");

  s = replaceOnce(
    s,
    `  fascicolo_completo?: boolean | null;\n  fascicolo_mancanti?: string[];`,
    `  fascicolo_completo?: boolean | null;\n  fascicolo_mancanti?: string[];\n  av4_firmato_presente?: boolean;`,
    "AV1Row av4_firmato_presente"
  );

  s = replaceOnce(
    s,
    `    const av4Ricevuto = !!(av4Info?.compilato_da_cliente || av4Info?.av4_caricato_manualmente);\n    const av4Inviato = !!(av4Info?.Av4InviatoCL || av4Info?.public_sent_at || av4Ricevuto);`,
    `    const av4Ricevuto = !!row.av4_firmato_presente;\n    const av4Inviato = !!(av4Info?.Av4InviatoCL || av4Info?.public_sent_at || av4Ricevuto);`,
    "getStatoInfo AV4 real document"
  );

  s = replaceOnce(
    s,
    `    const av4Ricevuto = !!(av4Info?.compilato_da_cliente || av4Info?.av4_caricato_manualmente);\n    const av4Inviato = !!(av4Info?.Av4InviatoCL || av4Info?.public_sent_at || av4Ricevuto);`,
    `    const av4Ricevuto = !!row.av4_firmato_presente;\n    const av4Inviato = !!(av4Info?.Av4InviatoCL || av4Info?.public_sent_at || av4Ricevuto);`,
    "getAV4IconBorderClass AV4 real document"
  );

  s = replaceOnce(
    s,
    `    return { completo: mancanti.length === 0, mancanti };`,
    `    return { completo: mancanti.length === 0, mancanti, av4Presente: av4 };`,
    "checkFascicoloDocumenti result"
  );

  s = replaceOnce(
    s,
    `        return { ...row, fascicolo_completo: check.completo, fascicolo_mancanti: check.mancanti };`,
    `        return { ...row, fascicolo_completo: check.completo, fascicolo_mancanti: check.mancanti, av4_firmato_presente: !!check.av4Presente };`,
    "rowsConFascicolo AV4 flag"
  );

  s = replaceOnce(
    s,
    `{av4Info?.compilato_da_cliente || row.stato_pratica === "av4_ricevuto" ? "Sì" : "No"}`,
    `{row.av4_firmato_presente ? "Sì" : "No"}`,
    "AV4 confermato column"
  );

  fs.writeFileSync(file, s);
}

// 2) Modello AV4: la spunta manuale da sola NON completa più l'AV4.
{
  const file = "src/pages/antiriciclaggio/modello-av4.tsx";
  let s = fs.readFileSync(file, "utf8");

  s = replaceOnce(
    s,
    `      av4_caricato_manualmente: !!form.av4_caricato_manualmente,\n      compilato_da_cliente: !!form.av4_caricato_manualmente || !!form.allegato_pdf_cliente,\n      Av4InviatoCL: form.av4_caricato_manualmente\n  ? false\n  : Boolean(form.stato === "completato"),\n\n      stato: form.av4_caricato_manualmente ? "completato" : form.stato,`,
    `      av4_caricato_manualmente: !!form.av4_caricato_manualmente,\n      // La modalità manuale abilita il caricamento, ma NON equivale a documento ricevuto.\n      compilato_da_cliente: !!form.allegato_pdf_cliente,\n      Av4InviatoCL: form.av4_caricato_manualmente\n        ? false\n        : Boolean(form.stato === "completato" && !!form.allegato_pdf_cliente),\n\n      stato: form.allegato_pdf_cliente ? "completato" : "bozza",`,
    "salvaAV4 completion logic"
  );

  s = replaceOnce(
    s,
    `  av4_caricato_manualmente: !!form.av4_caricato_manualmente,\n  compilato_da_cliente: !!form.av4_caricato_manualmente || !!form.allegato_pdf_cliente,\n  stato: form.av4_caricato_manualmente ? "completato" : prev.stato,`,
    `  av4_caricato_manualmente: !!form.av4_caricato_manualmente,\n  compilato_da_cliente: !!form.allegato_pdf_cliente,\n  stato: form.allegato_pdf_cliente ? "completato" : "bozza",`,
    "setForm after save"
  );

  s = replaceOnce(
    s,
    `        allegato_pdf_cliente: storagePath,\n        pdf_firmato_cliente: storagePath,\n        compilato_da_cliente: true,`,
    `        allegato_pdf_cliente: storagePath,\n        pdf_firmato_cliente: storagePath,\n        av4_caricato_manualmente: true,\n        compilato_da_cliente: true,`,
    "manual upload confirms actual document"
  );

  s = replaceOnce(
    s,
    `        allegato_pdf_cliente: null,\n          pdf_firmato_cliente: null,\n          compilato_da_cliente: false,\n          stato: "bozza",`,
    `        allegato_pdf_cliente: null,\n          pdf_firmato_cliente: null,\n          av4_caricato_manualmente: false,\n          compilato_da_cliente: false,\n          stato: "bozza",`,
    "remove PDF clears manual completion"
  );

  s = replaceOnce(
    s,
    `        allegato_pdf_cliente: "",\n        pdf_firmato_cliente: "",\n        stato: "bozza",`,
    `        allegato_pdf_cliente: "",\n        pdf_firmato_cliente: "",\n        av4_caricato_manualmente: false,\n        stato: "bozza",`,
    "remove PDF form state"
  );

  fs.writeFileSync(file, s);
}

console.log("AV4 real-document status patch applied");
