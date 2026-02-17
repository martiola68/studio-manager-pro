import { supabase } from "@/lib/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { teamsNotificationService } from "./teamsNotificationService";

type Cliente = Database["public"]["Tables"]["tbclienti"]["Row"];
// Omit studio_id because it's handled server-side
type ClienteInsert = Omit<
  Database["public"]["Tables"]["tbclienti"]["Insert"],
  "studio_id"
>;
type ClienteUpdate = Omit<
  Database["public"]["Tables"]["tbclienti"]["Update"],
  "studio_id"
>;

/**
 * ✅ Single place to read the session token (Supabase v2 safe)
 */
async function getAuthToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    console.error("[clienteService] ❌ getSession error:", error);
    throw new Error("Auth session error");
  }

  const token = data?.session?.access_token;

  if (!token) {
    console.error("[clienteService] ❌ No session found - user not authenticated");
    throw new Error("No session found (user not authenticated)");
  }

  return token;
}

export const clienteService = {
  async getClienti() {
    const { data, error } = await supabase
      .from("tbclienti")
      .select("*")
      .order("ragione_sociale");

    if (error) {
      console.error("Error fetching clienti:", error);
      throw error;
    }
    return data || [];
  },

  async getClienteById(id: string) {
    const { data, error } = await supabase
      .from("tbclienti")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;
    return data;
  },

  async createCliente(cliente: ClienteInsert) {
    // ✅ Get current session token for API authentication
    const token = await getAuthToken();

    const response = await fetch("/api/clienti/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(cliente),
    });

    if (!response.ok) {
      let errorMsg = "Errore durante la creazione del cliente";
      try {
        const errorData = await response.json();
        errorMsg = errorData?.error || errorMsg;
      } catch {}
      throw new Error(errorMsg);
    }

    const newCliente = await response.json();

    // Invia notifica Teams (non bloccare se fallisce)
    try {
      await teamsNotificationService.sendNuovoClienteNotification(
        cliente.ragione_sociale || "Nuovo Cliente"
      );
    } catch (e) {
      console.error("Errore invio notifica Teams:", e);
    }

    return { data: newCliente, error: null };
  },

  async updateCliente(id: string, updates: ClienteUpdate) {
    // ✅ Get current session token for API authentication
    const token = await getAuthToken();

    const response = await fetch("/api/clienti/update", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ id, ...updates }),
    });

    if (!response.ok) {
      let errorMsg = "Errore durante l'aggiornamento del cliente";
      try {
        const errorData = await response.json();
        errorMsg = errorData?.error || errorMsg;
      } catch {}
      throw new Error(errorMsg);
    }

    return await response.json();
  },

  async deleteCliente(id: string) {
    const deletePromises = [
      supabase.from("tbscadiva").delete().eq("id", id),
      supabase.from("tbscad770").delete().eq("id", id),
      supabase.from("tbscadlipe").delete().eq("id", id),
      supabase.from("tbscadestero").delete().eq("id", id),
      supabase.from("tbscadproforma").delete().eq("id", id),
      supabase.from("tbscadimu").delete().eq("id", id),
      supabase.from("tbscadcu").delete().eq("id", id),
      supabase.from("tbscadbilanci").delete().eq("id", id),
      supabase.from("tbscadccgg").delete().eq("id", id),
      supabase.from("tbscadfiscali").delete().eq("id", id),
    ];

    await Promise.all(deletePromises);

    const { error } = await supabase.from("tbclienti").delete().eq("id", id);

    if (error) throw error;
  },

  async searchClienti(query: string, studioId?: string | null) {
    let supabaseQuery = supabase
      .from("tbclienti")
      .select("*")
      .or(
        `ragione_sociale.ilike.%${query}%,partita_iva.ilike.%${query}%,codice_fiscale.ilike.%${query}%`
      )
      .order("ragione_sociale");

    if (studioId) {
      supabaseQuery = supabaseQuery.eq("studio_id", studioId);
    }

    const { data, error } = await supabaseQuery;

    if (error) throw error;
    return data || [];
  },

  async getClientiByUtente(utenteId: string, studioId?: string | null) {
    let query = supabase
      .from("tbclienti")
      .select("*")
      .or(
        `utente_operatore_id.eq.${utenteId},utente_professionista_id.eq.${utenteId}`
      )
      .order("ragione_sociale");

    if (studioId) {
      query = query.eq("studio_id", studioId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  },

  async getClientiAttivi(studioId?: string | null) {
    let query = supabase
      .from("tbclienti")
      .select("*")
      .eq("attivo", true)
      .order("ragione_sociale");

    if (studioId) {
      query = query.eq("studio_id", studioId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  },
};
