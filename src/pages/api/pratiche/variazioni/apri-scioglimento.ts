import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { aggiornaStatiVariazione } from "@/lib/pratiche/aggiornaStatiVariazione";

type ApiResult = { success: true; pratica_id: string } | { success: false; error: string };

const steps = [
  { ordine: 1, codice_step: "DETERMINA", titolo: "Determina", ente: "CCIAA" },
  { ordine: 2, codice_step: "LIQUIDAZIONE", titolo: "Liquidazione", ente: "CCIAA" },
  { ordine: 3, codice_step: "ACCETTAZIONE_CARICA", titolo: "Accettazione carica", ente: "CCIAA" },
  { ordine: 4, codice_step: "DEPOSITO_CCIAA", titolo: "Deposito pratica CCIAA", ente: "CCIAA" },
  { ordine: 5, codice_step: "COMUNICAZIONE_ADE", titolo: "Comunicazione Agenzia Entrate", ente: "AGENZIA_ENTRATE" },
];

export default async function handler(req: NextApiRequest, res: NextApiResponse<ApiResult>) {
  if (req.method !== "POST") return res.status(405).json({ success: false, error: "Metodo non consentito" });

  const id = String(req.body?.variazione_id || "").trim();
  if (!id) return res.status(400).json({ success: false, error: "ID variazione obbligatorio" });
  const supabase = getSupabaseAdmin();
  try {
    const authorization = String(req.headers.authorization || "");
    const token = authorization.toLowerCase().startsWith("bearer ") ? authorization.slice(7).trim() : "";
    if (!token) return res.status(401).json({ success: false, error: "Accesso richiesto" });
    const { data: auth, error: authError } = await supabase.auth.getUser(token);
    if (authError || !auth.user) return res.status(401).json({ success: false, error: "Sessione scaduta" });

    let { data: operatore, error: operatorError } = await supabase
      .from("tbutenti").select("studio_id")
      .eq("user_id", auth.user.id).eq("attivo", true).limit(1).maybeSingle();
    if (!operatore && !operatorError && auth.user.email) {
      const fallback = await supabase.from("tbutenti").select("studio_id")
        .ilike("email", auth.user.email).eq("attivo", true).limit(1).maybeSingle();
      operatore = fallback.data;
      operatorError = fallback.error;
    }
    if (operatorError || !operatore?.studio_id) return res.status(403).json({ success: false, error: "Utente dello studio non autorizzato" });

    const studioId = operatore.studio_id;
    const { data: v, error: variationError } = await supabase.from("tbpratiche_variazioni")
      .select("id, studio_id, cliente_id, tipo_variazione, titolo, priorita, assegnato_a, data_atto, obbligo_ade, pratica_determina_id, pratica_id")
      .eq("id", id).eq("studio_id", studioId).maybeSingle();
    if (variationError) throw variationError;
    if (!v) return res.status(404).json({ success: false, error: "Variazione non presente nello studio" });
    if (String(v.tipo_variazione || "").trim().toLowerCase() !== "scioglimento e liquidazione") {
      return res.status(400).json({ success: false, error: "Tipo di variazione non compatibile con la determina" });
    }

    const { data: tipo, error: tipoError } = await supabase.from("tbpratiche_tipi")
      .select("id").eq("classe_form", "determina_liquidazione").eq("attiva", true).limit(1).maybeSingle();
    if (tipoError) throw tipoError;
    if (!tipo?.id) return res.status(422).json({ success: false, error: "Il tipo pratica Determina di scioglimento non è configurato: verifica il catalogo delle pratiche." });

    let praticaId: string | null = null;
    if (v.pratica_determina_id || v.pratica_id) {
      const linkedIds = [v.pratica_determina_id, v.pratica_id].filter(Boolean);
      const { data: linked, error: linkedError } = await supabase.from("tbpratiche")
        .select("id, tipo_pratica_id").in("id", linkedIds)
        .eq("studio_id", studioId).eq("cliente_id", v.cliente_id);
      if (linkedError) throw linkedError;
      praticaId = linked?.find((p: any) => p.tipo_pratica_id === tipo.id)?.id || null;
    }

    if (!praticaId) {
      const { data: existing, error: existingError } = await supabase.from("tbpratiche")
        .select("id").eq("variazione_id", v.id).eq("studio_id", studioId)
        .eq("cliente_id", v.cliente_id).eq("tipo_pratica_id", tipo.id)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (existingError) throw existingError;
      praticaId = existing?.id || null;
    }

    if (!praticaId) {
      const timestamp = new Date().toISOString();
      const { data: created, error: createError } = await supabase.from("tbpratiche").insert({
        studio_id: studioId,
        cliente_id: v.cliente_id,
        tipo_pratica_id: tipo.id,
        numero_pratica: "VAR-SCI-" + Date.now().toString(36) + "-" + v.id.slice(0, 6),
        titolo: "Determina causa scioglimento",
        stato: "Aperta",
        priorita: v.priorita || "normale",
        data_apertura: v.data_atto || timestamp,
        assegnato_a: v.assegnato_a || null,
        pratica_padre_id: null,
        pratica_origine_id: null,
        variazione_id: v.id,
        codice_workflow: "scioglimento_liquidazione",
        codice_step: "DETERMINA",
        nome_step: "Determina causa scioglimento",
        ordine_step: 1,
        stato_step: "aperta",
      }).select("id").single();
      if (createError || !created?.id) throw createError || new Error("Creazione determina non riuscita");
      praticaId = created.id;
    }

    const { error: linkError } = await supabase.from("tbpratiche_variazioni")
      .update({ pratica_determina_id: praticaId, stato: "in_lavorazione" })
      .eq("id", v.id).eq("studio_id", studioId);
    if (linkError) throw linkError;

    const { data: existingSteps, error: stepsError } = await supabase.from("tbpratiche_step")
      .select("codice_step").eq("variazione_id", v.id);
    if (stepsError) throw stepsError;
    const known = new Set((existingSteps || []).map((step: any) => step.codice_step));
    const missing = steps.filter(step => !known.has(step.codice_step) && (v.obbligo_ade || step.codice_step !== "COMUNICAZIONE_ADE"));
    if (missing.length) {
      const timestamp = new Date().toISOString();
      const { error: insertError } = await supabase.from("tbpratiche_step").insert(missing.map(step => ({
        variazione_id: v.id, pratica_id: null, pratica_uuid: praticaId, documento_id: null,
        codice_step: step.codice_step, ordine: step.ordine, ente: step.ente,
        titolo: step.titolo, descrizione: step.titolo, stato: "da_fare",
        obbligatorio: true, completato: false, data_scadenza: null,
        data_evasione: null, created_at: timestamp, updated_at: timestamp,
      })));
      if (insertError) throw insertError;
    }

    await aggiornaStatiVariazione(supabase, v.id);
    return res.status(200).json({ success: true, pratica_id: praticaId });
  } catch (error: any) {
    console.error("Errore apertura determina scioglimento", error);
    return res.status(500).json({ success: false, error: error?.message || "Impossibile aprire la determina" });
  }
}
