import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendEmailServer } from "@/services/sendEmailServer";

const REVISIONI_TENANT_ID = "7aa03348-fa29-4f5f-bcf3-81698de3da7a";
const NOREPLY = "noreply@revisionicommerciali.it";

function getBearerToken(req: NextApiRequest) {
  const header = typeof req.headers.authorization === "string" ? req.headers.authorization : "";
  if (!header.toLowerCase().startsWith("bearer ")) return null;
  return header.slice(7).trim() || null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ success: false, error: "Sessione mancante" });

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !authData?.user) {
      return res.status(401).json({ success: false, error: "Utente non autenticato" });
    }

    const authUser = authData.user;
    let { data: userRow } = await supabaseAdmin
      .from("tbutenti")
      .select("id, user_id, studio_id, email, microsoft_connection_id, tipo_utente")
      .eq("user_id", authUser.id)
      .maybeSingle();

    if (!userRow && authUser.email) {
      const fallback = await supabaseAdmin
        .from("tbutenti")
        .select("id, user_id, studio_id, email, microsoft_connection_id, tipo_utente")
        .ilike("email", authUser.email)
        .maybeSingle();
      userRow = fallback.data;
    }

    if (!userRow?.studio_id) {
      return res.status(403).json({ success: false, error: "Studio utente non trovato" });
    }

    const microsoftConnectionId = userRow.microsoft_connection_id;
    if (!microsoftConnectionId) {
      return res.status(400).json({ success: false, error: "Connessione Microsoft non assegnata all'utente" });
    }

    // Verifica multi-tenant lato server: la connessione deve appartenere allo stesso studio
    // dell'utente autenticato e al tenant Microsoft 365 di Revisioni Commerciali.
    const { data: connection, error: connectionError } = await supabaseAdmin
      .from("microsoft365_connections")
      .select("id, studio_id, tenant_id, enabled")
      .eq("id", microsoftConnectionId)
      .eq("studio_id", userRow.studio_id)
      .maybeSingle();

    if (connectionError || !connection) {
      return res.status(403).json({ success: false, error: "Connessione Microsoft non valida per questo studio" });
    }

    if (connection.enabled === false) {
      return res.status(403).json({ success: false, error: "Connessione Microsoft disabilitata" });
    }

    if (String(connection.tenant_id || "").toLowerCase() !== REVISIONI_TENANT_ID) {
      console.error("[microsoft365/test-noreply] tenant non autorizzato", {
        userId: userRow.id,
        studioId: userRow.studio_id,
        tenantId: connection.tenant_id,
      });
      return res.status(403).json({ success: false, error: "Test noreply non abilitato per questo tenant Microsoft" });
    }

    const recipient = String(req.body?.to || userRow.email || authUser.email || "").trim();
    if (!recipient || !recipient.includes("@")) {
      return res.status(400).json({ success: false, error: "Destinatario non valido" });
    }

    const result = await sendEmailServer({
      senderUserId: userRow.id,
      microsoftConnectionId,
      fromMailbox: NOREPLY,
      to: recipient,
      subject: "Test mittente automatico Studio Manager Pro",
      html: `<p>Test tecnico del mittente automatico di Studio Manager Pro.</p><p>Se questa email risulta inviata da <strong>${NOREPLY}</strong>, la configurazione Send As è operativa.</p>`,
    });

    if (!result.success) {
      return res.status(502).json({ success: false, error: result.error || "Invio Microsoft non riuscito" });
    }

    return res.status(200).json({ success: true, to: recipient, from: NOREPLY });
  } catch (error: any) {
    console.error("[microsoft365/test-noreply]", error);
    return res.status(500).json({ success: false, error: error?.message || "Errore test noreply" });
  }
}
