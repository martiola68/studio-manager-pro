// src/services/logoutService.ts
import { authService } from "@/services/authService";

/**
 * Logout robusto:
 * - chiude la sessione Supabase (scope globale) tramite authService.logout()
 * - forza redirect HARD per azzerare lo stato dell'app
 *
 * Nota: la pulizia di localStorage/sessionStorage è già gestita in authService.logout()
 * (quindi qui non la duplichiamo).
 */
export async function hardLogout(redirectTo = "/login") {
  try {
    await authService.logout();
  } catch (e) {
    console.error("Logout error:", e);
  } finally {
    if (typeof window !== "undefined") {
      window.location.assign(redirectTo);
    }
  }
}
