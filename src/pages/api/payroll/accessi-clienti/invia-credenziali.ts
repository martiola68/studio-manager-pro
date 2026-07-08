import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { criptaPassword } from "@/lib/accessiClientiCrypto";
import { sendEmailServer } from "@/services/sendEmailServer";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Metodo non consentito" });
  }

  try {
    const { accesso_id } = req.body;

    if (!accesso_id) {
      return res.status(400).json({ error: "Accesso mancante" });
    }

    const supabase = getSupabaseAdmin();

    const { data: accesso, error } = await supabase
      .from("tbclienti_accessi_pubblici")
      .select(`
  id,
  studio_id,
  cliente_id,
  email_accesso,
  password_criptata,
  attivo,
  tbclienti (
    ragione_sociale,
    studio_id,
    utente_payroll_id
  )
`)
      .eq("id", accesso_id)
      .single();

    if (error || !accesso) {
      return res.status(404).json({ error: "Accesso non trovato" });
    }

    if (!accesso.attivo) {
      return res.status(400).json({
        error: "Accesso disattivato. Riattivarlo prima di inviare le credenziali.",
      });
    }

    if (!accesso.email_accesso) {
      return res.status(400).json({ error: "Email accesso mancante" });
    }

  function generaPasswordTemporanea() {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let password = "";

  for (let i = 0; i < 10; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return password;
}

const password = generaPasswordTemporanea();
const passwordCriptata = criptaPassword(password);

const { error: updatePasswordError } = await supabase
  .from("tbclienti_accessi_pubblici")
  .update({
    password_criptata: passwordCriptata,
    updated_at: new Date().toISOString(),
  })
  .eq("id", accesso.id);

if (updatePasswordError) {
  return res.status(500).json({
    error: "Errore durante aggiornamento password accesso.",
  });
}

    const linkAccesso = "https://studio-manager-public.vercel.app/area-cliente/login";

    const cliente: any = Array.isArray(accesso.tbclienti)
      ? accesso.tbclienti[0]
      : accesso.tbclienti;

    const ragioneSociale = cliente?.ragione_sociale || "Cliente";

   const subject = "Invio credenziali area richieste assunzioni";

const html = `
  <div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.5; color: #111827;">
    <p>Gentile Cliente,</p>

    <p>
      come richiesto, le inviamo nuovamente le credenziali per accedere
      all'area online dedicata alle richieste di assunzione.
    </p>

    <p>
      Di seguito trova le credenziali aggiornate:
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
        <td style="padding: 6px 12px;">${accesso.email_accesso}</td>
      </tr>
      <tr>
        <td style="padding: 6px 12px; font-weight: bold;">Password</td>
        <td style="padding: 6px 12px;">${password}</td>
      </tr>
    </table>

    <p>
      La precedente password non è più valida.
    </p>

    <p>Cordiali saluti</p>
  </div>
`;

 const studioId = accesso.studio_id || cliente?.studio_id;
const senderUserId = cliente?.utente_payroll_id;

if (!studioId) {
  return res.status(400).json({
    error: "Studio non associato al cliente.",
  });
}

if (!senderUserId) {
  return res.status(400).json({
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
    error: "Connessione Microsoft dello studio non configurata.",
  });
}

const result = await sendEmailServer({
  senderUserId,
  microsoftConnectionId: studio.microsoft_connection_id,
  to: accesso.email_accesso,
  subject,
  html,
});

    if (!result.success) {
      return res.status(500).json({
        error: result.error || "Errore durante invio email credenziali",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Credenziali inviate correttamente",
    });
  } catch (error: any) {
    return res.status(500).json({
      error: error?.message || "Errore durante invio credenziali",
    });
  }
}
