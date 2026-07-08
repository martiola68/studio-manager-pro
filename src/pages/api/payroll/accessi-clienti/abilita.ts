import type { NextApiRequest, NextApiResponse } from "next";
import bcrypt from "bcryptjs";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { criptaPassword } from "@/lib/accessiClientiCrypto";
import { sendEmailServer } from "@/services/sendEmailServer";

function generaPassword() {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

  let password = "";

  for (let i = 0; i < 10; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return password;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Metodo non consentito" });
  }

  try {
    const { cliente_id, email_accesso } = req.body;

    if (!cliente_id) {
      return res.status(400).json({ error: "Cliente mancante" });
    }

    if (!email_accesso) {
      return res.status(400).json({ error: "Email accesso mancante" });
    }

    const supabase = getSupabaseAdmin();

    const { data: cliente, error: clienteError } = await supabase
      .from("tbclienti")
      .select("id, studio_id, ragione_sociale, utente_payroll_id")
      .eq("id", cliente_id)
      .single();

    if (clienteError || !cliente) {
      return res.status(404).json({ error: "Cliente non trovato" });
    }

    const password = generaPassword();
    const password_hash = await bcrypt.hash(password, 10);
const password_criptata = criptaPassword(password);

    const { data, error } = await supabase
      .from("tbclienti_accessi_pubblici")
      .upsert(
        {
          studio_id: cliente.studio_id,
          cliente_id,
          email_accesso,
          password_hash,
           password_criptata,
          attivo: true,
          data_attivazione: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "cliente_id" }
      )
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    const senderUserId = cliente.utente_payroll_id;

if (!senderUserId) {
  return res.status(400).json({
    error: "Operatore payroll non associato al cliente.",
  });
}
const { data: studio, error: studioError } = await supabase
  .from("tbstudio")
  .select("microsoft_connection_id")
  .eq("id", cliente.studio_id)
  .maybeSingle();

if (studioError || !studio?.microsoft_connection_id) {
  return res.status(400).json({
    error: "Connessione Microsoft dello studio non configurata.",
  });
}

const linkAccesso =
  "https://studio-manager-public.vercel.app/area-cliente/login";

const subject = "Accesso area richieste assunzioni";

const html = `
  <div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.5; color: #111827;">
    <p>Gentile Cliente,</p>

    <p>
      la informiamo che da oggi le richieste relative a nuove assunzioni
      dovranno essere trasmesse esclusivamente tramite l'apposita area online
      messa a disposizione dallo Studio.
    </p>

    <p>
      Di seguito trova le credenziali di accesso:
    </p>

    <table style="border-collapse: collapse; margin: 16px 0;">
      <tr>
        <td style="padding: 6px 12px; font-weight: bold;">Azienda</td>
        <td style="padding: 6px 12px;">${cliente.ragione_sociale || "Cliente"}</td>
      </tr>
      <tr>
        <td style="padding: 6px 12px; font-weight: bold;">Link accesso</td>
        <td style="padding: 6px 12px;">
          <a href="${linkAccesso}">${linkAccesso}</a>
        </td>
      </tr>
      <tr>
        <td style="padding: 6px 12px; font-weight: bold;">Utente</td>
        <td style="padding: 6px 12px;">${email_accesso}</td>
      </tr>
      <tr>
        <td style="padding: 6px 12px; font-weight: bold;">Password</td>
        <td style="padding: 6px 12px;">${password}</td>
      </tr>
    </table>

    <p>
      Le credenziali resteranno valide fino a nuova comunicazione da parte dello Studio.
      In caso di smarrimento sarà sufficiente contattarci per riceverne di nuove.
    </p>

    <p>
      Per procedere con una nuova richiesta di assunzione sarà sufficiente accedere
      alla pagina indicata, selezionare “Nuova richiesta assunzione” e compilare
      il modulo online.
    </p>

    <p>Cordiali saluti</p>
  </div>
`;

const result = await sendEmailServer({
  senderUserId,
  microsoftConnectionId: studio.microsoft_connection_id,
  to: email_accesso,
  subject,
  html,
});

if (!result.success) {
  return res.status(500).json({
    error: result.error || "Accesso attivato, ma invio credenziali fallito.",
  });
}

return res.status(200).json({
  success: true,
  accesso: data,
  message: "Accesso attivato e credenziali inviate correttamente.",
});
    
  } catch (error: any) {
    return res.status(500).json({
      error: error?.message || "Errore durante abilitazione accesso",
    });
  }
}
