// src/services/logoutService.ts
import { authService } from "@/services/authService";

/**
 * Logout robusto:
 * - chiude la sessione (Supabase via authService)
 * - pulisce storage locale
 * - forza redirect HARD per azzerare stato SPA
 */
export async function hardLogout(redirectTo = "/login") {
  try {
    await authService.logout();; // <-- deve esistere in authService.ts
  } catch (e) {
    console.error("Logout error:", e);
  }

  try {
    if (typeof window !== "undefined") {
      // pulizia app (aggiungi/togli chiavi se necessario)
      localStorage.removeItem("studio_id");

      // se usi master password / encryption
      localStorage.removeItem("encryption_key");
      localStorage.removeItem("master_key_salt");
      localStorage.removeItem("encryption_unlocked");

      // token legacy (se esistono)
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");

      sessionStorage.clear();
    }
  } finally {
    if (typeof window !== "undefined") {
      window.location.assign(redirectTo);
    }
  }
}
