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
    return res.status(405).json({
      success: false,
      error: "Metodo non consentito",
    });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { accesso_id, email_accesso } = req.body || {};

    if (!accesso_id) {
      return res.status(400).json({
        success: false,
        error: "ID accesso mancante",
      });
    }

    if (!email_accesso || !String(email_accesso).trim()) {
      return res.status(400).json({
        success: false,
        error: "Email accesso obbligatoria",
      });
    }

    const emailPulita = String(email_accesso).trim().toLowerCase();

    const password = generaPassword();
    const password_hash = await bcrypt.hash(password, 10);
    const password_criptata = criptaPassword(password);

const { data, error } = await supabase
  .from("tbclienti_accessi_pubblici")
  .update({
    email_accesso: emailPulita,
    password_hash,
    password_criptata,
    attivo: true,
    updated_at: new Date().toISOString(),
  })
  .eq("id", accesso_id)
  .select(`
    id,
    studio_id,
    cliente_id,
    email_accesso,
    tbclienti (
      ragione_sociale,
      studio_id,
      utente_payroll_id
    )
  `)
  .single();

    if (error) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }

    const cliente: any = Array.isArray(data.tbclienti)
  ? data.tbclienti[0]
  : data.tbclienti;

const studioId = data.studio_id || cliente?.studio_id;
const senderUserId = cliente?.utente_payroll_id;

if (!studioId) {
  return res.status(400).json({
    success: false,
    error: "Studio non associato al cliente.",
  });
}

if (!senderUserId) {
  return res.status(400).json({
    success: false,
    error: "Operatore payroll non associato al cliente.",
  });
}

const { data: studio, error: studioError } = await supabase
  .from("tbstudio")
  .select("microsoft_connection_id")
  .eq("id", studioId)
  .maybeSingle();

if (studioError || !studio?.microsoft_connection_id) {
  return res.status(400).json({
    success: false,
    error: "Connessione Microsoft dello studio non configurata.",
  });
}

const linkAccesso =
  "https://studio-manager-public.vercel.app/area-cliente/login";

const ragioneSociale = cliente?.ragione_sociale || "Cliente";

const subject = "Accesso area richieste assunzioni";

const html = `
  <div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.5; color: #111827;">
    <p>Gentile Cliente,</p>

    <p>
      le credenziali per accedere all'area richieste assunzioni sono state aggiornate.
    </p>

    <table style="border-collapse: collapse; margin: 16px 0;">
      <tr>
        <td style="padding: 6px 12px; font-weight: bold;">Azienda</td>
        <td style="padding: 6px 12px;">${ragioneSociale}</td>
      </tr>
      <tr>
        <td style="padding: 6px 12px; font-weight: bold;">Link accesso</td>
        <td style="padding: 6px 12px;">
          <a href="${linkAccesso}">${linkAccesso}</a>
        </td>
      </tr>
      <tr>
        <td style="padding: 6px 12px; font-weight: bold;">Utente</td>
        <td style="padding: 6px 12px;">${emailPulita}</td>
      </tr>
      <tr>
        <td style="padding: 6px 12px; font-weight: bold;">Password</td>
        <td style="padding: 6px 12px;">${password}</td>
      </tr>
    </table>

    <p>Cordiali saluti</p>
  </div>
`;

const result = await sendEmailServer({
  senderUserId,
  microsoftConnectionId: studio.microsoft_connection_id,
  to: emailPulita,
  subject,
  html,
});

if (!result.success) {
  return res.status(500).json({
    success: false,
    error: result.error || "Email aggiornata, ma invio credenziali fallito.",
  });
}

 return res.status(200).json({
  success: true,
  accesso: data,
  message: "Email accesso aggiornata e credenziali inviate correttamente.",
});
    
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error?.message || "Errore modifica email accesso",
    });
  }
}
