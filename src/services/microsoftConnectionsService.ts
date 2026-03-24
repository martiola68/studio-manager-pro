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

export async function createMicrosoftConnection(input: {
  studio_id: string;
  nome_connessione: string;
  tenant_id: string;
  client_id: string;
  client_secret: string;
  enabled?: boolean;
  is_default?: boolean;
  sort_order?: number;
  connected_email?: string | null;
  organizer_email?: string | null;
}): Promise<MicrosoftConnection> {
  const client = supabase as any;

  if (input.is_default) {
    const { error: resetError } = await client
      .from("microsoft365_connections")
      .update({ is_default: false })
      .eq("studio_id", input.studio_id);

    if (resetError) {
      console.error("Errore reset default prima della creazione:", resetError);
      throw resetError;
    }
  }

  const payload = {
    studio_id: input.studio_id,
    nome_connessione: input.nome_connessione,
    tenant_id: input.tenant_id,
    client_id: input.client_id,
    client_secret: input.client_secret,
    enabled: input.enabled ?? true,
    is_default: input.is_default ?? false,
    sort_order: input.sort_order ?? 0,
    connected_email: input.connected_email ?? null,
    organizer_email: input.organizer_email ?? null,
  };

  const { data, error } = await client
    .from("microsoft365_connections")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    console.error("Errore creazione connessione Microsoft:", error);
    throw error;
  }

  return data as MicrosoftConnection;
}
