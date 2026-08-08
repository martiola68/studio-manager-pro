import { createClient } from "@supabase/supabase-js";

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

export type AnomaliaAnagraficaAML = {
  studio_id: string;

  cliente_id: string;
  cliente: string;

  soggetto_cliente_id: string;
  rappresentante: string;
  codice_fiscale: string | null;

  operatore_id: string;
  email_operatore: string;

  email_rappresentante: string | null;

  documento_aml_id: string | null;
  tipo_documento: string | null;
  scadenza_documento: string | null;

  anomalie: string[];
};

export type ReportOperatoreAML = {
  studio_id: string;

  operatore_id: string;
  email_operatore: string;

  anomalie: AnomaliaAnagraficaAML[];
};

function normalizzaEmail(
  value: string | null | undefined
): string {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function emailValida(
  value: string | null | undefined
): boolean {
  const email = normalizzaEmail(value);

  if (!email) {
    return false;
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    email
  );
}

function dataOnly(
  value: string | null | undefined
): Date | null {
  if (!value) {
    return null;
  }

  const raw =
    String(value).includes("T")
      ? String(value).split("T")[0]
      : String(value);

  const parsed =
    new Date(`${raw}T00:00:00`);

  if (
    Number.isNaN(parsed.getTime())
  ) {
    return null;
  }

  return parsed;
}

function oggi(): Date {
  const now = new Date();

  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );
}

function aggiungiGiorni(
  date: Date,
  giorni: number
): Date {
  const result =
    new Date(date);

  result.setDate(
    result.getDate() + giorni
  );

  return result;
}

export async function generaReportQualitaAnagraficheAML(): Promise<
  ReportOperatoreAML[]
> {
  /*
   * =========================================================
   * 1. RAPPRESENTANTI ATTUALI
   * =========================================================
   *
   * La sorgente ufficiale è:
   *
   * tbclienti_organi
   *
   * Devono essere:
   *
   * tipo_ruolo = R
   * principale = true
   * attivo = true
   */
  const {
    data: organi,
    error: organiError,
  } = await supabaseAdmin
    .from("tbclienti_organi")
    .select(`
      id,
      studio_id,
      cliente_id,
      soggetto_cliente_id,
      tipo_ruolo,
      ruolo,
      principale,
      attivo
    `)
    .eq("tipo_ruolo", "R")
    .eq("principale", true)
    .eq("attivo", true)
    .not(
      "soggetto_cliente_id",
      "is",
      null
    );

  if (organiError) {
    throw new Error(
      organiError.message
    );
  }

  if (
    !organi ||
    organi.length === 0
  ) {
    return [];
  }

  /*
   * =========================================================
   * 2. IDS NECESSARI
   * =========================================================
   */
  const clienteIds =
    Array.from(
      new Set(
        organi
          .map((o: any) =>
            String(
              o.cliente_id || ""
            ).trim()
          )
          .filter(Boolean)
      )
    );

  const soggettoIds =
    Array.from(
      new Set(
        organi
          .map((o: any) =>
            String(
              o.soggetto_cliente_id ||
                ""
            ).trim()
          )
          .filter(Boolean)
      )
    );

  /*
   * =========================================================
   * 3. SOCIETÀ / CLIENTI
   * =========================================================
   *
   * Da qui prendiamo:
   *
   * - ragione sociale
   * - utente_operatore_id
   */
  const {
    data: clienti,
    error: clientiError,
  } = await supabaseAdmin
    .from("tbclienti")
    .select(`
      id,
      studio_id,
      ragione_sociale,
      utente_operatore_id,
      attivo
    `)
    .in("id", clienteIds);

  if (clientiError) {
    throw new Error(
      clientiError.message
    );
  }

  const clientiMap =
    new Map<string, any>();

  for (
    const cliente of
      clienti || []
  ) {
    clientiMap.set(
      String(cliente.id),
      cliente
    );
  }

  /*
   * =========================================================
   * 4. ANAGRAFICHE RAPPRESENTANTI
   * =========================================================
   */
  const {
    data: soggetti,
    error: soggettiError,
  } = await supabaseAdmin
    .from("tbclienti")
    .select(`
      id,
      studio_id,
      ragione_sociale,
      codice_fiscale,
      email,
      attivo
    `)
    .in("id", soggettoIds);

  if (soggettiError) {
    throw new Error(
      soggettiError.message
    );
  }

  const soggettiMap =
    new Map<string, any>();

  for (
    const soggetto of
      soggetti || []
  ) {
    soggettiMap.set(
      String(soggetto.id),
      soggetto
    );
  }

  /*
   * =========================================================
   * 5. DOCUMENTI AML
   * =========================================================
   *
   * Prendiamo solamente i documenti attivi.
   */
  const {
    data: documenti,
    error: documentiError,
  } = await supabaseAdmin
    .from(
      "tbclienti_documenti_aml"
    )
    .select(`
      id,
      studio_id,
      soggetto_cliente_id,
      tipo_documento,
      scadenza_documento,
      attivo,
      updated_at
    `)
    .eq("attivo", true)
    .in(
      "soggetto_cliente_id",
      soggettoIds
    )
    .order(
      "updated_at",
      {
        ascending: false,
      }
    );

  if (documentiError) {
    throw new Error(
      documentiError.message
    );
  }

  /*
   * Un solo documento AML attivo
   * per soggetto.
   *
   * Se per errore ce ne fossero più
   * di uno prendiamo quello aggiornato
   * più recentemente.
   */
  const documentiMap =
    new Map<string, any>();

  for (
    const documento of
      documenti || []
  ) {
    const soggettoId =
      String(
        documento.soggetto_cliente_id ||
          ""
      );

    if (
      soggettoId &&
      !documentiMap.has(
        soggettoId
      )
    ) {
      documentiMap.set(
        soggettoId,
        documento
      );
    }
  }

  /*
   * =========================================================
   * 6. OPERATORI
   * =========================================================
   */
  const operatoreIds =
    Array.from(
      new Set(
        (clienti || [])
          .map((c: any) =>
            String(
              c.utente_operatore_id ||
                ""
            ).trim()
          )
          .filter(Boolean)
      )
    );

  const operatoriMap =
    new Map<string, any>();

  if (
    operatoreIds.length > 0
  ) {
    const {
      data: operatori,
      error: operatoriError,
    } = await supabaseAdmin
      .from("tbutenti")
      .select(`
        id,
        studio_id,
        email,
        attivo
      `)
      .in(
        "id",
        operatoreIds
      );

    if (operatoriError) {
      throw new Error(
        operatoriError.message
      );
    }

    for (
      const operatore of
        operatori || []
    ) {
      operatoriMap.set(
        String(operatore.id),
        operatore
      );
    }
  }

  /*
   * =========================================================
   * 7. CONTROLLO ANOMALIE
   * =========================================================
   */
  const today =
    oggi();

  const limite60 =
    aggiungiGiorni(
      today,
      60
    );

  const anomalieTrovate:
    AnomaliaAnagraficaAML[] =
      [];

  for (
    const organo of
      organi
  ) {
    const clienteId =
      String(
        organo.cliente_id || ""
      );

    const soggettoId =
      String(
        organo.soggetto_cliente_id ||
          ""
      );

    const cliente =
      clientiMap.get(
        clienteId
      );

    const soggetto =
      soggettiMap.get(
        soggettoId
      );

    /*
     * Se per qualche motivo manca
     * l'anagrafica base non procediamo.
     */
    if (
      !cliente ||
      !soggetto
    ) {
      continue;
    }

    const operatoreId =
      String(
        cliente.utente_operatore_id ||
          ""
      ).trim();

    /*
     * Cliente senza operatore:
     * per ora non inviamo nulla.
     *
     * Questo potrà diventare in futuro
     * un controllo qualità separato.
     */
    if (!operatoreId) {
      continue;
    }

    const operatore =
      operatoriMap.get(
        operatoreId
      );

    if (
      !operatore ||
      operatore.attivo === false
    ) {
      continue;
    }

    const emailOperatore =
      normalizzaEmail(
        operatore.email
      );

    if (
      !emailValida(
        emailOperatore
      )
    ) {
      continue;
    }

    const documento =
      documentiMap.get(
        soggettoId
      ) || null;

    const anomalie: string[] =
      [];

    /*
     * EMAIL
     */
    const emailRappresentante =
      normalizzaEmail(
        soggetto.email
      );

    if (
      !emailRappresentante
    ) {
      anomalie.push(
        "EMAIL_MANCANTE"
      );
    } else if (
      !emailValida(
        emailRappresentante
      )
    ) {
      anomalie.push(
        "EMAIL_NON_VALIDA"
      );
    }

    /*
     * DOCUMENTO
     */
    if (
      documento?.scadenza_documento
    ) {
      const scadenza =
        dataOnly(
          documento.scadenza_documento
        );

      if (scadenza) {
        if (
          scadenza < today
        ) {
          anomalie.push(
            "DOCUMENTO_SCADUTO"
          );
        } else if (
          scadenza <= limite60
        ) {
          anomalie.push(
            "DOCUMENTO_IN_SCADENZA_60_GIORNI"
          );
        }
      }
    }

    /*
     * Per questa prima versione
     * non segnaliamo documento mancante:
     * il problema è già gestito dal
     * processo automatico documentale.
     */

    if (
      anomalie.length === 0
    ) {
      continue;
    }

    anomalieTrovate.push({
      studio_id:
        String(
          organo.studio_id
        ),

      cliente_id:
        clienteId,

      cliente:
        String(
          cliente.ragione_sociale ||
            ""
        ),

      soggetto_cliente_id:
        soggettoId,

      rappresentante:
        String(
          soggetto.ragione_sociale ||
            ""
        ),

      codice_fiscale:
        soggetto.codice_fiscale ||
        null,

      operatore_id:
        operatoreId,

      email_operatore:
        emailOperatore,

      email_rappresentante:
        emailRappresentante ||
        null,

      documento_aml_id:
        documento?.id || null,

      tipo_documento:
        documento
          ?.tipo_documento ||
        null,

      scadenza_documento:
        documento
          ?.scadenza_documento ||
        null,

      anomalie,
    });
  }

  /*
   * =========================================================
   * 8. RAGGRUPPAMENTO PER OPERATORE
   * =========================================================
   *
   * studio_id + operatore_id
   *
   * perché Studio Manager Pro
   * è multi-studio.
   */
  const gruppi =
    new Map<
      string,
      ReportOperatoreAML
    >();

  for (
    const anomalia of
      anomalieTrovate
  ) {
    const key =
      `${anomalia.studio_id}::${anomalia.operatore_id}`;

    if (
      !gruppi.has(key)
    ) {
      gruppi.set(
        key,
        {
          studio_id:
            anomalia.studio_id,

          operatore_id:
            anomalia.operatore_id,

          email_operatore:
            anomalia.email_operatore,

          anomalie: [],
        }
      );
    }

    gruppi
      .get(key)!
      .anomalie
      .push(anomalia);
  }

  /*
   * Ordinamento leggibile
   * dentro ogni report.
   */
  for (
    const gruppo of
      gruppi.values()
  ) {
    gruppo.anomalie.sort(
      (a, b) => {
        const clienteCompare =
          a.cliente.localeCompare(
            b.cliente,
            "it",
            {
              sensitivity:
                "base",
            }
          );

        if (
          clienteCompare !== 0
        ) {
          return clienteCompare;
        }

        return a.rappresentante.localeCompare(
          b.rappresentante,
          "it",
          {
            sensitivity:
              "base",
          }
        );
      }
    );
  }

  return Array.from(
    gruppi.values()
  );
}
