import type {
  NextApiRequest,
  NextApiResponse,
} from "next";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type StatoScadenza =
  | "scaduta"
  | "scade_oggi"
  | "in_scadenza_7_giorni"
  | "in_scadenza_30_giorni"
  | "futura"
  | "completata"
  | "annullata"
  | "sospesa";

function leggiParametro(
  valore: string | string[] | undefined
): string {
  if (Array.isArray(valore)) {
    return String(valore[0] || "").trim();
  }

  return String(valore || "").trim();
}

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

  const token = authorization
    .slice(7)
    .trim();

  return token || null;
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
    /*
     * 1. Leggiamo l'utente autenticato dal
     * token Supabase inviato dal frontend.
     */
    const accessToken =
      leggiAccessToken(req);

    if (!accessToken) {
      return res.status(401).json({
        error:
          "Sessione non valida o token mancante.",
      });
    }

    const {
      data: authData,
      error: authError,
    } = await supabaseAdmin.auth.getUser(
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

    /*
     * 2. Ricaviamo lo studio dalla tabella
     * tbutenti. Non usiamo mai uno studio_id
     * fisso nell'API.
     */
    const {
      data: utente,
      error: utenteError,
    } = await supabaseAdmin
      .from("tbutenti")
      .select(`
        id,
        studio_id,
        nome,
        cognome,
        email,
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
     * 3. Filtri facoltativi inviati dalla pagina.
     */
    const stato =
      leggiParametro(req.query.stato);

    const origineModulo =
      leggiParametro(
        req.query.origine_modulo
      );

    const operatoreId =
      leggiParametro(
        req.query.operatore_id
      );

    const clienteId =
      leggiParametro(
        req.query.cliente_id
      );

    const dataDal =
      leggiParametro(req.query.data_dal);

    const dataAl =
      leggiParametro(req.query.data_al);

    const ricerca =
      leggiParametro(req.query.ricerca);

    /*
     * 4. Query principale sulla vista centrale.
     */
    let query = supabaseAdmin
      .from(
        "vw_scadenze_centrale_riepilogo"
      )
      .select("*")
      .eq("studio_id", studioId)
      .order(
        "data_scadenza",
        {
          ascending: true,
        }
      )
      .order(
        "cliente",
        {
          ascending: true,
        }
      );

    if (stato) {
      query = query.eq(
        "stato_calcolato",
        stato
      );
    }

    if (origineModulo) {
      query = query.eq(
        "origine_modulo",
        origineModulo
      );
    }

    if (operatoreId) {
      query = query.eq(
        "operatore_responsabile_id",
        operatoreId
      );
    }

    if (clienteId) {
      query = query.eq(
        "cliente_id",
        clienteId
      );
    }

    if (dataDal) {
      query = query.gte(
        "data_scadenza",
        dataDal
      );
    }

    if (dataAl) {
      query = query.lte(
        "data_scadenza",
        dataAl
      );
    }

    /*
     * Ricerca su cliente, titolo, descrizione,
     * operatore e modulo.
     *
     * Prima eliminiamo i caratteri che possono
     * alterare la sintassi del filtro PostgREST.
     */
    if (ricerca) {
      const ricercaPulita =
        ricerca
          .replace(/[%(),]/g, " ")
          .replace(/\s+/g, " ")
          .trim();

      if (ricercaPulita) {
        query = query.or(
          [
            `cliente.ilike.%${ricercaPulita}%`,
            `titolo.ilike.%${ricercaPulita}%`,
            `descrizione.ilike.%${ricercaPulita}%`,
            `operatore_responsabile.ilike.%${ricercaPulita}%`,
            `origine_modulo.ilike.%${ricercaPulita}%`,
          ].join(",")
        );
      }
    }

    const {
      data: scadenze,
      error: scadenzeError,
    } = await query;

    if (scadenzeError) {
      throw scadenzeError;
    }

    /*
     * 5. Recuperiamo l'elenco completo dello
     * studio per costruire filtri e card.
     */
    const {
      data: tutteLeScadenze,
      error: tutteError,
    } = await supabaseAdmin
      .from(
        "vw_scadenze_centrale_riepilogo"
      )
      .select(`
        id,
        cliente_id,
        cliente,
        operatore_responsabile_id,
        operatore_responsabile,
        origine_modulo,
        stato_calcolato,
        alert_con_errore
      `)
      .eq("studio_id", studioId);

    if (tutteError) {
      throw tutteError;
    }

    const elencoCompleto =
      tutteLeScadenze || [];

    /*
 * Recuperiamo i log dal più recente.
 * Il primo log incontrato per ogni scadenza
 * rappresenta il suo ultimo tentativo.
 */
const {
  data: logAlert,
  error: logAlertError,
} = await supabaseAdmin
  .from("tbscadenze_centrale_alert_log")
  .select(`
    scadenza_id,
    esito,
    created_at
  `)
  .eq("studio_id", studioId)
  .order("created_at", {
    ascending: false,
  });

if (logAlertError) {
  throw logAlertError;
}

const ultimoEsitoPerScadenza =
  new Map<string, string>();

(logAlert || []).forEach((log) => {
  const scadenzaId =
    String(log.scadenza_id || "");

  if (
    scadenzaId &&
    !ultimoEsitoPerScadenza.has(
      scadenzaId
    )
  ) {
    ultimoEsitoPerScadenza.set(
      scadenzaId,
      String(log.esito || "")
    );
  }
});

const scadenzeConErroreAperto =
  new Set(
    Array.from(
      ultimoEsitoPerScadenza.entries()
    )
      .filter(
        ([, esito]) =>
          esito === "errore"
      )
      .map(
        ([scadenzaId]) =>
          scadenzaId
      )
  );

    /*
     * 6. Card riepilogative.
     */
    const riepilogo = {
      totale:
        elencoCompleto.length,

      scadute:
        elencoCompleto.filter(
          (item) =>
            item.stato_calcolato ===
            "scaduta"
        ).length,

      scadono_oggi:
        elencoCompleto.filter(
          (item) =>
            item.stato_calcolato ===
            "scade_oggi"
        ).length,

      entro_7_giorni:
        elencoCompleto.filter(
          (item) =>
            item.stato_calcolato ===
            "in_scadenza_7_giorni"
        ).length,

      entro_30_giorni:
        elencoCompleto.filter(
          (item) =>
            item.stato_calcolato ===
            "in_scadenza_30_giorni"
        ).length,

      future:
        elencoCompleto.filter(
          (item) =>
            item.stato_calcolato ===
            "futura"
        ).length,

      completate:
        elencoCompleto.filter(
          (item) =>
            item.stato_calcolato ===
            "completata"
        ).length,

      senza_operatore:
        elencoCompleto.filter(
          (item) =>
            !item.operatore_responsabile_id &&
            ![
              "completata",
              "annullata",
            ].includes(
              String(
                item.stato_calcolato || ""
              )
            )
        ).length,

     con_errori_alert:
  scadenzeConErroreAperto.size,
    };

    /*
     * 7. Opzioni uniche per i filtri.
     */
    const moduliMap =
      new Map<string, string>();

    const operatoriMap =
      new Map<
        string,
        {
          id: string;
          nome: string;
        }
      >();

    const clientiMap =
      new Map<
        string,
        {
          id: string;
          nome: string;
        }
      >();

    elencoCompleto.forEach((item) => {
      if (item.origine_modulo) {
        moduliMap.set(
          String(item.origine_modulo),
          String(item.origine_modulo)
        );
      }

      if (
        item.operatore_responsabile_id &&
        item.operatore_responsabile
      ) {
        operatoriMap.set(
          String(
            item.operatore_responsabile_id
          ),
          {
            id: String(
              item.operatore_responsabile_id
            ),
            nome: String(
              item.operatore_responsabile
            ),
          }
        );
      }

      if (
        item.cliente_id &&
        item.cliente
      ) {
        clientiMap.set(
          String(item.cliente_id),
          {
            id: String(item.cliente_id),
            nome: String(item.cliente),
          }
        );
      }
    });

    const moduli = Array.from(
      moduliMap.values()
    ).sort((a, b) =>
      a.localeCompare(b, "it")
    );

    const operatori = Array.from(
      operatoriMap.values()
    ).sort((a, b) =>
      a.nome.localeCompare(
        b.nome,
        "it"
      )
    );

    const clienti = Array.from(
      clientiMap.values()
    ).sort((a, b) =>
      a.nome.localeCompare(
        b.nome,
        "it"
      )
    );

    return res.status(200).json({
      success: true,

      studio_id:
        studioId,

      utente: {
        id: utente.id,
        nome: utente.nome,
        cognome: utente.cognome,
        email: utente.email,
        tipo_utente:
          utente.tipo_utente,
      },

      riepilogo,

      filtri: {
        moduli,
        operatori,
        clienti,

        stati: [
          {
            valore: "scaduta",
            etichetta: "Scadute",
          },
          {
            valore: "scade_oggi",
            etichetta: "Scadono oggi",
          },
          {
            valore:
              "in_scadenza_7_giorni",
            etichetta:
              "Entro 7 giorni",
          },
          {
            valore:
              "in_scadenza_30_giorni",
            etichetta:
              "Entro 30 giorni",
          },
          {
            valore: "futura",
            etichetta: "Future",
          },
          {
            valore: "completata",
            etichetta: "Completate",
          },
          {
            valore: "annullata",
            etichetta: "Annullate",
          },
          {
            valore: "sospesa",
            etichetta: "Sospese",
          },
        ] satisfies Array<{
          valore: StatoScadenza;
          etichetta: string;
        }>,
      },

      scadenze:
        scadenze || [],

      numero_scadenze:
        scadenze?.length || 0,
    });
  } catch (error: any) {
    console.error(
      "Errore API scadenze centrali:",
      error
    );

    return res.status(500).json({
      error:
        error?.message ||
        "Errore durante il caricamento delle scadenze.",
    });
  }
}
