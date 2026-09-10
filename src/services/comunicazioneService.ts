import { supabase } from "@/lib/supabase/client";
import { Database } from "@/lib/supabase/types";
import { teamsNotificationService } from "./teamsNotificationService";

type Comunicazione = Database["public"]["Tables"]["tbcomunicazioni"]["Row"];
type ComunicazioneInsert = Database["public"]["Tables"]["tbcomunicazioni"]["Insert"];
type ComunicazioneUpdate = Database["public"]["Tables"]["tbcomunicazioni"]["Update"];

async function resolveCurrentStudioId(): Promise<string> {
  const { data, error } = await (supabase as any).rpc("current_studio_id");

  if (error) {
    console.error("Error resolving current studio:", error);
    throw error;
  }

  const studioId = typeof data === "string" ? data : String(data || "");

  if (!studioId) {
    throw new Error("Studio dell'utente loggato non determinato");
  }

  return studioId;
}

export const comunicazioneService = {
  async getComunicazioni(studioId?: string | null): Promise<Comunicazione[]> {
    try {
      const effectiveStudioId = studioId || (await resolveCurrentStudioId());

      const { data, error } = await supabase
        .from("tbcomunicazioni")
        .select("*")
        .eq("studio_id", effectiveStudioId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching comunicazioni:", error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error("Error fetching comunicazioni:", error);
      return [];
    }
  },

  async getComunicazioneById(id: string): Promise<Comunicazione | null> {
    const studioId = await resolveCurrentStudioId();

    const { data, error } = await supabase
      .from("tbcomunicazioni")
      .select("*")
      .eq("id", id)
      .eq("studio_id", studioId)
      .single();

    if (error) {
      console.error("Error fetching comunicazione:", error);
      return null;
    }

    return data;
  },

  async createComunicazione(comunicazione: ComunicazioneInsert): Promise<Comunicazione | null> {
    try {
      const studioId =
        (comunicazione as any).studio_id || (await resolveCurrentStudioId());

      const payload = {
        ...comunicazione,
        studio_id: studioId,
      } as ComunicazioneInsert;

      const { data, error } = await supabase
        .from("tbcomunicazioni")
        .insert(payload)
        .select()
        .single();

      if (error) {
        console.error("Error creating comunicazione:", error);
        throw error;
      }

      try {
        await teamsNotificationService.sendComunicazioneNotification(
          comunicazione.oggetto,
          "Cliente"
        );
      } catch (e) {
        console.error("Errore notifica Teams:", e);
      }

      return data;
    } catch (error: any) {
      console.error("Error creating comunicazione:", error);
      throw error;
    }
  },

  async updateComunicazione(id: string, updates: ComunicazioneUpdate): Promise<Comunicazione | null> {
    const studioId = await resolveCurrentStudioId();

    const { data, error } = await supabase
      .from("tbcomunicazioni")
      .update(updates)
      .eq("id", id)
      .eq("studio_id", studioId)
      .select()
      .single();

    if (error) {
      console.error("Error updating comunicazione:", error);
      throw error;
    }

    return data;
  },

  async deleteComunicazione(id: string): Promise<boolean> {
    const studioId = await resolveCurrentStudioId();

    const { error } = await supabase
      .from("tbcomunicazioni")
      .delete()
      .eq("id", id)
      .eq("studio_id", studioId);

    if (error) {
      console.error("Error deleting comunicazione:", error);
      return false;
    }

    return true;
  },
};