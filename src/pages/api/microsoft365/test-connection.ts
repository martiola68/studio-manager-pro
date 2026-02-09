import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { client_id, tenant_id, client_secret } = req.body;

    if (!client_id || !tenant_id || !client_secret) {
      return res.status(400).json({ 
        error: "Dati mancanti",
        details: "client_id, tenant_id e client_secret sono obbligatori" 
      });
    }

    // Test connessione Microsoft Graph API
    // Ottieni un token di accesso usando le credenziali
    const tokenUrl = `https://login.microsoftonline.com/${tenant_id}/oauth2/v2.0/token`;
    
    const params = new URLSearchParams({
      client_id,
      client_secret,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials"
    });

    const tokenResponse = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: params.toString()
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error("Errore autenticazione Microsoft:", errorData);
      
      return res.status(401).json({ 
        success: false,
        error: "Credenziali non valide",
        details: errorData.error_description || "Verifica Client ID, Tenant ID e Client Secret"
      });
    }

    const tokenData = await tokenResponse.json();

    // Test chiamata Graph API per verificare che il token funzioni
    const graphResponse = await fetch("https://graph.microsoft.com/v1.0/organization", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`
      }
    });

    if (!graphResponse.ok) {
      return res.status(500).json({ 
        success: false,
        error: "Autenticazione riuscita ma impossibile accedere a Graph API",
        details: "Verifica i permessi dell'applicazione in Azure AD"
      });
    }

    const orgData = await graphResponse.json();

    return res.status(200).json({ 
      success: true,
      message: "Connessione Microsoft 365 verificata con successo",
      organization: orgData.value?.[0]?.displayName || "Organizzazione verificata"
    });

  } catch (error: any) {
    console.error("Errore test connessione:", error);
    return res.status(500).json({ 
      success: false,
      error: "Errore durante il test della connessione",
      details: error.message 
    });
  }
}