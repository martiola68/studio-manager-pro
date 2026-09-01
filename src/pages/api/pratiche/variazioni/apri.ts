import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type ApiResponse =
  | { success: true; pratica_id: string }
  | { success: false; error: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ success: false, error: "Metodo non consentito" });
  }

  const variazioneId = String(req.body?.variazione_id || "").trim();
  if (!variazioneId) {
    return res.status(400).json({ success: false, error: "variazione_id obbligatorio" });
  }

  const supabase = getSupabaseAdmin();

  try {
    const { data: variazione, error: variazioneError } = await supabase
      .from("tbpratiche_variazioni")
      .select("id, studio_id, cliente_id, tipo_variazione, titolo, priorita, assegnato_a, pratica_id")
      .eq("id", variazioneId)
      .single();

    if (variazioneError || !variazione) {
      return res.status(404).json({ success: false, error: "Variazione non trovata" });
    }

    if (!String(variazione.tipo_variazione || "").toLowerCase().includes("distribuzione")) {
      return res.status(400).json({ success: false, error: "La variazione non è una distribuzione utili" });
    }

    if (variazione.pratica_id) {
      const { data: praticaEsistente } = await supabase
        .from("tbpratiche")
        .select("id")
        .eq("id", variazione.pratica_id)
        .maybeSingle();

      if (praticaEsistente?.id) {
        return res.status(200).json({ success: true, pratica_id: praticaEsistente.id });
      }
    }

    const { data: praticaCollegata } = await supabase
      .from("tbpratiche")
      .select("id")
      .eq("variazione_id", variazione.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (praticaCollegata?.id) {
      await supabase
        .from("tbpratiche_variazioni")
        .update({ pratica_id: praticaCollegata.id, stato: "in_lavorazione" })
        .eq("id", variazione.id);

      return res.status(200).json({ success: true, pratica_id: praticaCollegata.id });
    }

    const { data: tipoVariazione } = await supabase
      .from("tbpratiche_variazioni_tipi")
      .select("tipo_pratica_id")
      .eq("descrizione_variazione", variazione.tipo_variazione)
      .eq("attivo", true)
      .limit(1)
      .maybeSingle();

    if (!tipoVariazione?.tipo_pratica_id) {
      return res.status(422).json({
        success: false,
        error: "Tipo pratica non configurato per Distribuzione utili",
      });
    }

    const { data: praticaCreata, error: praticaError } = await supabase
      .from("tbpratiche")
      .insert({
        studio_id: variazione.studio_id,
        cliente_id: variazione.cliente_id,
        tipo_pratica_id: tipoVariazione.tipo_pratica_id,
        numero_pratica: `VAR-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`,
        titolo: variazione.titolo || variazione.tipo_variazione,
        stato: "Aperta",
        priorita: variazione.priorita,
        data_apertura: new Date().toISOString(),
        assegnato_a: variazione.assegnato_a,
        pratica_padre_id: null,
        pratica_origine_id: null,
        variazione_id: variazione.id,
        codice_workflow: variazione.tipo_variazione,
        codice_step: "ROOT",
        nome_step: variazione.tipo_variazione,
        ordine_step: 1,
        stato_step: "aperta",
      })
      .select("id")
      .single();

    if (praticaError || !praticaCreata?.id) {
      throw praticaError || new Error("Impossibile creare la pratica");
    }

    await supabase
      .from("tbpratiche_variazioni")
      .update({ pratica_id: praticaCreata.id, stato: "in_lavorazione" })
      .eq("id", variazione.id);

    const { data: stepEsistente } = await supabase
      .from("tbpratiche_step")
      .select("id")
      .eq("variazione_id", variazione.id)
      .eq("codice_step", "VERBALE")
      .limit(1)
      .maybeSingle();

    if (!stepEsistente?.id) {
      await supabase.from("tbpratiche_step").insert({
        variazione_id: variazione.id,
        pratica_id: null,
        pratica_uuid: praticaCreata.id,
        documento_id: null,
        codice_step: "VERBALE",
        ordine: 1,
        ente: "Interno",
        titolo: "Verbale distribuzione utili",
        descrizione: "Verbale distribuzione utili",
        stato: "da_fare",
        obbligatorio: true,
        completato: false,
        data_scadenza: null,
        data_evasione: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    return res.status(200).json({ success: true, pratica_id: praticaCreata.id });
  } catch (error: any) {
    console.error("Errore apertura pratica distribuzione utili:", error);
    return res.status(500).json({
      success: false,
      error: error?.message || "Errore apertura pratica distribuzione utili",
    });
  }
}
