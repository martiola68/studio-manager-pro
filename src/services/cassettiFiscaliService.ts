import { supabase } from "@/lib/supabase/client";
import { Database } from "@/integrations/supabase/types";

export type CassettoFiscale =
  Database["public"]["Tables"]["tbcassetti_fiscali"]["Row"];

type CassettoFiscaleInsertClient = Omit<
  Database["public"]["Tables"]["tbcassetti_fiscali"]["Insert"],
  "studio_id"
>;

type CassettoFiscaleUpdateClient = Omit<
  Database["public"]["Tables"]["tbcassetti_fiscali"]["Update"],
  "studio_id"
>;

async function getAuthToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.error("[cassettiFiscaliService] getSession error:", error);
    throw new Error("Auth session error");
  }

  const token = data?.session?.access_token;
  if (!token) {
    console.error("[cassettiFiscaliService] ❌ No session found - user not authenticated");
    throw new Error("No session found (user not authenticated)");
  }

  return token;
}

export const cassettiFiscaliService = {
  // ✅ lettura: puoi lasciarla così (RLS dovrebbe filtrare)
  // Nota: NON serve più studioId da localStorage. Se vuoi, puoi toglierlo anche dal chiamante.
  async getCassettiFiscali(studioId?: string | null) {
    let query = supabase
      .from("tbcassetti_fiscali")
      .select("*")
      .order("nominativo");

    if (studioId) query = query.eq("studio_id", studioId);

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async getById(id: string) {
    const { data, error } = await supabase
      .from("tbcassetti_fiscali")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;
    return data;
  },

  // ✅ CREATE via API (studio_id forzato server-side)
  async create(payload: CassettoFiscaleInsertClient) {
    const token = await getAuthToken();

    const res = await fetch("/api/cassetti-fiscali/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const raw = await res.text();
      console.error("[cassettiFiscaliService] create failed:", raw);
      throw new Error("Failed to create cassetto fiscale");
    }

    return (await res.json()) as CassettoFiscale;
  },

  // ✅ UPDATE via API (studio_id bloccato server-side)
  async update(id: string, payload: CassettoFiscaleUpdateClient) {
    const token = await getAuthToken();

    const res = await fetch("/api/cassetti-fiscali/update", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ id, ...payload }),
    });

    if (!res.ok) {
      const raw = await res.text();
      console.error("[cassettiFiscaliService] update failed:", raw);
      throw new Error("Failed to update cassetto fiscale");
    }

    return (await res.json()) as CassettoFiscale;
  },

  // ✅ DELETE: possiamo lasciarlo client-side (se RLS lo consente)
  // Se vuoi renderlo "come clienti", possiamo fare anche /api/cassetti-fiscali/delete
  async delete(id: string) {
    const { error } = await supabase
      .from("tbcassetti_fiscali")
      .delete()
      .eq("id", id);

    if (error) throw error;
  },
};
