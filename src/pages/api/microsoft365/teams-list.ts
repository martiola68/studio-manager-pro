import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/lib/supabase/client";
import { supabaseAdmin } from "@/lib/supabase/server";
import { microsoftGraphService } from "@/services/microsoftGraphService";

/**
 * API per recuperare lista team e canali disponibili
 * GET /api/microsoft365/teams-list
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    console.log("📋 Teams-list API chiamata");

    // 1. GUARDIA: Verifica presenza Authorization header
    const authHeader = req.headers.authorization || "";
    console.log("🔐 Auth header presente:", !!authHeader);
    
    if (!authHeader.startsWith("Bearer ")) {
      console.error("❌ Auth header mancante o non valido");
      return res.status(401).json({ 
        code: "NO_AUTH", 
        error: "Missing Authorization Bearer token" 
      });
    }

    // 2. ESTRAE TOKEN SUPABASE (NON MICROSOFT!)
    const supabaseToken = authHeader.slice("Bearer ".length);
    console.log("🔑 Supabase token estratto (length):", supabaseToken.length);

    // 3. VERIFICA USER CON SUPABASE
    const { data: { user }, error: authError } = await supabase.auth.getUser(supabaseToken);

    if (authError || !user) {
      console.error("❌ Errore getUser:", authError?.message || "User null");
      return res.status(401).json({ 
        code: "BAD_SUPABASE_TOKEN", 
        error: "Invalid Supabase session",
        details: authError?.message 
      });
    }

    console.log("✅ User autenticato:", { id: user.id, email: user.email });

    // 4. QUERY TOKEN MICROSOFT CON SUPABASE ADMIN (BYPASS RLS)
    const userId = user.id;
    console.log("🔍 Query Microsoft token per user_id:", userId);
    
    const { data: tokenData, error: tokenError } = await (supabaseAdmin as any)
      .from("tbmicrosoft_tokens")
      .select("id, access_token, expires_at")
      .eq("user_id", userId)
      .maybeSingle();

    console.log("🔍 Token query result:", { 
      found: !!tokenData, 
      error: tokenError ? tokenError.message : null,
      hasAccessToken: tokenData ? !!tokenData.access_token : false
    });

    if (tokenError) {
      console.error("❌ Errore query token:", tokenError);
      return res.status(500).json({ 
        code: "DB_ERROR",
        error: "Errore verifica token",
        details: tokenError.message
      });
    }

    // 5. VERIFICA ESISTENZA TOKEN MICROSOFT
    if (!tokenData || !tokenData.access_token) {
      console.error("❌ Token Microsoft non trovato per user_id:", userId);
      return res.status(400).json({ 
        code: "NOT_CONNECTED",
        error: "Account Microsoft non connesso",
        hint: "Connetti l'account Microsoft dalla sezione Configurazione"
      });
    }

    // 6. VERIFICA SCADENZA TOKEN MICROSOFT
    const now = Date.now();
    const expiresAt = tokenData.expires_at ? new Date(tokenData.expires_at).getTime() : 0;
    const isExpired = expiresAt > 0 && expiresAt < now;

    console.log("🔍 Token Microsoft:", {
      id: tokenData.id,
      expires: tokenData.expires_at,
      isExpired,
      remainingMs: expiresAt - now
    });

    if (isExpired) {
      console.error("❌ Token Microsoft scaduto");
      return res.status(401).json({ 
        code: "MS_TOKEN_EXPIRED", 
        error: "Microsoft token expired. Reconnect.",
        hint: "Riconnetti l'account dalla sezione Configurazione"
      });
    }

    console.log("✅ Token Microsoft valido, recupero teams...");

    // 7. CHIAMA MICROSOFT GRAPH CON IL TOKEN CORRETTO
    const msAccessToken = tokenData.access_token;
    const result = await microsoftGraphService.getTeamsWithChannels(msAccessToken);

    if (!result.success) {
      console.error("❌ Errore getTeamsWithChannels:", result.error);
      return res.status(500).json({ 
        code: "GRAPH_ERROR",
        error: result.error || "Errore recupero team"
      });
    }

    console.log("✅ Teams recuperati:", result.teams?.length || 0);

    return res.status(200).json({
      success: true,
      teams: result.teams || []
    });

  } catch (error: any) {
    console.error("❌ Errore generale API teams-list:", error);
    return res.status(500).json({
      code: "SERVER_ERROR",
      error: error.message || "Errore server",
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined
    });
  }
}