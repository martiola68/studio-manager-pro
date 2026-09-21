function isNominaOrganoControllo(tipo: unknown) {
  const value = String(tipo || "").toLowerCase();
  return (
    value.includes("revisore") ||
    value.includes("revisione") ||
    value.includes("sindaco") ||
    value.includes("sindacale") ||
    value.includes("collegio") ||
    value.includes("organo di controllo")
  );
}

function isCambioAmministratore(tipo: unknown) {
  return String(tipo || "").toLowerCase().includes("amministratore");
}

function isDistribuzioneUtili(tipo: unknown) {
  return String(tipo || "").toLowerCase().includes("distribuzione");
}

export async function aggiornaStatiVariazione(
  supabase: any,
  variazioneId: string
) {
  if (!variazioneId) return;

  const { data: variazioni, error } = await supabase
    .from("tbpratiche_variazioni")
    .select("*")
    .eq("id", variazioneId)
    .limit(1);

  const variazione = variazioni?.[0] || null;

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
  const praticaVerbaleId = variazione.pratica_id;

  const nominaOrganoControllo = isNominaOrganoControllo(
    variazione.tipo_variazione
  );
  const cambioAmministratore = isCambioAmministratore(
    variazione.tipo_variazione
  );
  const distribuzioneUtili = isDistribuzioneUtili(
    variazione.tipo_variazione
  );
  const depositoCciaaDistribuzione =
    distribuzioneUtili &&
    (
      Number(variazione.giorni_scadenza_cciaa || 0) > 0 ||
      Boolean(variazione.data_scadenza_cciaa) ||
      Boolean(variazione.data_evasione_cciaa) ||
      variazione.pratica_cciaa_chiusa === true
    );

  if (praticaDeterminaId) {
    step_determina_stato = "in_lavorazione";

    const { data: docDetermina } = await supabase
      .from("tbpratiche_documenti")
      .select("id")
      .eq("pratica_id", praticaDeterminaId)
      .in("tipo_documento", [
        "DETERMINA_AU_CDA",
        "DETERMINA_LIQUIDAZIONE",
        "DETERMINA_CAUSA_SCIOGLIMENTO",
      ])
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
        "DISTRIBUZIONE_UTILI",
        "NOMINA_AMMINISTRATORI",
        "CAMBIO_AMMINISTRATORE",
        "VERBALE_NOMINA_AMMINISTRATORE",
        "VERBALE_CAMBIO_AMMINISTRATORE",
        "VERBALE_NOMINA_ORGANO_CONTROLLO",
      ])
      .limit(1);

    if (docVerbale && docVerbale.length > 0) {
      step_verbale_stato = "completato";
    }

    if (nominaOrganoControllo || cambioAmministratore) {
      const { data: docAccettazione } = await supabase
        .from("tbpratiche_documenti")
        .select("id")
        .eq("pratica_id", praticaVerbaleId)
        .eq("tipo_documento", "ACCETTAZIONE_CARICHE")
        .limit(1);

      step_accettazione_carica_stato =
        docAccettazione && docAccettazione.length > 0
          ? "completato"
          : "da_fare";
    }
  }

  if (praticaLiquidazioneId) {
    step_liquidazione_stato = "in_lavorazione";

    const { data: docLiquidazione } = await supabase
      .from("tbpratiche_documenti")
      .select("id")
      .eq("pratica_id", praticaLiquidazioneId)
      .in("tipo_documento", [
        "VERBALE_LIQUIDAZIONE",
        "MESSA_LIQUIDAZIONE",
        "VERBALE_ASSEMBLEA_LIQUIDAZIONE",
      ])
      .limit(1);

    const { data: datiLiquidazione } = await supabase
      .from("tbpratiche_dati_documenti")
      .select("verbale_definitivo")
      .eq("pratica_id", praticaLiquidazioneId)
      .maybeSingle();

    if (
      datiLiquidazione?.verbale_definitivo === true ||
      (docLiquidazione && docLiquidazione.length > 0)
    ) {
      step_liquidazione_stato = "completato";
    }

    const { data: docAccettazione } = await supabase
      .from("tbpratiche_documenti")
      .select("id")
      .eq("pratica_id", praticaLiquidazioneId)
      .eq("tipo_documento", "ACCETTAZIONE_CARICHE")
      .limit(1);

    step_accettazione_carica_stato =
      docAccettazione && docAccettazione.length > 0
        ? "completato"
        : "da_fare";
  }

  if (
    variazione.data_evasione_cciaa ||
    variazione.pratica_cciaa_chiusa === true
  ) {
    step_cciaa_stato = "completato";
  } else if (
    (!distribuzioneUtili || depositoCciaaDistribuzione) &&
    (
      praticaLiquidazioneId ||
      praticaVerbaleId ||
      praticaDeterminaId
    )
  ) {
    step_cciaa_stato =
      variazione.data_presentazione_cciaa || variazione.protocollo_cciaa
        ? "in_lavorazione"
        : "da_fare";
  }

  if (
    variazione.data_comunicazione_ade ||
    variazione.conferma_record === true
  ) {
    step_ade_stato = "completato";
  } else if (
    variazione.obbligo_ade === true &&
    (
      praticaLiquidazioneId ||
      praticaVerbaleId ||
      distribuzioneUtili
    )
  ) {
    step_ade_stato = "in_lavorazione";
  }

  const distribuzioneCompletata =
    distribuzioneUtili &&
    step_verbale_stato === "completato" &&
    step_ade_stato === "completato" &&
    (
      !depositoCciaaDistribuzione ||
      step_cciaa_stato === "completato"
    );

  const now = new Date().toISOString();

  const { error: updateError } = await supabase
    .from("tbpratiche_variazioni")
    .update({
      ...(distribuzioneUtili
        ? {
            stato: distribuzioneCompletata ? "completata" : "in_lavorazione",
            pratica_chiusa: distribuzioneCompletata,
          }
        : {}),
      step_determina_stato,
      step_verbale_stato,
      step_liquidazione_stato,
      step_accettazione_carica_stato,
      step_cciaa_stato,
      step_ade_stato,
      updated_at: now,
    })
    .eq("id", variazioneId);

  if (updateError) {
    console.error("Errore aggiornamento stati variazione:", updateError);
  }

  const stepStates: Record<string, string> = {
    DETERMINA: step_determina_stato,
    VERBALE: step_verbale_stato,
    LIQUIDAZIONE: step_liquidazione_stato,
    ACCETTAZIONE_CARICA: step_accettazione_carica_stato,
    DEPOSITO_CCIAA: step_cciaa_stato,
    COMUNICAZIONE_ADE: step_ade_stato,
  };

  for (const [codiceStep, stato] of Object.entries(stepStates)) {
    const completato = stato === "completato";
    const { error: stepError } = await supabase
      .from("tbpratiche_step")
      .update({
        stato,
        completato,
        data_completamento: completato ? now : null,
        updated_at: now,
      })
      .eq("variazione_id", variazioneId)
      .eq("codice_step", codiceStep);

    if (stepError) {
      console.error(
        `Errore aggiornamento step ${codiceStep} variazione ${variazioneId}:`,
        stepError
      );
    }
  }
}
