import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

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

    // Get auth token from request headers
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ 
        error: "Non autenticato",
        details: "Token di autenticazione mancante" 
      });
    }

    const token = authHeader.replace("Bearer ", "");

    // Create Supabase client with user's JWT token
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      }
    );

    // Verify user is admin
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !userData.user) {
      return res.status(401).json({ 
        error: "Utente non autenticato",
        details: userError?.message 
      });
    }

    const { data: utente, error: utenteError } = await supabase
      .from("tbutenti")
      .select("tipo_utente, studio_id")
      .eq("id", userData.user.id)
      .single();

    if (utenteError || !utente || utente.tipo_utente !== "Admin") {
      return res.status(403).json({ 
        error: "Accesso negato",
        details: "Solo gli amministratori possono modificare la configurazione" 
      });
    }

    if (utente.studio_id !== studio_id) {
      return res.status(403).json({ 
        error: "Accesso negato",
        details: "Non puoi modificare la configurazione di un altro studio" 
      });
    }

    // Salva configurazione
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
        onConflict: "studio_id",
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