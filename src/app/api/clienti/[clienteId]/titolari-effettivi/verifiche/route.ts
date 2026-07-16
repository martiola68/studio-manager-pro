import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  createClient,
} from "@supabase/supabase-js";

type EsitoConfronto =
  | "non_verificato"
  | "ok"
  | "solo_soci"
  | "solo_aml"
  | "contrastante";

type RigaConfrontoPayload = {
  chiave_soggetto: string;

  nome_soci: string | null;
  nome_aml: string | null;

  codice_fiscale_soci: string | null;
  codice_fiscale_aml: string | null;

  presente_soci: boolean;
  presente_aml: boolean;

  esito: EsitoConfronto;
};

type TitolareSociPayload = {
  persona_id: string;
  persona_nome: string;
  codice_fiscale: string | null;

  criterio_titolarita:
    | "proprieta"
    | "residuale";

  tipo_titolarita:
    | "diretta"
    | "indiretta"
    | "mista"
    | "residuale";

  quota_diretta: number;
  quota_indiretta: number;
  quota_complessiva: number;

  valido_dal: string | null;
  valido_al: string | null;

  chiave_soggetto: string;

  percorsi: unknown[];
};

type PayloadVerifica = {
  data_riferimento: string;

  criterio_utilizzato:
    | "proprieta"
    | "residuale";

  titolari_soci: TitolareSociPayload[];

  dati_aml: {
    aml_presente: boolean;

    av4: {
      id: string;
      pratica_id: string | null;
      stato: string | null;
      versione: number | null;
      data_documento: string | null;
    } | null;

    titolari_aml: unknown[];
  } | null;

  righe_confronto:
    RigaConfrontoPayload[];

  variazione_rilevata: boolean;
  data_variazione: string | null;

  note?: string | null;
};

function calcolaEsitoGenerale(
  righe: RigaConfrontoPayload[]
): EsitoConfronto {
  if (righe.length === 0) {
    return "non_verificato";
  }

  if (
    righe.some(
      (riga) =>
        riga.esito === "contrastante"
    )
  ) {
    return "contrastante";
  }

  const haSoloSoci =
    righe.some(
      (riga) =>
        riga.esito === "solo_soci"
    );

  const haSoloAml =
    righe.some(
      (riga) =>
        riga.esito === "solo_aml"
    );

  /*
   * Se esistono contemporaneamente soggetti
   * solo in Soci e soggetti solo in AML,
   * il quadro generale è contrastante.
   */
  if (haSoloSoci && haSoloAml) {
    return "contrastante";
  }

  if (haSoloSoci) {
    return "solo_soci";
  }

  if (haSoloAml) {
    return "solo_aml";
  }

  return "ok";
}

export async function POST(
  req: NextRequest,
  context: {
    params: Promise<{
      clienteId: string;
    }>;
  }
) {
  const supabase = createClient(
    process.env
      .NEXT_PUBLIC_SUPABASE_URL!,
    process.env
      .SUPABASE_SERVICE_ROLE_KEY!
  );

  let verificaCreataId:
    string | null = null;

  try {
    const {
      clienteId,
    } = await context.params;

    if (!clienteId) {
      return NextResponse.json(
        {
          error:
            "clienteId mancante",
        },
        {
          status: 400,
        }
      );
    }

    const payload =
      (await req.json()) as PayloadVerifica;

    if (
      !payload.data_riferimento ||
      !/^\d{4}-\d{2}-\d{2}$/.test(
        payload.data_riferimento
      )
    ) {
      return NextResponse.json(
        {
          error:
            "data_riferimento non valida",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !Array.isArray(
        payload.titolari_soci
      )
    ) {
      return NextResponse.json(
        {
          error:
            "titolari_soci non validi",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !Array.isArray(
        payload.righe_confronto
      )
    ) {
      return NextResponse.json(
        {
          error:
            "righe_confronto non valide",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Recuperiamo lo studio direttamente
     * dal cliente per evitare che venga
     * passato dal browser.
     */
    const {
      data: cliente,
      error: clienteError,
    } = await supabase
      .from("tbclienti")
      .select(`
        id,
        studio_id,
        ragione_sociale
      `)
      .eq("id", clienteId)
      .maybeSingle();

    if (clienteError) {
      throw clienteError;
    }

    if (!cliente) {
      return NextResponse.json(
        {
          error:
            "Cliente non trovato",
        },
        {
          status: 404,
        }
      );
    }

    if (!cliente.studio_id) {
      return NextResponse.json(
        {
          error:
            "studio_id mancante nel cliente",
        },
        {
          status: 400,
        }
      );
    }

    const esitoGenerale =
      calcolaEsitoGenerale(
        payload.righe_confronto
      );

    /*
     * Creazione testata della verifica.
     */
    const {
      data: verifica,
      error: verificaError,
    } = await supabase
      .from(
        "tbverifiche_titolare_effettivo"
      )
      .insert({
        studio_id:
          cliente.studio_id,

        cliente_id:
          clienteId,

        data_riferimento:
          payload.data_riferimento,

        data_verifica:
          new Date().toISOString(),

        stato:
          "confermata",

        esito_confronto:
          esitoGenerale,

        variazione_rilevata:
          payload.variazione_rilevata ===
          true,

        data_variazione:
          payload.data_variazione ||
          null,

        note:
          payload.note || null,

        snapshot_soci:
          payload.titolari_soci,

        snapshot_aml:
          payload.dati_aml || {
            aml_presente: false,
            av4: null,
            titolari_aml: [],
          },
      })
      .select(`
        id,
        cliente_id,
        data_riferimento,
        data_verifica,
        stato,
        esito_confronto,
        variazione_rilevata,
        data_variazione
      `)
      .single();

    if (verificaError) {
      throw verificaError;
    }

    verificaCreataId =
      verifica.id;

    const sociMap =
      new Map<
        string,
        TitolareSociPayload
      >();

    payload.titolari_soci.forEach(
      (titolare) => {
        sociMap.set(
          titolare.chiave_soggetto,
          titolare
        );
      }
    );

    /*
     * Prepariamo una riga storica per
     * ogni soggetto presente nel confronto.
     */
    const righeDaInserire =
      payload.righe_confronto.map(
        (riga) => {
          const titolareSoci =
            sociMap.get(
              riga.chiave_soggetto
            );

          return {
            verifica_id:
              verifica.id,

            chiave_soggetto:
              riga.chiave_soggetto,

            persona_id:
              titolareSoci
                ?.persona_id ||
              null,

            persona_nome:
              riga.nome_soci ||
              riga.nome_aml ||
              "Nominativo non disponibile",

            codice_fiscale:
              riga
                .codice_fiscale_soci ||
              riga
                .codice_fiscale_aml ||
              null,

            criterio_titolarita:
              titolareSoci
                ?.criterio_titolarita ||
              null,

            tipo_titolarita:
              titolareSoci
                ?.tipo_titolarita ||
              null,

            quota_diretta:
              Number(
                titolareSoci
                  ?.quota_diretta ||
                  0
              ),

            quota_indiretta:
              Number(
                titolareSoci
                  ?.quota_indiretta ||
                  0
              ),

            quota_complessiva:
              Number(
                titolareSoci
                  ?.quota_complessiva ||
                  0
              ),

            valido_dal:
              titolareSoci
                ?.valido_dal ||
              null,

            valido_al:
              titolareSoci
                ?.valido_al ||
              null,

            presente_soci:
              riga.presente_soci,

            presente_aml:
              riga.presente_aml,

            esito_confronto:
              riga.esito,

            percorsi:
              titolareSoci
                ?.percorsi ||
              [],
          };
        }
      );

    if (
      righeDaInserire.length > 0
    ) {
      const {
        error: righeError,
      } = await supabase
        .from(
          "tbverifiche_titolare_effettivo_righe"
        )
        .insert(
          righeDaInserire
        );

      if (righeError) {
        throw righeError;
      }
    }

    return NextResponse.json({
      success: true,

      verifica: {
        ...verifica,

        numero_righe:
          righeDaInserire.length,
      },
    });
  } catch (error: any) {
    console.error(
      "Errore conferma verifica TE:",
      error
    );

    /*
     * Se la testata è stata creata ma
     * l'inserimento delle righe fallisce,
     * eliminiamo la testata incompleta.
     */
    if (verificaCreataId) {
      await supabase
        .from(
          "tbverifiche_titolare_effettivo"
        )
        .delete()
        .eq(
          "id",
          verificaCreataId
        );
    }

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Errore durante il salvataggio della verifica.",
      },
      {
        status: 500,
      }
    );
  }
}
