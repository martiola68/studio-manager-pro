import { supabase } from "@/lib/supabase/client";
import type { MicrosoftConnection } from "@/types/microsoftConnection";

export async function getMicrosoftConnections(
  studioId: string
): Promise<MicrosoftConnection[]> {
  const { data, error } = await supabase
    .from("microsoft365_connections")
    .select("*")
    .eq("studio_id", studioId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data || []) as MicrosoftConnection[];
}

export async function setDefaultMicrosoftConnection(
  studioId: string,
  connectionId: string
) {
  const { error: resetError } = await supabase
    .from("microsoft365_connections")
    .update({ is_default: false })
    .eq("studio_id", studioId);

  if (resetError) throw resetError;

  const { error: setError } = await supabase
    .from("microsoft365_connections")
    .update({ is_default: true })
    .eq("id", connectionId);

  if (setError) throw setError;
}
