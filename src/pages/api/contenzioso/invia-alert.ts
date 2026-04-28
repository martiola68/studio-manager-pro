import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { sendEmail } from "@/services/emailService";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Metodo non consentito" });
  }

  try {
    await (supabase as any).rpc("genera_alert_contenzioso_base");

    const { data: alert, error: alertError } = await (supabase as any)
      .from("tbcontenzioso_alert_email")
      .select("*")
      .eq("inviato", false)
      .is("errore", null)
      .order("created_at", { ascending: true })
      .limit(20);

    if (alertError) {
      return res.status(500).json({
        success: false,
        error: alertError.message,
      });
    }

    let inviati = 0;
    let falliti = 0;

    for (const item of alert || []) {
      try {
        const { data: operatore, error: operatoreError } = await (supabase as any)
          .from("tbutenti")
          .select("id, email, microsoft_connection_id")
          .eq("id", item.operatore_responsabile_id)
          .maybeSingle();

        if (operatoreError || !operatore?.id || !operatore?.microsoft_connection_id) {
          throw new Error("Operatore senza connessione Microsoft valida");
        }

        const result = await sendEmail({
          to: item.email_destinatario,
          subject: item.oggetto,
          html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6;">
              <h2 style="color:#dc2626;">Promemoria scadenza contenzioso</h2>
              <p>${item.corpo}</p>
              <hr />
              <p style="font-size:12px;color:#666;">
                Studio Manager Pro - Email automatica
              </p>
            </div>
          `,
          text: item.corpo,
          senderUserId: operatore.id,
          microsoftConnectionId: operatore.microsoft_connection_id,
          sendMode: "user",
        });

        if (!result.success) {
          throw new Error(result.error || "Invio email non riuscito");
        }

        await (supabase as any)
          .from("tbcontenzioso_alert_email")
          .update({
            inviato: true,
            inviato_at: new Date().toISOString(),
            errore: null,
          })
          .eq("id", item.id);

        inviati++;
      } catch (error: any) {
        falliti++;

        await (supabase as any)
          .from("tbcontenzioso_alert_email")
          .update({
            errore: error?.message || "Errore invio email",
          })
          .eq("id", item.id);
      }
    }

    return res.status(200).json({
      success: true,
      processati: alert?.length || 0,
      inviati,
      falliti,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error?.message || "Errore invio alert contenzioso",
    });
  }
}
