import { createClient } from "@supabase/supabase-js";
import { mkdirSync, writeFileSync } from "node:fs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Supabase env mancanti per riallineamento distribuzione utili");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: variazioni, error: varError } = await supabase
  .from("tbpratiche_variazioni")
  .select("*")
  .ilike("tipo_variazione", "%Distribuzione utili%");

if (varError) throw varError;

const report = [];

for (const v of variazioni || []) {
  let praticaId = v.pratica_id || null;

  if (!praticaId) {
    const { data: pratiche, error: praticaError } = await supabase
      .from("tbpratiche")
      .select("id, created_at")
      .eq("variazione_id", v.id)
      .order("created_at", { ascending: false })
      .limit(1);

    if (praticaError) throw praticaError;
    praticaId = pratiche?.[0]?.id || null;
  }

  let verbaleCompletato = false;
  if (praticaId) {
    const { data: docs, error: docsError } = await supabase
      .from("tbpratiche_documenti")
      .select("id, tipo_documento")
      .eq("pratica_id", praticaId)
      .in("tipo_documento", [
        "VERBALE_UTILI",
        "VERBALE_DISTRIBUZIONE_UTILI",
        "DISTRIBUZIONE_UTILI",
      ])
      .limit(1);

    if (docsError) throw docsError;
    verbaleCompletato = Boolean(docs?.[0]?.id);
  }

  const cciaaRichiesta =
    Number(v.giorni_scadenza_cciaa || 0) > 0 ||
    Boolean(v.data_evasione_cciaa) ||
    Boolean(v.data_presentazione_cciaa) ||
    Boolean(v.protocollo_cciaa) ||
    v.pratica_cciaa_chiusa === true;

  const cciaaCompletata =
    !cciaaRichiesta ||
    v.pratica_cciaa_chiusa === true ||
    Boolean(v.data_evasione_cciaa);

  const adeCompletata =
    v.conferma_record === true ||
    Boolean(v.data_comunicazione_ade);

  const completata =
    verbaleCompletato &&
    adeCompletata &&
    cciaaCompletata;

  const updatePayload = {
    pratica_id: praticaId,
    step_verbale_stato: verbaleCompletato ? "completato" : "da_fare",
    step_cciaa_stato: cciaaRichiesta
      ? cciaaCompletata
        ? "completato"
        : "da_fare"
      : "da_fare",
    step_ade_stato: adeCompletata ? "completato" : "da_fare",
    stato: completata ? "completata" : "in_lavorazione",
    pratica_chiusa: completata,
    updated_at: new Date().toISOString(),
  };

  const { error: updateError } = await supabase
    .from("tbpratiche_variazioni")
    .update(updatePayload)
    .eq("id", v.id);

  if (updateError) throw updateError;

  const stepMap = {
    VERBALE: updatePayload.step_verbale_stato,
    DEPOSITO_CCIAA: updatePayload.step_cciaa_stato,
    COMUNICAZIONE_ADE: updatePayload.step_ade_stato,
  };

  for (const [codice_step, stato] of Object.entries(stepMap)) {
    const completato = stato === "completato";
    const { error: stepError } = await supabase
      .from("tbpratiche_step")
      .update({
        stato,
        completato,
        data_completamento: completato ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("variazione_id", v.id)
      .eq("codice_step", codice_step);

    if (stepError) throw stepError;
  }

  if (praticaId) {
    const { error: praticaUpdateError } = await supabase
      .from("tbpratiche")
      .update({
        stato: completata ? "Completata" : "In lavorazione",
        stato_step: completata ? "completato" : "in_lavorazione",
        updated_at: new Date().toISOString(),
      })
      .eq("id", praticaId);

    if (praticaUpdateError) throw praticaUpdateError;
  }

  report.push({
    id: v.id,
    pratica_id: praticaId,
    cliente_id: v.cliente_id,
    verbale_completato: verbaleCompletato,
    cciaa_richiesta: cciaaRichiesta,
    cciaa_completata: cciaaCompletata,
    ade_completata: adeCompletata,
    completata,
  });
}

mkdirSync("public", { recursive: true });
writeFileSync(
  "public/oneoff-riallineamento-distribuzione-utili.json",
  JSON.stringify(
    {
      status: "completed",
      count: report.length,
      rows: report,
      generated_at: new Date().toISOString(),
    },
    null,
    2
  ),
  "utf8"
);

console.log("✓ Riallineamento Distribuzione utili completato", report);
