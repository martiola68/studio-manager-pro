import type {
  NextApiRequest,
  NextApiResponse,
} from "next";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const CRON_SECRET =
  process.env.CRON_SECRET ||
  "x9KfP2LmQ8zYtA71vBnR";

function leggiAccessToken(
  req: NextApiRequest
): string | null {
  const authorization =
    req.headers.authorization || "";

  if (
    !authorization
      .toLowerCase()
      .startsWith("bearer ")
  ) {
    return null;
  }

  return (
    authorization.slice(7).trim() ||
    null
  );
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);

    return res.status(405).json({
      error: "Metodo non consentito.",
    });
  }

  const supabaseAdmin =
    getSupabaseAdmin();

  try {
    const accessToken =
      leggiAccessToken(req);

    if (!accessToken) {
      return res.status(401).json({
        error: "Sessione non valida.",
      });
    }

    const {
      data: authData,
      error: authError,
    } =
      await supabaseAdmin.auth.getUser(
        accessToken
      );

    if (
      authError ||
      !authData.user
    ) {
      return res.status(401).json({
        error:
          authError?.message ||
          "Utente non autenticato.",
      });
    }

    const {
      data: utente,
      error: utenteError,
    } = await supabaseAdmin
      .from("tbutenti")
      .select(`
        id,
        studio_id,
        tipo_utente,
        attivo
      `)
      .eq(
        "user_id",
        authData.user.id
      )
      .eq("attivo", true)
      .maybeSingle();

    if (utenteError) {
      throw utenteError;
    }

    if (!utente?.studio_id) {
      return res.status(403).json({
        error:
          "Utente non associato a uno studio.",
      });
    }

    const scadenzaId =
      typeof req.body?.scadenza_id ===
      "string"
        ? req.body.scadenza_id.trim()
        : "";

    if (!scadenzaId) {
      return res.status(400).json({
        error:
          "scadenza_id obbligatorio.",
      });
    }

    const studioId =
      String(utente.studio_id);

    const {
      data: scadenza,
      error: scadenzaError,
    } = await supabaseAdmin
      .from("tbscadenze_centrale")
      .select(`
        id,
        studio_id,
        stato
      `)
      .eq("id", scadenzaId)
      .eq("studio_id", studioId)
      .maybeSingle();

    if (scadenzaError) {
      throw scadenzaError;
    }

    if (!scadenza) {
      return res.status(404).json({
        error: "Scadenza non trovata.",
      });
    }

    if (scadenza.stato !== "attiva") {
      return res.status(400).json({
        error:
          "La scadenza non è attiva.",
      });
    }

    const {
      data: ultimoLog,
      error: ultimoLogError,
    } = await supabaseAdmin
      .from(
        "tbscadenze_centrale_alert_log"
      )
      .select(`
        id,
        esito,
        chiave_invio
      `)
      .eq("studio_id", studioId)
      .eq(
        "scadenza_id",
        scadenzaId
      )
      .order("created_at", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    if (ultimoLogError) {
      throw ultimoLogError;
    }

    if (
      !ultimoLog ||
      ultimoLog.esito !== "errore"
    ) {
      return res.status(400).json({
        error:
          "L'ultimo tentativo non risulta in errore.",
      });
    }

    const chiaveStorica =
      `${ultimoLog.chiave_invio}` +
      `-errore-${ultimoLog.id}`;

    const {
      error: storicoError,
    } = await supabaseAdmin
      .from(
        "tbscadenze_centrale_alert_log"
      )
      .update({
        chiave_invio:
          chiaveStorica,
      })
      .eq("id", ultimoLog.id)
      .eq("studio_id", studioId);

    if (storicoError) {
      throw storicoError;
    }

    const adesso =
      new Date().toISOString();

    const {
      error: updateError,
    } = await supabaseAdmin
      .from("tbscadenze_centrale")
      .update({
        prossimo_alert_at:
          adesso,
        updated_at:
          adesso,
      })
      .eq("id", scadenzaId)
      .eq("studio_id", studioId);

    if (updateError) {
      throw updateError;
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      "https://studio-manager-pro.vercel.app";

    const url =
      `${baseUrl}` +
      `/api/scadenze-centrale/processa-alert` +
      `?secret=${encodeURIComponent(
        CRON_SECRET
      )}` +
      `&scadenza_id=${encodeURIComponent(
        scadenzaId
      )}`;

    const response = await fetch(
      url,
      {
        method: "GET",
        headers: {
          Authorization:
            `Bearer ${CRON_SECRET}`,
        },
      }
    );

    const testo =
      await response.text();

    let risultato: any;

    try {
      risultato =
        JSON.parse(testo);
    } catch {
      risultato = {
        raw: testo,
      };
    }

    if (!response.ok) {
      return res
        .status(response.status)
        .json({
          error:
            risultato?.error ||
            "Errore durante il nuovo tentativo.",
          risultato,
        });
    }

    return res.status(200).json({
      success: true,
      messaggio:
        "Nuovo tentativo completato.",
      risultato,
    });
  } catch (error: any) {
    console.error(
      "Errore retry alert:",
      error
    );

    return res.status(500).json({
      error:
        error?.message ||
        "Errore durante il nuovo tentativo.",
    });
  }
}
