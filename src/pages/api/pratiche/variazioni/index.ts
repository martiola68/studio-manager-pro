import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { aggiornaStatiVariazione } from "@/lib/pratiche/aggiornaStatiVariazione";

type ApiResponse =
  | { success: true; data: any }
  | { success: false; error: string };

const allowedEnti = ["CCIAA", "AGENZIA_ENTRATE"];
const allowedPriorita = ["bassa", "normale", "alta", "urgente"];
const allowedStati = ["aperta", "in_lavorazione", "completata"];
const allowedEsiti = ["Accettata", "Respinta", "Protocollata", "Evasa"];

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

function cleanString(value: any) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function cleanBoolean(value: any, fallback = false) {
  if (value === undefined || value === null) return fallback;
  return value === true;
}

function cleanInteger(value: any, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
}

function validateEnum(
  value: any,
  allowed: string[],
  fallback: string | null = null
) {
  const cleaned = cleanString(value);
  if (!cleaned) return fallback;
  return allowed.includes(cleaned) ? cleaned : fallback;
}

function buildPayload(body: any) {
  const entePrincipale =
    validateEnum(body.ente_principale, allowedEnti, "CCIAA") || "CCIAA";

  const priorita =
    validateEnum(body.priorita, allowedPriorita, "normale") || "normale";

  const stato = validateEnum(body.stato, allowedStati, "aperta") || "aperta";

  const esitoCciaa = validateEnum(body.esito_cciaa, allowedEsiti, null);
  const esitoAde = validateEnum(body.esito_ade, allowedEsiti, null);

  return {
    studio_id: body.studio_id,
    cliente_id: body.cliente_id,
    pratica_id: body.pratica_id || null,

    titolo: cleanString(body.titolo),
    descrizione: cleanString(body.descrizione),
    tipo_variazione: cleanString(body.tipo_variazione),

    priorita,
    assegnato_a: body.assegnato_a || null,

    data_atto: body.data_atto || null,
    giorni_scadenza_cciaa: cleanInteger(body.giorni_scadenza_cciaa, 30),
    data_scadenza_cciaa: body.data_scadenza_cciaa || null,

    ente_principale: entePrincipale,

    data_presentazione_cciaa: body.data_presentazione_cciaa || null,
    protocollo_cciaa: cleanString(body.protocollo_cciaa),
    data_evasione_cciaa: body.data_evasione_cciaa || null,
    esito_cciaa: esitoCciaa,
    ricevuta_cciaa: cleanString(body.ricevuta_cciaa),
    pratica_cciaa_chiusa: cleanBoolean(body.pratica_cciaa_chiusa),

    obbligo_ade: cleanBoolean(body.obbligo_ade),
    giorni_scadenza_ade: cleanInteger(body.giorni_scadenza_ade, 30),
    data_scadenza_ade: body.data_scadenza_ade || null,
    data_comunicazione_ade: body.data_comunicazione_ade || null,
    protocollo_ade: cleanString(body.protocollo_ade),
    ricevuta_telematica_ade: cleanString(body.ricevuta_telematica_ade),
    esito_ade: esitoAde,
    pratica_ade_chiusa: cleanBoolean(body.pratica_ade_chiusa),

    conferma_record: cleanBoolean(body.conferma_record),
    pratica_chiusa: cleanBoolean(body.pratica_chiusa),

    stato,
    genera_verbale: cleanBoolean(body.genera_verbale),
    richiede_pratica: cleanBoolean(body.richiede_pratica),

    note: cleanString(body.note),
  };
}

async function creaOAggiornaPromemoria(
  supabase: any,
  params: {
    id?: string | null;
    studio_id: string;
    cliente_id: string;
    assegnato_a: string | null;
    titolo: string;
    descrizione: string;
    data_scadenza: string;
    priorita: string;
    origine: string;
    origine_id: string;
    tipo: string;
    settore: string | null;
  }
) {
  const payload = {
    studio_id: params.studio_id,
    destinatario_id: params.assegnato_a,
    operatore_id: params.assegnato_a,
    titolo: params.titolo,
    descrizione: params.descrizione,
    data_scadenza: params.data_scadenza,
    priorita:
      params.priorita === "urgente" || params.priorita === "alta"
        ? "Alta"
        : params.priorita === "bassa"
        ? "Bassa"
        : "Media",
    working_progress: "Aperto",
    origine: params.origine,
    origine_id: params.origine_id,
    tipo: params.tipo,
    settore: params.settore,
  };

  if (params.id) {
    const { data, error } = await supabase
      .from("tbpromemoria")
      .update(payload)
      .eq("id", params.id)
      .select("id")
      .limit(1);

    if (error) throw error;
    if (data?.[0]?.id) return data[0].id;
  }

  const { data: existingRows, error: existingError } = await supabase
    .from("tbpromemoria")
    .select("id")
    .eq("origine", params.origine)
    .eq("origine_id", params.origine_id)
    .limit(1);

  if (existingError) throw existingError;
  const existingId = existingRows?.[0]?.id || null;

  if (existingId) {
    const { data, error } = await supabase
      .from("tbpromemoria")
      .update(payload)
      .eq("id", existingId)
      .select("id")
      .limit(1);

    if (error) throw error;
    return data?.[0]?.id || existingId;
  }

  const { data, error } = await supabase
    .from("tbpromemoria")
    .insert(payload)
    .select("id")
    .limit(1);

  if (error) throw error;
  if (!data?.[0]?.id) throw new Error("Promemoria creato senza id");
  return data[0].id;
}

async function sincronizzaPromemoriaVariazione(supabase: any, variazione: any) {
  const { data: clienteRows } = await supabase
    .from("tbclienti")
    .select("ragione_sociale")
    .eq("id", variazione.cliente_id)
    .limit(1);
  const cliente = clienteRows?.[0] || null;

  const { data: utenteRows } = await supabase
    .from("tbutenti")
    .select("settore")
    .eq("id", variazione.assegnato_a)
    .limit(1);
  const utente = utenteRows?.[0] || null;
  const updatePayload: any = {};

  if (variazione.data_scadenza_cciaa) {
   const promemoriaCciaaId = await creaOAggiornaPromemoria(supabase, {
  id: variazione.promemoria_cciaa_id,
  studio_id: variazione.studio_id,
  cliente_id: variazione.cliente_id,
  assegnato_a: variazione.assegnato_a,
  titolo: cliente?.ragione_sociale || variazione.tipo_variazione,
  descrizione: `Variazione CCIAA: ${variazione.tipo_variazione}`,
  data_scadenza: variazione.data_scadenza_cciaa,
  priorita: variazione.priorita,
  origine: "variazione_cciaa",
  origine_id: variazione.id,
  tipo: "CCIAA",
  settore: utente?.settore || null,
});
    updatePayload.promemoria_cciaa_id = promemoriaCciaaId;
  }

  if (variazione.obbligo_ade && variazione.data_scadenza_ade) {
    const promemoriaAdeId = await creaOAggiornaPromemoria(supabase, {
      id: variazione.promemoria_ade_id,
      studio_id: variazione.studio_id,
      cliente_id: variazione.cliente_id,
      assegnato_a: variazione.assegnato_a,
      titolo: cliente?.ragione_sociale || variazione.tipo_variazione,
      descrizione: `Comunicazione Agenzia Entrate: ${variazione.tipo_variazione}`,
      data_scadenza: variazione.data_scadenza_ade,
      priorita: variazione.priorita,
        origine: "variazione_ade",
    origine_id: variazione.id,

    tipo: "Agenzia delle Entrate",
    settore: utente?.settore || null,
  });

    updatePayload.promemoria_ade_id = promemoriaAdeId;
  }

  if (Object.keys(updatePayload).length > 0) {
    await supabase
      .from("tbpratiche_variazioni")
      .update(updatePayload)
      .eq("id", variazione.id);
  }
}

function getStepVariazione(
  tipoVariazione: string,
  obbligoAde: boolean,
  variazione?: any
) {
  const tipo = String(tipoVariazione || "").toLowerCase();

  if (tipo.includes("scioglimento") || tipo.includes("liquidazione")) {
    return [
      { ordine: 1, codice_step: "DETERMINA", titolo: "Determina", ente: "CCIAA" },
      { ordine: 2, codice_step: "LIQUIDAZIONE", titolo: "Liquidazione", ente: "CCIAA" },
      { ordine: 3, codice_step: "ACCETTAZIONE_CARICA", titolo: "Accettazione carica", ente: "CCIAA" },
      { ordine: 4, codice_step: "DEPOSITO_CCIAA", titolo: "Deposito pratica CCIAA", ente: "CCIAA" },
      ...(obbligoAde
        ? [{ ordine: 5, codice_step: "COMUNICAZIONE_ADE", titolo: "Comunicazione Agenzia Entrate", ente: "AGENZIA_ENTRATE" }]
        : []),
    ];
  }

  if (tipo.includes("amministratore")) {
  return [
    {
      ordine: 1,
      codice_step: "VERBALE",
      titolo: "Verbale",
      ente: "Interno",
    },
    {
      ordine: 2,
      codice_step: "ACCETTAZIONE_CARICA",
      titolo: "Accettazione carica",
      ente: "CCIAA",
    },
    {
      ordine: 3,
      codice_step: "DEPOSITO_CCIAA",
      titolo: "Deposito pratica CCIAA",
      ente: "CCIAA",
    },
  ];
}

if (tipo.includes("distribuzione")) {
  const depositoCciaa =
    Number(variazione?.giorni_scadenza_cciaa || 0) > 0 ||
    Boolean(variazione?.data_scadenza_cciaa) ||
    Boolean(variazione?.data_evasione_cciaa) ||
    variazione?.pratica_cciaa_chiusa === true;

  return [
    {
      ordine: 1,
      codice_step: "VERBALE",
      titolo: "Verbale distribuzione utili",
      ente: "Interno",
    },
    ...(depositoCciaa
      ? [
          {
            ordine: 2,
            codice_step: "DEPOSITO_CCIAA",
            titolo: "Deposito pratica CCIAA",
            ente: "CCIAA",
          },
        ]
      : []),
    {
      ordine: depositoCciaa ? 3 : 2,
      codice_step: "COMUNICAZIONE_ADE",
      titolo: "Deposito Agenzia Entrate",
      ente: "AGENZIA_ENTRATE",
    },
  ];
}

  if (
    tipo.includes("amministratore") ||
    tipo.includes("nomina") ||
    tipo.includes("cambio")
  ) {
    return [
      { ordine: 1, codice_step: "VERBALE", titolo: "Verbale", ente: "CCIAA" },
      { ordine: 2, codice_step: "ACCETTAZIONE_CARICA", titolo: "Accettazione carica", ente: "CCIAA" },
      { ordine: 3, codice_step: "DEPOSITO_CCIAA", titolo: "Deposito pratica CCIAA", ente: "CCIAA" },
    ];
  }

  if (tipo.includes("apertura") && tipo.includes("unit")) {
    return [
      { ordine: 1, codice_step: "DEPOSITO_CCIAA", titolo: "Deposito pratica CCIAA", ente: "CCIAA" },
      { ordine: 2, codice_step: "SCIA", titolo: "SCIA", ente: "SUAP" },
    ];
  }

  if (tipo.includes("chiusura") && tipo.includes("unit")) {
    return [
      { ordine: 1, codice_step: "DEPOSITO_CCIAA", titolo: "Deposito pratica CCIAA", ente: "CCIAA" },
    ];
  }

  return [
    { ordine: 1, codice_step: "DEPOSITO_CCIAA", titolo: "Deposito pratica CCIAA", ente: "CCIAA" },
  ];
}

async function creaStepVariazione(supabase: any, variazione: any) {
  if (!variazione?.id) return;

  const { data: esistenti } = await supabase
    .from("tbpratiche_step")
    .select("id")
    .eq("variazione_id", variazione.id)
    .limit(1);

  if (esistenti && esistenti.length > 0) return;

  const steps = getStepVariazione(
    variazione.tipo_variazione,
    variazione.obbligo_ade === true,
    variazione
  );

const praticaUuid =
  variazione.pratica_determina_id || variazione.pratica_id;

if (!praticaUuid) {
  console.warn("Pratica non ancora creata:", variazione.id);
  return;
}
const rows = steps.map((step) => ({
  variazione_id: variazione.id,
  pratica_id: null,
  pratica_uuid: praticaUuid,
  documento_id: null,
    codice_step: step.codice_step,
    ordine: step.ordine,
    ente: step.ente,
    titolo: step.titolo,
    descrizione: step.titolo,
    stato: "da_fare",
    obbligatorio: true,
    completato: false,
    data_scadenza: null,
    data_evasione: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from("tbpratiche_step")
    .insert(rows);

 if (error) {
  console.error("Errore creazione step variazione:", error);
  throw error;
}
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  const supabase = getSupabaseAdmin();

  try {
    if (req.method === "GET") {
      const {
        studio_id,
        cliente_id,
        stato,
        ente_principale,
        assegnato_a,
        pratica_id,
      } = req.query;

      if (!studio_id || typeof studio_id !== "string") {
        return res.status(400).json({
          success: false,
          error: "studio_id obbligatorio",
        });
      }

      let query = supabase
        .from("tbpratiche_variazioni")
        .select(`
          id,
          cliente_id,
          tipo_variazione,
          ente_principale,
          priorita,
          data_atto,
          giorni_scadenza_cciaa,
          data_scadenza_cciaa,
          data_evasione_cciaa,
          pratica_cciaa_chiusa,
          obbligo_ade,
          giorni_scadenza_ade,
          data_scadenza_ade,
          data_comunicazione_ade,
          ricevuta_telematica_ade,
          conferma_record,
          genera_verbale,
          note,
          pratica_id,
          pratica_determina_id,
          pratica_liquidazione_id,
          stato,
          step_determina_stato,
          step_verbale_stato,
          step_liquidazione_stato,
          step_accettazione_carica_stato,
          step_cciaa_stato,
          step_ade_stato,
          data_presentazione_cciaa,
          protocollo_cciaa,
          created_at,
          cliente:tbclienti(id, ragione_sociale)
        `)
        .eq("studio_id", studio_id)
        .order("data_atto", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });

      if (cliente_id && typeof cliente_id === "string") {
        query = query.eq("cliente_id", cliente_id);
      }

      if (stato && typeof stato === "string" && stato !== "tutti") {
        query = query.eq("stato", stato);
      }

      if (
        ente_principale &&
        typeof ente_principale === "string" &&
        ente_principale !== "tutti"
      ) {
        query = query.eq("ente_principale", ente_principale);
      }

      if (assegnato_a && typeof assegnato_a === "string") {
        query = query.eq("assegnato_a", assegnato_a);
      }

      if (pratica_id && typeof pratica_id === "string") {
        query = query.eq("pratica_id", pratica_id);
      }

     const { data, error } = await query;

if (error) throw error;

const distribuzioniSenzaPratica = (data || []).filter(
  (v: any) =>
    String(v.tipo_variazione || "").toLowerCase().includes("distribuzione") &&
    !v.pratica_id
);

// La GET dell'elenco deve essere read-only: eventuali collegamenti legacy
// vengono risolti in memoria, senza UPDATE per ogni riga durante la visualizzazione.
if (distribuzioniSenzaPratica.length > 0) {
  const idsVariazione = distribuzioniSenzaPratica.map((v: any) => v.id);
  const { data: praticheCollegate, error: praticheCollegateError } = await supabase
    .from("tbpratiche")
    .select("id, variazione_id, created_at")
    .in("variazione_id", idsVariazione)
    .order("created_at", { ascending: false });

  if (praticheCollegateError) throw praticheCollegateError;

  const praticaByVariazione = new Map<string, string>();
  for (const pratica of praticheCollegate || []) {
    if (
      pratica.variazione_id &&
      !praticaByVariazione.has(String(pratica.variazione_id))
    ) {
      praticaByVariazione.set(
        String(pratica.variazione_id),
        String(pratica.id)
      );
    }
  }

  for (const variazione of distribuzioniSenzaPratica) {
    const praticaIdRipristinata = praticaByVariazione.get(String(variazione.id));
    if (praticaIdRipristinata) {
      variazione.pratica_id = praticaIdRipristinata;
    }
  }
}

const dataArricchita = (data || []).map((v: any) => ({
  ...v,
  step_determina_stato: v.step_determina_stato || "da_fare",
  step_verbale_stato: v.step_verbale_stato || "da_fare",
  step_liquidazione_stato: v.step_liquidazione_stato || "da_fare",
  step_accettazione_carica_stato:
    v.step_accettazione_carica_stato || "da_fare",
  step_cciaa_stato: v.step_cciaa_stato || "da_fare",
  step_ade_stato: v.step_ade_stato || "da_fare",
}));

return res.status(200).json({
  success: true,
  data: dataArricchita,
});
    }

    if (req.method === "POST") {
      const payload = buildPayload(req.body || {});

      if (!payload.studio_id) {
        return res.status(400).json({
          success: false,
          error: "studio_id obbligatorio",
        });
      }

      if (!payload.cliente_id) {
        return res.status(400).json({
          success: false,
          error: "cliente_id obbligatorio",
        });
      }

      if (!payload.titolo) {
        return res.status(400).json({
          success: false,
          error: "titolo obbligatorio",
        });
      }

      if (!payload.tipo_variazione) {
        return res.status(400).json({
          success: false,
          error: "tipo_variazione obbligatorio",
        });
      }

      if (!payload.assegnato_a) {
        return res.status(400).json({
          success: false,
          error: "assegnato_a obbligatorio",
        });
      }

      const { data, error } = await supabase
        .from("tbpratiche_variazioni")
        .insert(payload)
        .select()
        .single();

      if (error) throw error;

      await creaStepVariazione(supabase, data);
      await sincronizzaPromemoriaVariazione(supabase, data);
      await aggiornaStatiVariazione(supabase, data.id);

      return res.status(200).json({
        success: true,
        data,
      });
    }

    if (req.method === "PUT") {
      const { id, ...body } = req.body || {};

      if (!id) {
        return res.status(400).json({
          success: false,
          error: "id obbligatorio",
        });
      }

      const { data: variazioniEsistenti, error: variazioneEsistenteError } =
        await supabase
          .from("tbpratiche_variazioni")
          .select("id, pratica_id, tipo_variazione")
          .eq("id", id)
          .limit(1);

      if (variazioneEsistenteError) throw variazioneEsistenteError;

      const variazioneEsistente = variazioniEsistenti?.[0] || null;
      if (!variazioneEsistente) {
        return res.status(404).json({
          success: false,
          error: "Variazione non trovata",
        });
      }

      let praticaId =
        body.pratica_id !== undefined
          ? body.pratica_id
          : variazioneEsistente.pratica_id || null;

      // Le distribuzioni utili legacy possono avere la pratica collegata
      // tramite tbpratiche.variazione_id ma pratica_id nullo sulla variazione.
      // Recuperiamo e persistiamo il collegamento prima del ricalcolo stati.
      const isDistribuzioneUtili = String(
        body.tipo_variazione || variazioneEsistente.tipo_variazione || ""
      )
        .toLowerCase()
        .includes("distribuzione");

      if (isDistribuzioneUtili && !praticaId) {
        const { data: praticheLegacy, error: praticheLegacyError } =
          await supabase
            .from("tbpratiche")
            .select("id, created_at")
            .eq("variazione_id", id)
            .order("created_at", { ascending: false })
            .limit(1);

        if (praticheLegacyError) throw praticheLegacyError;
        praticaId = praticheLegacy?.[0]?.id || null;
      }

      const payload = buildPayload({
        ...body,
        pratica_id: praticaId,
      });

      const { data: updatedRows, error } = await supabase
        .from("tbpratiche_variazioni")
        .update(payload)
        .eq("id", id)
        .select()
        .limit(1);

      if (error) throw error;

      const data = updatedRows?.[0] || null;
      if (!data) {
        return res.status(404).json({
          success: false,
          error: "Variazione non trovata dopo l'aggiornamento",
        });
      }

      await creaStepVariazione(supabase, data);
      await sincronizzaPromemoriaVariazione(supabase, data);

      const now = new Date().toISOString();

      if (data.pratica_cciaa_chiusa === true || data.data_evasione_cciaa) {
        await supabase
          .from("tbpratiche_step")
          .update({
            data_evasione: data.data_evasione_cciaa || null,
            stato: "completato",
            completato: true,
            data_completamento: now,
            updated_at: now,
          })
          .eq("variazione_id", id)
          .eq("codice_step", "DEPOSITO_CCIAA");
      }

      if (data.conferma_record === true || data.data_comunicazione_ade) {
        await supabase
          .from("tbpratiche_step")
          .update({
            data_evasione: data.data_comunicazione_ade || null,
            stato: "completato",
            completato: true,
            data_completamento: now,
            updated_at: now,
          })
          .eq("variazione_id", id)
          .eq("codice_step", "COMUNICAZIONE_ADE");
      }

      // Il verbale NON viene forzato completato: deve risultare realmente
      // presente in tbpratiche_documenti. Il ricalcolo lo rileva subito.
      await aggiornaStatiVariazione(supabase, id);

      const { data: finalRows, error: finalError } = await supabase
        .from("tbpratiche_variazioni")
        .select("*")
        .eq("id", id)
        .limit(1);

      if (finalError) throw finalError;

      return res.status(200).json({
        success: true,
        data: finalRows?.[0] || data,
      });
    }

    if (req.method === "DELETE") {
      const { id } = req.query;

      if (!id || typeof id !== "string") {
        return res.status(400).json({
          success: false,
          error: "id obbligatorio",
        });
      }

      const { error } = await supabase
        .from("tbpratiche_variazioni")
        .delete()
        .eq("id", id);

      if (error) throw error;

      return res.status(200).json({
        success: true,
        data: { id },
      });
    }

    res.setHeader("Allow", ["GET", "POST", "PUT", "DELETE"]);
    return res.status(405).json({
      success: false,
      error: "Metodo non consentito",
    });
  } catch (error: any) {
    console.error("Errore API variazioni:", error);

    return res.status(500).json({
      success: false,
      error: error?.message || "Errore interno server",
    });
  }
}
