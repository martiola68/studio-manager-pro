import { supabase } from "@/lib/supabase/client";
import { authService } from "@/services/authService";

export const studioService = {
  async getStudioId(): Promise<string> {
    const authUser = await authService.getCurrentUser();

    if (!authUser?.email) {
      throw new Error("Utente non autenticato.");
    }

    const { data, error } = await (supabase as any)
      .from("tbutenti")
      .select("studio_id")
      .eq("email", authUser.email)
      .single();

    if (error) {
      throw new Error(error.message || "Errore recupero studio_id.");
    }

    if (!data?.studio_id) {
      throw new Error("studio_id non trovato per l'utente loggato.");
    }

    return data.studio_id;
  },

  async getStudio(): Promise<any | null> {
    const studioId = await this.getStudioId();

    const { data, error } = await (supabase as any)
      .from("tbstudio")
      .select("*")
      .eq("id", studioId)
      .single();

    if (error) {
      throw new Error(error.message || "Errore recupero studio.");
    }

    return data ?? null;
  },
};

export async function getStudioId(): Promise<string> {
  return studioService.getStudioId();
}
