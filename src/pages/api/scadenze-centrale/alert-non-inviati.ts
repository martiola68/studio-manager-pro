import type {
  NextApiRequest,
  NextApiResponse,
} from "next";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

function leggiToken(
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
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);

    return res.status(405).json({
      error: "Metodo non consentito.",
    });
  }

  const supabaseAdmin =
    getSupabaseAdmin();

  try {
    const accessToken =
      leggiToken(req);

    if (!accessToken) {
      return res.status(401).json({
        error: "Token mancante.",
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

    const studioId =
      String(utente.studio_id);

    /*
     * Ordine decrescente: il primo log
     * incontrato è l'ultimo tentativo.
     */
    const {
      data: logs,
      error: logsError,
    } = await supabaseAdmin
      .from(
        "tbscadenze_centrale_alert_log"
      )
      .select(`
        id,
        studio_id,
        scadenza_id,
        destinatario_email,
        esito,
        errore,
        tipo_alert,
        chiave_invio,
        data_programmata,
        inviato_at,
        created_at
      `)
      .eq("studio_id", studioId)
      .order("created_at", {
        ascending: false,
      });

    if (logsError) {
      throw logsError;
    }

    const ultimoLogMap =
      new Map<string, any>();

    (logs || []).forEach((log) => {
      const scadenzaId =
        String(log.scadenza_id || "");

      if (
        scadenzaId &&
        !ultimoLogMap.has(
          scadenzaId
        )
      ) {
        ultimoLogMap.set(
          scadenzaId,
          log
        );
      }
    });

    const logInErrore =
      Array.from(
        ultimoLogMap.values()
      ).filter(
        (log) =>
          log.esito === "errore"
      );

    if (
      logInErrore.length === 0
    ) {
      return res.status(200).json({
        success: true,
        numero_errori: 0,
        errori: [],
      });
    }

    const scadenzaIds =
      logInErrore.map(
        (log) =>
          String(log.scadenza_id)
      );

    const {
      data: scadenze,
      error: scadenzeError,
    } = await supabaseAdmin
      .from(
        "vw_scadenze_centrale_riepilogo"
      )
      .select(`
        id,
        studio_id,
        cliente,
        cliente_id,
        origine_modulo,
        titolo,
        descrizione,
        data_scadenza,
        operatore_responsabile,
        operatore_email,
        link_dettaglio
      `)
      .eq("studio_id", studioId)
      .in("id", scadenzaIds);

    if (scadenzeError) {
      throw scadenzeError;
    }

    const scadenzeMap =
      new Map(
        (scadenze || []).map(
          (scadenza) => [
            String(scadenza.id),
            scadenza,
          ]
        )
      );

    const errori = logInErrore
      .map((log) => {
        const scadenza =
          scadenzeMap.get(
            String(log.scadenza_id)
          );

        if (!scadenza) {
          return null;
        }

        return {
          log_id: log.id,
          scadenza_id:
            log.scadenza_id,

          cliente:
            scadenza.cliente,

          cliente_id:
            scadenza.cliente_id,

          origine_modulo:
            scadenza.origine_modulo,

          titolo:
            scadenza.titolo,

          descrizione:
            scadenza.descrizione,

          data_scadenza:
            scadenza.data_scadenza,

          operatore:
            scadenza.operatore_responsabile,

          operatore_email:
            scadenza.operatore_email,

          destinatario_email:
            log.destinatario_email,

          errore:
            log.errore,

          tipo_alert:
            log.tipo_alert,

          data_tentativo:
            log.created_at,

          link_dettaglio:
            scadenza.link_dettaglio,
        };
      })
      .filter(Boolean);

    return res.status(200).json({
      success: true,
      numero_errori:
        errori.length,
      errori,
    });
  } catch (error: any) {
    console.error(
      "Errore alert non inviati:",
      error
    );

    return res.status(500).json({
      error:
        error?.message ||
        "Errore durante il caricamento degli alert non inviati.",
    });
  }
}
