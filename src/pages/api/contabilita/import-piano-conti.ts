import type {
  NextApiRequest,
  NextApiResponse,
} from "next";

import { supabaseAdmin } from "@/lib/supabase/admin";

type ContoImportato = {
  codice_conto: string;
  descrizione_conto: string;
  codice_padre?: string | null;
};

type ImportPianoContiBody = {
  studio_id: string;

  /*
   * Nuova architettura.
   */
  piano_conti_id?: string;

  /*
   * Compatibilità temporanea con
   * il frontend precedente.
   *
   * Quando avremo migrato la pagina
   * potremo eliminarlo.
   */
  template_id?: string;

  conti: ContoImportato[];
};

function normalizeCodice(
  value: unknown
) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, "");
}

function normalizeDescrizione(
  value: unknown
) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    if (req.method !== "POST") {
      res.setHeader(
        "Allow",
        "POST"
      );

      return res.status(405).json({
        success: false,
        error:
          "Metodo non consentito",
      });
    }

    const {
      studio_id,
      piano_conti_id,
      template_id,
      conti,
    } =
      req.body as ImportPianoContiBody;

    if (!studio_id) {
      return res.status(400).json({
        success: false,
        error:
          "studio_id obbligatorio",
      });
    }

    /*
     * Durante la migrazione accettiamo
     * entrambi i nomi.
     *
     * Il valore rappresenta comunque
     * SEMPRE l'id del nuovo Piano Master.
     */
    const pianoId =
      String(
        piano_conti_id ||
          template_id ||
          ""
      ).trim();

    if (!pianoId) {
      return res.status(400).json({
        success: false,
        error:
          "piano_conti_id obbligatorio",
      });
    }

    if (
      !Array.isArray(conti) ||
      conti.length === 0
    ) {
      return res.status(400).json({
        success: false,
        error:
          "Nessun conto da importare",
      });
    }

    /*
     * =====================================================
     * 1. VERIFICA PIANO MASTER
     * =====================================================
     *
     * Il piano deve appartenere
     * allo stesso studio.
     */
    const {
      data: piano,
      error: pianoError,
    } = await supabaseAdmin
      .from(
        "tbcontabilita_piani_conti"
      )
      .select(`
        id,
        studio_id,
        nome,
        software_contabile,
        codice_piano,
        attivo
      `)
      .eq(
        "id",
        pianoId
      )
      .eq(
        "studio_id",
        studio_id
      )
      .maybeSingle();

    if (pianoError) {
      throw pianoError;
    }

    if (!piano) {
      return res.status(404).json({
        success: false,
        error:
          "Piano dei conti Master non trovato nello studio",
      });
    }

    if (!piano.attivo) {
      return res.status(400).json({
        success: false,
        error:
          "Il Piano dei conti Master selezionato non è attivo",
      });
    }

    /*
     * =====================================================
     * 2. NORMALIZZAZIONE
     * =====================================================
     *
     * codice_conto rimane SEMPRE text.
     */
    const normalizzati =
      conti
        .map((conto) => ({
          codice_conto:
            normalizeCodice(
              conto.codice_conto
            ),

          descrizione_conto:
            normalizeDescrizione(
              conto.descrizione_conto
            ),

          codice_padre:
            conto.codice_padre
              ? normalizeCodice(
                  conto.codice_padre
                )
              : null,
        }))
        .filter(
          (conto) =>
            conto.codice_conto &&
            conto.descrizione_conto
        );

    /*
     * =====================================================
     * 3. DEDUPE FILE
     * =====================================================
     *
     * Se lo stesso codice appare più volte,
     * utilizziamo l'ultima occorrenza.
     */
    const fileMap = new Map<
      string,
      ContoImportato
    >();

    for (
      const conto of normalizzati
    ) {
      fileMap.set(
        conto.codice_conto,
        conto
      );
    }

    const contiFile =
      Array.from(
        fileMap.values()
      );

    if (
      contiFile.length === 0
    ) {
      return res.status(400).json({
        success: false,
        error:
          "Il file non contiene conti validi con codice e descrizione",
      });
    }

    /*
     * =====================================================
     * 4. CONTI GIÀ PRESENTI NEL MASTER
     * =====================================================
     */
    const {
      data: esistenti,
      error: esistentiError,
    } = await supabaseAdmin
      .from(
        "tbcontabilita_piano_conti_voci"
      )
      .select(`
        id,
        studio_id,
        piano_conti_id,
        codice_conto,
        descrizione_conto,
        codice_padre,
        voce_smp_id,
        voce_smp_id_negativo,
        escluso,
        attivo
      `)
      .eq(
        "studio_id",
        studio_id
      )
      .eq(
        "piano_conti_id",
        pianoId
      );

    if (esistentiError) {
      throw esistentiError;
    }

    const esistentiMap =
      new Map(
        (esistenti || []).map(
          (conto) => [
            normalizeCodice(
              conto.codice_conto
            ),
            conto,
          ]
        )
      );

    /*
     * =====================================================
     * 5. ANALISI DIFFERENZE
     * =====================================================
     */
    const nuovi:
      ContoImportato[] = [];

    const giaPresenti: Array<{
      codice_conto: string;
      descrizione_conto: string;
      classificato: boolean;
      escluso: boolean;
    }> = [];

    const descrizioniCambiate:
      Array<{
        codice_conto: string;

        descrizione_precedente:
          string | null;

        descrizione_nuova:
          string;
      }> = [];

    for (
      const conto of contiFile
    ) {
      const esistente =
        esistentiMap.get(
          conto.codice_conto
        );

      if (!esistente) {
        nuovi.push(conto);
        continue;
      }

      const descrizionePrecedente =
        normalizeDescrizione(
          esistente
            .descrizione_conto
        );

      if (
        descrizionePrecedente !==
        conto.descrizione_conto
      ) {
        descrizioniCambiate.push(
          {
            codice_conto:
              conto.codice_conto,

            descrizione_precedente:
              esistente
                .descrizione_conto,

            descrizione_nuova:
              conto.descrizione_conto,
          }
        );
      }

      giaPresenti.push({
        codice_conto:
          conto.codice_conto,

        descrizione_conto:
          conto.descrizione_conto,

        classificato:
          Boolean(
            esistente
              .voce_smp_id
          ),

        escluso:
          Boolean(
            esistente.escluso
          ),
      });
    }

    /*
     * =====================================================
     * 6. INSERIMENTO NUOVI CONTI
     * =====================================================
     *
     * I nuovi conti entrano nel Master
     * senza classificazione.
     */
    if (nuovi.length > 0) {
      const now =
        new Date()
          .toISOString();

      const rows =
        nuovi.map(
          (conto) => ({
            studio_id,

            piano_conti_id:
              pianoId,

            codice_conto:
              conto.codice_conto,

            descrizione_conto:
              conto
                .descrizione_conto,

            codice_padre:
              conto.codice_padre ||
              null,

            voce_smp_id:
              null,

            voce_smp_id_negativo:
              null,

            escluso:
              false,

            attivo:
              true,

            updated_at:
              now,
          })
        );

      const BATCH_SIZE = 500;

      for (
        let i = 0;
        i < rows.length;
        i += BATCH_SIZE
      ) {
        const batch =
          rows.slice(
            i,
            i + BATCH_SIZE
          );

        const {
          error,
        } = await supabaseAdmin
          .from(
            "tbcontabilita_piano_conti_voci"
          )
          .upsert(
            batch,
            {
              onConflict:
                "piano_conti_id,codice_conto",

              ignoreDuplicates:
                true,
            }
          );

        if (error) {
          throw error;
        }
      }
    }

    /*
     * =====================================================
     * 7. AGGIORNAMENTO DESCRIZIONI / GERARCHIA
     * =====================================================
     *
     * ATTENZIONE:
     *
     * NON tocchiamo:
     * - voce_smp_id
     * - voce_smp_id_negativo
     * - escluso
     *
     * quindi la riclassificazione Master
     * rimane intatta.
     */
    for (
      const conto of contiFile
    ) {
      const esistente =
        esistentiMap.get(
          conto.codice_conto
        );

      if (!esistente) {
        continue;
      }

      const {
        error,
      } = await supabaseAdmin
        .from(
          "tbcontabilita_piano_conti_voci"
        )
        .update({
          descrizione_conto:
            conto
              .descrizione_conto,

          codice_padre:
            conto.codice_padre ||
            null,

          attivo:
            true,

          updated_at:
            new Date()
              .toISOString(),
        })
        .eq(
          "studio_id",
          studio_id
        )
        .eq(
          "piano_conti_id",
          pianoId
        )
        .eq(
          "codice_conto",
          conto.codice_conto
        );

      if (error) {
        throw error;
      }
    }

    /*
     * =====================================================
     * 8. CONTI NON PRESENTI NEL NUOVO FILE
     * =====================================================
     *
     * NON vengono cancellati.
     */
    const codiciFile =
      new Set(
        contiFile.map(
          (conto) =>
            conto.codice_conto
        )
      );

    const nonPresentiNelFile =
      (esistenti || [])
        .filter(
          (conto) =>
            !codiciFile.has(
              normalizeCodice(
                conto.codice_conto
              )
            )
        )
        .map(
          (conto) => ({
            codice_conto:
              conto.codice_conto,

            descrizione_conto:
              conto
                .descrizione_conto,
          })
        );

    /*
     * =====================================================
     * 9. CONTEGGI MASTER DOPO SINCRONIZZAZIONE
     * =====================================================
     */
    const {
      count: totaleMaster,
      error: totaleError,
    } = await supabaseAdmin
      .from(
        "tbcontabilita_piano_conti_voci"
      )
      .select(
        "id",
        {
          count: "exact",
          head: true,
        }
      )
      .eq(
        "studio_id",
        studio_id
      )
      .eq(
        "piano_conti_id",
        pianoId
      )
      .eq(
        "attivo",
        true
      );

    if (totaleError) {
      throw totaleError;
    }

    const {
      count: classificatiMaster,
      error:
        classificatiError,
    } = await supabaseAdmin
      .from(
        "tbcontabilita_piano_conti_voci"
      )
      .select(
        "id",
        {
          count: "exact",
          head: true,
        }
      )
      .eq(
        "studio_id",
        studio_id
      )
      .eq(
        "piano_conti_id",
        pianoId
      )
      .eq(
        "attivo",
        true
      )
      .not(
        "voce_smp_id",
        "is",
        null
      );

    if (classificatiError) {
      throw classificatiError;
    }

    const totale =
      totaleMaster || 0;

    const classificati =
      classificatiMaster || 0;

    /*
     * =====================================================
     * 10. RISPOSTA
     * =====================================================
     */
    return res.status(200).json({
      success: true,

      piano: {
        id:
          piano.id,

        nome:
          piano.nome,

        software_contabile:
          piano
            .software_contabile,

        codice_piano:
          piano.codice_piano,
      },

      /*
       * Alias temporaneo per non rompere
       * eventuale frontend vecchio che
       * legge ancora "template".
       */
      template: {
        id:
          piano.id,

        nome:
          piano.nome,

        software_contabile:
          piano
            .software_contabile,
      },

      riepilogo: {
        righe_file:
          conti.length,

        conti_validi:
          contiFile.length,

        gia_presenti:
          giaPresenti.length,

        nuovi:
          nuovi.length,

        descrizioni_aggiornate:
          descrizioniCambiate.length,

        non_presenti_nel_file:
          nonPresentiNelFile.length,

        totale_master:
          totale,

        classificati:
          classificati,

        da_classificare:
          Math.max(
            totale -
              classificati,
            0
          ),
      },

      nuovi,

      gia_presenti:
        giaPresenti,

      descrizioni_cambiate:
        descrizioniCambiate,

      non_presenti_nel_file:
        nonPresentiNelFile,
    });
  } catch (error: any) {
    console.error(
      "Errore import Piano dei Conti Master:",
      error
    );

    return res.status(500).json({
      success: false,

      error:
        error?.message ||
        "Errore interno durante l'importazione del piano dei conti",
    });
  }
}
