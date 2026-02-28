// studio-manager-pro/src/lib/supabase/client.ts

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * Singleton browser-only: il client viene creato una sola volta nel browser
 * e riutilizzato in tutta l'app.
 */
let browserClient: SupabaseClient<Database> | null = null;

/**
 * Ritorna il Supabase client SOLO lato browser.
 * ❌ Non chiamare questa funzione in SSR, build o server-side.
 */
export function getSupabaseClient(): SupabaseClient<Database> {
  // SSR/build/server: blocca subito (così trovi ogni uso sbagliato)
  if (typeof window === "undefined") {
    throw new Error(
      "getSupabaseClient() called on server/SSR. Use a server-side Supabase client in API routes/server code."
    );
  }

  // se esiste già, riusalo
  if (browserClient) return browserClient;

  // env pubbliche (devono essere disponibili nel browser)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing env vars: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  // crea il client browser
  browserClient = createBrowserClient<Database>(url, anonKey);

  return browserClient;
}

/**
 * ✅ Alias di compatibilità
 * Permette di continuare a usare:
 *   import { supabase } from "@/lib/supabase/client";
 * senza dover modificare altri file
 */
export const supabase: SupabaseClient<Database> = (() => {
  if (typeof window === "undefined") {
    // evita crash in build/SSR se qualcuno importa supabase per sbaglio
    return null as unknown as SupabaseClient<Database>;
  }
  return getSupabaseClient();
})();
