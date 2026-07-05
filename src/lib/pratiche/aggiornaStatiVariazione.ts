export async function aggiornaStatiVariazione(
  supabase: any,
  variazioneId: string
) {
  if (!variazioneId) return;

  const { data: variazione, error } = await supabase
    .from("tbpratiche_variazioni")
    .select("*")
    .eq("id", variazioneId)
    .single();

  if (error || !variazione) {
    console.error("Errore caricamento variazione:", error);
    return;
  }

 let step_determina_stato = "da_fare";
let step_verbale_stato = "da_fare";
let step_liquidazione_stato = "da_fare";
let step_accettazione_carica_stato = "da_fare";
let step_cciaa_stato = "da_fare";
let step_ade_stato = "da_fare";

  const praticaDeterminaId = variazione.pratica_determina_id;
  const praticaLiquidazioneId = variazione.pratica_liquidazione_id;

  const praticaVerbaleId =
  variazione.pratica_verbale_id ||
  variazione.pratica_distribuzione_id ||
  variazione.pratica_cambio_amministratore_id ||
  variazione.pratica_id;

  if (praticaDeterminaId) {
    step_determina_stato = "in_lavorazione";

    const { data: docDetermina } = await supabase
      .from("tbpratiche_documenti")
      .select("id")
      .eq("pratica_id", praticaDeterminaId)
      .in("tipo_documento", ["DETERMINA_AU_CDA", "DETERMINA_LIQUIDAZIONE", "DETERMINA_CAUSA_SCIOGLIMENTO"])
      .limit(1);

    if (docDetermina && docDetermina.length > 0) {
      step_determina_stato = "completato";
    }
  }

  if (praticaVerbaleId) {
  step_verbale_stato = "in_lavorazione";

  const { data: docVerbale } = await supabase
    .from("tbpratiche_documenti")
    .select("id")
    .eq("pratica_id", praticaVerbaleId)
    .in("tipo_documento", [
      "VERBALE_UTILI",
      "VERBALE_DISTRIBUZIONE_UTILI",
      "NOMINA_AMMINISTRATORI",
      "CAMBIO_AMMINISTRATORE",
      "VERBALE_NOMINA_AMMINISTRATORE",
      "VERBALE_CAMBIO_AMMINISTRATORE",
    ])
    .limit(1);

  if (docVerbale && docVerbale.length > 0) {
    step_verbale_stato = "completato";
  }
}

  if (praticaLiquidazioneId) {
    step_liquidazione_stato = "in_lavorazione";

    const { data: docLiquidazione } = await supabase
      .from("tbpratiche_documenti")
      .select("id")
      .eq("pratica_id", praticaLiquidazioneId)
      .in("tipo_documento", ["VERBALE_LIQUIDAZIONE", "MESSA_LIQUIDAZIONE", "VERBALE_ASSEMBLEA_LIQUIDAZIONE"])
      .limit(1);

   const { data: datiLiquidazione } = await supabase
  .from("tbpratiche_dati_documenti")
  .select("verbale_definitivo")
  .eq("pratica_id", praticaLiquidazioneId)
  .maybeSingle();

if (datiLiquidazione?.verbale_definitivo === true) {
  step_liquidazione_stato = "completato";
}

    const { data: docAccettazione } = await supabase
      .from("tbpratiche_documenti")
      .select("id")
      .eq("pratica_id", praticaLiquidazioneId)
      .eq("tipo_documento", "ACCETTAZIONE_CARICHE")
      .limit(1);

   if (docAccettazione && docAccettazione.length > 0) {
  step_accettazione_carica_stato = "completato";
} else {
  step_accettazione_carica_stato = "da_fare";
}
  }

  if (variazione.data_evasione_cciaa) {
    step_cciaa_stato = "completato";
  } else if (praticaLiquidazioneId) {
    step_cciaa_stato = "in_lavorazione";
  }

  if (variazione.data_comunicazione_ade || variazione.conferma_record === true) {
    step_ade_stato = "completato";
  } else if (praticaLiquidazioneId) {
    step_ade_stato = "in_lavorazione";
  }

  const { error: updateError } = await supabase
    .from("tbpratiche_variazioni")
    .update({
  step_determina_stato,
  step_verbale_stato,
  step_liquidazione_stato,
  step_accettazione_carica_stato,
  step_cciaa_stato,
  step_ade_stato,
  updated_at: new Date().toISOString(),
})
    .eq("id", variazioneId);

  if (updateError) {
    console.error("Errore aggiornamento stati variazione:", updateError);
  }
}
