import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { sendEmailServer } from "@/services/sendEmailServer";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Metodo non consentito" });
  }

  try {
    const { post_id, user_id } = req.body || {};

    if (!post_id || !user_id) {
      return res.status(400).json({
        ok: false,
        error: "post_id e user_id obbligatori",
      });
    }

    const supabase = getSupabaseAdmin();

    const { data: post, error: postError } = await supabase
      .from("tbpromemoria")
      .select(`
        id,
        titolo,
        descrizione,
        priorita,
        data_scadenza,
        destinatario_id,
        operatore_id,
        tipo,
        working_progress
      `)
      .eq("id", post_id)
      .eq("destinatario_id", user_id)
      .eq("tipo", "POST_GIORNO")
      .maybeSingle();

    if (postError) throw postError;

    if (!post) {
      return res.status(404).json({
        ok: false,
        error: "Post non trovato o non autorizzato",
      });
    }

    const { data: utente, error: utenteError } = await supabase
      .from("tbutenti")
      .select("id, nome, cognome, email, studio_id")
      .eq("id", user_id)
      .maybeSingle();

    if (utenteError) throw utenteError;

    if (!utente?.email || !utente?.studio_id) {
      return res.status(400).json({
        ok: false,
        error: "Email utente o studio_id mancanti",
      });
    }

    const { data: studio, error: studioError } = await supabase
      .from("tbstudio")
      .select("microsoft_connection_id")
      .eq("id", utente.studio_id)
      .maybeSingle();

    if (studioError) throw studioError;

    if (!studio?.microsoft_connection_id) {
      return res.status(400).json({
        ok: false,
        error: "Connessione Microsoft 365 mancante per lo studio",
      });
    }

    const nowIso = new Date().toISOString();

    const { error: updateError } = await supabase
      .from("tbpromemoria")
      .update({
        working_progress: "Completato",
        updated_at: nowIso,
      })
      .eq("id", post_id)
      .eq("destinatario_id", user_id)
      .eq("tipo", "POST_GIORNO");

    if (updateError) throw updateError;

    const nomeUtente = [utente.nome, utente.cognome].filter(Boolean).join(" ");

    const html = `
      <div style="font-family: Arial, sans-serif; font-size: 14px; color: #111827; line-height: 1.6;">
        <p>Ciao ${nomeUtente || "utente"},</p>

        <p>Il seguente post del giorno è stato completato:</p>

        <div style="border:1px solid #e5e7eb; border-left:5px solid #2563eb; padding:14px; background:#f9fafb;">
          <p><strong>Titolo:</strong> ${post.titolo}</p>
          <p><strong>Descrizione:</strong> ${post.descrizione || "-"}</p>
          <p><strong>Priorità:</strong> ${post.priorita || "-"}</p>
          <p><strong>Data riferimento:</strong> ${
            post.data_scadenza
              ? new Date(post.data_scadenza).toLocaleDateString("it-IT")
              : "-"
          }</p>
          <p><strong>Completato il:</strong> ${new Date().toLocaleString("it-IT")}</p>
        </div>

        <p style="margin-top:16px;">
          Questo messaggio è stato generato automaticamente da Studio Manager Pro per mantenere traccia dell’attività svolta.
        </p>
      </div>
    `.trim();

    const result = await sendEmailServer({
      senderUserId: utente.id,
      microsoftConnectionId: studio.microsoft_connection_id,
      to: utente.email,
      subject: `Post completato: ${post.titolo}`,
      html,
    });

    if (!result.success) {
      return res.status(200).json({
        ok: true,
        email_inviata: false,
        warning: result.error || "Post completato, ma email non inviata",
      });
    }

    return res.status(200).json({
      ok: true,
      email_inviata: true,
    });
  } catch (error: any) {
    console.error("Errore completamento post del giorno:", error);

    return res.status(500).json({
      ok: false,
      error: error?.message || "Errore interno",
    });
  }
}
