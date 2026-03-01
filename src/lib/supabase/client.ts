// studio-manager-pro/src/lib/supabase/client.ts

import { createBrowserClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/integrations/supabase/types"

let browserClient: SupabaseClient<Database> | null = null

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
