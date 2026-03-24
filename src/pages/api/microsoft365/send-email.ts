import type { NextApiRequest, NextApiResponse } from "next";

const TENANT_ID = process.env.MS365_TENANT_ID;
const CLIENT_ID = process.env.MS365_CLIENT_ID;
const CLIENT_SECRET = process.env.MS365_CLIENT_SECRET;
const SENDER_EMAIL = "noreply@revisionicommerciali.it";

async function getAppOnlyAccessToken(): Promise<string> {
  if (!TENANT_ID) {
    throw new Error("MS365_TENANT_ID non definito");
  }

  if (!CLIENT_ID) {
    throw new Error("MS365_CLIENT_ID non definito");
  }

  if (!CLIENT_SECRET) {
    throw new Error("MS365_CLIENT_SECRET non definito");
  }

  const tokenUrl = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`;

  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
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
    console.error("❌ Errore token app-only:", data);
    throw new Error(data?.error_description || "Errore ottenimento token Microsoft");
  }

  if (!data?.access_token) {
    throw new Error("Access token Microsoft non ricevuto");
  }

  return data.access_token;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Metodo non consentito" });
  }

  try {
    console.log("API ENV CHECK");
console.log("MS365_TENANT_ID =", process.env.MS365_TENANT_ID);
console.log("MS365_CLIENT_ID =", process.env.MS365_CLIENT_ID);
console.log(
  "MS365_CLIENT_SECRET =",
  process.env.MS365_CLIENT_SECRET ? "OK" : "MANCANTE"
);
    const { to, subject, html, cc, bcc } = req.body || {};

    if (!to || !subject || !html) {
      return res.status(400).json({
        ok: false,
        error: "Parametri mancanti: to, subject, html",
      });
    }

    const accessToken = await getAppOnlyAccessToken();

    const toArray = Array.isArray(to) ? to : [to];
    const ccArray = cc ? (Array.isArray(cc) ? cc : [cc]) : [];
    const bccArray = bcc ? (Array.isArray(bcc) ? bcc : [bcc]) : [];

    const message: any = {
      subject,
      body: {
        contentType: "HTML",
        content: html,
      },
      toRecipients: toArray.map((email: string) => ({
        emailAddress: { address: email },
      })),
    };

    if (ccArray.length > 0) {
      message.ccRecipients = ccArray.map((email: string) => ({
        emailAddress: { address: email },
      }));
    }

    if (bccArray.length > 0) {
      message.bccRecipients = bccArray.map((email: string) => ({
        emailAddress: { address: email },
      }));
    }

    const graphResponse = await fetch(
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(SENDER_EMAIL)}/sendMail`,
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
