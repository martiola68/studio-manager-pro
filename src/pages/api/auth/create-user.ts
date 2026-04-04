import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { generateSecurePassword, validatePassword } from "@/lib/passwordGenerator";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

function escapeHtml(value: string) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildUserCreatedEmailHtml(params: {
  nome: string;
  email: string;
  password: string;
  loginUrl: string;
}) {
  const nome = escapeHtml(params.nome);
  const email = escapeHtml(params.email);
  const password = escapeHtml(params.password);
  const loginUrl = escapeHtml(params.loginUrl);

  return `
    <div style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
      <div style="max-width:700px;margin:0 auto;background:#ffffff;">
        <div style="background:#16a34a;padding:28px 24px;text-align:center;color:#ffffff;">
          <div style="font-size:42px;font-weight:700;line-height:1.2;">✅ Utente Creato</div>
          <div style="font-size:22px;margin-top:10px;">Studio Manager Pro</div>
        </div>

        <div style="padding:36px 32px;color:#111827;">
          <h1 style="margin:0 0 24px 0;font-size:52px;line-height:1.1;font-weight:700;">
            Ciao ${nome},
          </h1>

          <p style="font-size:22px;line-height:1.7;margin:0 0 28px 0;">
            Il tuo account è stato creato correttamente dall'amministratore.
          </p>

          <div style="border-left:6px solid #16a34a;background:#f9fafb;padding:24px;margin:24px 0 32px 0;border-radius:8px;">
            <div style="font-size:34px;font-weight:700;color:#16a34a;margin-bottom:24px;">
              🔐 Le tue credenziali di accesso:
            </div>

            <div style="font-size:18px;color:#6b7280;font-weight:700;margin-bottom:8px;">
              📧 Email:
            </div>
            <div style="background:#eef2f7;padding:16px 18px;border-radius:8px;font-size:22px;word-break:break-word;margin-bottom:22px;">
              ${email}
            </div>

            <div style="font-size:18px;color:#6b7280;font-weight:700;margin-bottom:8px;">
              🔑 Password:
            </div>
            <div style="background:#eef2f7;padding:16px 18px;border-radius:8px;font-size:22px;word-break:break-word;">
              ${password}
            </div>
          </div>

          <div style="text-align:center;margin:36px 0;">
            <a
              href="${loginUrl}"
              style="display:inline-block;background:#dc2626;color:#ffffff;text-decoration:none;padding:18px 34px;border-radius:10px;font-size:34px;font-weight:700;"
              target="_blank"
              rel="noopener noreferrer"
            >
              🚀 Accedi Ora
            </a>
          </div>

          <div style="background:#fef3c7;border-left:6px solid #f59e0b;padding:22px;border-radius:8px;margin:32px 0;">
            <div style="font-size:22px;font-weight:700;color:#92400e;margin-bottom:12px;">
              ⚠️ Attenzione:
            </div>
            <ul style="margin:0;padding-left:22px;color:#78350f;font-size:18px;line-height:1.8;">
              <li>Conserva questa email in un luogo sicuro</li>
              <li>Ti consigliamo di modificare la password dopo il primo accesso</li>
            </ul>
          </div>

          <p style="font-size:24px;margin:28px 0 0 0;color:#111827;">
            Buon lavoro! 💼
          </p>
        </div>

        <div style="border-top:1px solid #e5e7eb;padding:28px 24px;text-align:center;color:#6b7280;">
          <div style="font-size:18px;font-weight:700;">Studio Manager Pro - Sistema Gestionale Integrato</div>
          <div style="font-size:16px;margin-top:12px;">Powered by ProWork Studio M</div>
          <div style="font-size:16px;margin-top:18px;">Questa è una email automatica, non rispondere a questo messaggio</div>
        </div>
      </div>
    </div>
  `;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ error: "Non autenticato" });
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user: adminUser },
      error: authUserError,
    } = await supabaseAdmin.auth.getUser(token);

    if (authUserError || !adminUser?.email) {
      return res.status(401).json({
        error: "Sessione non valida",
        details: authUserError?.message || "Utente admin non disponibile",
      });
    }

    const { data: adminRow, error: adminRowError } = await supabaseAdmin
      .from("tbutenti")
      .select("id, email, tipo_utente, studio_id")
      .eq("email", adminUser.email)
      .single();

    if (adminRowError || !adminRow) {
      return res.status(403).json({
        error: "Utente amministratore non trovato",
        details: adminRowError?.message || "Record admin assente in tbutenti",
      });
    }

    if (adminRow.tipo_utente !== "Admin") {
      return res.status(403).json({
        error: "Solo gli amministratori possono creare utenti",
      });
    }

    if (!adminRow.studio_id) {
      return res.status(400).json({
        error: "Studio non valorizzato per l'amministratore",
      });
    }

    const {
      email,
      nome,
      cognome,
      tipo_utente,
      ruolo_operatore_id,
      attivo,
      settore,
      responsabile,
      microsoft_connection_id,
    } = req.body;

    if (!email || !nome || !cognome) {
      return res.status(400).json({
        error: "Email, nome e cognome richiesti",
      });
    }

    const passwordGenerata = generateSecurePassword();

    if (!validatePassword(passwordGenerata)) {
      console.error("Password generata non valida:", passwordGenerata);
      return res.status(500).json({
        error: "Errore generazione password sicura",
      });
    }

    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password: passwordGenerata,
        email_confirm: true,
        user_metadata: {
          nome,
          cognome,
        },
      });

    if (authError || !authData?.user?.id) {
      console.error("Errore creazione Auth:", authError);
      return res.status(400).json({
        error: "Errore creazione account",
        details: authError?.message || "Utente Auth non creato",
      });
    }

    const newUserId = authData.user.id;

    const payload = {
      id: newUserId,
      user_id: newUserId,
      studio_id: adminRow.studio_id,
      nome,
      cognome,
      email,
      tipo_utente: tipo_utente || "User",
      ruolo_operatore_id: ruolo_operatore_id || null,
      attivo: typeof attivo === "boolean" ? attivo : true,
      settore: settore || null,
      responsabile: typeof responsabile === "boolean" ? responsabile : false,
      microsoft_connection_id: microsoft_connection_id || null,
    };

  const { error: upsertError } = await supabaseAdmin
      .from("tbutenti")
      .upsert(payload, { onConflict: "id" });

    if (upsertError) {
      console.error("Errore aggiornamento/anagrafica tbutenti:", upsertError);
      return res.status(500).json({
        error: "Utente Auth creato ma anagrafica non aggiornata",
        details: upsertError.message,
      });
    }

    // Invio email di primo accesso / impostazione password

     const appBaseUrl =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  "http://localhost:3000";

  const loginUrl = `${appBaseUrl.replace(/\/$/, "")}/login`;
    
      ".supabase.co",
      ".supabase.co/functions/v1"
    );

    if (!edgeBaseUrl) {
      return res.status(500).json({
        error: "URL Supabase non configurato",
      });
    }

    const emailHtml = buildUserCreatedEmailHtml({
      nome,
      email,
      password: passwordGenerata,
      loginUrl,
    });

    const sendEmailResponse = await fetch(`${edgeBaseUrl}/send-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
      },
      body: JSON.stringify({
        to: email,
        subject: "Utente creato - Studio Manager Pro",
        html: emailHtml,
        text: `Ciao ${nome},

Il tuo account è stato creato correttamente.

Email: ${email}
Password: ${passwordGenerata}

Accedi qui: ${loginUrl}

Studio Manager Pro`,
      }),
    });

    const sendEmailResult = await sendEmailResponse.json().catch(() => null);

    if (!sendEmailResponse.ok || !sendEmailResult?.success) {
      console.error("Errore invio email utente creato:", sendEmailResult);
      return res.status(500).json({
        error: "Utente creato ma email non inviata",
        details: sendEmailResult?.error || sendEmailResult?.message || "Errore invio email",
      });
    }
  

    return res.status(200).json({
      success: true,
      userId: newUserId,
      email,
      message: "Utente creato ed email inviata con successo",
    });
  } catch (error: any) {
    console.error("Errore API create-user:", error);
    return res.status(500).json({
      error: "Errore interno del server",
      details: error.message,
    });
  }
}
