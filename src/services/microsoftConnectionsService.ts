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

  const { count: connectionsCount, error: countError } = await client
    .from("microsoft365_connections")
    .select("id", { count: "exact", head: true })
    .eq("studio_id", input.studio_id);

  if (countError) {
    console.error("Errore conteggio connessioni Microsoft:", countError);
    throw countError;
  }

  if ((connectionsCount || 0) >= 2) {
    throw new Error("Limite massimo di 2 connessioni Microsoft raggiunto per questo studio");
  }

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

export async function getMicrosoftConnectionsForUser(
  studioId: string,
  userId: string
): Promise<MicrosoftConnection[]> {
  const client = supabase as any;

 const { data: connections, error: connectionsError } = await client
  .from("microsoft365_connections")
  .select("*")
  .eq("studio_id", studioId)
  .order("is_default", { ascending: false })
  .order("sort_order", { ascending: true });

  if (connectionsError) {
    console.error("Errore caricamento connessioni Microsoft per utente:", connectionsError);
    throw connectionsError;
  }

  const { data: tokenRows, error: tokenError } = await client
    .from("tbmicrosoft365_user_tokens")
    .select("microsoft_connection_id")
    .eq("studio_id", studioId)
    .eq("user_id", userId)
    .is("revoked_at", null);

  if (tokenError) {
    console.error("Errore caricamento token Microsoft utente:", tokenError);
    throw tokenError;
  }

  const allowedIds = new Set(
    (tokenRows ?? [])
      .map((row: any) => row.microsoft_connection_id)
      .filter(Boolean)
  );

  return ((connections ?? []) as MicrosoftConnection[]).filter((conn) =>
    allowedIds.has(conn.id)
  );
}

export function resolveMicrosoftConnectionId(
  connections: MicrosoftConnection[],
  currentConnectionId?: string | null
): string {
  const current = currentConnectionId ?? "";

  if (current && connections.some((conn) => conn.id === current)) {
    return current;
  }

  const defaultConnection =
    connections.find((conn: any) => conn.is_default) ?? null;

  if (defaultConnection?.id) {
    return defaultConnection.id;
  }

  return connections[0]?.id ?? "";
}
