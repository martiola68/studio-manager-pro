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
  if (error) throw error;

  const token = data?.session?.access_token;
  if (!token) throw new Error("User not authenticated");

  return token;
}

export const cassettiFiscaliService = {
  async getCassettiFiscali(
    studioId?: string | null,
    viewMode: "gestori" | "societa" = "gestori"
  ) {
    const source =
      viewMode === "gestori"
        ? "v_cassetti_fiscali"
        : "v_clienti_con_cassetto";

    const selectFields = `
      id,
      nominativo,
      username,
      password1,
      password2,
      pin,
      pw_iniziale,
      pw_attiva1,
      pw_attiva2,
      note,
      studio_id
    `;

    let query = supabase
      .from(source)
      .select(selectFields)
      .order("nominativo");

    // 🔒 filtro SOLO per Gestori
    if (studioId && viewMode === "gestori") {
      query = query.eq("studio_id", studioId);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data ?? []).map((r: any) => ({
      ...r,
      pw_attiva1: Boolean(
        r.pw_attiva1 === true ||
          r.pw_attiva1 === 1 ||
          r.pw_attiva1 === "1" ||
          r.pw_attiva1 === "t"
      ),
      pw_attiva2: Boolean(
        r.pw_attiva2 === true ||
          r.pw_attiva2 === 1 ||
          r.pw_attiva2 === "1" ||
          r.pw_attiva2 === "t"
      ),
    }));
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

    if (!res.ok) throw new Error("Create failed");
    return res.json();
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

    if (!res.ok) throw new Error("Update failed");
    return res.json();
  },

  async delete(id: string) {
    const { error } = await supabase
      .from("tbcassetti_fiscali")
      .delete()
      .eq("id", id);

    if (error) throw error;
  },
};
