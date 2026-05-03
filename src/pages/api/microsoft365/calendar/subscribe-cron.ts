import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";

function getBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://studio-manager-pro.vercel.app"
  );
}

function expirationDateTime() {
  const d = new Date();
  d.setDate(d.getDate() + 2);
  return d.toISOString();
}

async function callGraphCron(params: {
  userId: string;
  microsoftConnectionId: string;
  body: any;
}) {
  const baseUrl = getBaseUrl();

  const res = await fetch(`${baseUrl}/api/microsoft365/graph-cron`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.CRON_SECRET}`,
    },
    body: JSON.stringify({
      userId: params.userId,
      microsoftConnectionId: params.microsoftConnectionId,
      endpoint: "/subscriptions",
      method: "POST",
      body: params.body,
    }),
  });

  const text = await res.text();

  if (!res.ok) {
    throw new Error(text || `Errore Graph subscriptions ${res.status}`);
  }

  return text ? JSON.parse(text) : {};
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const secret = typeof req.query.secret === "string" ? req.query.secret : null;

  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return res.status(401).json({
      ok: false,
      error: "Non autorizzato",
    });
  }

  const { data: tokens, error: tokenError } = await (supabaseAdmin as any)
    .from("tbmicrosoft365_user_tokens")
    .select("studio_id, user_id, microsoft_connection_id")
    .is("revoked_at", null)
    .not("microsoft_connection_id", "is", null);

  if (tokenError) {
    return res.status(500).json({
      ok: false,
      error: tokenError.message,
    });
  }

  const baseUrl = getBaseUrl();
  const notificationUrl = `${baseUrl}/api/microsoft365/calendar/webhook`;

  const results: any[] = [];

  for (const token of tokens || []) {
    try {
      const clientState = crypto.randomBytes(24).toString("hex");

      const graphSub = await callGraphCron({
        userId: token.user_id,
        microsoftConnectionId: token.microsoft_connection_id,
        body: {
          changeType: "created,updated,deleted",
          notificationUrl,
          resource: "me/events",
          expirationDateTime: expirationDateTime(),
          clientState,
        },
      });

      const { error: upsertError } = await (supabaseAdmin as any)
        .from("microsoft365_calendar_subscriptions")
        .upsert(
          {
            studio_id: token.studio_id,
            user_id: token.user_id,
            microsoft_connection_id: token.microsoft_connection_id,
            subscription_id: graphSub.id,
            client_state: clientState,
            expiration_datetime: graphSub.expirationDateTime,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "subscription_id",
          }
        );

      if (upsertError) {
        throw upsertError;
      }

      results.push({
        user_id: token.user_id,
        ok: true,
        subscription_id: graphSub.id,
        expiration_datetime: graphSub.expirationDateTime,
      });
    } catch (error: any) {
      results.push({
        user_id: token.user_id,
        ok: false,
        error: error?.message || "Errore creazione subscription",
      });
    }
  }

  return res.status(200).json({
    ok: true,
    notificationUrl,
    processed: results.length,
    results,
  });
}
