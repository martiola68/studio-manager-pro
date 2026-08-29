import { supabase } from "@/lib/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { teamsNotificationService } from "./teamsNotificationService";

type Cliente = Database["public"]["Tables"]["tbclienti"]["Row"];
type ClienteInsert = Omit<Database["public"]["Tables"]["tbclienti"]["Insert"], "studio_id">;
type ClienteUpdate = Omit<Database["public"]["Tables"]["tbclienti"]["Update"], "studio_id">;

async function getAuthToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error("Auth session error");
  const token = data?.session?.access_token;
  if (!token) throw new Error("No session found (user not authenticated)");
  return token;
}

/**
 * Risolve SEMPRE lo studio dalla sessione autenticata.
 * Non accetta studio_id dal chiamante: un tenant non deve poter scegliere quale studio leggere.
 */
async function getCurrentStudioId(): Promise<string> {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session?.user) throw new Error("Sessione non valida");

  let { data: utente, error } = await supabase
    .from("tbutenti")
    .select("studio_id")
    .eq("user_id", session.user.id)
    .maybeSingle();

  if ((!utente || error) && session.user.email) {
    const fallback = await supabase
      .from("tbutenti")
      .select("studio_id")
      .eq("email", session.user.email.toLowerCase())
      .maybeSingle();
    utente = fallback.data;
    error = fallback.error;
  }

  if (error) throw error;
  const studioId = String(utente?.studio_id || "").trim();
  if (!studioId) throw new Error("Utente senza studio associato");
  return studioId;
}

export const clienteService = {
  async getClienti() {
    const studioId = await getCurrentStudioId();
    const { data, error } = await supabase
      .from("tbclienti")
      .select("*")
      .eq("studio_id", studioId)
      .order("ragione_sociale");
    if (error) throw error;
    return data || [];
  },

  async getClienteById(id: string) {
    const studioId = await getCurrentStudioId();
    const { data, error } = await supabase
      .from("tbclienti")
      .select("*")
      .eq("id", id)
      .eq("studio_id", studioId)
      .single();
    if (error) throw error;
    return data;
  },

  async createCliente(cliente: ClienteInsert) {
    const token = await getAuthToken();
    const response = await fetch("/api/clienti/create", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(cliente),
    });
    if (!response.ok) {
      let errorMsg = "Errore durante la creazione del cliente";
      try { const errorData = await response.json(); errorMsg = errorData?.error || errorMsg; } catch {}
      throw new Error(errorMsg);
    }
    const newCliente = await response.json();
    try { await teamsNotificationService.sendNuovoClienteNotification(cliente.ragione_sociale || "Nuovo Cliente"); } catch (e) { console.error("Errore invio notifica Teams:", e); }
    return { data: newCliente, error: null };
  },

  async updateCliente(id: string, updates: ClienteUpdate) {
    const token = await getAuthToken();
    const response = await fetch("/api/clienti/update", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id, ...updates }),
    });
    if (!response.ok) {
      let errorMsg = "Errore durante l'aggiornamento del cliente";
      try { const errorData = await response.json(); errorMsg = errorData?.error || errorMsg; } catch {}
      throw new Error(errorMsg);
    }
    return await response.json();
  },

  async deleteCliente(id: string) {
    const studioId = await getCurrentStudioId();
    const { data: cliente, error: checkError } = await supabase
      .from("tbclienti").select("id").eq("id", id).eq("studio_id", studioId).maybeSingle();
    if (checkError) throw checkError;
    if (!cliente) throw new Error("Cliente non appartenente allo studio corrente");

    const deletePromises = ["tbscadiva", "tbscad770", "tbscadlipe", "tbscadestero", "tbscadproforma", "tbscadimu", "tbscadcu", "tbscadbilanci", "tbscadccgg", "tbscadfiscali"].map((table) =>
      supabase.from(table as any).delete().eq("id", id)
    );
    await Promise.all(deletePromises);
    const { error } = await supabase.from("tbclienti").delete().eq("id", id).eq("studio_id", studioId);
    if (error) throw error;
  },

  async searchClienti(query: string, _studioId?: string | null) {
    const studioId = await getCurrentStudioId();
    const { data, error } = await supabase
      .from("tbclienti")
      .select("*")
      .eq("studio_id", studioId)
      .or(`ragione_sociale.ilike.%${query}%,partita_iva.ilike.%${query}%,codice_fiscale.ilike.%${query}%`)
      .order("ragione_sociale");
    if (error) throw error;
    return data || [];
  },

  async getClientiByUtente(utenteId: string, _studioId?: string | null) {
    const studioId = await getCurrentStudioId();
    const { data, error } = await supabase
      .from("tbclienti")
      .select("*")
      .eq("studio_id", studioId)
      .or(`utente_operatore_id.eq.${utenteId},utente_professionista_id.eq.${utenteId}`)
      .order("ragione_sociale");
    if (error) throw error;
    return data || [];
  },

  async getClientiAttivi(_studioId?: string | null) {
    const studioId = await getCurrentStudioId();
    const { data, error } = await supabase
      .from("tbclienti")
      .select("*")
      .eq("studio_id", studioId)
      .eq("attivo", true)
      .order("ragione_sociale");
    if (error) throw error;
    return data || [];
  },
};
