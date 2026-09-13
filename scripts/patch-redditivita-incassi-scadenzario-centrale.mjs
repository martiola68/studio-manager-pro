import fs from "node:fs";
import path from "node:path";

const file = path.join(
  process.cwd(),
  "src/pages/api/controllo-gestione/redditivita-incassi.ts"
);

let source = fs.readFileSync(file, "utf8");
const marker = "// CENTRAL_SYNC_REDDITIVITA_INCASSI";

if (source.includes(marker)) {
  console.log("✓ Redditivita Incassi central deadlines already patched");
  process.exit(0);
}

function mustReplace(needle, replacement, label) {
  if (!source.includes(needle)) {
    throw new Error(`Anchor non trovato: ${label}`);
  }
  source = source.replace(needle, replacement);
}

const handlerAnchor = "export default async function handler(req: NextApiRequest, res: NextApiResponse) {";
const helpers = `// CENTRAL_SYNC_REDDITIVITA_INCASSI
const CENTRAL_ORIGINE_MODULO = "Redditività Studio - Incassi";
const CENTRAL_ORIGINE_TABELLA = "tbcdg_contratti_scadenze";
const CENTRAL_TIPO_SCADENZA = "incasso_compenso";

async function operatoreResponsabileCliente(studioId: string, clienteId: string) {
  const { data, error } = await admin
    .from("tbclienti")
    .select("utente_operatore_id")
    .eq("id", clienteId)
    .eq("studio_id", studioId)
    .maybeSingle();
  if (error) throw error;
  return data?.utente_operatore_id ? String(data.utente_operatore_id) : null;
}

async function annullaScadenzaCentrale(studioId: string, origineRecordId: string) {
  if (!origineRecordId) return;
  const now = new Date().toISOString();
  const { error } = await admin
    .from("tbscadenze_centrale")
    .update({
      stato: "annullata",
      annullata_at: now,
      completata_at: null,
      prossimo_alert_at: null,
      updated_at: now,
    })
    .eq("studio_id", studioId)
    .eq("origine_tabella", CENTRAL_ORIGINE_TABELLA)
    .eq("origine_record_id", origineRecordId)
    .eq("tipo_scadenza", CENTRAL_TIPO_SCADENZA);
  if (error) throw error;
}

async function sincronizzaScadenzaCentrale(scadenza: any) {
  if (!scadenza?.id || !scadenza?.studio_id || !scadenza?.cliente_id) return;

  const studioId = String(scadenza.studio_id);
  const clienteId = String(scadenza.cliente_id);
  const stato = String(scadenza.stato || "previsto");

  if (stato === "annullato") {
    await annullaScadenzaCentrale(studioId, String(scadenza.id));
    return;
  }

  const operatoreId = await operatoreResponsabileCliente(studioId, clienteId);
  const titolo = "Incasso compenso - rata " + String(scadenza.numero_rata || "");
  const descrizione =
    "Rata " + String(scadenza.numero_rata || "") +
    " del contratto " + String(scadenza.contratto_id || "") +
    " - importo " + n(scadenza.importo).toFixed(2) + " EUR";

  const { data: centraleIdRaw, error: upsertError } = await admin.rpc(
    "upsert_scadenza_centrale",
    {
      p_studio_id: studioId,
      p_cliente_id: clienteId,
      p_operatore_responsabile_id: operatoreId,
      p_origine_modulo: CENTRAL_ORIGINE_MODULO,
      p_origine_tabella: CENTRAL_ORIGINE_TABELLA,
      p_origine_record_id: String(scadenza.id),
      p_tipo_scadenza: CENTRAL_TIPO_SCADENZA,
      p_titolo: titolo,
      p_descrizione: descrizione,
      p_data_scadenza: scadenza.data_scadenza,
      p_link_dettaglio: "/controllo-gestione/redditivita-studio",
      p_metadati: {
        contratto_id: scadenza.contratto_id,
        numero_rata: scadenza.numero_rata,
        importo: n(scadenza.importo),
        stato_incasso: stato,
        riferimento_fattura: scadenza.riferimento_fattura || null,
      },
      p_giorni_preavviso_1: 15,
      p_giorni_preavviso_2: 7,
      p_giorni_preavviso_3: 0,
    }
  );
  if (upsertError) throw upsertError;

  const centraleId = centraleIdRaw ? String(centraleIdRaw) : "";
  if (centraleId) {
    const { error: destinatariError } = await admin.rpc(
      "sync_destinatari_scadenza_centrale",
      {
        p_scadenza_id: centraleId,
        p_studio_id: studioId,
        p_operatore_responsabile_id: operatoreId,
        p_settore_fiscale: false,
        p_settore_lavoro: false,
        p_settore_consulenza: false,
      }
    );
    if (destinatariError) throw destinatariError;
  }

  if (stato === "incassato") {
    const now = new Date().toISOString();
    const { error: completaError } = await admin
      .from("tbscadenze_centrale")
      .update({
        stato: "completata",
        completata_at: now,
        annullata_at: null,
        prossimo_alert_at: null,
        updated_at: now,
      })
      .eq("studio_id", studioId)
      .eq("origine_tabella", CENTRAL_ORIGINE_TABELLA)
      .eq("origine_record_id", String(scadenza.id))
      .eq("tipo_scadenza", CENTRAL_TIPO_SCADENZA);
    if (completaError) throw completaError;
  }
}

`;

mustReplace(handlerAnchor, helpers + handlerAnchor, "handler API");

const deleteAnchor = `        const { error: deleteError } = await admin
          .from("tbcdg_contratti_scadenze")
          .delete()`;
mustReplace(
  deleteAnchor,
  `        for (const scadenza of esistenti || []) {
          await annullaScadenzaCentrale(studioId, String(scadenza.id || ""));
        }

${deleteAnchor}`,
  "annullamento rate precedenti"
);

const generateReturn = `        if (error) throw error;
        return res.status(200).json({ success: true, scadenze: data || [] });`;
mustReplace(
  generateReturn,
  `        if (error) throw error;
        for (const scadenza of data || []) {
          await sincronizzaScadenzaCentrale(scadenza);
        }
        return res.status(200).json({ success: true, scadenze: data || [] });`,
  "sync rate generate"
);

const manualInsert = `        const { data, error } = await admin.from("tbcdg_contratti_scadenze").insert(payload).select("*").single();
        if (error) throw error;
        return res.status(200).json({ success: true, data });`;
mustReplace(
  manualInsert,
  `        const { data, error } = await admin.from("tbcdg_contratti_scadenze").insert(payload).select("*").single();
        if (error) throw error;
        await sincronizzaScadenzaCentrale(data);
        return res.status(200).json({ success: true, data });`,
  "sync scadenza manuale"
);

const updateAction = `      if (action === "aggiorna_scadenza") {`;
const updateIndex = source.indexOf(updateAction);
if (updateIndex < 0) throw new Error("Sezione aggiorna_scadenza non trovata");

const beforeUpdate = source.slice(0, updateIndex);
let updateSection = source.slice(updateIndex);
const updateReturn = `        if (error) throw error;
        return res.status(200).json({ success: true, data });`;
if (!updateSection.includes(updateReturn)) {
  throw new Error("Return aggiorna_scadenza non trovato");
}
updateSection = updateSection.replace(
  updateReturn,
  `        if (error) throw error;
        await sincronizzaScadenzaCentrale(data);
        return res.status(200).json({ success: true, data });`
);
source = beforeUpdate + updateSection;

fs.writeFileSync(file, source);
console.log("✓ Redditivita Studio Incassi synced with Scadenzario centrale");
