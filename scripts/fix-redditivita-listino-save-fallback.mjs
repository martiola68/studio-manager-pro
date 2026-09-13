import fs from "node:fs";

function patch(file, fn) {
  const source = fs.readFileSync(file, "utf8");
  const next = fn(source);
  fs.writeFileSync(file, next, "utf8");
  console.log(`✓ ${file}`);
}

function replaceOrFail(source, label, from, to) {
  if (!source.includes(from)) throw new Error(`[listino-save-fallback] pattern not found: ${label}`);
  return source.replace(from, to);
}

patch("src/pages/api/controllo-gestione/redditivita-studio.ts", (source) => {
  if (!source.includes('scriviListinoInNote')) {
    source = replaceOrFail(
      source,
      "import helper listino",
      'import { createClient } from "@supabase/supabase-js";',
      'import { createClient } from "@supabase/supabase-js";\nimport { attivitaConListinoFallback, scriviListinoInNote } from "@/lib/redditivita-listino";'
    );
  }

  // Ogni lettura del catalogo espone i valori salvati nel campo note come normali campi listino.
  source = source.replaceAll(
    "const attivitaMap = new Map((attivitaResult.data || []).map((a: any) => [a.id, a]));",
    "const attivitaIdratate = (attivitaResult.data || []).map((a: any) => attivitaConListinoFallback(a));\n        const attivitaMap = new Map(attivitaIdratate.map((a: any) => [a.id, a]));"
  );
  source = source.replaceAll(
    "attivita: attivitaResult.data || [],",
    "attivita: (attivitaResult.data || []).map((a: any) => attivitaConListinoFallback(a)),"
  );

  // Handler definitivo salva_attivita: usa colonne già esistenti + note strutturate.
  // Viene inserito PRIMA dell'handler generato dalle patch precedenti, quindi non dipende
  // dalla migration delle colonne prezzo_* per funzionare in produzione.
  const actionAnchor = '      if (action === "salva_attivita") {';
  if (!source.includes("LISTINO_FALLBACK_SAVE_V1")) {
    if (!source.includes(actionAnchor)) throw new Error("[listino-save-fallback] salva_attivita non trovato");
    const handler = `      // LISTINO_FALLBACK_SAVE_V1\n      if (action === "salva_attivita") {\n        const id = String(req.body?.id || "").trim() || null;\n        const codice = String(req.body?.codice || "").trim().toUpperCase();\n        const area = String(req.body?.area || "").trim();\n        const descrizione = String(req.body?.descrizione || "").trim();\n        const driver = String(req.body?.driver || "").trim();\n        const unitaMisura = String(req.body?.unita_misura || "n.").trim() || "n.";\n        const tempoStandardMinuti = n(req.body?.tempo_standard_minuti);\n        const coefficienteBase = n(req.body?.coefficiente_base || 1);\n        const ordinamento = Math.trunc(n(req.body?.ordinamento));\n        const attiva = req.body?.attiva !== false;\n        const prezzoMinimo = Math.max(0, n(req.body?.prezzo_minimo));\n        const prezzoMassimo = Math.max(0, n(req.body?.prezzo_massimo));\n        const modalitaPrezzo = String(req.body?.modalita_prezzo || "unitario").trim().toLowerCase();\n        const gruppoListino = String(req.body?.gruppo_listino || "").trim().toUpperCase();\n        const listinoAttivo = req.body?.listino_attivo !== false;\n\n        if (!codice || !area || !descrizione || !driver) {\n          return res.status(400).json({ success: false, error: "Codice, area, attività e driver sono obbligatori" });\n        }\n        if (tempoStandardMinuti < 0) return res.status(400).json({ success: false, error: "Il tempo standard non può essere negativo" });\n        if (coefficienteBase <= 0) return res.status(400).json({ success: false, error: "Il coefficiente base deve essere maggiore di zero" });\n        if (prezzoMassimo < prezzoMinimo) return res.status(400).json({ success: false, error: "Il prezzo massimo non può essere inferiore al prezzo minimo" });\n        if (!["unitario", "mensile", "orario"].includes(modalitaPrezzo)) return res.status(400).json({ success: false, error: "Modalità prezzo non valida" });\n\n        let noteCorrente: string | null = null;\n        if (id) {\n          const { data: corrente, error: correnteError } = await supabaseAdmin\n            .from("tbcdg_attivita_catalogo")\n            .select("note")\n            .eq("id", id)\n            .eq("studio_id", studioId)\n            .maybeSingle();\n          if (correnteError) throw correnteError;\n          if (!corrente) return res.status(404).json({ success: false, error: "Attività non appartenente allo studio" });\n          noteCorrente = corrente.note || null;\n        }\n\n        const noteListino = scriviListinoInNote(noteCorrente, {\n          prezzo_minimo: prezzoMinimo,\n          prezzo_massimo: prezzoMassimo,\n          modalita_prezzo: modalitaPrezzo as "unitario" | "mensile" | "orario",\n          gruppo_listino: gruppoListino,\n          listino_attivo: listinoAttivo,\n        });\n\n        const payloadFallback = {\n          studio_id: studioId,\n          codice,\n          area,\n          descrizione,\n          driver,\n          unita_misura: unitaMisura,\n          tempo_standard_minuti: tempoStandardMinuti,\n          coefficiente_base: coefficienteBase,\n          ordinamento,\n          attiva,\n          note: noteListino,\n        };\n\n        const query = id\n          ? supabaseAdmin.from("tbcdg_attivita_catalogo").update(payloadFallback).eq("id", id).eq("studio_id", studioId).select("*").single()\n          : supabaseAdmin.from("tbcdg_attivita_catalogo").insert(payloadFallback).select("*").single();\n\n        const { data, error } = await query;\n        if (error) {\n          if (String(error.code) === "23505") return res.status(409).json({ success: false, error: "Esiste già un'attività con questo codice" });\n          throw error;\n        }\n\n        return res.status(200).json({ success: true, data: attivitaConListinoFallback(data) });\n      }\n\n`;
    source = source.replace(actionAnchor, handler + actionAnchor);
  }

  return source;
});

patch("src/pages/api/controllo-gestione/redditivita-compensi.ts", (source) => {
  // Il motore tariffario deve ricevere anche note (fallback) e, quando disponibili, le colonne listino.
  source = source.replaceAll(
    '.select("id,codice,area,descrizione,driver,unita_misura")',
    '.select("*")'
  );
  return source;
});

patch("src/pages/controllo-gestione/redditivita-studio.tsx", (source) => {
  // Garantisce che la modale si chiuda soltanto dopo un salvataggio realmente riuscito.
  const start = source.indexOf("  async function salvaAttivita() {");
  const end = source.indexOf("\n  async function toggleAttivita", start);
  if (start < 0 || end < 0) throw new Error("[listino-save-fallback] funzione salvaAttivita non trovata");
  let block = source.slice(start, end);
  const okAnchor = '      if (!response.ok) throw new Error(json?.error || "Errore salvataggio attività");';
  if (!block.includes(okAnchor)) throw new Error("[listino-save-fallback] response.ok salvaAttivita non trovato");

  if (!block.includes('setShowAttivitaForm(false);')) {
    block = block.replace(
      okAnchor,
      `${okAnchor}\n      setShowAttivitaForm(false);\n      setAttivitaDraft({ ...emptyAttivita });`
    );
  } else {
    // Manteniamo la chiusura immediatamente dopo il 200, prima del reload dei dati.
    block = block.replace(/\n\s*setShowAttivitaForm\(false\);/g, "");
    block = block.replace(/\n\s*setAttivitaDraft\([^\n]+\);/g, "");
    block = block.replace(
      okAnchor,
      `${okAnchor}\n      setShowAttivitaForm(false);\n      setAttivitaDraft({ ...emptyAttivita });`
    );
  }

  return source.slice(0, start) + block + source.slice(end);
});

console.log("✓ Redditività listino: salvataggio fallback persistente e chiusura modale su 200 OK");
