// src/pages/api/admin/reset-password.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { generateSecurePassword } from "@/lib/passwordGenerator";
import { getPasswordResetEmailTemplate } from "@/lib/emailTemplates";
import { sendEmailServer } from "@/services/sendEmailServer";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type Ok = { success: true; message: string; emailSent: true };
type Err = { success: false; message: string; details?: string; emailSent?: false };

async function resolveMicrosoftSender(studioId: string) {
  const { data: studio, error: studioError } = await supabaseAdmin
    .from("tbstudio")
    .select("microsoft_connection_id")
    .eq("id", studioId)
    .single();
  if (studioError || !studio?.microsoft_connection_id) {
    throw new Error("Connessione Microsoft 365 dello studio non trovata");
  }

  const { data: tokenOwner, error: tokenError } = await supabaseAdmin
    .from("tbmicrosoft365_user_tokens")
    .select("user_id")
    .eq("microsoft_connection_id", studio.microsoft_connection_id)
    .is("revoked_at", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (tokenError || !tokenOwner?.user_id) {
    throw new Error("Token Microsoft 365 dello studio non trovato");
  }
  return { senderUserId: tokenOwner.user_id, microsoftConnectionId: studio.microsoft_connection_id };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<Ok | Err>) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    const { userId, email, nome } = req.body ?? {};
    if (!userId || !email) {
      return res.status(400).json({ success: false, message: "userId ed email obbligatori" });
    }

    const { data: targetUser, error: targetUserError } = await supabaseAdmin
      .from("tbutenti")
      .select("studio_id")
      .eq("id", userId)
      .single();
    if (targetUserError || !targetUser?.studio_id) {
      return res.status(400).json({ success: false, message: "Studio dell'utente non determinato", details: targetUserError?.message });
    }

    const tempPassword = generateSecurePassword();
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, { password: tempPassword });
    if (updateError) {
      return res.status(500).json({ success: false, message: "Errore aggiornamento password", details: updateError.message });
    }

    const loginUrl = "https://app.studiomanagerpro.it/login";
    const displayName = (nome && String(nome).trim()) || "Utente";
    const html = getPasswordResetEmailTemplate(displayName, email, tempPassword, loginUrl);
    const sender = await resolveMicrosoftSender(targetUser.studio_id);
    const sendRes = await sendEmailServer({
      senderUserId: sender.senderUserId,
      microsoftConnectionId: sender.microsoftConnectionId,
      to: email,
      subject: "Password Reset - Studio Manager Pro",
      html,
    });

    if (!sendRes.success) {
      return res.status(502).json({ success: false, message: "Password aggiornata ma invio email Microsoft 365 fallito", details: sendRes.error, emailSent: false });
    }

    return res.status(200).json({ success: true, message: "Password resettata e email Microsoft 365 inviata con successo", emailSent: true });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error?.message || "Errore interno server" });
  }
}
