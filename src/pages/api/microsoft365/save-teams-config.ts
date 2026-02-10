import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/lib/supabase/client";

/**
 * API per salvare configurazione Teams (team/canali selezionati)
 * POST /api/microsoft365/save-teams-config
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // 1. Verifica autenticazione
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Non autenticato" });
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: "Token non valido" });
    }

    // 2. Verifica permessi Admin
    const { data: userData, error: userError } = await supabase
      .from("tbutenti")
      .select("tipo_utente, studio_id")
      .eq("email", user.email)
      .single();

    if (userError || !userData) {
      return res.status(404).json({ error: "Utente non trovato" });
    }

    if (!userData.tipo_utente || userData.tipo_utente !== "Admin") {
      return res.status(403).json({ error: "Permessi insufficienti" });
    }

    if (!userData.studio_id) {
      return res.status(400).json({ error: "Studio non identificato" });
    }

    // Type assertion dopo verifica null
    const studioId: string = userData.studio_id!;

    // 3. Valida i dati ricevuti
    const { 
      default_team_id, 
      default_team_name,
      default_channel_id, 
      default_channel_name,
      scadenze_channel_id,
      scadenze_channel_name,
      alert_channel_id,
      alert_channel_name
    } = req.body;

    if (!default_team_id || !default_channel_id) {
      return res.status(400).json({ 
        error: "Team e canale predefiniti sono obbligatori" 
      });
    }

    // 4. Verifica se esiste già una configurazione
    const { data: existingConfig } = await supabase
      .from("microsoft365_config")
      .select("id")
      .eq("studio_id", studioId)
      .single();

    // 5. Prepara i dati da salvare
    const configData = {
      teams_default_team_id: default_team_id,
      teams_default_team_name: default_team_name,
      teams_default_channel_id: default_channel_id,
      teams_default_channel_name: default_channel_name,
      teams_scadenze_channel_id: scadenze_channel_id || default_channel_id,
      teams_scadenze_channel_name: scadenze_channel_name || default_channel_name,
      teams_alert_channel_id: alert_channel_id || default_channel_id,
      teams_alert_channel_name: alert_channel_name || default_channel_name,
      updated_at: new Date().toISOString()
    };

    // 6. Aggiorna o inserisci configurazione
    if (existingConfig) {
      const { error: updateError } = await supabase
        .from("microsoft365_config")
        .update(configData)
        .eq("studio_id", studioId);

      if (updateError) {
        console.error("Errore aggiornamento config:", updateError);
        return res.status(500).json({ error: "Errore salvataggio configurazione" });
      }
    } else {
      const { error: insertError } = await supabase
        .from("microsoft365_config")
        .insert({
          ...configData,
          studio_id: studioId,
          enabled: true,
          features: { email: false, calendar: false, contacts: false, teams: true }
        });

      if (insertError) {
        console.error("Errore inserimento config:", insertError);
        return res.status(500).json({ error: "Errore creazione configurazione" });
      }
    }

    return res.status(200).json({
      success: true,
      message: "Configurazione Teams salvata con successo"
    });

  } catch (error: any) {
    console.error("Errore API save-teams-config:", error);
    return res.status(500).json({
      error: error.message || "Errore server"
    });
  }
}