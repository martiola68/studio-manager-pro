import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { sendEmail } from "@/services/emailService";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function prossimoLunediOre9() {
  const now = new Date();
  const result = new Date(now);

  const day = result.getDay();
  const daysUntilMonday = day === 0 ? 1 : 8 - day;

  result.setDate(result.getDate() + daysUntilMonday);
  result.setHours(9, 0, 0, 0);

  return result.toISOString();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const cronSecret = req.headers.authorization?.replace("Bearer ", "");

    if (cronSecret !== process.env.CRON_SECRET) {
      return res.status(401).json({ error: "Non autorizzato" });
    }

    const { data: alerts, error: alertsError } = await supabaseAdmin
      .from("tbAVFascicoliAlert")
      .select("*")
      .eq("completo", false)
      .lte("prossimo_alert_at", new Date().toISOString());

    if (alertsError) throw alertsError;

    let inviati = 0;
    let saltati = 0;

    for (const alert of alerts || []) {
      if (!alert.cliente_id) {
        saltati++;
        continue;
      }

      const { data: cliente, error: clienteError } = await supabaseAdmin
        .from("tbclienti")
        .select(`
          id,
          ragione_sociale,
          cod_cliente,
          utente_operatore_id
        `)
        .eq("id", alert.cliente_id)
        .maybeSingle();

      if (clienteError || !cliente?.utente_operatore_id) {
        saltati++;
        continue;
      }

      const { data: utente, error: utenteError } = await supabaseAdmin
        .from("tbutenti")
        .select("id, email, nome, cognome")
        .eq("id", cliente.utente_operatore_id)
        .maybeSingle();

      if (utenteError || !utente?.email) {
        saltati++;
        continue;
      }

      const nomeCliente =
        cliente.ragione_sociale || cliente.cod_cliente || "Cliente";

      const mancanti = alert.documenti_mancanti || [];
      const opzionali = alert.documenti_opzionali_mancanti || [];

      const { data: studio } = await supabaseAdmin
  .from("tbstudio")
  .select("email, microsoft_connection_id")
  .eq("id", alert.studio_id)
  .maybeSingle();

if (!studio?.microsoft_connection_id) {
  saltati++;
  continue;
}
      
      const html = `
        <div style="font-family: Arial, sans-serif; font-size: 14px; color: #111827;">
          <h2>Fascicolo AML incompleto</h2>

          <p>
            Il fascicolo AML del cliente <strong>${nomeCliente}</strong>
            risulta ancora incompleto.
          </p>

          <p><strong>Documenti mancanti:</strong></p>
          <ul>
            ${mancanti.map((doc: string) => `<li>${doc}</li>`).join("")}
          </ul>

          ${
            opzionali.length > 0
              ? `
                <p><strong>Documenti opzionali mancanti:</strong></p>
                <ul>
                  ${opzionali.map((doc: string) => `<li>${doc}</li>`).join("")}
                </ul>
              `
              : ""
          }

          <p>
            Questo promemoria verrà inviato ogni lunedì mattina fino al completamento del fascicolo.
          </p>
        </div>
      `;

    const text = `
Fascicolo AML incompleto - ${nomeCliente}

Il fascicolo AML del cliente ${nomeCliente} risulta ancora incompleto.

Documenti mancanti:
${mancanti.map((doc: string) => `- ${doc}`).join("\n")}

${
  opzionali.length > 0
    ? `Documenti opzionali mancanti:\n${opzionali
        .map((doc: string) => `- ${doc}`)
        .join("\n")}`
    : ""
}

Questo promemoria verrà inviato ogni lunedì mattina fino al completamento del fascicolo.
`.trim();

const result = await sendEmail({
  to: utente.email,
  subject: `Fascicolo AML incompleto - ${nomeCliente}`,
  html,
  text,
  senderUserId: utente.id,
  microsoftConnectionId: studio.microsoft_connection_id,
  fromEmail: studio.email || undefined,
  sendMode: "user",
});

if (!result.success) {
  console.error("Errore invio email AML:", result.error);
  saltati++;
  continue;
}

      await supabaseAdmin
        .from("tbAVFascicoliAlert")
        .update({
          ultimo_alert_at: new Date().toISOString(),
          prossimo_alert_at: prossimoLunediOre9(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", alert.id);

      inviati++;
    }

    return res.status(200).json({
      ok: true,
      trovati: alerts?.length || 0,
      inviati,
      saltati,
    });
  } catch (err: any) {
    console.error("Errore cron alert fascicoli AML:", err);
    return res.status(500).json({
      error: err?.message || "Errore cron alert fascicoli AML",
    });
  }
}
