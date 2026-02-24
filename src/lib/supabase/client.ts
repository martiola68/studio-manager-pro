import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

import { createClient } from "@supabase/supabase-js";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

let supabaseInstance: SupabaseClient<Database> | null = null;

export function getSupabaseClient(): SupabaseClient<Database> {
  // ✅ sempre lato browser
  if (typeof window === "undefined") {
    // in SSR/build non deve creare il client
    throw new Error("Supabase client requested on server/SSR. Use server-side client in API routes.");
  }

  if (!supabaseInstance) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
    }

    supabaseInstance = createClient<Database>(supabaseUrl, supabaseAnonKey);
  }

  return supabaseInstance;
}

let supabaseInstance: SupabaseClient<Database> | null = null;

function getSupabaseBrowserClient(): SupabaseClient<Database> | null {
  // SSR/build: niente client browser
  if (typeof window === "undefined") return null;

  if (!supabaseInstance) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error("Missing Supabase environment variables");
      return null;
    }

    // Validate URL to prevent crash with placeholders
    try {
      new URL(supabaseUrl);
    } catch {
      console.warn(
        "Invalid Supabase URL provided (likely placeholder). Client initialization skipped."
      );
      return null;
    }

    supabaseInstance = createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
  }

  return supabaseInstance;
}

function supabaseNotConfiguredError(): Error {
  return new Error(
    "Supabase non configurato: verifica NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY"
  );
}

/**
 * SSR/build auth stub: evita crash durante build/SSR.
 * (Non deve bypassare login; è solo un no-op minimo.)
 */
const ssrAuthStub = {
  onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
  getSession: async () => ({ data: { session: null }, error: null }),
};

/**
 * Browser auth fallback: nessun bypass, nessun mock “silenzioso”.
 * Se Supabase non è configurato, restituiamo errori espliciti ma lasciamo la UI viva.
 */
const browserAuthFallback = {
  onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
  getSession: async () => ({ data: { session: null }, error: supabaseNotConfiguredError() }),
  getUser: async () => ({ data: { user: null }, error: supabaseNotConfiguredError() }),
  signInWithPassword: async () => ({
    data: { user: null, session: null },
    error: { message: supabaseNotConfiguredError().message } as any,
  }),
  signOut: async () => ({ error: null }),
};

// Mock Query Builder for database operations (safe fallback)
const mockQueryBuilder: any = {
  select: () => mockQueryBuilder,
  insert: () => mockQueryBuilder,
  update: () => mockQueryBuilder,
  delete: () => mockQueryBuilder,
  eq: () => mockQueryBuilder,
  neq: () => mockQueryBuilder,
  gt: () => mockQueryBuilder,
  lt: () => mockQueryBuilder,
  gte: () => mockQueryBuilder,
  lte: () => mockQueryBuilder,
  like: () => mockQueryBuilder,
  ilike: () => mockQueryBuilder,
  is: () => mockQueryBuilder,
  in: () => mockQueryBuilder,
  contains: () => mockQueryBuilder,
  range: () => mockQueryBuilder,
  order: () => mockQueryBuilder,
  limit: () => mockQueryBuilder,
  single: async () => ({
    data: null,
    error: { message: "Supabase non configurato (Sandbox/Env mancante)" },
  }),
  maybeSingle: async () => ({ data: null, error: null }),
  // Allow awaiting the builder directly
  then: (resolve: any) =>
    resolve({
      data: null,
      error: { message: "Supabase non configurato (Sandbox/Env mancante)" },
    }),
};

const mockRpc = async () => ({
  data: null,
  error: { message: "Supabase non configurato (Sandbox/Env mancante)" },
});

const mockChannel = () => ({
  on: () => mockChannel(),
  subscribe: () => ({ unsubscribe: () => {} }),
});

const mockStorage = {
  from: () => ({
    upload: async () => ({
      data: null,
      error: { message: "Supabase non configurato (Sandbox/Env mancante)" },
    }),
    download: async () => ({
      data: null,
      error: { message: "Supabase non configurato (Sandbox/Env mancante)" },
    }),
    list: async () => ({ data: [], error: null }),
    remove: async () => ({
      data: null,
      error: { message: "Supabase non configurato (Sandbox/Env mancante)" },
    }),
    getPublicUrl: () => ({ data: { publicUrl: "" } }),
  }),
};

export const supabase = new Proxy({} as SupabaseClient<Database>, {
  get(_target, prop) {
    const client = getSupabaseBrowserClient();

    // Se il client non esiste (SSR o ENV mancanti), gestiamo in modo esplicito e NON bypassiamo il login
    if (!client) {
      // SSR/build
      if (typeof window === "undefined") {
        console.warn(
          `Supabase client accessed during SSR (property: ${String(prop)}). ` +
            "This is expected during build/SSR and will be initialized client-side."
        );

        if (prop === "auth") return ssrAuthStub as any;
        return undefined;
      }

      // Browser
      if (prop === "auth") return browserAuthFallback as any;

      // Manteniamo fallback sicuri per operazioni DB/realtime/storage senza far crashare la UI
      if (prop === "from") return () => mockQueryBuilder;
      if (prop === "rpc") return mockRpc as any;
      if (prop === "channel") return mockChannel as any;
      if (prop === "removeChannel") return () => {};
      if (prop === "storage") return mockStorage as any;

      return undefined;
    }

    // Client valido: passthrough al vero SupabaseClient
    const value = (client as any)[prop];

    if (typeof value === "function") {
      return value.bind(client);
    }

    return value;
  },
});
