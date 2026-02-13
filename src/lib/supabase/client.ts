import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

let supabaseInstance: SupabaseClient<Database> | null = null;

function getSupabaseBrowserClient(): SupabaseClient<Database> | null {
  if (typeof window === "undefined") {
    return null;
  }

  if (!supabaseInstance) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error("Missing Supabase environment variables");
      return null;
    }

    // Validate URL to prevent crash with placeholders (common in sandbox)
    try {
      new URL(supabaseUrl);
    } catch (error) {
      console.warn("Invalid Supabase URL provided (likely placeholder). Client initialization skipped.");
      return null;
    }

    supabaseInstance = createBrowserClient<Database>(
      supabaseUrl,
      supabaseAnonKey
    );
  }

  return supabaseInstance;
}

// Mock object to prevent app crashes when Supabase is not configured (e.g. sandbox)
const mockAuth = {
  onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
  getSession: async () => ({ data: { session: null }, error: null }),
  getUser: async () => ({ data: { user: null }, error: null }),
  signInWithPassword: async () => ({ data: { user: null, session: null }, error: { message: "Supabase not configured" } }),
  signOut: async () => ({ error: null }),
};

// Mock Query Builder for database operations
const mockQueryBuilder = {
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
  single: async () => ({ data: null, error: { message: "Supabase not configured (Sandbox)" } }),
  maybeSingle: async () => ({ data: null, error: null }),
  // Allow awaiting the builder directly
  then: (resolve: any) => resolve({ data: null, error: { message: "Supabase not configured (Sandbox)" } }),
};

// Mock for other Supabase methods (rpc, channel, storage, etc.)
const mockRpc = async () => ({ data: null, error: { message: "Supabase not configured (Sandbox)" } });
const mockChannel = () => ({
  on: () => mockChannel(),
  subscribe: () => ({ unsubscribe: () => {} }),
});
const mockStorage = {
  from: () => ({
    upload: async () => ({ data: null, error: { message: "Supabase not configured (Sandbox)" } }),
    download: async () => ({ data: null, error: { message: "Supabase not configured (Sandbox)" } }),
    list: async () => ({ data: [], error: null }),
    remove: async () => ({ data: null, error: { message: "Supabase not configured (Sandbox)" } }),
    getPublicUrl: () => ({ data: { publicUrl: "" } }),
  }),
};

export const supabase = new Proxy({} as SupabaseClient<Database>, {
  get(_target, prop) {
    const client = getSupabaseBrowserClient();
    
    if (!client) {
      if (typeof window === "undefined") {
        console.warn(
          `Supabase client accessed during SSR (property: ${String(prop)}). ` +
          "This is expected during build/SSR and will be initialized client-side."
        );
      }
      
      // Return mock auth to prevent crash in _app.tsx onAuthStateChange
      if (prop === "auth") {
        return mockAuth;
      }

      // Return mock query builder for DB operations
      if (prop === "from") {
        return () => mockQueryBuilder;
      }

      // Return mock for RPC calls
      if (prop === "rpc") {
        return mockRpc;
      }

      // Return mock for realtime channels
      if (prop === "channel") {
        return mockChannel;
      }

      if (prop === "removeChannel") {
        return () => {};
      }

      // Return mock for storage
      if (prop === "storage") {
        return mockStorage;
      }
      
      return undefined;
    }

    const value = client[prop as keyof SupabaseClient<Database>];
    
    if (typeof value === "function") {
      return value.bind(client);
    }
    
    return value;
  },
});