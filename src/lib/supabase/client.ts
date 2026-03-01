// studio-manager-pro/src/lib/supabase/client.ts

import { createBrowserClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/database.types"

/**
 * Singleton browser-only: il client viene creato una sola volta nel browser
 * e riutilizzato in tutta l'app.
 */
let browserClient: SupabaseClient<Database> | null = null

/**
 * Ritorna il Supabase client SOLO lato browser.
 * ❌ Non chiamare questa funzione in SSR, build o server-side.
 */
export function getSupabaseClient(): SupabaseClient<Database> {
  if (typeof window === "undefined") {
    throw new Error(
      "getSupabaseClient() called on server/SSR. Use a server-side Supabase client in API routes/server code."
    )
  }

  if (browserClient) return browserClient

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error(
      "Missing env vars: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY."
    )
  }

  browserClient = createBrowserClient<Database>(url, anonKey)
  return browserClient
}

/**
 * ✅ Alias di compatibilità
 * Permette di continuare a usare:
 *   import { supabase } from "@/lib/supabase/client";
 *
 * In SSR/build, se qualcuno prova a usarlo, lancia un errore esplicito.
 */
export const supabase: SupabaseClient<Database> =
  typeof window === "undefined"
    ? (new Proxy(
        {},
        {
          get() {
            throw new Error(
              "You are using the browser Supabase client on the server/SSR. Import a server-side Supabase client instead."
            )
          },
        }
      ) as unknown as SupabaseClient<Database>)
    : getSupabaseClient()
