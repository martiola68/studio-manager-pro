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

    // Test 1: Verifica che il tenant esista e sia accessibile
    const discoveryUrl = `https://login.microsoftonline.com/${tenant_id}/v2.0/.well-known/openid-configuration`;
    
    const discoveryResponse = await fetch(discoveryUrl);

    if (!discoveryResponse.ok) {
      return res.status(401).json({ 
        success: false,
        error: "Tenant ID non valido",
        details: "Verifica che il Tenant ID sia corretto"
      });
    }

    // Test 2: Verifica che le credenziali siano valide tentando di ottenere un token
    // Usa scope minimo per non richiedere permessi Application
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

    // Se arriviamo qui, le credenziali sono corrette!
    // Non testiamo l'accesso a Graph API perché richiederebbe permessi Application
    // L'accesso reale avverrà tramite OAuth flow con permessi Delegated

    return res.status(200).json({ 
      success: true,
      message: "✅ Credenziali Microsoft 365 verificate con successo!",
      details: "La configurazione è corretta. Gli utenti potranno autenticarsi tramite OAuth."
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