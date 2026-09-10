import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const supabaseAdmin = getSupabaseAdmin();

async function getSystemAdmin(req: NextApiRequest) {
  const authHeader = String(req.headers.authorization || "");
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : "";

  if (!token) return null;

  const {
    data: { user: authUser },
    error: authError,
  } = await supabaseAdmin.auth.getUser(token);

  if (authError || !authUser) return null;

  const { data: caller, error: callerError } = await supabaseAdmin
    .from("tbutenti")
    .select("id,email,studio_id,tipo_utente,attivo,amministratore_sistema_generale")
    .or(`user_id.eq.${authUser.id},email.eq.${authUser.email || ""}`)
    .limit(1)
    .maybeSingle();

  if (callerError || !caller) return null;

  if (
    caller.attivo === false ||
    caller.tipo_utente !== "Admin" ||
    !caller.amministratore_sistema_generale
  ) {
    return null;
  }

  return caller;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Metodo non consentito" });
  }

  const admin = await getSystemAdmin(req);
  if (!admin) {
    return res.status(403).json({
      success: false,
      error: "Accesso riservato all'Amministratore di sistema generale",
    });
  }

  const studioId =
    typeof req.query.studio_id === "string"
      ? req.query.studio_id
      : String(req.body?.studio_id || "");

  if (!studioId) {
    return res.status(400).json({ success: false, error: "studio_id obbligatorio" });
  }

  try {
    if (req.method === "GET") {
      const { data, error } = await supabaseAdmin
        .from("tbpresenze_report_email_config")
        .select("studio_id,destinatari,attivo,ora_invio,ultimo_invio_data")
        .eq("studio_id", studioId)
        .maybeSingle();

      if (error) throw error;

      return res.status(200).json({
        success: true,
        config: data || {
          studio_id: studioId,
          destinatari: ["", "", ""],
          attivo: false,
          ora_invio: "08:00",
          ultimo_invio_data: null,
        },
      });
    }

    const destinatari = Array.isArray(req.body?.destinatari)
      ? req.body.destinatari.slice(0, 3).map((x: unknown) => String(x || "").trim())
      : ["", "", ""];

    while (destinatari.length < 3) destinatari.push("");

    const oraInvio = String(req.body?.ora_invio || "08:00").slice(0, 5);
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(oraInvio)) {
      return res.status(400).json({ success: false, error: "Ora invio non valida" });
    }

    const { data, error } = await supabaseAdmin
      .from("tbpresenze_report_email_config")
      .upsert(
        {
          studio_id: studioId,
          destinatari,
          ora_invio: oraInvio,
          attivo: !!req.body?.attivo,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "studio_id" }
      )
      .select("studio_id,destinatari,attivo,ora_invio,ultimo_invio_data")
      .single();

    if (error) throw error;

    return res.status(200).json({ success: true, config: data });
  } catch (error: any) {
    console.error("Errore configurazione report presenze:", error);
    return res.status(500).json({
      success: false,
      error: error?.message || "Errore configurazione report presenze",
    });
  }
}
