import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === "HEAD") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    console.log("🔐 Microsoft Login API chiamata");
    
    const userId = req.query.user_id as string;
    console.log("📋 User ID ricevuto:", userId);

    if (!userId) {
      console.error("❌ User ID mancante");
      return res.status(400).json({ error: "Missing user_id parameter" });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Recupera utente e studio_id
    console.log("🔍 Query utente per user_id:", userId);
    const { data: utente, error: utenteError } = await supabase
      .from("tbutenti")
      .select("studio_id, email")
      .eq("id", userId)
      .single();

    console.log("📊 Risultato query utente:", { utente, error: utenteError });

    if (utenteError || !utente?.studio_id) {
      console.error("❌ Utente o studio non trovato:", utenteError);
      return res.status(404).json({ error: "User or studio not found" });
    }

    console.log("✅ Utente trovato:", utente.email, "Studio ID:", utente.studio_id);

    // 2. Recupera configurazione Microsoft 365
    console.log("🔍 Query configurazione per studio_id:", utente.studio_id);
    const { data: config, error: configError } = await supabase
      .from("microsoft365_config")
      .select("client_id, tenant_id")
      .eq("studio_id", utente.studio_id)
      .single();

    console.log("📊 Risultato query config:", { config, error: configError });

    if (configError || !config?.client_id || !config?.tenant_id) {
      console.error("❌ Configurazione Microsoft non trovata o incompleta");
      return res.status(400).json({ 
        error: "Microsoft 365 not configured for this studio. Please configure credentials in Settings.",
        debug: {
          studio_id: utente.studio_id,
          config_found: !!config,
          has_client_id: !!config?.client_id,
          has_tenant_id: !!config?.tenant_id
        }
      });
    }

    console.log("✅ Configurazione trovata - Client ID:", config.client_id.substring(0, 8) + "...");

    // 3. Costruisci URL di redirect
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || "https://studio-manager-pro.vercel.app"}/api/auth/microsoft/callback`;
    console.log("🔗 Redirect URI:", redirectUri);

    // 4. Definisci scope necessari
    const scope = [
      "openid",
      "profile",
      "email",
      "offline_access",
      "User.Read",
      "Calendars.ReadWrite",
      "Mail.Send",
      "Mail.Read",
      "OnlineMeetings.ReadWrite",
      "Chat.ReadWrite",
      "Channel.ReadBasic.All",
      "ChannelMessage.Send"
    ].join(" ");

    console.log("📋 Scope richiesti:", scope);

    // 5. Crea state con informazioni utente
    const state = Buffer.from(
      JSON.stringify({
        user_id: userId,
        studio_id: utente.studio_id,
        timestamp: Date.now(),
      })
    ).toString("base64");

    console.log("🔐 State generato (base64)");

    // 6. Costruisci URL di autorizzazione Microsoft
    const authUrl = `https://login.microsoftonline.com/${config.tenant_id}/oauth2/v2.0/authorize?` +
      `client_id=${config.client_id}` +
      `&response_type=code` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_mode=query` +
      `&scope=${encodeURIComponent(scope)}` +
      `&state=${state}` +
      `&prompt=consent`;

    console.log("🚀 URL autorizzazione Microsoft generato");
    console.log("🔗 Tenant:", config.tenant_id);
    console.log("📍 Redirect a Microsoft...");

    // 7. Redirect a Microsoft
    res.redirect(authUrl);
  } catch (error: any) {
    console.error("❌ Errore Microsoft login:", error);
    res.status(500).json({ 
      error: "Authentication failed",
      details: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined
    });
  }
}