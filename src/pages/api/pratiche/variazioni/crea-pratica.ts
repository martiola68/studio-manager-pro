import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type ApiResponse =
  | { success: true; data: any }
  | { success: false; error: string };

function buildNumeroPratica() {
  const anno = new Date().getFullYear();
  const random = Math.floor(10000 + Math.random() * 90000);
  return `VAR-${anno}-${random}`;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Metodo non consentito",
    });
  }

  try {
    const { variazione_id, tipo_pratica_id } = req.body || {};

    if (!variazione_id) {
      return res.status(400).json({
        success: false,
        error: "variazione_id obbligatorio",
      });
    }

    if (!tipo_pratica_id) {
      return res.status(400).json({
        success: false,
        error: "tipo_pratica_id obbligatorio",
      });
    }

    const supabase = getSupabaseAdmin();

    const { data: variazione, error: variazioneError } = await supabase
      .from("tbpratiche_variazioni")
      .select("*")
      .eq("id", variazione_id)
      .maybeSingle();

    if (variazioneError) throw variazioneError;

    if (!variazione) {
      return res.status(404).json({
        success: false,
        error: "Variazione non trovata",
      });
    }

    if (variazione.pratica_id) {
      return res.status(409).json({
        success: false,
        error: "La variazione è già collegata a una pratica",
      });
    }

    const numeroPratica = buildNumeroPratica();

    const titoloPratica = variazione.titolo
      ? `Variazione - ${variazione.titolo}`
      : `Variazione ${variazione.tipo_variazione || ""}`.trim();

    const notePratica = [
      variazione.descrizione ? `Descrizione: ${variazione.descrizione}` : null,
      variazione.ente_principale
        ? `Ente principale: ${variazione.ente_principale}`
        : null,
      variazione.tipo_variazione
        ? `Tipo variazione: ${variazione.tipo_variazione}`
        : null,
      variazione.data_atto ? `Data atto: ${variazione.data_atto}` : null,
      variazione.data_scadenza_cciaa
        ? `Scadenza CCIAA: ${variazione.data_scadenza_cciaa}`
        : null,
      variazione.obbligo_ade
        ? `Obbligo comunicazione AdE: SI`
        : `Obbligo comunicazione AdE: NO`,
      variazione.note ? `Note: ${variazione.note}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const { data: pratica, error: praticaError } = await supabase
      .from("tbpratiche")
      .insert({
        studio_id: variazione.studio_id,
        cliente_id: variazione.cliente_id,
        tipo_pratica_id: Number(tipo_pratica_id),
        numero_pratica: numeroPratica,
        titolo: titoloPratica,
        stato: "aperta",
        priorita:
          variazione.priorita === "urgente" || variazione.priorita === "alta"
            ? "alta"
            : "normale",
        assegnato_a: variazione.assegnato_a || null,
        note: notePratica || null,
      })
      .select("*")
      .single();

    if (praticaError) throw praticaError;

    const { data: aggiornata, error: updateError } = await supabase
      .from("tbpratiche_variazioni")
      .update({
        pratica_id: pratica.id,
        stato: "convertita",
        richiede_pratica: true,
        genera_verbale: true,
      })
      .eq("id", variazione.id)
      .select(`
        *,
        cliente:tbclienti(id, ragione_sociale, codice_fiscale, partita_iva),
        assegnato:tbutenti(id, nome, cognome, email),
        pratica:tbpratiche(id, numero_pratica, titolo, stato)
      `)
      .single();

    if (updateError) throw updateError;

    return res.status(200).json({
      success: true,
      data: {
        variazione: aggiornata,
        pratica,
      },
    });
  } catch (error: any) {
    console.error("Errore creazione pratica da variazione:", error);

    return res.status(500).json({
      success: false,
      error: error?.message || "Errore interno",
    });
  }
}
