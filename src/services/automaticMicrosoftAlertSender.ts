import type { SupabaseClient } from "@supabase/supabase-js";

export const AUTOMATIC_ALERT_OWNER_EMAIL = "m.artiola@revisionicommerciali.it";
export const AUTOMATIC_ALERT_FROM_MAILBOX = "noreply@revisionicommerciali.it";

export async function resolveAutomaticMicrosoftAlertSender(
  supabase: SupabaseClient,
  studioId: string
): Promise<{
  senderUserId: string;
  microsoftConnectionId: string;
  fromMailbox: string;
}> {
  if (!studioId) {
    throw new Error("studio_id mancante per l'invio automatico");
  }

  const { data: owner, error: ownerError } = await supabase
    .from("tbutenti")
    .select("id, studio_id, email, attivo, microsoft_connection_id")
    .eq("studio_id", studioId)
    .eq("email", AUTOMATIC_ALERT_OWNER_EMAIL)
    .eq("attivo", true)
    .maybeSingle();

  if (ownerError || !owner?.id) {
    throw new Error(
      `Mittente automatico Microsoft ${AUTOMATIC_ALERT_OWNER_EMAIL} non trovato nello studio`
    );
  }

  if (!owner.microsoft_connection_id) {
    throw new Error(
      `Connessione Microsoft di ${AUTOMATIC_ALERT_OWNER_EMAIL} non trovata`
    );
  }

  const { data: token, error: tokenError } = await supabase
    .from("tbmicrosoft365_user_tokens")
    .select("user_id")
    .eq("microsoft_connection_id", owner.microsoft_connection_id)
    .eq("user_id", owner.id)
    .is("revoked_at", null)
    .maybeSingle();

  if (tokenError || !token?.user_id) {
    throw new Error(
      `Token Microsoft di ${AUTOMATIC_ALERT_OWNER_EMAIL} non trovato o revocato`
    );
  }

  return {
    senderUserId: String(owner.id),
    microsoftConnectionId: String(owner.microsoft_connection_id),
    fromMailbox: AUTOMATIC_ALERT_FROM_MAILBOX,
  };
}
