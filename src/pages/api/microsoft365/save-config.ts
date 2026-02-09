import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/lib/supabase/client";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { studio_id, client_id, tenant_id, client_secret, enabled, features } = req.body;

    if (!studio_id || !client_id || !tenant_id || !client_secret) {
      return res.status(400).json({ 
        error: "Dati mancanti",
        details: "studio_id, client_id, tenant_id e client_secret sono obbligatori" 
      });
    }

    // Salva configurazione (il client_secret sarà criptato dal database o dal servizio)
    const { data, error } = await supabase
      .from("microsoft365_config")
      .upsert({
        studio_id,
        client_id,
        tenant_id,
        client_secret,
        enabled: enabled || false,
        features: features || {
          email: false,
          calendar: false,
          contacts: false,
          teams: false
        },
        updated_at: new Date().toISOString()
      }, { 
        onConflict: 'studio_id',
        ignoreDuplicates: false 
      })
      .select()
      .single();

    if (error) {
      console.error("Errore salvataggio configurazione:", error);
      return res.status(500).json({ 
        error: "Errore durante il salvataggio",
        details: error.message 
      });
    }

    return res.status(200).json({ 
      success: true, 
      message: "Configurazione salvata con successo",
      data 
    });

  } catch (error: any) {
    console.error("Errore handler save-config:", error);
    return res.status(500).json({ 
      error: "Errore server",
      details: error.message 
    });
  }
}