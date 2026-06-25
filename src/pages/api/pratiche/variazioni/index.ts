import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type ApiResponse =
  | { success: true; data: any }
  | { success: false; error: string };

const allowedEnti = ["CCIAA", "AGENZIA_ENTRATE"];
const allowedPriorita = ["bassa", "normale", "alta", "urgente"];
const allowedStati = ["memo", "da_convertire", "convertita", "archiviata"];
const allowedEsiti = ["Accettata", "Respinta", "Protocollata", "Evasa"];

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

  const stato = validateEnum(body.stato, allowedStati, "memo") || "memo";

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
    params.priorita === "urgente"
      ? "Alta"
      : params.priorita === "alta"
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
      .single();

    if (error) throw error;
    return data?.id || params.id;
  }

  const { data: existing } = await supabase
    .from("tbpromemoria")
    .select("id")
    .eq("origine", params.origine)
    .eq("origine_id", params.origine_id)
    .maybeSingle();

  if (existing?.id) {
    const { data, error } = await supabase
      .from("tbpromemoria")
      .update(payload)
      .eq("id", existing.id)
      .select("id")
      .single();

    if (error) throw error;
    return data?.id || existing.id;
  }

  const { data, error } = await supabase
    .from("tbpromemoria")
    .insert(payload)
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
}

async function sincronizzaPromemoriaVariazione(supabase: any, variazione: any) {
  const { data: cliente } = await supabase
  .from("tbclienti")
  .select("ragione_sociale")
  .eq("id", variazione.cliente_id)
  .single();

const { data: utente } = await supabase
  .from("tbutenti")
  .select("settore")
  .eq("id", variazione.assegnato_a)
  .single();
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
          *,
          cliente:tbclienti(id, ragione_sociale, codice_fiscale, partita_iva),
          assegnato:tbutenti!tbpratiche_variazioni_assegnato_a_fkey(id, nome, cognome, email),
          pratica:tbpratiche!tbpratiche_variazioni_pratica_id_fkey(id, numero_pratica, titolo, stato)
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

      return res.status(200).json({
        success: true,
        data: data || [],
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

      const { data, error } = await supabase
        .from("tbpratiche_variazioni")
        .insert(payload)
        .select(`
          *,
          cliente:tbclienti(id, ragione_sociale, codice_fiscale, partita_iva),
          assegnato:tbutenti!tbpratiche_variazioni_assegnato_a_fkey(id, nome, cognome, email),
          pratica:tbpratiche!tbpratiche_variazioni_pratica_id_fkey(id, numero_pratica, titolo, stato)
        `)
        .single();

      if (error) throw error;

      // ==============================
// CREA PRATICA PADRE
// ==============================

if (req.body.genera_pratica && !data.pratica_id) {

  const { data: praticaCreata, error: praticaError } = await supabase
    .from("tbpratiche")
    .insert({

      studio_id: data.studio_id,

      cliente_id: data.cliente_id,

      tipo_pratica_id: req.body.tipo_pratica_id,

      numero_pratica: `VAR-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`,

      titolo: data.titolo,

      stato: "Aperta",

      priorita: data.priorita,

      data_apertura: new Date(),

      assegnato_a: data.assegnato_a,

      pratica_padre_id: null,

      pratica_origine_id: null,

      variazione_id: data.id,

      codice_workflow: data.tipo_variazione,

      codice_step: "ROOT",

      ordine_step: 1,

      stato_step: "aperta"

    })
    .select("id")
    .single();

  if (praticaError) throw praticaError;

  await supabase
    .from("tbpratiche_variazioni")
    .update({
      pratica_id: praticaCreata.id,
      stato: "convertita"
    })
    .eq("id", data.id);

  data.pratica_id = praticaCreata.id;
  data.stato = "convertita";
}
      
      await sincronizzaPromemoriaVariazione(supabase, data);

      return res.status(201).json({
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

      const payload = buildPayload(body);

      delete (payload as any).studio_id;
      delete (payload as any).cliente_id;

      const { data, error } = await supabase
        .from("tbpratiche_variazioni")
        .update(payload)
        .eq("id", id)
        .select(`
          *,
          cliente:tbclienti(id, ragione_sociale, codice_fiscale, partita_iva),
          assegnato:tbutenti!tbpratiche_variazioni_assegnato_a_fkey(id, nome, cognome, email),
          pratica:tbpratiche!tbpratiche_variazioni_pratica_id_fkey(id, numero_pratica, titolo, stato)
        `)
        .single();

      if (error) throw error;

      await sincronizzaPromemoriaVariazione(supabase, data);

      return res.status(200).json({
        success: true,
        data,
      });
    }

  if (req.method === "DELETE") {
  const id =
    typeof req.query.id === "string"
      ? req.query.id
      : req.body?.id;

  if (!id) {
    return res.status(400).json({
      success: false,
      error: "id obbligatorio",
    });
  }

  const { data: variazione } = await supabase
    .from("tbpratiche_variazioni")
    .select(`
      promemoria_cciaa_id,
      promemoria_ade_id
    `)
    .eq("id", id)
    .single();

  const idsPromemoria = [
    variazione?.promemoria_cciaa_id,
    variazione?.promemoria_ade_id,
  ].filter(Boolean);

  if (idsPromemoria.length > 0) {
    await supabase
      .from("tbpromemoria")
      .delete()
      .in("id", idsPromemoria);
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
    return res.status(405).json({
      success: false,
      error: "Metodo non consentito",
    });
  } catch (error: any) {
    console.error("Errore API pratiche variazioni:", error);

    return res.status(500).json({
      success: false,
      error: error?.message || "Errore interno",
    });
  }
}
