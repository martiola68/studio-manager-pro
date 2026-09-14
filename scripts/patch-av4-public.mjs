import fs from "node:fs";

const componentPath = "src/components/antiriciclaggio/TitolariEffettiviForm.tsx";
const pagePath = "src/pages/compilazione-av4/[token].tsx";
const apiPath = "src/pages/api/public/av4/titolari.ts";

let component = fs.readFileSync(componentPath, "utf8");
let page = fs.readFileSync(pagePath, "utf8");
let api = fs.readFileSync(apiPath, "utf8");

function replaceOnce(source, oldValue, newValue, label) {
  if (source.includes(newValue)) return source;
  if (!source.includes(oldValue)) {
    throw new Error(`AV4 patch: blocco non trovato: ${label}`);
  }
  return source.replace(oldValue, newValue);
}

// tbclienti_organi è già scoped dalla società AV4 (cliente_id); non ha bisogno del filtro studio_id.
api = api.replace(
  '\n        if (studioId) organiQuery = organiQuery.eq("studio_id", studioId);\n',
  "\n"
);
fs.writeFileSync(apiPath, api, "utf8");

component = replaceOnce(
  component,
  `  publicMode?: boolean;\n  readOnly?: boolean;`,
  `  publicMode?: boolean;\n  publicToken?: string;\n  readOnly?: boolean;`,
  "prop publicToken"
);

component = replaceOnce(
  component,
  `  publicMode = false,\n  readOnly = false,`,
  `  publicMode = false,\n  publicToken = "",\n  readOnly = false,`,
  "destructuring publicToken"
);

component = component.replace(
  `  }, [av4_id, sezione, draftKey]);`,
  `  }, [av4_id, sezione, draftKey, publicMode, publicToken]);`
);

const loadAnchor = `  async function loadSavedTitolari(currentAv4Id: string): Promise<RigaTitolare[]> {\n    const { data, error } = await supabase`;
const loadReplacement = `  async function loadSavedTitolari(currentAv4Id: string): Promise<RigaTitolare[]> {\n    if (publicMode) {\n      if (!publicToken) return [];\n\n      const params = new URLSearchParams({\n        token: publicToken,\n        av4_id: currentAv4Id,\n        sezione,\n      });\n      const response = await fetch(\`/api/public/av4/titolari?\${params.toString()}\`, {\n        cache: "no-store",\n      });\n      const payload = await response.json();\n\n      if (!response.ok) {\n        throw new Error(payload?.error || "Errore caricamento titolari effettivi.");\n      }\n\n      return Array.isArray(payload?.rows) ? payload.rows : [];\n    }\n\n    const { data, error } = await supabase`;
component = replaceOnce(component, loadAnchor, loadReplacement, "caricamento pubblico titolari");

const deleteAnchor = `    if (!rowId || !normalizeId(av4_id)) {\n      setRighe((prev) => prev.filter((_, i) => i !== index));\n      return;\n    }\n\n    try {`;
const deleteReplacement = `    if (!rowId || !normalizeId(av4_id)) {\n      setRighe((prev) => prev.filter((_, i) => i !== index));\n      return;\n    }\n\n    if (publicMode) {\n      try {\n        if (!publicToken) throw new Error("Token pubblico AV4 mancante.");\n        const params = new URLSearchParams({\n          token: publicToken,\n          av4_id: normalizeId(av4_id),\n          sezione,\n          id: rowId,\n        });\n        const response = await fetch(\`/api/public/av4/titolari?\${params.toString()}\`, {\n          method: "DELETE",\n        });\n        const payload = await response.json();\n        if (!response.ok) throw new Error(payload?.error || "Errore eliminazione titolare.");\n        setRighe((prev) => prev.filter((_, i) => i !== index));\n      } catch (error: any) {\n        console.error("Errore eliminazione titolare pubblico:", error);\n        alert(error?.message || "Errore durante l'eliminazione del titolare effettivo.");\n      }\n      return;\n    }\n\n    try {`;
component = replaceOnce(component, deleteAnchor, deleteReplacement, "eliminazione pubblica titolare");

const importAnchor = `    try {\n     let query = supabase`;
const importReplacement = `    try {\n      if (publicMode) {\n        if (!publicToken || !normalizeId(av4_id)) {\n          throw new Error("Link pubblico AV4 non valido.");\n        }\n\n        const params = new URLSearchParams({\n          token: publicToken,\n          av4_id: normalizeId(av4_id),\n          sezione,\n          action: "lookup",\n          codice_fiscale: codiceFiscale,\n        });\n        const response = await fetch(\`/api/public/av4/titolari?\${params.toString()}\`, {\n          cache: "no-store",\n        });\n        const payload = await response.json();\n        if (!response.ok) {\n          throw new Error(payload?.error || "Errore durante la ricerca del nominativo.");\n        }\n\n        if (!payload?.found || !payload?.data) {\n          updateRiga(index, {\n            soggetto_cliente_id: "",\n            source_mode: "manual",\n            import_status: "not_found",\n            import_message: "Nessun dato trovato, inserire i dati manualmente",\n            error_codice_fiscale: "",\n          });\n          return;\n        }\n\n        const data = payload.data;\n        const next: RigaTitolare = {\n          ...righe[index],\n          soggetto_cliente_id: normalizeId(data.soggetto_cliente_id),\n          source_mode: "import",\n          nome_cognome: normalizeText(data.nome_cognome),\n          codice_fiscale: normalizeCF(data.codice_fiscale),\n          luogo_nascita: normalizeText(data.luogo_nascita),\n          data_nascita: normalizeDateForInput(data.data_nascita),\n          indirizzo_residenza: normalizeText(data.indirizzo_residenza),\n          citta_residenza: normalizeText(data.citta_residenza),\n          cap_residenza: normalizeText(data.cap_residenza),\n          nazionalita: normalizeText(data.nazionalita),\n          error_codice_fiscale: "",\n          import_status: "success",\n          import_message: "Importazione avvenuta con successo",\n        };\n\n        if (isDuplicateTitolare(righe, next, index)) {\n          updateRiga(index, {\n            error_codice_fiscale: "Codice fiscale già presente",\n            import_status: "",\n            import_message: "",\n          });\n          return;\n        }\n\n        updateRiga(index, next);\n        return;\n      }\n\n     let query = supabase`;
component = replaceOnce(component, importAnchor, importReplacement, "import pubblico da codice fiscale");

const saveAnchor = `    try {\n      const normalizedRows = validation.normalizedRows;\n    const rowsWithSoggettoId: RigaTitolare[] = [];`;
const saveReplacement = `    try {\n      const normalizedRows = validation.normalizedRows;\n\n      if (publicMode) {\n        if (!publicToken || !normalizeId(av4_id)) {\n          throw new Error("Link pubblico AV4 non valido.");\n        }\n\n        const response = await fetch("/api/public/av4/titolari", {\n          method: "POST",\n          headers: { "Content-Type": "application/json" },\n          body: JSON.stringify({\n            token: publicToken,\n            av4_id: normalizeId(av4_id),\n            sezione,\n            rows: normalizedRows,\n          }),\n        });\n        const payload = await response.json();\n        if (!response.ok) {\n          throw new Error(payload?.error || "Errore salvataggio titolari.");\n        }\n\n        clearDraft();\n        setRighe(Array.isArray(payload?.rows) ? payload.rows : normalizedRows);\n        alert("Titolari salvati correttamente.");\n        return;\n      }\n\n    const rowsWithSoggettoId: RigaTitolare[] = [];`;
component = replaceOnce(component, saveAnchor, saveReplacement, "salvataggio pubblico titolari");

fs.writeFileSync(componentPath, component, "utf8");

// Tutte le istanze della pagina pubblica devono dichiarare publicMode e passare il token.
if (!page.includes("publicToken={token}")) {
  const before = page;
  page = page.replace(
    /cliente_id=\{form\.cliente_id\}\n(\s*)\/>/g,
    `cliente_id={form.cliente_id}\n$1publicMode\n$1publicToken={token}\n$1/>`
  );
  if (page === before || (page.match(/publicToken=\{token\}/g) || []).length !== 3) {
    throw new Error("AV4 patch: impossibile collegare le 3 sezioni titolari al token pubblico");
  }
}

const legalMarker = `                    <div>\n                      <label className="mb-1 block text-sm font-medium">Luogo</label>\n                      <input\n                        name="luogo_firma_bis"`;

const legalBlock = `                    <div className="md:col-span-2 my-4 rounded-lg border border-slate-300 bg-white p-5 text-slate-800">\n                      <h3 className="mb-4 text-base font-semibold">Allegato alla Dichiarazione del Cliente</h3>\n                      <div className="whitespace-pre-line text-sm leading-6">{\`(Nota 1)\nPer “riciclaggio” (art. 2, co. 4 e 5, d.lgs. 231/2007) si intende:\na) la conversione o il trasferimento di beni, effettuati essendo a conoscenza che essi provengono da un’attività criminosa o da una partecipazione a tale attività, allo scopo di occultare o dissimulare l’origine illecita dei beni medesimi o di aiutare chiunque sia coinvolto in tale attività a sottrarsi alle conseguenze giuridiche delle proprie azioni;\nb) l’occultamento o la dissimulazione della reale natura, provenienza, ubicazione, disposizione, movimento, proprietà dei beni o dei diritti sugli stessi, effettuati essendo a conoscenza che tali beni provengono da un’attività criminosa o da una partecipazione a tale attività;\nc) l’acquisto, la detenzione o l’utilizzazione di beni essendo a conoscenza, al momento della loro ricezione, che tali beni provengono da un’attività criminosa o da una partecipazione a tale attività;\nd) la partecipazione ad uno degli atti di cui alle lettere a), b) e c), l’associazione per commettere tale atto, il tentativo di perpetrarlo, il fatto di aiutare, istigare o consigliare qualcuno a commetterlo o il fatto di agevolarne l’esecuzione.\n\nIl riciclaggio è considerato tale anche se le attività che hanno generato i beni da riciclare si sono svolte fuori dai confini nazionali. La conoscenza, l’intenzione o la finalità possono essere dedotte da circostanze di fatto obiettive.\n\nPer “finanziamento al terrorismo” si intende qualsiasi attività diretta, con ogni mezzo, alla fornitura, alla raccolta, alla provvista, all'intermediazione, al deposito, alla custodia o all'erogazione di fondi e risorse economiche utilizzabili per finalità di terrorismo (art. 2, co. 6, d.lgs. 231/2007).\n\nPer “finanziamento dei programmi di proliferazione delle armi di distruzione di massa” si intende la fornitura o raccolta di fondi e risorse economiche finalizzate allo sviluppo di armi nucleari, chimiche o biologiche (art. 1, lett. e), d.lgs. 109/2007).\n\n(Nota 2)\nAi sensi dell’art. 55, co. 3, del d.lgs. 231/2007, chi fornisce dati falsi o informazioni non veritiere è punito con reclusione da sei mesi a tre anni e multa da 10.000 a 30.000 euro.\n\n(Nota 3)\nPer “persone politicamente esposte” si intendono soggetti con importanti cariche pubbliche, i loro familiari e soggetti con legami stretti (art. 1, co. 2, lett. dd, d.lgs. 231/2007).\n\n(Nota 4)\nPer “titolare effettivo” si intende la persona fisica cui è attribuibile in ultima istanza la proprietà o il controllo del cliente (art. 1, co. 2, lett. pp, d.lgs. 231/2007).\n\nArt. 20 d.lgs. 231/2007:\nIl titolare effettivo è individuato sulla base di proprietà (>25%), controllo o, in ultima istanza, poteri di rappresentanza/amministrazione.\n1. Il titolare effettivo di clienti diversi dalle persone fisiche coincide con la persona fisica o le persone fisiche cui, in ultima istanza, è attribuibile la proprietà diretta o indiretta dell'ente ovvero il relativo controllo.\n2. Nel caso in cui il cliente sia una società di capitali: a) costituisce indicazione di proprietà diretta la titolarità di una partecipazione superiore al 25 per cento del capitale del cliente, detenuta da una persona fisica; b) costituisce indicazione di proprietà indiretta la titolarità di una percentuale di partecipazioni superiore al 25 per cento del capitale del cliente, posseduto per il tramite di società controllate, società fiduciarie o per interposta persona.\n3. Nelle ipotesi in cui l’esame dell'assetto proprietario non consenta di individuare in maniera univoca la persona fisica o le persone fisiche cui è attribuibile la proprietà diretta o indiretta dell’ente, il titolare effettivo coincide con la persona fisica o le persone fisiche cui, in ultima istanza, è attribuibile il controllo del medesimo in forza: a) del controllo della maggioranza dei voti esercitabili in assemblea ordinaria; b) del controllo di voti sufficienti per esercitare un'influenza dominante in assemblea ordinaria; c) dell'esistenza di particolari vincoli contrattuali che consentano di esercitare un’influenza dominante.\n4. Nel caso in cui il cliente sia una persona giuridica privata, di cui al decreto del Presidente della Repubblica 10 febbraio 2000, n. 361, sono cumulativamente individuati, come titolari effettivi: a) i fondatori, ove in vita; b) i beneficiari, quando individuati o facilmente individuabili; c) i titolari di funzioni di rappresentanza legale, direzione e amministrazione.\n5. Qualora l’applicazione dei criteri di cui ai precedenti commi non consenta di individuare univocamente uno o più titolari effettivi, il titolare effettivo coincide con la persona fisica o le persone fisiche titolari conformemente ai rispettivi assetti organizzativi o statutari, di poteri di rappresentanza legale, amministrazione o direzione della società o del cliente comunque diverso dalla persona fisica.\n6. I soggetti obbligati conservano traccia delle verifiche effettuate ai fini dell'individuazione del titolare effettivo nonché, con specifico riferimento al titolare effettivo individuato ai sensi del comma 5, delle ragioni che non hanno consentito di individuare il titolare effettivo ai sensi dei commi 1, 2, 3 e 4 del presente articolo.\`}</div>\n                    </div>\n\n`;

if (!page.includes("Allegato alla Dichiarazione del Cliente")) {
  if (!page.includes(legalMarker)) {
    throw new Error("AV4 patch: seconda firma non trovata");
  }
  page = page.replace(legalMarker, legalBlock + legalMarker);
}

fs.writeFileSync(pagePath, page, "utf8");

if (!component.includes("/api/public/av4/titolari")) {
  throw new Error("AV4 patch: API pubblica titolari non collegata");
}
if ((page.match(/publicToken=\{token\}/g) || []).length !== 3) {
  throw new Error("AV4 patch: non risultano collegate tutte le sezioni titolari");
}
if (!page.includes("Allegato alla Dichiarazione del Cliente")) {
  throw new Error("AV4 patch: allegato legale non inserito");
}

console.log("AV4 pubblico: titolari via API sicura, import organi SMP e allegato firme applicati");
