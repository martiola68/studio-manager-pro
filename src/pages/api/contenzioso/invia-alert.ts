import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const SECRET = process.env.CRON_SECRET || "x9KfP2LmQ8zYtA71vBnR";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ success: false, error: "Metodo non consentito" });
  }

  const querySecret =
    typeof req.query.secret === "string" ? req.query.secret : null;

  if (!SECRET || querySecret !== SECRET) {
    return res.status(401).json({
      success: false,
      error: "Non autorizzato",
    });
  }

  try {
    const oggi = new Date();
    oggi.setHours(0, 0, 0, 0);

    const oggiIso = oggi.toISOString().split("T")[0];

    const traSetteGiorni = new Date(oggi);
    traSetteGiorni.setDate(traSetteGiorni.getDate() + 7);
    const setteGiorniIso = traSetteGiorni.toISOString().split("T")[0];

    const { data: scadenze, error } = await supabase
      .from("tbcontenzioso_scadenze_generate")
      .select("*")
      .neq("stato", "Completata")
      .in("data_scadenza", [oggiIso, setteGiorniIso])
      .order("data_scadenza", { ascending: true })
      .limit(100);

    if (error) throw error;

    let processati = 0;
    let logCreati = 0;
    let giaInviati = 0;
    let saltati = 0;

    for (const item of scadenze || []) {
      processati++;

      const dataScadenza = new Date(item.data_scadenza);
      dataScadenza.setHours(0, 0, 0, 0);

      const giorniPreavviso = Math.round(
        (dataScadenza.getTime() - oggi.getTime()) / (1000 * 60 * 60 * 24)
      );

      const tipoAlert = giorniPreavviso === 7 ? "7gg" : "oggi";

      const markerUnivoco = `contenzioso:${item.id}:${tipoAlert}:${item.data_scadenza}`;

      const { data: logEsistente } = await supabase
        .from("tbalert_log")
        .select("id")
        .eq("marker_univoco", markerUnivoco)
        .maybeSingle();

      if (logEsistente) {
        giaInviati++;
        continue;
      }

      const { error: insertError } = await supabase.from("tbalert_log").insert({
        studio_id: null,
        modulo: "contenzioso",
        riferimento_tabella: "tbcontenzioso_scadenze_generate",
        riferimento_id: item.id,
        tipo_alert: tipoAlert,
        data_scadenza: item.data_scadenza,
        giorni_preavviso: giorniPreavviso,
        destinatario_utente_id: null,
        destinatario_email: null,
        messaggio_interno_creato: false,
        email_inviata: false,
        marker_univoco: markerUnivoco,
        errore: null,
        inviato_at: new Date().toISOString(),
      });

      if (insertError) {
        saltati++;
        console.error("Errore inserimento tbalert_log contenzioso:", insertError);
        continue;
      }

      logCreati++;
    }

    return res.status(200).json({
      success: true,
      oggiIso,
      setteGiorniIso,
      processati,
      log_creati: logCreati,
      gia_inviati: giaInviati,
      saltati,
      email_inviate: 0,
      note: "Contenzioso migrato su tbalert_log. Invio email non attivo finché non vengono definiti destinatari/responsabili sulle scadenze generate.",
    });
  } catch (error: any) {
    console.error("Errore alert contenzioso:", error);

    return res.status(500).json({
      success: false,
      error: error?.message || "Errore invio alert contenzioso",
    });
  }
}
