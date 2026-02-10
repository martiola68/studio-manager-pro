/**
 * Supabase Server Client con Service Role
 * Da usare SOLO in API routes server-side per operazioni che richiedono bypass RLS
 * 
 * ATTENZIONE: Questo client ha accesso completo al database.
 * Usare SOLO dopo aver verificato l'autenticazione dell'utente!
 */

import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL mancante");
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY mancante");
}

/**
 * Client Supabase con Service Role Key
 * - Bypassa Row Level Security (RLS)
 * - Accesso completo al database
 * - Da usare SOLO in API routes dopo verifica auth
 */
export const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);