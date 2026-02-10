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

    // 1. Verifica autenticazione con client standard
    const authHeader = req.headers.authorization;
    console.log("🔐 Auth header presente:", !!authHeader);
    
    if (!authHeader?.startsWith("Bearer ")) {
      console.error("❌ Auth header mancante o non valido");
      return res.status(401).json({ error: "Non autenticato" });
    }

    const token = authHeader.substring(7);
    console.log("🔑 Token estratto (length):", token.length);

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError) {
      console.error("❌ Errore getUser:", authError);
      return res.status(401).json({ error: "Token non valido", details: authError.message });
    }

    if (!user || !user.id) {
      console.error("❌ User o user.id mancante:", { user: !!user, id: user?.id });
      return res.status(401).json({ error: "Utente non valido" });
    }

    console.log("✅ User autenticato, user.id:", user.id);
    console.log("✅ User email:", user.email);

    // 2. Usa user.id come user_id
    const userId = user.id;
    console.log("🔍 Uso direttamente user.id come user_id:", userId);

    // 3. Query token con supabaseAdmin (bypassa RLS)
    console.log("🔍 Query token con Service Role (bypass RLS)...");
    
    const { data: tokenData, error: tokenError } = await supabaseAdmin
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
        error: "Errore verifica token",
        code: "DB_ERROR",
        details: tokenError.message
      });
    }

    if (!tokenData || !tokenData.access_token) {
      console.error("❌ Token non trovato per user_id:", userId);
      return res.status(400).json({ 
        error: "Account Microsoft non connesso",
        code: "NOT_CONNECTED",
        debug: {
          userId,
          email: user.email,
          hint: "Connetti l'account Microsoft dalla sezione Configurazione"
        }
      });
    }

    // Verifica scadenza token
    const now = new Date();
    const expiresAt = new Date(tokenData.expires_at);
    const isExpired = now >= expiresAt;

    console.log("🔍 Token trovato:", {
      id: tokenData.id,
      expires: expiresAt.toISOString(),
      isExpired
    });

    if (isExpired) {
      console.log("⚠️ Token scaduto, ma procedo comunque (refresh automatico)");
    }

    console.log("✅ Token valido, recupero teams...");

    // 4. Recupera lista team e canali
    const result = await microsoftGraphService.getTeamsWithChannels(userId);

    if (!result.success) {
      console.error("❌ Errore getTeamsWithChannels:", result.error);
      return res.status(500).json({ 
        error: result.error || "Errore recupero team",
        code: "GRAPH_ERROR"
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
      error: error.message || "Errore server",
      code: "SERVER_ERROR",
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined
    });
  }
}