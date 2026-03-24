export const config = { runtime: "nodejs" };

import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/encryption365";

const SendEmailSchema = z.object({
  userId: z.string().uuid().optional(),
  to: z.union([z.string().email(), z.array(z.string().email())]),
  subject: z.string().min(1),
  html: z.string().min(1),
  cc: z.union([z.string().email(), z.array(z.string().email())]).optional(),
  bcc: z.union([z.string().email(), z.array(z.string().email())]).optional(),
});

type ApiResponse =
  | { ok: true }
  | { ok: false; error: string; details?: any };

function recipients(input: string | string[]) {
  const arr = Array.isArray(input) ? input : [input];
  return arr.map((email) => ({
    emailAddress: { address: email },
  }));
}

async function getAppOnlyAccessToken(params: {
  tenantId: string;
  clientId: string;
  clientSecret: string;
}) {
  const tokenUrl = `https://login.microsoftonline.com/${params.tenantId}/oauth2/v2.0/token`;

  const body = new URLSearchParams({
    client_id: params.clientId,
    client_secret: params.clientSecret,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("❌ Errore token Microsoft:", data);
    throw new Error(data?.error_description || "Errore ottenimento token Microsoft");
  }

  if (!data?.access_token) {
    throw new Error("Access token Microsoft non ricevuto");
  }

  return data.access_token as string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  res.setHeader("Content-Type", "application/json");

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Metodo non consentito" });
  }

  try {
    const parsed = SendEmailSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: "Dati richiesta non validi",
        details: parsed.error.flatten(),
      });
    }

    const { userId: bodyUserId, to, subject, html, cc, bcc } = parsed.data;

    const supabase = createClient(req, res);
    const {
      data: { session },
      error: sessionErr,
    } = await supabase.auth.getSession();

    if (sessionErr) {
      return res.status(401).json({
        ok: false,
        error: "Errore sessione utente",
        details: sessionErr.message,
      });
    }

    // Compatibile con il vecchio flusso:
    // - se userId arriva dal frontend, usa quello
    // - altrimenti usa l'utente loggato
    const effectiveUserId = bodyUserId || session?.user?.id;

    if (!effectiveUserId) {
      return res.status(401).json({
        ok: false,
        error: "Utente non identificato",
      });
    }

    // Recupero studio_id dall'utente
    const { data: userRow, error: userErr } = await supabaseAdmin
      .from("tbutenti")
      .select("studio_id")
      .eq("id", effectiveUserId)
      .maybeSingle();

    if (userErr || !userRow?.studio_id) {
      return res.status(404).json({
        ok: false,
        error: "Studio utente non trovato",
        details: userErr?.message,
      });
    }

    const studioId = userRow.studio_id as string;

    // Legge la config studio da DB, come nel flusso originale
    const { data: cfg, error: cfgErr } = await supabaseAdmin
      .from("microsoft365_config")
      .select(
        "client_id, tenant_id, client_secret, enabled, connected_email, organizer_email"
      )
      .eq("studio_id", studioId)
      .maybeSingle();

    if (cfgErr) {
      return res.status(500).json({
        ok: false,
        error: "Errore lettura configurazione Microsoft 365",
        details: cfgErr.message,
      });
    }

    if (!cfg) {
      return res.status(404).json({
        ok: false,
        error: "Configurazione Microsoft 365 non trovata",
      });
    }

    if (cfg.enabled === false) {
      return res.status(400).json({
        ok: false,
        error: "Microsoft 365 disabilitato per lo studio",
      });
    }

    if (!cfg.client_id || !cfg.client_secret) {
      return res.status(400).json({
        ok: false,
        error: "Configurazione Microsoft 365 incompleta",
      });
    }

    let clientSecret: string;
    try {
      clientSecret = decrypt(cfg.client_secret);
    } catch (e: any) {
      console.error("❌ Errore decrypt client_secret:", e);
      return res.status(500).json({
        ok: false,
        error: "Impossibile decifrare il client secret Microsoft 365",
        details: e?.message,
      });
    }

    const tenantId = cfg.tenant_id || "common";
    const senderEmail =
      (cfg.connected_email || "").trim() ||
      (cfg.organizer_email || "").trim();

    if (!senderEmail) {
      return res.status(400).json({
        ok: false,
        error: "Mittente Microsoft non configurato (connected_email / organizer_email)",
      });
    }

    const accessToken = await getAppOnlyAccessToken({
      tenantId,
      clientId: cfg.client_id,
      clientSecret,
    });

    const message: any = {
      subject,
      body: {
        contentType: "HTML",
        content: html,
      },
      toRecipients: recipients(to),
    };

    if (cc) {
      message.ccRecipients = recipients(cc);
    }

    if (bcc) {
      message.bccRecipients = recipients(bcc);
    }

    const graphResponse = await fetch(
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(senderEmail)}/sendMail`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message,
          saveToSentItems: true,
        }),
      }
    );

    if (!graphResponse.ok) {
      const errorText = await graphResponse.text();
      console.error("❌ Errore Graph sendMail:", errorText);

      return res.status(500).json({
        ok: false,
        error: errorText || "Errore invio email Microsoft",
      });
    }

    return res.status(200).json({ ok: true });
  } catch (error: any) {
    console.error("❌ API send-email error:", error);

    return res.status(500).json({
      ok: false,
      error: error?.message || "Errore interno invio email",
    });
  }
}
