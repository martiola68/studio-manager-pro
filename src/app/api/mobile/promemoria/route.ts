import { randomUUID } from "crypto";
import { getMobileUser, mobileError, mobileSupabaseAdmin } from "@/lib/mobileApiAuth";
import { teamsService } from "@/services/teamsService";

export async function GET(request: Request) {
  try {
    const { utente } = await getMobileUser(request);

    const [
      { data: promemoria, error: pError },
      { data: utenti, error: uError },
      { data: tipi, error: tError },
    ] = await Promise.all([
      mobileSupabaseAdmin
        .from("tbpromemoria")
        .select("id,codice_promemoria,titolo,descrizione,data_inserimento,giorni_scadenza,data_scadenza,priorita,working_progress,operatore_id,destinatario_id,settore,tipo_promemoria_id,allegati")
        .eq("studio_id", utente.studio_id)
        .or(`operatore_id.eq.${utente.id},destinatario_id.eq.${utente.id}`)
        .not("working_progress", "in", '("Completato","Annullata")')
        .order("data_scadenza", { ascending: true, nullsFirst: false })
        .limit(500),

      mobileSupabaseAdmin
        .from("tbutenti")
        .select("id,nome,cognome,email,settore,attivo")
        .eq("studio_id", utente.studio_id)
        .eq("attivo", true)
        .order("cognome", { ascending: true }),

      mobileSupabaseAdmin
        .from("tbtipopromemoria")
        .select("id,nome,colore")
        .eq("origine", "S")
        .order("nome", { ascending: true }),
    ]);

    if (pError) throw pError;
    if (uError) throw uError;
    if (tError) throw tError;

    return Response.json({
      success: true,
      data: promemoria || [],
      utenti: utenti || [],
      tipi_promemoria: tipi || [],
      utente_corrente: utente,
    });
  } catch (error) {
    return mobileError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { utente } = await getMobileUser(request);
    const body = await request.json();

    const titolo = String(body?.titolo || "").trim();
    if (!titolo) {
      return Response.json({ success: false, error: "Titolo obbligatorio." }, { status: 400 });
    }

    const destinatari = Array.isArray(body?.destinatari)
      ? body.destinatari.map(String).filter(Boolean)
      : [];

    const finalDestinatari =
      destinatari.length > 0 ? Array.from(new Set(destinatari)) : [utente.id];

    const gruppoPromemoriaId =
      finalDestinatari.length > 1 ? randomUUID() : null;

    const created: any[] = [];

    for (const destinatarioId of finalDestinatari) {
      const { data: destinatario } = await mobileSupabaseAdmin
        .from("tbutenti")
        .select("id,nome,cognome,email,settore")
        .eq("id", destinatarioId)
        .eq("studio_id", utente.studio_id)
        .maybeSingle();

      const payload = {
        titolo,
        descrizione: body?.descrizione || null,
        data_inserimento: body?.data_inserimento,
        giorni_scadenza: Number(body?.giorni_scadenza || 0),
        data_scadenza: body?.data_scadenza,
        priorita: body?.priorita || "Media",
        working_progress: body?.working_progress || "Aperto",
        operatore_id: utente.id,
        destinatario_id: destinatarioId || null,
        settore: destinatario?.settore || body?.settore || utente.settore || null,
        tipo_promemoria_id: body?.tipo_promemoria_id || null,
        studio_id: utente.studio_id,
        gruppo_promemoria_id: gruppoPromemoriaId,
      };

      const { data: inserted, error } = await mobileSupabaseAdmin
        .from("tbpromemoria")
        .insert(payload)
        .select("*")
        .single();

      if (error) throw error;
      created.push(inserted);

      if (body?.invia_teams && destinatario?.email) {
        try {
          await teamsService.sendDirectMessage(
            utente.studio_id,
            utente.id,
            destinatario.email,
            {
              content:
                `📝 <strong>Nuovo Promemoria</strong><br><br><strong>${titolo}</strong><br>${body?.descrizione || ""}<br><br>📅 Scadenza: ${body?.data_scadenza || "-"}<br>🚨 Priorità: ${body?.priorita || "Media"}`,
              contentType: "html",
              importance: body?.priorita === "Alta" ? "high" : "normal",
            }
          );
        } catch (error) {
          console.error("Notifica Teams promemoria non inviata:", error);
        }
      }
    }

    return Response.json({ success: true, data: created });
  } catch (error) {
    return mobileError(error);
  }
}
