import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    if (req.method === "GET") {
    const {
  studio_id,
  cliente_id,
  software_contabile,
} = req.query;

if (
  typeof software_contabile !== "string" ||
  !software_contabile
) {
  return res.status(400).json({
    success: false,
    error: "software_contabile obbligatorio",
  });
}

      if (typeof studio_id !== "string" || !studio_id) {
        return res.status(400).json({
          success: false,
          error: "studio_id obbligatorio",
        });
      }

      if (typeof cliente_id !== "string" || !cliente_id) {
        return res.status(400).json({
          success: false,
          error: "cliente_id obbligatorio",
        });
      }

      /*
       * 1. Recuperiamo il template associato al cliente.
       */
      const { data: cliente, error: clienteError } =
        await supabaseAdmin
          .from("tbclienti")
          .select(`
            id,
            studio_id,
            controllo_gestione_template_id
          `)
          .eq("id", cliente_id)
          .eq("studio_id", studio_id)
          .maybeSingle();

      if (clienteError) throw clienteError;

      if (!cliente) {
        return res.status(404).json({
          success: false,
          error: "Cliente non trovato nello studio",
        });
      }

      /*
       * 2. Se il cliente non ha ancora un template associato,
       *    proviamo a usare il template predefinito dello studio.
       */
      let templateId =
        cliente.controllo_gestione_template_id || null;

      if (!templateId) {
        const { data: templateDefault, error: templateError } =
          await supabaseAdmin
            .from("tbcontrollo_gestione_template")
            .select("id")
            .eq("studio_id", studio_id)
            .eq(
              "software_contabile",
              String(software_contabile || "datev_koinos")
            )
            .eq("predefinito", true)
            .eq("attivo", true)
            .maybeSingle();

        if (templateError) throw templateError;

        templateId = templateDefault?.id || null;
      }

      /*
       * 3. Carichiamo le mappature del template.
       */
      let templateMappings: any[] = [];

      if (templateId) {
       const { data, error } = await supabaseAdmin
  .from("tbcontrollo_gestione_template_conti")
  .select(`
    id,
    template_id,
    codice_conto,
    descrizione_conto,
    voce_id,
    voce_id_negativo,
    moltiplicatore,
    escluso,
    created_at,
    updated_at
  `)
          .eq("template_id", templateId)
          .order("codice_conto", {
            ascending: true,
          });

        if (error) throw error;

        templateMappings = data || [];
      }

      /*
       * 4. Carichiamo eventuali eccezioni specifiche
       *    della singola società.
       *
       * Per ora esistono ancora anche le vecchie
       * mappature di HAPPY: le leggiamo come eccezioni.
       */
      const {
        data: clienteMappings,
        error: clienteMappingsError,
      } = await supabaseAdmin
        .from("tbcontrollo_gestione_mappatura_conti")
        .select(`
          id,
          studio_id,
          cliente_id,
          software_contabile,
          codice_conto,
          descrizione_conto,
          voce_id,
          moltiplicatore,
          escluso,
          origine,
          confermato,
          ultimo_utilizzo,
          created_at,
          updated_at,
          voce:tbcontrollo_gestione_voci (
            id,
            codice,
            descrizione,
            sezione,
            macrovoce,
            natura,
            ordine
          )
        `)
        .eq("studio_id", studio_id)
        .eq("cliente_id", cliente_id)
        .eq(
          "software_contabile",
          String(software_contabile || "datev_koinos")
        );

      if (clienteMappingsError) {
        throw clienteMappingsError;
      }

      /*
       * 5. Merge:
       *
       * template
       * +
       * eccezione cliente
       *
       * Se lo stesso codice esiste in entrambi,
       * vince il cliente.
       */
      const mappingMap = new Map<string, any>();

      for (const row of templateMappings) {
        mappingMap.set(row.codice_conto, {
          ...row,

          studio_id,
          cliente_id,
          software_contabile,

          origine_effettiva: "template_studio",
        });
      }

      for (const row of clienteMappings || []) {
        mappingMap.set(row.codice_conto, {
          ...row,

          origine_effettiva: "cliente",
        });
      }

      const merged = Array.from(
        mappingMap.values()
      ).sort((a, b) =>
        String(a.codice_conto).localeCompare(
          String(b.codice_conto),
          "it",
          {
            numeric: true,
          }
        )
      );

      return res.status(200).json({
        success: true,

        template_id: templateId,

        data: merged,
      });
    }

    if (req.method === "POST") {
   const {
  studio_id,
  cliente_id,
  software_contabile,

  codice_conto,
  descrizione_conto,

  voce_id,
  voce_id_negativo = null,

  moltiplicatore = 1,
  escluso = false,

  ambito = "template",
} = req.body;

      if (!studio_id) {
        return res.status(400).json({
          success: false,
          error: "studio_id obbligatorio",
        });
      }

     if (!cliente_id) {
  return res.status(400).json({
    success: false,
    error: "cliente_id obbligatorio",
  });
}

if (!software_contabile) {
  return res.status(400).json({
    success: false,
    error: "software_contabile obbligatorio",
  });
}

if (!codice_conto) {
        return res.status(400).json({
          success: false,
          error: "codice_conto obbligatorio",
        });
      }

      if (
        ambito !== "template" &&
        ambito !== "cliente"
      ) {
        return res.status(400).json({
          success: false,
          error:
            "ambito deve essere 'template' oppure 'cliente'",
        });
      }

      if (!escluso && !voce_id) {
        return res.status(400).json({
          success: false,
          error:
            "Se il conto non è escluso devi indicare la voce di riclassificazione",
        });
      }

      /*
       * Verifica cliente.
       */
      const { data: cliente, error: clienteError } =
        await supabaseAdmin
          .from("tbclienti")
          .select(`
            id,
            studio_id,
            controllo_gestione_template_id
          `)
          .eq("id", cliente_id)
          .eq("studio_id", studio_id)
          .maybeSingle();

      if (clienteError) throw clienteError;

      if (!cliente) {
        return res.status(404).json({
          success: false,
          error: "Cliente non trovato nello studio",
        });
      }

      /*
       * ==========================================
       * SALVATAGGIO NEL TEMPLATE
       * ==========================================
       */
      if (ambito === "template") {
        let templateId =
          cliente.controllo_gestione_template_id || null;

        /*
         * Se il cliente non ha ancora template,
         * cerchiamo quello predefinito dello studio.
         */
        if (!templateId) {
          const {
            data: templateDefault,
            error: templateError,
          } = await supabaseAdmin
            .from("tbcontrollo_gestione_template")
            .select("id")
            .eq("studio_id", studio_id)
            .eq(
              "software_contabile",
              software_contabile
            )
            .eq("predefinito", true)
            .eq("attivo", true)
            .maybeSingle();

          if (templateError) {
            throw templateError;
          }

          templateId =
            templateDefault?.id || null;
        }

        if (!templateId) {
          return res.status(400).json({
            success: false,
            error:
              "Nessun template contabile disponibile per questo studio",
          });
        }

        /*
         * Se il cliente non era ancora associato,
         * lo colleghiamo al template.
         */
        if (
          !cliente.controllo_gestione_template_id
        ) {
          const { error: updateClienteError } =
            await supabaseAdmin
              .from("tbclienti")
              .update({
                controllo_gestione_template_id:
                  templateId,
              })
              .eq("id", cliente_id)
              .eq("studio_id", studio_id);

          if (updateClienteError) {
            throw updateClienteError;
          }
        }

      const payload = {
  template_id: templateId,

  codice_conto:
    String(codice_conto).trim(),

  descrizione_conto:
    descrizione_conto != null
      ? String(descrizione_conto).trim()
      : null,

  voce_id:
    escluso
      ? null
      : voce_id,

  voce_id_negativo:
    escluso
      ? null
      : voce_id_negativo || null,

  moltiplicatore:
    Number(moltiplicatore || 1),

  escluso: Boolean(escluso),

  updated_at:
    new Date().toISOString(),
};
       const { data, error } =
  await supabaseAdmin
    .from(
      "tbcontrollo_gestione_template_conti"
    )
    .upsert(payload, {
      onConflict:
        "template_id,codice_conto",
    })
    .select("*")
    .single();

        if (error) throw error;

        return res.status(200).json({
          success: true,

          ambito: "template",

          template_id: templateId,

          data,
        });
      }

      /*
       * ==========================================
       * ECCEZIONE PER SINGOLA SOCIETÀ
       * ==========================================
       */
      const payload = {
        studio_id,
        cliente_id,
        software_contabile,

        codice_conto:
          String(codice_conto).trim(),

        descrizione_conto:
          descrizione_conto != null
            ? String(
                descrizione_conto
              ).trim()
            : null,

        voce_id:
          escluso
            ? null
            : voce_id,

        moltiplicatore:
          Number(moltiplicatore || 1),

        escluso: Boolean(escluso),

        origine: "manuale",

        confermato: true,

        ultimo_utilizzo:
          new Date().toISOString(),

        updated_at:
          new Date().toISOString(),
      };

      const { data, error } =
        await supabaseAdmin
          .from(
            "tbcontrollo_gestione_mappatura_conti"
          )
          .upsert(payload, {
            onConflict:
              "studio_id,cliente_id,software_contabile,codice_conto",
          })
         .select("*")
.single();

      if (error) throw error;

      return res.status(200).json({
        success: true,

        ambito: "cliente",

        data,
      });
    }

    return res.status(405).json({
      success: false,
      error: "Metodo non consentito",
    });
  } catch (error: any) {
    console.error(
      "Errore API controllo-gestione/mappatura-conti:",
      error
    );

    return res.status(500).json({
      success: false,
      error:
        error?.message ||
        "Errore interno server",
    });
  }
}
