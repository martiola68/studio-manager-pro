import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabase/admin";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const validationToken =
    typeof req.query.validationToken === "string"
      ? req.query.validationToken
      : null;

  if (validationToken) {
    res.setHeader("Content-Type", "text/plain");
    return res.status(200).send(validationToken);
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "Metodo non consentito",
    });
  }

  try {
    const notifications = Array.isArray(req.body?.value) ? req.body.value : [];

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      "https://studio-manager-pro.vercel.app";

    const results: any[] = [];

    for (const notification of notifications) {
      const subscriptionId = notification.subscriptionId;
      const clientState = notification.clientState;

      if (!subscriptionId || !clientState) {
        continue;
      }

      const { data: sub, error: subError } = await (supabaseAdmin as any)
        .from("microsoft365_calendar_subscriptions")
        .select("user_id, microsoft_connection_id, client_state")
        .eq("subscription_id", subscriptionId)
        .maybeSingle();

      if (subError || !sub) {
        results.push({
          subscriptionId,
          ok: false,
          error: subError?.message || "Subscription non trovata",
        });
        continue;
      }

      if (sub.client_state !== clientState) {
        results.push({
          subscriptionId,
          ok: false,
          error: "clientState non valido",
        });
        continue;
      }

      const syncUrl =
        `${baseUrl}/api/microsoft365/calendar/sync-cron` +
        `?secret=${process.env.CRON_SECRET}` +
        `&userId=${sub.user_id}` +
        `&microsoftConnectionId=${sub.microsoft_connection_id}`;

      const syncRes = await fetch(syncUrl);
      const syncText = await syncRes.text();

      results.push({
        subscriptionId,
        ok: syncRes.ok,
        status: syncRes.status,
        body: syncText,
      });
    }

    return res.status(202).json({
      ok: true,
      received: notifications.length,
      results,
    });
  } catch (error: any) {
    console.error("[calendar/webhook]", error);

    return res.status(500).json({
      ok: false,
      error: error?.message || "Errore webhook calendario",
    });
  }
}
