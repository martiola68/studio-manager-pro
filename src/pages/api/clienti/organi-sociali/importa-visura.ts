import type {
  NextApiRequest,
  NextApiResponse,
} from "next";

import formidable from "formidable";
import fs from "fs";
import { PDFParse } from "pdf-parse";
import { createClient } from "@supabase/supabase-js";

import {
  parseVisuraRappresentanti,
} from "@/utils/visuraRappresentantiMapper";

import {
  normalizeCF,
  isValidCF,
} from "@/utils/codiceFiscale";

export const config = {
  api: {
    bodyParser: false,
  },
};

type TipoRuoloOrgano =
  | "socio"
  | "amministratore"
  | "amministratore_unico"
  | "amministratore_delegato"
  | "presidente_cda"
  | "consigliere"
  | "liquidatore"
  | "rappresentante_legale"
  | "sindaco_effettivo"
  | "presidente_collegio_sindacale"
  | "sindaco_unico"
  | "sindaco_supplente"
  | "revisore";

type SoggettoVisura = {
  nome_cognome: string;
  codice_fiscale?: string | null;
  qualifica?: string | null;
  tipo_soggetto:
  | "amministratore"
  | "socio"
  | "organo_controllo";

  luogo_nascita?: string | null;
  data_nascita?: string | null;
  citta_residenza?: string | null;
  indirizzo_residenza?: string | null;
  CAP?: string | null;
  nazionalita?: string | null;
};

type ClienteEsistente = {
  id: string;
  ragione_sociale: string | null;
  codice_fiscale: string | null;
  tipo_cliente: string | null;
};

type OrganoEsistente = {
  id: string;
  cliente_id: string;
  soggetto_cliente_id: string | null;
  ruolo: string | null;
  carica: string | null;
  percentuale_partecipazione: number | null;
  attivo: boolean | null;
};

function getServerSupabase() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Variabili Supabase server mancanti"
    );
  }

  return createClient(
    supabaseUrl,
    serviceRoleKey
  );
}

async function extractTextFromPdfBuffer(
  buffer: Buffer
): Promise<string> {
  const parser = new PDFParse({
    data: buffer,
  });

  const result = await parser.getText();

  return result.text || "";
}

function normalizeText(value: unknown): string {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizzaRuolo(
  soggetto: SoggettoVisura
): TipoRuoloOrgano {
  if (soggetto.tipo_soggetto === "socio") {
    return "socio";
  }

  const qualifica = normalizeText(
    soggetto.qualifica
  );

  if (
    qualifica.includes(
      "amministratore unico"
    ) ||
    qualifica.includes(
      "amministratrice unica"
    )
  ) {
    return "amministratore_unico";
  }

  if (
    qualifica.includes(
      "amministratore delegato"
    ) ||
    qualifica.includes(
      "amministratrice delegata"
    )
  ) {
    return "amministratore_delegato";
  }

  if (
    qualifica.includes(
      "presidente del consiglio di amministrazione"
    ) ||
    qualifica === "presidente"
  ) {
    return "presidente_cda";
  }

  if (qualifica.includes("consigliere")) {
    return "consigliere";
  }

  if (qualifica.includes("liquidatore")) {
    return "liquidatore";
  }

  if (
    qualifica.includes(
      "rappresentante dell impresa"
    ) ||
    qualifica.includes(
      "rappresentante legale"
    )
  ) {
    return "rappresentante_legale";
  }

  return "amministratore";
}

function getCaricaVisualizzata(
  soggetto: SoggettoVisura,
  ruolo: TipoRuoloOrgano
): string {
  const qualifica = String(
    soggetto.qualifica || ""
  ).trim();

  if (qualifica) {
    return qualifica;
  }

  const labels: Record<
    TipoRuoloOrgano,
    string
  > = {
    socio: "Socio",
    amministratore: "Amministratore",
    amministratore_unico:
      "Amministratore unico",
    amministratore_delegato:
      "Amministratore delegato",
    presidente_cda: "Presidente CDA",
    consigliere: "Consigliere",
    liquidatore: "Liquidatore",
    rappresentante_legale:
      "Rappresentante legale",
  };

  return labels[ruolo];
}

function dedupeSoggettiRuolo(
  soggetti: Array<
    SoggettoVisura & {
      codice_fiscale_normalizzato: string;
      ruolo_normalizzato: TipoRuoloOrgano;
      carica_normalizzata: string;
    }
  >
) {
  const map = new Map<
    string,
    (typeof soggetti)[number]
  >();

  soggetti.forEach((soggetto) => {
    const chiave = [
      soggetto.codice_fiscale_normalizzato,
      soggetto.ruolo_normalizzato,
    ].join("|");

    if (!map.has(chiave)) {
      map.set(chiave, soggetto);
    }
  });

  return Array.from(map.values());
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Metodo non consentito",
    });
  }

  try {
    const supabase =
      getServerSupabase() as any;

    const { fields, files } =
      await new Promise<{
        fields: formidable.Fields;
        files: formidable.Files;
      }>((resolve, reject) => {
        const form = formidable({
          multiples: false,
        });

        form.parse(
          req,
          (error, parsedFields, parsedFiles) => {
            if (error) {
              reject(error);
              return;
            }

            resolve({
              fields: parsedFields,
              files: parsedFiles,
            });
          }
        );
      });

    const clienteId = Array.isArray(
      fields.clienteId
    )
      ? fields.clienteId[0]
      : fields.clienteId;

    const uploadedFile = Array.isArray(
      files.file
    )
      ? files.file[0]
      : files.file;

    if (
      !clienteId ||
      typeof clienteId !== "string"
    ) {
      return res.status(400).json({
        error: "clienteId mancante",
      });
    }

    if (!uploadedFile?.filepath) {
      return res.status(400).json({
        error: "File PDF mancante",
      });
    }

    /*
     * Verifica che la società destinataria
     * esista realmente.
     */
    const {
      data: societaDestinataria,
      error: societaError,
    } = await supabase
      .from("tbclienti")
      .select(
        "id, ragione_sociale, codice_fiscale"
      )
      .eq("id", clienteId)
      .maybeSingle();

    if (societaError) {
      throw societaError;
    }

    if (!societaDestinataria) {
      return res.status(404).json({
        error: "Società non trovata",
      });
    }

    const buffer = fs.readFileSync(
      uploadedFile.filepath
    );

    const text =
      await extractTextFromPdfBuffer(buffer);

    const parsed =
      parseVisuraRappresentanti(
        text
      ) as SoggettoVisura[];

    /*
     * Per Soci e organi sociali ci interessano
     * entrambe le tipologie:
     *
     * - soci;
     * - amministratori e altre cariche.
     */
    const soggettiConCf = parsed
      .map((soggetto) => {
        const cf = normalizeCF(
          soggetto.codice_fiscale || ""
        );

        const ruolo =
          normalizzaRuolo(soggetto);

        return {
          ...soggetto,

          codice_fiscale_normalizzato:
            cf,

          ruolo_normalizzato:
            ruolo,

          carica_normalizzata:
            getCaricaVisualizzata(
              soggetto,
              ruolo
            ),
        };
      })
      .filter(
        (soggetto) =>
          !!soggetto
            .codice_fiscale_normalizzato &&
          isValidCF(
            soggetto
              .codice_fiscale_normalizzato
          )
      );

    const soggettiUnici =
      dedupeSoggettiRuolo(
        soggettiConCf
      );

    const cfList = Array.from(
      new Set(
        soggettiUnici.map(
          (soggetto) =>
            soggetto
              .codice_fiscale_normalizzato
        )
      )
    );

    /*
     * Cerca le anagrafiche già presenti
     * in tbclienti.
     */
    let clientiEsistenti: ClienteEsistente[] =
      [];

    if (cfList.length > 0) {
      const {
        data: clientiData,
        error: clientiError,
      } = await supabase
        .from("tbclienti")
        .select(
          "id, ragione_sociale, codice_fiscale, tipo_cliente"
        )
        .in("codice_fiscale", cfList);

      if (clientiError) {
        throw clientiError;
      }

      clientiEsistenti =
        (clientiData ||
          []) as ClienteEsistente[];
    }

    const clientiPerCf = new Map<
      string,
      ClienteEsistente
    >();

    clientiEsistenti.forEach(
      (cliente) => {
        const cf = normalizeCF(
          cliente.codice_fiscale || ""
        );

        if (cf) {
          clientiPerCf.set(cf, cliente);
        }
      }
    );

    /*
     * Cerca tutti i record già presenti
     * negli organi della società selezionata.
     */
    const {
      data: organiData,
      error: organiError,
    } = await supabase
      .from("tbclienti_organi")
      .select(`
        id,
        cliente_id,
        soggetto_cliente_id,
        ruolo,
        carica,
        percentuale_partecipazione,
        attivo
      `)
      .eq("cliente_id", clienteId);

    if (organiError) {
      throw organiError;
    }

    const organiEsistenti =
      (organiData ||
        []) as OrganoEsistente[];

    const anteprima =
      soggettiUnici.map(
        (soggetto) => {
          const cf =
            soggetto
              .codice_fiscale_normalizzato;

          const anagraficaEsistente =
            clientiPerCf.get(cf) || null;

          const organoEsistente =
            anagraficaEsistente
              ? organiEsistenti.find(
                  (organo) =>
                    String(
                      organo
                        .soggetto_cliente_id
                    ) ===
                      String(
                        anagraficaEsistente.id
                      ) &&
                    String(
                      organo.ruolo || ""
                    ) ===
                      String(
                        soggetto
                          .ruolo_normalizzato
                      ) &&
                    organo.attivo !== false
                ) || null
              : null;

          let esito:
            | "nuovo_soggetto"
            | "nuovo_ruolo"
            | "gia_presente";

          if (!anagraficaEsistente) {
            esito = "nuovo_soggetto";
          } else if (!organoEsistente) {
            esito = "nuovo_ruolo";
          } else {
            esito = "gia_presente";
          }

          return {
            nome:
              soggetto.nome_cognome,

            codice_fiscale: cf,

            tipo_visura:
              soggetto.tipo_soggetto,

            qualifica_visura:
              soggetto.qualifica || null,

            ruolo:
              soggetto
                .ruolo_normalizzato,

            carica:
              soggetto
                .carica_normalizzata,

            anagrafica_cliente_id:
              anagraficaEsistente?.id ||
              null,

            anagrafica_esistente:
              !!anagraficaEsistente,

            organo_esistente_id:
              organoEsistente?.id ||
              null,

            esito,

            selected:
              esito !== "gia_presente",

            dati_anagrafici: {
              luogo_nascita:
                soggetto.luogo_nascita ||
                null,

              data_nascita:
                soggetto.data_nascita ||
                null,

              citta_residenza:
                soggetto.citta_residenza ||
                null,

              indirizzo_residenza:
                soggetto
                  .indirizzo_residenza ||
                null,

              cap:
                soggetto.CAP || null,

              nazionalita:
                soggetto.nazionalita ||
                null,
            },
          };
        }
      );

    const scartatiSenzaCf =
      parsed.length -
      soggettiConCf.length;

    return res.status(200).json({
      ok: true,
      preview: true,

      societa: {
        id: societaDestinataria.id,
        ragione_sociale:
          societaDestinataria
            .ragione_sociale,

        codice_fiscale:
          societaDestinataria
            .codice_fiscale,
      },

      soggetti: anteprima,

      stats: {
        trovati_nella_visura:
          parsed.length,

        validi_con_codice_fiscale:
          soggettiConCf.length,

        unici_per_cf_e_ruolo:
          soggettiUnici.length,

        nuovi_soggetti:
          anteprima.filter(
            (item) =>
              item.esito ===
              "nuovo_soggetto"
          ).length,

        nuovi_ruoli:
          anteprima.filter(
            (item) =>
              item.esito ===
              "nuovo_ruolo"
          ).length,

        gia_presenti:
          anteprima.filter(
            (item) =>
              item.esito ===
              "gia_presente"
          ).length,

        scartati_senza_cf_valido:
          scartatiSenzaCf,
      },
    });
  } catch (error: any) {
    console.error(
      "Errore anteprima import visura organi sociali:",
      error
    );

    return res.status(500).json({
      error:
        error?.message ||
        "Errore durante la lettura della visura",
    });
  }
}
