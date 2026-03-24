import { supabase } from "@/lib/supabase/client";
import type { MicrosoftConnection } from "@/types/microsoftConnection";

export async function getMicrosoftConnections(
  studioId: string
): Promise<MicrosoftConnection[]> {
  const { data, error } = await (supabase as any)
    .from("microsoft365_connections")
    .select("*")
    .eq("studio_id", studioId)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("Errore caricamento connessioni Microsoft:", error);
    throw error;
  }

  return (data ?? []) as MicrosoftConnection[];
}

export async function setDefaultMicrosoftConnection(
  studioId: string,
  connectionId: string
): Promise<void> {
  const client = supabase as any;

  const { error: resetError } = await client
    .from("microsoft365_connections")
    .update({ is_default: false })
    .eq("studio_id", studioId);

  if (resetError) {
    console.error("Errore reset connessioni predefinite:", resetError);
    throw resetError;
  }

  const { error } = await client
    .from("microsoft365_connections")
    .update({ is_default: true })
    .eq("id", connectionId)
    .eq("studio_id", studioId);

  if (error) {
    console.error("Errore impostazione connessione predefinita:", error);
    throw error;
  }
}
