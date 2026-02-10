import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/lib/supabase/client";

/**
 * Endpoint per refreshare manualmente un token Microsoft
 * POST /api/auth/microsoft/refresh
 * Body: { user_id: string }
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: "user_id is required" });
    }

    // Ottieni token corrente
    const { data: tokenData, error: tokenError } = await supabase
      .from("tbmicrosoft_tokens")
      .select("*")
      .eq("user_id", user_id)
      .single();

    if (tokenError || !tokenData) {
      return res.status(404).json({ error: "Token not found" });
    }

    // Credenziali Microsoft
    const clientId = process.env.MICROSOFT_CLIENT_ID;
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
    const tenantId = process.env.MICROSOFT_TENANT_ID;

    if (!clientId || !clientSecret || !tenantId) {
      throw new Error("Microsoft 365 configuration missing");
    }

    const params = new URLSearchParams();
    params.append("client_id", clientId);
    params.append("client_secret", clientSecret);

    // Se esiste refresh_token, usa il flusso authorization_code
    // Altrimenti usa client_credentials (app-only)
    if (tokenData.refresh_token) {
      params.append("refresh_token", tokenData.refresh_token);
      params.append("grant_type", "refresh_token");
    } else {
      // Flusso client_credentials (app-only)
      params.append("grant_type", "client_credentials");
      params.append("scope", "https://graph.microsoft.com/.default");
    }

    const response = await fetch(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Token refresh failed:", errorText);
      throw new Error("Token refresh failed");
    }

    const data = await response.json();

    // Aggiorna token nel database
    const expiresAt = new Date(Date.now() + data.expires_in * 1000);

    const { error: updateError } = await supabase
      .from("tbmicrosoft_tokens")
      .update({
        access_token: data.access_token,
        refresh_token: data.refresh_token || tokenData.refresh_token,
        expires_at: expiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", tokenData.id);

    if (updateError) {
      throw new Error(`Database update error: ${updateError.message}`);
    }

    res.status(200).json({
      success: true,
      message: "Token refreshed successfully",
    });
  } catch (error: any) {
    console.error("Refresh token error:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
}