import type {
  NextApiRequest,
  NextApiResponse,
} from "next";

import { createClient } from "@supabase/supabase-js";

import {
  generaReportQualitaAnagraficheAML,
  type ReportOperatoreAML,
  type AnomaliaAnagraficaAML,
} from "@/services/anagraficheQualityReport";

import { sendEmailServer } from "@/services/sendEmailServer";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL!;

const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(
  supabaseUrl,
  serviceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

type ResponseData =
  | {
      ok: true;
      test: boolean;
      gruppi: number;
      anomalie: number;
      email_inviate?: number;
      email_saltate?: number;
      errori?: string[];
      data?: any[];
    }
  | {
      ok: false;
      error: string;
    };

function formatDateEU(
  value: string | null | undefined
): string {
  if (!value) return "-";

  const raw =
    value.includes("T")
      ? value.split("T")[0]
      : value;

  const parts =
    raw.split("-");

  if (parts.length !== 3) {
    return value;
  }

  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function escapeHtml(
  value: string | null | undefined
): string {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

type AnomaliaAggregata = {
  soggetto_cliente_id: string;
  rappresentante: string;
  codice_fiscale: string | null;
  email_rappresentante: string | null;

  documento_aml_id: string | null;
  tipo_documento: string | null;
  scadenza_documento: string | null;

  anomalie: string[];

  societa: {
    cliente_id: string;
    cliente: string;
  }[];
};

function aggregaPerRappresentante(
  gruppo: ReportOperatoreAML
): AnomaliaAggregata[] {
  const map =
    new Map<
      string,
      AnomaliaAggregata
    >();

  for (
    const voce of
      gruppo.anomalie
  ) {
    const key =
      voce.soggetto_cliente_id;

    if (!map.has(key)) {
      map.set(
        key,
        {
          soggetto_cliente_id:
            voce.soggetto_cliente_id,

          rappresentante:
            voce.rappresentante,

          codice_fiscale:
            voce.codice_fiscale,

          email_rappresentante:
            voce.email_rappresentante,

          documento_aml_id:
            voce.documento_aml_id,

          tipo_documento:
            voce.tipo_documento,

          scadenza_documento:
            voce.scadenza_documento,

          anomalie:
            [],

          societa:
            [],
        }
      );
    }

    const aggregato =
      map.get(key)!;

    for (
      const anomalia of
        voce.anomalie
    ) {
      if (
        !aggregato.anomalie.includes(
          anomalia
        )
      ) {
        aggregato.anomalie.push(
          anomalia
        );
      }
    }

    const societaGiaPresente =
      aggregato.societa.some(
        (s) =>
          s.cliente_id ===
          voce.cliente_id
      );

    if (!societaGiaPresente) {
      aggregato.societa.push({
        cliente_id:
          voce.cliente_id,

        cliente:
          voce.cliente,
      });
    }
  }

  const result =
    Array.from(
      map.values()
    );

  for (
    const voce of
      result
  ) {
    voce.societa.sort(
      (a, b) =>
        a.cliente.localeCompare(
          b.cliente,
          "it",
          {
            sensitivity: "base",
          }
        )
    );
  }

  result.sort(
    (a, b) =>
      a.rappresentante.localeCompare(
        b.rappresentante,
        "it",
        {
          sensitivity: "base",
        }
      )
  );

  return result;
}

function labelAnomalia(
  codice: string
): string {
  switch (codice) {
    case "EMAIL_MANCANTE":
      return "Email mancante";

    case "EMAIL_NON_VALIDA":
      return "Email non valida";

    case "DOCUMENTO_SCADUTO":
      return "Documento scaduto";

    case "DOCUMENTO_IN_SCADENZA_60_GIORNI":
      return "Documento in scadenza entro 60 giorni";

    default:
      return codice;
  }
}

function buildHtml(
  gruppo: ReportOperatoreAML
): string {
  const rappresentanti =
    aggregaPerRappresentante(
      gruppo
    );

  const righe =
    rappresentanti
      .map(
        (r) => {
          const societaHtml =
            r.societa
              .map(
                (s) =>
                  `<div>${escapeHtml(
                    s.cliente
                  )}</div>`
              )
              .join("");

          const anomalieHtml =
            r.anomalie
              .map(
                (a) =>
                  `<div>${escapeHtml(
                    labelAnomalia(a)
                  )}</div>`
              )
              .join("");

          return `
            <tr>
              <td style="border:1px solid #d1d5db;padding:8px;vertical-align:top;">
                <strong>${escapeHtml(
                  r.rappresentante
                )}</strong>
                ${
                  r.codice_fiscale
                    ? `<div style="font-size:12px;color:#6b7280;">
                        CF: ${escapeHtml(
                          r.codice_fiscale
                        )}
                      </div>`
                    : ""
                }
              </td>

              <td style="border:1px solid #d1d5db;padding:8px;vertical-align:top;">
                ${societaHtml}
              </td>

              <td style="border:1px solid #d1d5db;padding:8px;vertical-align:top;">
                ${anomalieHtml}
              </td>

              <td style="border:1px solid #d1d5db;padding:8px;vertical-align:top;">
                ${
                  r.scadenza_documento
                    ? formatDateEU(
                        r.scadenza_documento
                      )
                    : "-"
                }
              </td>
            </tr>
          `;
        }
      )
      .join("");

  return `
    <div style="font-family:Arial,sans-serif;font-size:14px;color:#111827;line-height:1.5;">
      <p>Buongiorno,</p>

      <p>
        Studio Manager Pro ha rilevato alcune anomalie
        nelle anagrafiche dei rappresentanti legali
        relative ai clienti assegnati.
      </p>

      <p>
        È necessario verificare e aggiornare i dati segnalati,
        con particolare attenzione agli indirizzi email,
        indispensabili per l'invio automatico delle comunicazioni AML.
      </p>

      <table
        style="
          border-collapse:collapse;
          width:100%;
          margin-top:16px;
        "
      >
        <thead>
          <tr style="background:#f3f4f6;">
            <th style="border:1px solid #d1d5db;padding:8px;text-align:left;">
              Rappresentante
            </th>

            <th style="border:1px solid #d1d5db;padding:8px;text-align:left;">
              Società collegate
            </th>

            <th style="border:1px solid #d1d5db;padding:8px;text-align:left;">
              Anomalie
            </th>

            <th style="border:1px solid #d1d5db;padding:8px;text-align:left;">
              Scadenza documento
            </th>
          </tr>
        </thead>

        <tbody>
          ${righe}
        </tbody>
      </table>

      <p style="margin-top:18px;">
        Si richiede l'aggiornamento delle anagrafiche
        direttamente in Studio Manager Pro.
      </p>

      <p>
        Questa comunicazione è generata automaticamente
        dal controllo qualità delle anagrafiche AML.
      </p>
    </div>
  `;
}

function buildText(
  gruppo: ReportOperatoreAML
): string {
  const rappresentanti =
    aggregaPerRappresentante(
      gruppo
    );

  const righe =
    rappresentanti
      .map(
        (r) => {
          const societa =
            r.societa
              .map(
                (s) =>
                  `- ${s.cliente}`
              )
              .join("\n");

          const anomalie =
            r.anomalie
              .map(
                (a) =>
                  `- ${labelAnomalia(
                    a
                  )}`
              )
              .join("\n");

          return `
${r.rappresentante}
${r.codice_fiscale ? `CF: ${r.codice_fiscale}` : ""}

Società:
${societa}

Anomalie:
${anomalie}

Scadenza documento:
${formatDateEU(
  r.scadenza_documento
)}
          `.trim();
        }
      )
      .join("\n\n-----------------------------\n\n");

  return `
Buongiorno,

Studio Manager Pro ha rilevato alcune anomalie
nelle anagrafiche dei rappresentanti legali
relative ai clienti assegnati.

È necessario verificare e aggiornare i dati segnalati,
con particolare attenzione agli indirizzi email,
indispensabili per l'invio automatico delle comunicazioni AML.

${righe}

Si richiede l'aggiornamento delle anagrafiche
direttamente in Studio Manager Pro.

Questa comunicazione è generata automaticamente
dal controllo qualità delle anagrafiche AML.
  `.trim();
}

function dataOggiKey(): string {
  const now =
    new Date();

  const yyyy =
    now.getFullYear();

  const mm =
    String(
      now.getMonth() + 1
    ).padStart(
      2,
      "0"
    );

  const dd =
    String(
      now.getDate()
    ).padStart(
      2,
      "0"
    );

  return `${yyyy}-${mm}-${dd}`;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  if (
    req.method !== "GET"
  ) {
    return res.status(405).json({
      ok: false,
      error:
        "Metodo non consentito",
    });
  }

  try {
    /*
     * =========================================================
     * TEST MODE
     * =========================================================
     *
     * /api/jobs/report-anagrafiche-aml?test=1
     *
     * Nessuna email viene inviata.
     */
    const testMode =
      req.query.test === "1";

    const report =
      await generaReportQualitaAnagraficheAML();

    const totaleAnomalie =
      report.reduce(
        (
          totale,
          gruppo
        ) =>
          totale +
          gruppo.anomalie.length,
        0
      );

    if (testMode) {
      return res
        .status(200)
        .json({
          ok: true,
          test: true,
          gruppi:
            report.length,
          anomalie:
            totaleAnomalie,
          data:
            report.map(
              (gruppo) => ({
                ...gruppo,

                rappresentanti:
                  aggregaPerRappresentante(
                    gruppo
                  ),
              })
            ),
        });
    }

    /*
     * =========================================================
     * INVIO REALE
     * =========================================================
     */
    let emailInviate =
      0;

    let emailSaltate =
      0;

    const errori:
      string[] = [];

    const oggi =
      dataOggiKey();

    for (
      const gruppo of
        report
    ) {
      try {
        /*
         * =====================================================
         * ANTI-DUPLICAZIONE
         * =====================================================
         *
         * Usiamo tbalert_log.
         *
         * Una sola email:
         *
         * studio
         * + operatore
         * + giorno
         * + tipo report
         */
        const chiave =
          `QUALITA_ANAGRAFICHE_AML:${gruppo.studio_id}:${gruppo.operatore_id}:${oggi}`;

        const {
          data: logEsistente,
          error:
            logLookupError,
        } =
          await supabaseAdmin
            .from(
              "tbalert_log"
            )
            .select("id")
            .eq(
              "tipo",
              "QUALITA_ANAGRAFICHE_AML"
            )
            .eq(
              "studio_id",
              gruppo.studio_id
            )
            .eq(
              "utente_id",
              gruppo.operatore_id
            )
            .eq(
              "chiave",
              chiave
            )
            .limit(1)
            .maybeSingle();

        if (
          logLookupError
        ) {
          throw new Error(
            logLookupError.message
          );
        }

        if (
          logEsistente?.id
        ) {
          emailSaltate++;
          continue;
        }

        /*
         * =====================================================
         * UTENTE COMUNICAZIONI DELLO STUDIO
         * =====================================================
         */
        const {
          data:
            utenteComunicazioni,
          error:
            utenteComunicazioniError,
        } =
          await supabaseAdmin
            .from("tbutenti")
            .select(`
              id,
              microsoft_connection_id
            `)
            .eq(
              "studio_id",
              gruppo.studio_id
            )
            .eq(
              "utente_comunicazioni",
              true
            )
            .eq(
              "attivo",
              true
            )
            .maybeSingle();

        if (
          utenteComunicazioniError
        ) {
          throw new Error(
            utenteComunicazioniError.message
          );
        }

        if (
          !utenteComunicazioni?.id
        ) {
          throw new Error(
            "Utente comunicazioni dello Studio non configurato."
          );
        }

        if (
          !utenteComunicazioni
            .microsoft_connection_id
        ) {
          throw new Error(
            "Connessione Microsoft 365 dell'Utente comunicazioni non configurata."
          );
        }

        const senderUserId =
          String(
            utenteComunicazioni.id
          );

        const microsoftConnectionId =
          String(
            utenteComunicazioni
              .microsoft_connection_id
          );

        /*
         * =====================================================
         * CONTROLLO TOKEN MICROSOFT
         * =====================================================
         */
        const {
          data:
            tokenMicrosoft,
          error:
            tokenMicrosoftError,
        } =
          await supabaseAdmin
            .from(
              "tbmicrosoft365_user_tokens"
            )
            .select("user_id")
            .eq(
              "user_id",
              senderUserId
            )
            .eq(
              "microsoft_connection_id",
              microsoftConnectionId
            )
            .is(
              "revoked_at",
              null
            )
            .limit(1)
            .maybeSingle();

        if (
          tokenMicrosoftError
        ) {
          throw new Error(
            tokenMicrosoftError.message
          );
        }

        if (
          !tokenMicrosoft?.user_id
        ) {
          throw new Error(
            "L'Utente comunicazioni non dispone di un token Microsoft 365 valido."
          );
        }

        /*
         * =====================================================
         * EMAIL
         * =====================================================
         */
        const subject =
          "Studio Manager Pro - Controllo qualità anagrafiche AML";

        const html =
          buildHtml(
            gruppo
          );

        const text =
          buildText(
            gruppo
          );

        const emailResult =
          await sendEmailServer({
            senderUserId,

            microsoftConnectionId,

            to:
              gruppo.email_operatore,

            subject,

            html,

            text,
          } as any);

        if (
          !emailResult.success
        ) {
          throw new Error(
            emailResult.error ||
              "Errore invio email"
          );
        }

        /*
         * =====================================================
         * LOG INVIO
         * =====================================================
         */
        const {
          error:
            logInsertError,
        } =
          await supabaseAdmin
            .from(
              "tbalert_log"
            )
            .insert({
              studio_id:
                gruppo.studio_id,

              utente_id:
                gruppo.operatore_id,

              tipo:
                "QUALITA_ANAGRAFICHE_AML",

              chiave,

              destinatario:
                gruppo.email_operatore,

              oggetto:
                subject,

              data_invio:
                new Date()
                  .toISOString(),
            });

        if (
          logInsertError
        ) {
          throw new Error(
            `Email inviata a ${gruppo.email_operatore}, ma il log non è stato salvato: ${logInsertError.message}`
          );
        }

        emailInviate++;
      } catch (
        error: any
      ) {
        const messaggio =
          error?.message ||
          "Errore sconosciuto";

        console.error(
          `Errore report AML operatore ${gruppo.operatore_id}:`,
          error
        );

        errori.push(
          `${gruppo.email_operatore}: ${messaggio}`
        );
      }
    }

    return res
      .status(200)
      .json({
        ok: true,
        test: false,

        gruppi:
          report.length,

        anomalie:
          totaleAnomalie,

        email_inviate:
          emailInviate,

        email_saltate:
          emailSaltate,

        errori,
      });
  } catch (
    error: any
  ) {
    console.error(
      "Errore report qualità anagrafiche AML:",
      error
    );

    return res
      .status(500)
      .json({
        ok: false,

        error:
          error?.message ||
          "Errore durante il report qualità anagrafiche AML",
      });
  }
}
