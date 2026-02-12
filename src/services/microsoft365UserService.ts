import { supabase } from "@/lib/supabase/client";

/**
 * Interfaccia per lo stato della connessione Microsoft 365 dell'utente
 */
export interface UserConnectionStatus {
  isConnected: boolean;
  microsoftUserId?: string;
  lastConnection?: Date;
  expiresAt?: Date;
}

/**
 * Recupera lo stato della connessione Microsoft 365 per l'utente corrente
 */
export async function getUserConnectionStatus(userId: string): Promise<UserConnectionStatus> {
  try {
    const { data, error } = await supabase
      .from("tbmicrosoft_tokens")
      .select("microsoft_user_id, expires_at, created_at, updated_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("[M365 User Service] Error fetching connection status:", error);
      return { isConnected: false };
    }

    if (!data) {
      return { isConnected: false };
    }

    return {
      isConnected: true,
      microsoftUserId: data.microsoft_user_id || undefined,
      lastConnection: data.updated_at ? new Date(data.updated_at) : new Date(data.created_at),
      expiresAt: data.expires_at ? new Date(data.expires_at) : undefined,
    };
  } catch (err) {
    console.error("[M365 User Service] Unexpected error:", err);
    return { isConnected: false };
  }
}

/**
 * Disconnette l'utente da Microsoft 365
 * Elimina i token dell'utente dal database
 */
export async function disconnectMicrosoft365(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from("tbmicrosoft_tokens")
      .delete()
      .eq("user_id", userId);

    if (error) {
      console.error("[M365 User Service] Error disconnecting:", error);
      return {
        success: false,
        error: "Errore durante la disconnessione. Riprova.",
      };
    }

    console.log(`✅ Utente ${userId} disconnesso da Microsoft 365`);
    return { success: true };
  } catch (err) {
    console.error("[M365 User Service] Unexpected error during disconnect:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Errore sconosciuto",
    };
  }
}

/**
 * Inizia il flusso OAuth per connettere Microsoft 365
 * Redirect a /api/auth/microsoft/login
 */
export function startMicrosoftOAuthFlow(): void {
  window.location.href = "/api/auth/microsoft/login";
}