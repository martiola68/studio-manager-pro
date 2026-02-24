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
    console.error(
      "[cassettiFiscaliService] ❌ No session found - user not authenticated"
    );
    throw new Error("No session found (user not authenticated)");
  }

  return token;
}

export const cassettiFiscaliService = {
  async getCassettiFiscali(
    studioId?: string | null,
    viewMode: "gestori" | "societa" = "gestori"
  ) {
    const source =
      viewMode === "gestori" ? "v_cassetti_fiscali" : "v_clienti_con_cassetto";

    // ⬅️ ROLLBACK: select("*") come prima, così non rompiamo la view "societa"
    let query = (supabase as any).from(source).select("*").order("nominativo");

    // filtro SOLO per gestori (come prima)
    if (studioId && source !== "v_clienti_con_cassetto") {
      query = query.eq("studio_id", studioId);
    }

    const { data, error } = await query;
    if (error) throw error;

    // 🔍 Debug (puoi lasciarlo un attimo e poi rimuoverlo)
    // console.log("[getCassettiFiscali]", viewMode, "sample:", data?.[0]);

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

  async delete(id: string) {
    const { error } = await supabase
      .from("tbcassetti_fiscali")
      .delete()
      .eq("id", id);

    if (error) throw error;
  },
};
