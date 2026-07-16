import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  createClient,
} from "@supabase/supabase-js";

type TitolareAmlRow = {
  id: string;
  av4_id: string;
  sezione: string | null;
  nome_cognome: string | null;
  codice_fiscale: string | null;
};

function normalizzaCodiceFiscale(
  valore: string | null | undefined
): string {
  return String(valore || "")
    .trim()
    .toUpperCase();
}

function normalizzaNome(
  valore: string | null | undefined
): string {
  return String(valore || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}

function costruisciChiaveSoggetto(
  codiceFiscale: string | null | undefined,
  nome: string | null | undefined
): string {
  const cf =
    normalizzaCodiceFiscale(
      codiceFiscale
    );

  if (cf) {
    return cf;
  }

  return normalizzaNome(nome);
}

export async function GET(
  req: NextRequest,
  context: {
    params: Promise<{
      clienteId: string;
    }>;
  }
) {
  try {
    const {
      clienteId,
    } = await context.params;

    if (!clienteId) {
      return NextResponse.json(
        {
          error: "clienteId mancante",
        },
        {
          status: 400,
        }
      );
    }

    const supabase = createClient(
      process.env
        .NEXT_PUBLIC_SUPABASE_URL!,
      process.env
        .SUPABASE_SERVICE_ROLE_KEY!
    );

    /*
     * Recuperiamo l’ultimo AV4 del cliente.
     *
     * L’ordinamento per created_at permette
     * di utilizzare il dato AML più recente.
     */
    const {
      data: av4,
      error: av4Error,
    } = await supabase
      .from("tbAV4")
      .select(`
        id,
        cliente_id,
        pratica_id,
        stato,
        versione,
        created_at,
        updated_at,
        data_firma,
        data_firma_bis,
        compilato_da_cliente,
        av4_caricato_manualmente
      `)
      .eq("cliente_id", clienteId)
      .order(
        "created_at",
        {
          ascending: false,
        }
      )
      .limit(1)
      .maybeSingle();

    if (av4Error) {
      throw av4Error;
    }

    /*
     * Il cliente può non avere ancora
     * alcun modello AML/AV4.
     */
    if (!av4?.id) {
      return NextResponse.json({
        aml_presente: false,

        av4: null,

        titolari_aml: [],

        numero_titolari_aml: 0,

        messaggio:
          "Nessun modello AV4 presente per il cliente.",
      });
    }

    const {
      data: titolariData,
      error: titolariError,
    } = await supabase
      .from("tbAV4_titolari")
      .select("*")
      .eq("av4_id", av4.id);

    if (titolariError) {
      throw titolariError;
    }

    const titolari =
      (titolariData ||
        []) as TitolareAmlRow[];

    /*
     * Lo stesso soggetto potrebbe comparire
     * più volte o in più sezioni.
     *
     * Lo deduplichiamo mediante:
     * 1. codice fiscale;
     * 2. nominativo normalizzato se manca il CF.
     */
    const titolariMap =
      new Map<string, any>();

    titolari.forEach((riga) => {
      const chiave =
        costruisciChiaveSoggetto(
          riga.codice_fiscale,
          riga.nome_cognome
        );

      if (!chiave) {
        return;
      }

      const esistente =
        titolariMap.get(chiave);

      if (esistente) {
        const sezioni =
          new Set<string>(
            esistente.sezioni || []
          );

        if (riga.sezione) {
          sezioni.add(
            String(riga.sezione)
          );
        }

        titolariMap.set(chiave, {
          ...esistente,

          sezioni:
            Array.from(sezioni),
        });

        return;
      }

      titolariMap.set(chiave, {
        id:
          riga.id,

        chiave_soggetto:
          chiave,

        nome_cognome:
          riga.nome_cognome ||
          "Nominativo non disponibile",

        codice_fiscale:
          normalizzaCodiceFiscale(
            riga.codice_fiscale
          ) || null,

        sezioni:
          riga.sezione
            ? [riga.sezione]
            : [],
      });
    });

    const titolariAml =
      Array.from(
        titolariMap.values()
      ).sort(
        (a, b) =>
          String(a.nome_cognome)
            .localeCompare(
              String(
                b.nome_cognome
              ),
              "it"
            )
      );

    return NextResponse.json({
      aml_presente: true,

      av4: {
        id:
          av4.id,

        pratica_id:
          av4.pratica_id ||
          null,

        stato:
          av4.stato ||
          null,

        versione:
          av4.versione ||
          null,

        data_documento:
          av4.data_firma_bis ||
          av4.data_firma ||
          av4.updated_at ||
          av4.created_at ||
          null,

        compilato_da_cliente:
          av4.compilato_da_cliente ===
          true,

        caricato_manualmente:
          av4
            .av4_caricato_manualmente ===
          true,
      },

      titolari_aml:
        titolariAml,

      numero_titolari_aml:
        titolariAml.length,

      messaggio:
        titolariAml.length === 0
          ? "Il modello AV4 esiste, ma non contiene Titolari Effettivi salvati."
          : null,
    });
  } catch (error: any) {
    console.error(
      "Errore lettura Titolari Effettivi AML:",
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Errore durante la lettura dei Titolari Effettivi AML.",
      },
      {
        status: 500,
      }
    );
  }
}
