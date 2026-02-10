import { supabase } from "@/lib/supabase/client";
import { Database } from "@/lib/supabase/types";
import { teamsNotificationService } from "./teamsNotificationService";

type Comunicazione = Database["public"]["Tables"]["tbcomunicazioni"]["Row"];
type ComunicazioneInsert = Database["public"]["Tables"]["tbcomunicazioni"]["Insert"];
type ComunicazioneUpdate = Database["public"]["Tables"]["tbcomunicazioni"]["Update"];

export const comunicazioneService = {
  async getComunicazioni(studioId?: string | null): Promise<Comunicazione[]> {
    let query = supabase
      .from("tbcomunicazioni")
      .select("*")
      .order("created_at", { ascending: false });

    if (studioId) {
      query = query.eq("studio_id", studioId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching comunicazioni:", error);
      return [];
    }
    return data || [];
  },

  async getComunicazioneById(id: string): Promise<Comunicazione | null> {
    const { data, error } = await supabase
      .from("tbcomunicazioni")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error fetching comunicazione:", error);
      return null;
    }
    return data;
  },
  
  async createComunicazione(comunicazione: ComunicazioneInsert): Promise<Comunicazione | null> {
    const { data, error } = await supabase
      .from("tbcomunicazioni")
      .insert(comunicazione)
      .select()
      .single();

    if (error) {
      console.error("Error creating comunicazione:", error);
      throw error;
    }

    // NUOVO: Invia notifica Teams (se configurato)
    if (data) {
      try {
        // Recupera nome mittente
        let mittenteNome = "Sistema";
        if (data.mittente_id) {
          const { data: mittenteData } = await supabase
            .from("tbutenti")
            .select("nome, cognome")
            .eq("id", data.mittente_id)
            .single();

          if (mittenteData) {
            mittenteNome = `${mittenteData.nome} ${mittenteData.cognome}`;
          }
        }

        // Recupera nomi destinatari (se disponibili in campo destinatari)
        const destinatariNomi: string[] = [];
        if (data.destinatari && Array.isArray(data.destinatari)) {
          for (const destId of data.destinatari) {
            const { data: destData } = await supabase
              .from("tbutenti")
              .select("nome, cognome")
              .eq("id", destId)
              .single();

            if (destData) {
              destinatariNomi.push(`${destData.nome} ${destData.cognome}`);
            }
          }
        }

        await teamsNotificationService.sendComunicazioneNotification({
          id: data.id,
          oggetto: data.oggetto || "Nuova comunicazione",
          mittente: mittenteNome,
          destinatari: destinatariNomi.length > 0 ? destinatariNomi : ["Team"],
        });
      } catch (teamsError) {
        // Non blocchiamo l'operazione se la notifica Teams fallisce
        console.log("Teams notification skipped:", teamsError);
      }
    }

    return data;
  },

  async updateComunicazione(id: string, updates: ComunicazioneUpdate): Promise<Comunicazione | null> {
    const { data, error } = await supabase
      .from("tbcomunicazioni")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating comunicazione:", error);
      throw error;
    }
    return data;
  },

  async deleteComunicazione(id: string): Promise<boolean> {
    const { error } = await supabase
      .from("tbcomunicazioni")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting comunicazione:", error);
      return false;
    }
    return true;
  }
};