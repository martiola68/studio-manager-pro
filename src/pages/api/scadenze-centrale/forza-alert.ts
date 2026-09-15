import type { NextApiRequest, NextApiResponse } from "next";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const CRON_SECRET = process.env.CRON_SECRET;

function leggiAccessToken(req: NextApiRequest): string | null {
  const authorization = String(req.headers.authorization || "");
  if (!authorization.toLowerCase().startsWith("bearer ")) return null;
  return authorization.slice(7).trim() || null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ success: false, error: "Metodo non consentito." });
  }

  if (!CRON_SECRET) {
    return res.status(500).json({ success: false, error: "CRON_SECRET mancante." });
  }

  const supabaseAdmin = getSupabaseAdmin();

  try {
    const accessToken = leggiAccessToken(req);
    if (!accessToken) {
      return res.status(401).json({ success: false, error: "Sessione non valida." });
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(accessToken);
    if (authError || !authData.user) {
      return res.status(401).json({
        success: false,
        error: authError?.message || "Utente non autenticato.",
      });
    }

    const { data: caller, error: callerError } = await supabaseAdmin
      .from("tbutenti")
      .select("id,studio_id,tipo_utente,attivo,amministratore_sistema_generale")
      .eq("user_id", authData.user.id)
      .eq("attivo", true)
      .maybeSingle();

    if (callerError) throw callerError;

    if (
      !caller?.studio_id ||
      caller.tipo_utente !== "Admin" ||
      !caller.amministratore_sistema_generale
    ) {
      return res.status(403).json({
        success: false,
        error: "Operazione riservata all'Amministratore di sistema generale.",
      });
    }

    const scadenzaId = String(req.body?.scadenza_id || "").trim();
    if (!scadenzaId) {
      return res.status(400).json({ success: false, error: "scadenza_id obbligatorio." });
    }

    const studioId = String(caller.studio_id);
    const { data: scadenza, error: scadenzaError } = await supabaseAdmin
      .from("tbscadenze_centrale")
      .select("id,studio_id,stato,titolo,data_scadenza,prossimo_alert_at")
      .eq("id", scadenzaId)
      .eq("studio_id", studioId)
      .maybeSingle();

    if (scadenzaError) throw scadenzaError;
    if (!scadenza) {
      return res.status(404).json({ success: false, error: "Scadenza non trovata." });
    }
    if (scadenza.stato !== "attiva") {
      return res.status(400).json({
        success: false,
        error: "La scadenza non è attiva e non può essere inviata.",
      });
    }

    const adesso = new Date().toISOString();
    const { error: updateError } = await supabaseAdmin
      .from("tbscadenze_centrale")
      .update({ prossimo_alert_at: adesso, updated_at: adesso })
      .eq("id", scadenzaId)
      .eq("studio_id", studioId);

    if (updateError) throw updateError;

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      "https://app.studiomanagerpro.it";

    const url =
      `${baseUrl}/api/scadenze-centrale/processa-alert` +
      `?secret=${encodeURIComponent(CRON_SECRET)}` +
      `&scadenza_id=${encodeURIComponent(scadenzaId)}`;

    const response = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
      cache: "no-store",
    });

    const testo = await response.text();
    let risultato: any;
    try {
      risultato = JSON.parse(testo);
    } catch {
      risultato = { raw: testo };
    }

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: risultato?.error || "Errore durante l'invio manuale dell'alert.",
        risultato,
      });
    }

    const inviati = Number(risultato?.inviati || 0);
    const saltati = Number(risultato?.saltati || 0);
    const errori = Number(risultato?.errori || 0);

    return res.status(200).json({
      success: true,
      scadenza_id: scadenzaId,
      titolo: scadenza.titolo,
      inviati,
      saltati,
      errori,
      risultato,
      messaggio:
        inviati > 0
          ? `Alert inviato: ${inviati} destinatari.`
          : errori > 0
            ? "Invio eseguito con errori."
            : "Nessun nuovo invio: alert già processato oppure nessun destinatario da inviare.",
    });
  } catch (error: any) {
    console.error("Errore invio manuale alert scadenza:", error);
    return res.status(500).json({
      success: false,
      error: error?.message || "Errore durante l'invio manuale dell'alert.",
    });
  }
}
