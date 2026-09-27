import { getMobileUser, mobileError, mobileSupabaseAdmin } from "@/lib/mobileApiAuth";

export async function GET(request: Request) {
  try {
    const { utente } = await getMobileUser(request);

    const { data, error } = await mobileSupabaseAdmin
      .from("tbpromemoria")
      .select("id,codice_promemoria,titolo,descrizione,data_inserimento,data_scadenza,priorita,working_progress,operatore_id,destinatario_id,settore")
      .eq("studio_id", utente.studio_id)
      .or(`operatore_id.eq.${utente.id},destinatario_id.eq.${utente.id}`)
      .not("working_progress", "in", '("Completato","Annullata")')
      .order("data_scadenza", { ascending: true, nullsFirst: false })
      .limit(500);

    if (error) throw error;

    return Response.json({ success: true, data: data || [] });
  } catch (error) {
    return mobileError(error);
  }
}
