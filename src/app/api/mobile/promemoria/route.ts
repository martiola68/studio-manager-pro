import { randomUUID } from "crypto";
import { getMobileUser, mobileError, mobileSupabaseAdmin } from "@/lib/mobileApiAuth";
import { teamsService } from "@/services/teamsService";
import { sendEmailServer } from "@/services/sendEmailServer";


async function resolveStudioEmailSender(studioId: string, currentUserId: string) {
  const { data: studio } = await mobileSupabaseAdmin
    .from("tbstudio")
    .select("email,microsoft_connection_id,email_tenant2,microsoft_connection_id_tenant2")
    .eq("id", studioId)
    .maybeSingle();

  const connections = [
    {
      id: studio?.microsoft_connection_id ? String(studio.microsoft_connection_id) : null,
      mailbox: studio?.email ? String(studio.email).trim() : null,
    },
    {
      id: studio?.microsoft_connection_id_tenant2 ? String(studio.microsoft_connection_id_tenant2) : null,
      mailbox: studio?.email_tenant2 ? String(studio.email_tenant2).trim() : null,
    },
  ].filter((item) => Boolean(item.id));

  // Prima scelta: il token delegato dell'utente che ha creato il promemoria.
  // In questo modo /me/sendMail parte realmente dal suo account e non da quello
  // dell'ultimo collega che ha aggiornato il token Microsoft 365.
  for (const connection of connections) {
    const { data: ownToken } = await mobileSupabaseAdmin
      .from("tbmicrosoft365_user_tokens")
      .select("user_id")
      .eq("studio_id", studioId)
      .eq("microsoft_connection_id", connection.id)
      .eq("user_id", currentUserId)
      .is("revoked_at", null)
      .not("token_cache_encrypted", "is", null)
      .limit(1)
      .maybeSingle();

    if (ownToken?.user_id) {
      return {
        senderUserId: currentUserId,
        microsoftConnectionId: String(connection.id),
        fromMailbox: null as string | null,
      };
    }
  }

  // Fallback: usa un token tecnico disponibile per la connessione ma forza
  // come From la mailbox dello studio. Non deve mai apparire il nome di un
  // altro collega come mittente del promemoria creato dall'utente corrente.
  for (const connection of connections) {
    if (!connection.mailbox) continue;

    const { data: tokenOwner } = await mobileSupabaseAdmin
      .from("tbmicrosoft365_user_tokens")
      .select("user_id")
      .eq("studio_id", studioId)
      .eq("microsoft_connection_id", connection.id)
      .is("revoked_at", null)
      .not("token_cache_encrypted", "is", null)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (tokenOwner?.user_id) {
      return {
        senderUserId: String(tokenOwner.user_id),
        microsoftConnectionId: String(connection.id),
        fromMailbox: connection.mailbox,
      };
    }
  }

  return null;
}

function esc(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtDate(value: unknown) {
  const s = String(value || "");
  if (!/^\d{4}-\d{2}-\d{2}/.test(s)) return s || "-";
  return `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}`;
}

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

    if (body?.action === "update_working_progress") {
      const id = String(body?.id || "").trim();
      const workingProgress = String(body?.working_progress || "").trim();
      const allowed = ["Aperto", "In lavorazione", "Completato", "Presa visione", "Richiesta confronto", "Annullata"];
      if (!id || !allowed.includes(workingProgress)) {
        return Response.json({ success: false, error: "Dati stato non validi." }, { status: 400 });
      }

      const { data: current, error: currentError } = await mobileSupabaseAdmin
        .from("tbpromemoria")
        .select("id,operatore_id,destinatario_id")
        .eq("id", id)
        .eq("studio_id", utente.studio_id)
        .maybeSingle();
      if (currentError) throw currentError;
      if (!current || (String(current.operatore_id || "") !== String(utente.id) && String(current.destinatario_id || "") !== String(utente.id))) {
        return Response.json({ success: false, error: "Promemoria non disponibile." }, { status: 404 });
      }

      const { data: updated, error: updateError } = await mobileSupabaseAdmin
        .from("tbpromemoria")
        .update({ working_progress: workingProgress })
        .eq("id", id)
        .eq("studio_id", utente.studio_id)
        .select("*")
        .single();
      if (updateError) throw updateError;

      return Response.json({ success: true, data: updated });
    }

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

      if (destinatario?.email) {
        try {
          const sender = await resolveStudioEmailSender(utente.studio_id, utente.id);
          if (sender) {
            const codice = inserted?.codice_promemoria ? String(inserted.codice_promemoria) : "";
            const priorita = String(body?.priorita || "Media");
            const subject = `${codice ? `[${codice}] ` : ""}Nuovo promemoria: ${titolo}`;
            const html = `
              <div style="font-family:Arial,sans-serif;font-size:14px;color:#111827;line-height:1.6">
                <p>Gentile ${esc(destinatario.nome)} ${esc(destinatario.cognome)},</p>
                <p>ti è stato assegnato un nuovo promemoria.</p>
                <div style="margin:16px 0;padding:16px;border:1px solid #e5e7eb;border-radius:12px;background:#fff">
                  ${codice ? `<p><strong>Codice:</strong> ${esc(codice)}</p>` : ""}
                  <p><strong>Titolo:</strong> ${esc(titolo)}</p>
                  <p><strong>Descrizione:</strong> ${esc(body?.descrizione || "-")}</p>
                  <p><strong>Data inserimento:</strong> ${esc(fmtDate(body?.data_inserimento))}</p>
                  <p><strong>Data scadenza:</strong> ${esc(fmtDate(body?.data_scadenza))}</p>
                  <p><strong>Priorità:</strong> ${esc(priorita)}</p>
                  <p><strong>Stato:</strong> ${esc(body?.working_progress || "Aperto")}</p>
                  <p><strong>Operatore:</strong> ${esc(`${utente.nome || ""} ${utente.cognome || ""}`.trim())}</p>
                </div>
                <p>Accedi al gestionale per visualizzare il dettaglio completo del promemoria.</p>
              </div>`;
            const result = await sendEmailServer({
              senderUserId: sender.senderUserId,
              microsoftConnectionId: sender.microsoftConnectionId,
              to: destinatario.email,
              subject,
              html,
              fromMailbox: sender.fromMailbox,
            });
            if (!result.success) {
              console.error("Email creazione promemoria mobile non inviata:", result.error);
            }
          }
        } catch (emailError) {
          console.error("Email creazione promemoria mobile non inviata:", emailError);
        }
      }

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
