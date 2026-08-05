import type {
  NextApiRequest,
  NextApiResponse,
} from "next";

import { createClient } from "@supabase/supabase-js";
import { sendEmailServer } from "@/services/sendEmailServer";

const SECRET =
  process.env.CRON_SECRET ||
  "x9KfP2LmQ8zYtA71vBnR";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type ScadenzaRow = {
  id: string;
  studio_id: string;
  cliente_id: string | null;
  operatore_responsabile_id: string | null;

  origine_modulo: string;
  tipo_scadenza: string;
  titolo: string;
  descrizione: string | null;

  data_scadenza: string;
  stato: string;

  giorni_preavviso_1: number | null;
  giorni_preavviso_2: number | null;
  giorni_preavviso_3: number | null;

  prossimo_alert_at: string | null;
  numero_alert_inviati: number;

  link_dettaglio: string | null;
};

function dataIsoOggi(): string {
  return new Date()
    .toISOString()
    .slice(0, 10);
}

function differenzaGiorni(
  dataScadenza: string,
  dataRiferimento: string
): number {
  const scadenza = new Date(
    `${dataScadenza}T12:00:00Z`
  );

  const riferimento = new Date(
    `${dataRiferimento}T12:00:00Z`
  );

  return Math.round(
    (
      scadenza.getTime() -
      riferimento.getTime()
    ) /
      86400000
  );
}

function sottraiGiorni(
  dataInput: string,
  giorni: number
): string {
  const data = new Date(
    `${dataInput}T12:00:00Z`
  );

  data.setUTCDate(
    data.getUTCDate() - giorni
  );

  return data
    .toISOString()
    .slice(0, 10);
}

function aggiungiGiorni(
  dataInput: string,
  giorni: number
): string {
  const data = new Date(
    `${dataInput}T12:00:00Z`
  );

  data.setUTCDate(
    data.getUTCDate() + giorni
  );

  return data
    .toISOString()
    .slice(0, 10);
}

function formattaDataItaliana(
  dataInput: string
): string {
  const [anno, mese, giorno] =
    dataInput.split("-");

  return `${giorno}/${mese}/${anno}`;
}

function calcolaTipoAlert(
  scadenza: ScadenzaRow,
  oggi: string
): {
  tipoAlert: string;
  chiaveInvio: string;
  oggetto: string;
  intestazione: string;
} {
  const giorniResidui =
    differenzaGiorni(
      scadenza.data_scadenza,
      oggi
    );

  if (giorniResidui < 0) {
    return {
      tipoAlert: "scadenza_superata",

      chiaveInvio:
        `scaduta-${oggi}`,

      oggetto:
        `Scadenza superata - ${scadenza.titolo}`,

      intestazione:
        `Scadenza superata da ${Math.abs(
          giorniResidui
        )} ${
          Math.abs(giorniResidui) === 1
            ? "giorno"
            : "giorni"
        }`,
    };
  }

  if (giorniResidui === 0) {
    return {
      tipoAlert: "scade_oggi",
      chiaveInvio:
        `scade-oggi-${oggi}`,
      oggetto:
        `Scadenza di oggi - ${scadenza.titolo}`,
      intestazione:
        "La scadenza è prevista per oggi",
    };
  }

  return {
    tipoAlert: "preavviso",
    chiaveInvio:
      `preavviso-${giorniResidui}-${oggi}`,
    oggetto:
      `Scadenza tra ${giorniResidui} giorni - ${scadenza.titolo}`,
    intestazione:
      `La scadenza è prevista tra ${giorniResidui} giorni`,
  };
}

function calcolaProssimoAlert(
  scadenza: ScadenzaRow,
  oggi: string
): string | null {
  const giorniResidui =
    differenzaGiorni(
      scadenza.data_scadenza,
      oggi
    );

  /*
   * Scadenza già superata:
   * nuovo alert ogni 5 giorni.
   */
  if (giorniResidui < 0) {
    return `${aggiungiGiorni(
      oggi,
      5
    )}T08:00:00.000Z`;
  }

  const preavvisi = Array.from(
    new Set(
      [
        scadenza.giorni_preavviso_1,
        scadenza.giorni_preavviso_2,
        scadenza.giorni_preavviso_3,
      ]
        .filter(
          (
            valore
          ): valore is number =>
            valore != null &&
            valore >= 0
        )
        .sort((a, b) => b - a)
    )
  );

  const dateProgrammate =
    preavvisi
      .map((giorni) => ({
        giorni,
        data: sottraiGiorni(
          scadenza.data_scadenza,
          giorni
        ),
      }))
      .filter(
        (item) => item.data > oggi
      )
      .sort((a, b) =>
        a.data.localeCompare(b.data)
      );

  if (dateProgrammate.length > 0) {
    return `${dateProgrammate[0].data}T08:00:00.000Z`;
  }

  /*
   * Se non restano altri preavvisi ma
   * la scadenza non è ancora passata,
   * programmiamo il giorno della scadenza.
   */
  if (giorniResidui > 0) {
    return `${scadenza.data_scadenza}T08:00:00.000Z`;
  }

  /*
   * Dopo l’avviso del giorno stesso,
   * il primo sollecito scaduto parte
   * cinque giorni dopo.
   */
  return `${aggiungiGiorni(
    scadenza.data_scadenza,
    5
  )}T08:00:00.000Z`;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const querySecret =
    typeof req.query.secret === "string"
      ? req.query.secret
      : null;

  const bearerSecret =
    req.headers.authorization
      ?.replace("Bearer ", "")
      .trim();

  if (
    !SECRET ||
    (
      querySecret !== SECRET &&
      bearerSecret !== SECRET
    )
  ) {
    return res.status(401).json({
      ok: false,
      error: "Non autorizzato",
    });
  }

  try {
    const adesso =
      new Date().toISOString();

    const oggi =
      dataIsoOggi();

    const {
      data: scadenze,
      error: scadenzeError,
    } = await supabaseAdmin
      .from("tbscadenze_centrale")
      .select(`
        id,
        studio_id,
        cliente_id,
        operatore_responsabile_id,
        origine_modulo,
        tipo_scadenza,
        titolo,
        descrizione,
        data_scadenza,
        stato,
        giorni_preavviso_1,
        giorni_preavviso_2,
        giorni_preavviso_3,
        prossimo_alert_at,
        numero_alert_inviati,
        link_dettaglio
      `)
      .eq("stato", "attiva")
      .not(
        "prossimo_alert_at",
        "is",
        null
      )
      .lte(
        "prossimo_alert_at",
        adesso
      )
      .order(
        "prossimo_alert_at",
        {
          ascending: true,
        }
      )
      .limit(200);

    if (scadenzeError) {
      throw scadenzeError;
    }

    let inviati = 0;
    let errori = 0;
    let saltati = 0;

    const dettagli: Array<{
      scadenza_id: string;
      ok: boolean;
      messaggio: string;
    }> = [];

    for (
      const riga of
        (scadenze || []) as ScadenzaRow[]
    ) {
      if (
        !riga.operatore_responsabile_id
      ) {
        saltati += 1;

        dettagli.push({
          scadenza_id: riga.id,
          ok: false,
          messaggio:
            "Operatore responsabile assente",
        });

        continue;
      }

      const {
        data: operatore,
        error: operatoreError,
      } = await supabaseAdmin
        .from("tbutenti")
        .select(`
          id,
          nome,
          cognome,
          email,
          studio_id
        `)
        .eq(
          "id",
          riga.operatore_responsabile_id
        )
        .eq(
          "studio_id",
          riga.studio_id
        )
        .maybeSingle();

      if (
        operatoreError ||
        !operatore?.email
      ) {
        saltati += 1;

        dettagli.push({
          scadenza_id: riga.id,
          ok: false,
          messaggio:
            "Email operatore non disponibile",
        });

        continue;
      }

      const {
        data: studio,
        error: studioError,
      } = await supabaseAdmin
        .from("tbstudio")
        .select(`
          id,
          email,
          microsoft_connection_id
        `)
        .eq("id", riga.studio_id)
        .maybeSingle();

      if (
        studioError ||
        !studio
          ?.microsoft_connection_id
      ) {
        saltati += 1;

        dettagli.push({
          scadenza_id: riga.id,
          ok: false,
          messaggio:
            "Connessione Microsoft dello studio assente",
        });

        continue;
      }

      const alert =
        calcolaTipoAlert(
          riga,
          oggi
        );

      /*
       * Prenotiamo l’invio prima di mandare
       * l’email. Il vincolo univoco impedisce
       * doppioni se il cron parte due volte.
       */
      const {
        data: logCreato,
        error: prenotazioneError,
      } = await supabaseAdmin
        .from(
          "tbscadenze_centrale_alert_log"
        )
        .insert({
          studio_id:
            riga.studio_id,

          scadenza_id:
            riga.id,

          operatore_responsabile_id:
            operatore.id,

          alert_numero:
            Number(
              riga.numero_alert_inviati ||
                0
            ) + 1,

          giorni_preavviso:
            Math.max(
              differenzaGiorni(
                riga.data_scadenza,
                oggi
              ),
              0
            ),

          data_programmata:
            riga.prossimo_alert_at ||
            adesso,

          canale:
            "email",

          destinatario_email:
            operatore.email,

          esito:
            "in_lavorazione",

          tipo_alert:
            alert.tipoAlert,

          chiave_invio:
            alert.chiaveInvio,
        })
        .select("id")
        .maybeSingle();

      if (prenotazioneError) {
        /*
         * Codice PostgreSQL 23505:
         * alert già prenotato o inviato.
         */
        if (
          prenotazioneError.code ===
          "23505"
        ) {
          saltati += 1;

          dettagli.push({
            scadenza_id:
              riga.id,
            ok: true,
            messaggio:
              "Alert già processato",
          });

          continue;
        }

        throw prenotazioneError;
      }

      const nomeOperatore =
        [
          operatore.nome,
          operatore.cognome,
        ]
          .filter(Boolean)
          .join(" ");

      const urlApplicazione =
        process.env
          .NEXT_PUBLIC_APP_URL ||
        process.env
          .NEXT_PUBLIC_SITE_URL ||
        "https://studio-manager-pro.vercel.app";

      const link =
        riga.link_dettaglio
          ? `${urlApplicazione}${riga.link_dettaglio}`
          : `${urlApplicazione}/scadenze`;

      const html = `
        <div style="font-family:Arial,sans-serif;font-size:14px;color:#111827;line-height:1.55">
          <h2 style="margin-bottom:8px;color:#1d4ed8">
            ${alert.intestazione}
          </h2>

          <p>
            Ciao <strong>${nomeOperatore}</strong>,
          </p>

          <p>
            è presente una scadenza assegnata a te che richiede attenzione.
          </p>

          <table style="border-collapse:collapse;width:100%;max-width:700px">
            <tr>
              <td style="padding:7px;border:1px solid #d1d5db"><strong>Modulo</strong></td>
              <td style="padding:7px;border:1px solid #d1d5db">${riga.origine_modulo}</td>
            </tr>

            <tr>
              <td style="padding:7px;border:1px solid #d1d5db"><strong>Oggetto</strong></td>
              <td style="padding:7px;border:1px solid #d1d5db">${riga.titolo}</td>
            </tr>

            <tr>
              <td style="padding:7px;border:1px solid #d1d5db"><strong>Data di scadenza</strong></td>
              <td style="padding:7px;border:1px solid #d1d5db">
                ${formattaDataItaliana(
                  riga.data_scadenza
                )}
              </td>
            </tr>

            ${
              riga.descrizione
                ? `
                  <tr>
                    <td style="padding:7px;border:1px solid #d1d5db"><strong>Descrizione</strong></td>
                    <td style="padding:7px;border:1px solid #d1d5db">${riga.descrizione}</td>
                  </tr>
                `
                : ""
            }
          </table>

          <p style="margin-top:20px">
            <a
              href="${link}"
              style="display:inline-block;padding:10px 16px;border-radius:6px;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:bold"
            >
              Apri la scadenza
            </a>
          </p>

          ${
            alert.tipoAlert ===
            "scadenza_superata"
              ? `
                <p style="color:#b91c1c;font-weight:bold">
                  Il promemoria verrà ripetuto ogni 5 giorni fino alla chiusura o all’annullamento della scadenza.
                </p>
              `
              : ""
          }

          <p style="margin-top:24px;font-size:12px;color:#6b7280">
            Comunicazione automatica di Studio Manager Pro.
          </p>
        </div>
      `;

      const text = `
${alert.intestazione}

Operatore: ${nomeOperatore}
Modulo: ${riga.origine_modulo}
Oggetto: ${riga.titolo}
Data di scadenza: ${formattaDataItaliana(
        riga.data_scadenza
      )}

${riga.descrizione || ""}

Apri la scadenza:
${link}

Studio Manager Pro
Comunicazione automatica.
      `.trim();

    const risultatoInvio =    
  await sendEmailServer({
    senderUserId:
      operatore.id,

    microsoftConnectionId:
      studio.microsoft_connection_id,

    to:
      operatore.email,

    subject:
      alert.oggetto,

    html,
  });

      if (!risultatoInvio.success) {
        errori += 1;

        await supabaseAdmin
          .from(
            "tbscadenze_centrale_alert_log"
          )
          .update({
            esito: "errore",
            errore:
              risultatoInvio.error ||
              "Errore invio email",
          })
          .eq(
            "id",
            logCreato!.id
          );

        dettagli.push({
          scadenza_id:
            riga.id,
          ok: false,
          messaggio:
            risultatoInvio.error ||
            "Errore invio email",
        });

        continue;
      }

      const prossimoAlert =
        calcolaProssimoAlert(
          riga,
          oggi
        );

      await supabaseAdmin
        .from(
          "tbscadenze_centrale_alert_log"
        )
        .update({
          esito: "inviato",
          inviato_at: new Date()
            .toISOString(),
          errore: null,
        })
        .eq(
          "id",
          logCreato!.id
        );

      await supabaseAdmin
        .from(
          "tbscadenze_centrale"
        )
        .update({
          ultimo_alert_inviato_at:
            new Date().toISOString(),

          prossimo_alert_at:
            prossimoAlert,

          numero_alert_inviati:
            Number(
              riga.numero_alert_inviati ||
                0
            ) + 1,

          updated_at:
            new Date().toISOString(),
        })
        .eq("id", riga.id)
        .eq(
          "studio_id",
          riga.studio_id
        );

      inviati += 1;

      dettagli.push({
        scadenza_id:
          riga.id,
        ok: true,
        messaggio:
          "Alert inviato",
      });
    }

    return res.status(
      errori > 0 ? 207 : 200
    ).json({
      ok: errori === 0,
      trovati:
        scadenze?.length || 0,
      inviati,
      saltati,
      errori,
      dettagli,
    });
  } catch (error: any) {
    console.error(
      "Errore processore unico scadenze:",
      error
    );

    return res.status(500).json({
      ok: false,
      error:
        error?.message ||
        "Errore processore unico delle scadenze",
    });
  }
}
