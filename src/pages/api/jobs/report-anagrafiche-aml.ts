import type {
  NextApiRequest,
  NextApiResponse,
} from "next";

import { createClient } from "@supabase/supabase-js";

import {
  generaReportQualitaAnagraficheAML,
  type ReportOperatoreAML,
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

function normalizzaTesto(
  value: string | null | undefined
): string {
  return String(value || "").trim();
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

function formatDateEU(
  value: string | null | undefined
): string {
  if (!value) {
    return "-";
  }

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
    const soggettoId =
      String(
        voce.soggetto_cliente_id ||
          ""
      );

    if (!soggettoId) {
      continue;
    }

    if (
      !map.has(
        soggettoId
      )
    ) {
      map.set(
        soggettoId,
        {
          soggetto_cliente_id:
            soggettoId,

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
      map.get(
        soggettoId
      )!;

    /*
     * Uniamo le anomalie.
     */
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

    /*
     * Uniamo le società.
     *
     * Lo stesso amministratore può essere
     * rappresentante di più società.
     */
    const clienteId =
      String(
        voce.cliente_id || ""
      );

    if (clienteId) {
      const giaPresente =
        aggregato.societa.some(
          (societa) =>
            societa.cliente_id ===
            clienteId
        );

      if (!giaPresente) {
        aggregato.societa.push({
          cliente_id:
            clienteId,

          cliente:
            voce.cliente,
        });
      }
    }

    /*
     * Manteniamo eventuali dati documento
     * se la prima riga aggregata non li aveva.
     */
    if (
      !aggregato.documento_aml_id &&
      voce.documento_aml_id
    ) {
      aggregato.documento_aml_id =
        voce.documento_aml_id;
    }

    if (
      !aggregato.tipo_documento &&
      voce.tipo_documento
    ) {
      aggregato.tipo_documento =
        voce.tipo_documento;
    }

    if (
      !aggregato.scadenza_documento &&
      voce.scadenza_documento
    ) {
      aggregato.scadenza_documento =
        voce.scadenza_documento;
    }
  }

  const result =
    Array.from(
      map.values()
    );

  for (
    const rappresentante of
      result
  ) {
    rappresentante.societa.sort(
      (a, b) =>
        a.cliente.localeCompare(
          b.cliente,
          "it",
          {
            sensitivity:
              "base",
          }
        )
    );

    rappresentante.anomalie.sort();
  }

  result.sort(
    (a, b) =>
      a.rappresentante.localeCompare(
        b.rappresentante,
        "it",
        {
          sensitivity:
            "base",
        }
      )
  );

  return result;
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
        (rappresentante) => {
          const societa =
            rappresentante.societa
              .map(
                (societa) =>
                  `<div style="margin-bottom:3px;">
                    ${escapeHtml(
                      societa.cliente
                    )}
                  </div>`
              )
              .join("");

          const anomalie =
            rappresentante.anomalie
              .map(
                (anomalia) =>
                  `<div style="margin-bottom:3px;">
                    ${escapeHtml(
                      labelAnomalia(
                        anomalia
                      )
                    )}
                  </div>`
              )
              .join("");

          return `
            <tr>
              <td
                style="
                  border:1px solid #d1d5db;
                  padding:8px;
                  vertical-align:top;
                "
              >
                <strong>
                  ${escapeHtml(
                    rappresentante.rappresentante
                  )}
                </strong>

                ${
                  rappresentante.codice_fiscale
                    ? `
                      <div
                        style="
                          margin-top:3px;
                          color:#6b7280;
                          font-size:12px;
                        "
                      >
                        CF:
                        ${escapeHtml(
                          rappresentante.codice_fiscale
                        )}
                      </div>
                    `
                    : ""
                }
              </td>

              <td
                style="
                  border:1px solid #d1d5db;
                  padding:8px;
                  vertical-align:top;
                "
              >
                ${societa || "-"}
              </td>

              <td
                style="
                  border:1px solid #d1d5db;
                  padding:8px;
                  vertical-align:top;
                "
              >
                ${anomalie || "-"}
              </td>

              <td
                style="
                  border:1px solid #d1d5db;
                  padding:8px;
                  vertical-align:top;
                  white-space:nowrap;
                "
              >
                ${formatDateEU(
                  rappresentante.scadenza_documento
                )}
              </td>
            </tr>
          `;
        }
      )
      .join("");

  return `
    <div
      style="
        font-family:Arial,sans-serif;
        font-size:14px;
        color:#111827;
        line-height:1.5;
      "
    >
      <p>
        Buongiorno,
      </p>

      <p>
        Studio Manager Pro ha rilevato alcune anomalie
        nelle anagrafiche dei rappresentanti legali
        relative ai clienti assegnati.
      </p>

      <p>
        È necessario verificare e aggiornare i dati segnalati.
        In particolare, l'indirizzo email del rappresentante
        è obbligatorio perché necessario per le comunicazioni
        automatiche relative agli adempimenti antiriciclaggio.
      </p>

      <table
        style="
          border-collapse:collapse;
          width:100%;
          margin-top:16px;
        "
      >
        <thead>
          <tr
            style="
              background:#f3f4f6;
            "
          >
            <th
              style="
                border:1px solid #d1d5db;
                padding:8px;
                text-align:left;
              "
            >
              Rappresentante
            </th>

            <th
              style="
                border:1px solid #d1d5db;
                padding:8px;
                text-align:left;
              "
            >
              Società collegate
            </th>

            <th
              style="
                border:1px solid #d1d5db;
                padding:8px;
                text-align:left;
              "
            >
              Anomalie
            </th>

            <th
              style="
                border:1px solid #d1d5db;
                padding:8px;
                text-align:left;
              "
            >
              Scadenza documento
            </th>
          </tr>
        </thead>

        <tbody>
          ${righe}
        </tbody>
      </table>

      <p
        style="
          margin-top:18px;
        "
      >
        Ogni operatore responsabile è tenuto
        ad aggiornare le anagrafiche segnalate
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
        (rappresentante) => {
          const societa =
            rappresentante.societa
              .map(
                (societa) =>
                  `- ${societa.cliente}`
              )
              .join("\n");

          const anomalie =
            rappresentante.anomalie
              .map(
                (anomalia) =>
                  `- ${labelAnomalia(
                    anomalia
                  )}`
              )
              .join("\n");

          return `
${rappresentante.rappresentante}
${
  rappresentante.codice_fiscale
    ? `CF: ${rappresentante.codice_fiscale}`
    : ""
}

Società collegate:
${societa || "-"}

Anomalie:
${anomalie || "-"}

Scadenza documento:
${formatDateEU(
  rappresentante.scadenza_documento
)}
          `.trim();
        }
      )
      .join(
        "\n\n----------------------------------------\n\n"
      );

  return `
Buongiorno,

Studio Manager Pro ha rilevato alcune anomalie
nelle anagrafiche dei rappresentanti legali
relative ai clienti assegnati.

È necessario verificare e aggiornare i dati segnalati.

L'indirizzo email del rappresentante è obbligatorio
perché necessario per le comunicazioni automatiche AML.

${righe}

Ogni operatore responsabile è tenuto ad aggiornare
le anagrafiche segnalate direttamente in Studio Manager Pro.

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
     * ?test=1
     *
     * NON invia email.
     */
    const testMode =
      req.query.test === "1";

    /*
     * =========================================================
     * GENERAZIONE REPORT
     * =========================================================
     */
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

    /*
     * =========================================================
     * TEST
     * =========================================================
     */
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
                studio_id:
                  gruppo.studio_id,

                operatore_id:
                  gruppo.operatore_id,

                email_operatore:
                  gruppo.email_operatore,

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

    /*
     * Cache per non cercare l'Utente comunicazioni
     * dello stesso Studio ad ogni operatore.
     */
    const mittentiStudio =
      new Map<
        string,
        {
          senderUserId: string;
          microsoftConnectionId: string;
        }
      >();

    for (
      const gruppo of
        report
    ) {
      try {
        const emailOperatore =
          normalizzaTesto(
            gruppo.email_operatore
          );

        if (!emailOperatore) {
          throw new Error(
            "Email operatore mancante."
          );
        }

        /*
         * =====================================================
         * MARKER UNIVOCO
         * =====================================================
         */
        const markerUnivoco =
          `QUALITA_ANAGRAFICHE_AML:${gruppo.studio_id}:${gruppo.operatore_id}:${oggi}`;

        /*
         * =====================================================
         * ANTI-DUPLICAZIONE
         * =====================================================
         */
        const {
          data:
            logEsistente,
          error:
            logLookupError,
        } =
          await supabaseAdmin
            .from(
              "tbalert_log"
            )
            .select("id")
            .eq(
              "studio_id",
              gruppo.studio_id
            )
            .eq(
              "modulo",
              "anagrafiche_aml"
            )
            .eq(
              "tipo_alert",
              "qualita_anagrafiche_aml"
            )
            .eq(
              "destinatario_utente_id",
              gruppo.operatore_id
            )
            .eq(
              "marker_univoco",
              markerUnivoco
            )
            .eq(
              "email_inviata",
              true
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
         * MITTENTE DELLO STUDIO
         * =====================================================
         */
        let mittente =
          mittentiStudio.get(
            gruppo.studio_id
          );

        if (!mittente) {
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
              "L'Utente comunicazioni non ha una connessione Microsoft 365 configurata."
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
           * Verifica token Microsoft.
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

          mittente = {
            senderUserId,
            microsoftConnectionId,
          };

          mittentiStudio.set(
            gruppo.studio_id,
            mittente
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
            senderUserId:
              mittente.senderUserId,

            microsoftConnectionId:
              mittente.microsoftConnectionId,

            to:
              emailOperatore,

            subject,

            html,

            text,
          } as any);

        if (
          !emailResult.success
        ) {
          throw new Error(
            emailResult.error ||
              "Errore durante l'invio email."
          );
        }

        /*
         * =====================================================
         * LOG
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

              modulo:
                "anagrafiche_aml",

              riferimento_tabella:
                "tbclienti_organi",

              riferimento_id:
                null,

              tipo_alert:
                "qualita_anagrafiche_aml",

              data_scadenza:
                null,

              giorni_preavviso:
                null,

              destinatario_utente_id:
                gruppo.operatore_id,

              destinatario_email:
                emailOperatore,

              messaggio_interno_creato:
                false,

              email_inviata:
                true,

              marker_univoco:
                markerUnivoco,

              errore:
                null,

              inviato_at:
                new Date()
                  .toISOString(),
            });

        if (
          logInsertError
        ) {
          throw new Error(
            `Email inviata correttamente a ${emailOperatore}, ma il log non è stato salvato: ${logInsertError.message}`
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
          "Errore durante la generazione del report qualità anagrafiche AML",
      });
  }
}
