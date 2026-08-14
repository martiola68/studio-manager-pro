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
        controllo_id,
        import_id,
      } = req.query;

      if (
        typeof studio_id !== "string" ||
        !studio_id
      ) {
        return res.status(400).json({
          success: false,
          error: "studio_id obbligatorio",
        });
      }

      if (
        typeof cliente_id !== "string" ||
        !cliente_id
      ) {
        return res.status(400).json({
          success: false,
          error: "cliente_id obbligatorio",
        });
      }

      if (
        typeof controllo_id !== "string" ||
        !controllo_id
      ) {
        return res.status(400).json({
          success: false,
          error: "controllo_id obbligatorio",
        });
      }

      if (
        typeof import_id !== "string" ||
        !import_id
      ) {
        return res.status(400).json({
          success: false,
          error: "import_id obbligatorio",
        });
      }

      const { data, error } = await supabaseAdmin
        .from("tbcontrollo_gestione_integrazioni")
        .select("*")
        .eq("studio_id", studio_id)
        .eq("cliente_id", cliente_id)
        .eq("controllo_id", controllo_id)
        .eq("import_id", import_id)
        .maybeSingle();

      if (error) {
        throw error;
      }

      const { data: righeFinanziarie, error: righeFinanziarieError } =
  await supabaseAdmin
    .from("tbcontrollo_gestione_import_righe")
    .select(`
      saldo,
      voce:tbcontrollo_gestione_voci!tbcontrollo_gestione_import_righe_voce_id_fkey (
        codice
      )
    `)
    .eq("import_id", import_id)
    .eq("mappata", true)
    .eq("esclusa", false);

if (righeFinanziarieError) {
  throw righeFinanziarieError;
}

const debitiFinanziariContabili = (righeFinanziarie || [])
  .filter((riga: any) => {
    const codice = riga.voce?.codice;

    return (
      codice === "SP_DEBITI_BANCHE_BT" ||
      codice === "SP_DEBITI_BANCHE_MLT"
    );
  })
  .reduce(
    (totale: number, riga: any) =>
      totale + Math.abs(Number(riga.saldo || 0)),
    0
  );

return res.status(200).json({
  success: true,

  data: data || null,

  debiti_finanziari_contabili:
    Math.round(
      (debitiFinanziariContabili + Number.EPSILON) * 100
    ) / 100,
});

} // <-- CHIUDE if (req.method === "GET")

if (req.method === "POST") {
     const {
  studio_id,
  cliente_id,
  controllo_id,
  import_id,

  debiti_finanziari_mlt = 0,
  rate_finanziarie_12_mesi = 0,
  cash_flow_operativo_previsionale = null,

  note = null,
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

      if (!controllo_id) {
        return res.status(400).json({
          success: false,
          error: "controllo_id obbligatorio",
        });
      }

      if (!import_id) {
        return res.status(400).json({
          success: false,
          error: "import_id obbligatorio",
        });
      }

      /*
       * Verifica che import e controllo appartengano
       * davvero allo stesso studio/cliente.
       */
      const {
        data: importRecord,
        error: importError,
      } = await supabaseAdmin
        .from("tbcontrollo_gestione_import")
        .select(`
          id,
          studio_id,
          cliente_id,
          controllo_id
        `)
        .eq("id", import_id)
        .eq("studio_id", studio_id)
        .eq("cliente_id", cliente_id)
        .eq("controllo_id", controllo_id)
        .maybeSingle();

      if (importError) {
        throw importError;
      }

      if (!importRecord) {
        return res.status(404).json({
          success: false,
          error:
            "Import non trovato oppure non appartenente al controllo indicato",
        });
      }

     const mlt = Number(debiti_finanziari_mlt || 0);
const rate = Number(rate_finanziarie_12_mesi || 0);

if (mlt < 0 || rate < 0) {
  return res.status(400).json({
    success: false,
    error:
      "Debiti finanziari M/L e rate non possono essere negativi",
  });
}

/*
 * Calcoliamo il debito finanziario direttamente
 * dall'import contabile.
 */
const {
  data: righeFinanziarie,
  error: righeFinanziarieError,
} = await supabaseAdmin
  .from("tbcontrollo_gestione_import_righe")
  .select(`
    saldo,
    voce:tbcontrollo_gestione_voci!tbcontrollo_gestione_import_righe_voce_id_fkey (
      codice
    )
  `)
  .eq("import_id", import_id)
  .eq("mappata", true)
  .eq("esclusa", false);

if (righeFinanziarieError) {
  throw righeFinanziarieError;
}

const totaleFinanziario = (righeFinanziarie || [])
  .filter((riga: any) => {
    const codice = riga.voce?.codice;

    return (
      codice === "SP_DEBITI_BANCHE_BT" ||
      codice === "SP_DEBITI_BANCHE_MLT"
    );
  })
  .reduce(
    (totale: number, riga: any) =>
      totale + Math.abs(Number(riga.saldo || 0)),
    0
  );

const totaleFinanziarioArrotondato =
  Math.round(
    (totaleFinanziario + Number.EPSILON) * 100
  ) / 100;

if (mlt > totaleFinanziarioArrotondato) {
  return res.status(400).json({
    success: false,
    error:
      "La quota di debiti finanziari oltre 12 mesi non può superare il debito finanziario complessivo risultante dalla contabilità.",
  });
}

const bt =
  Math.round(
    (
      totaleFinanziarioArrotondato -
      mlt +
      Number.EPSILON
    ) * 100
  ) / 100;

      const cashFlow =
        cash_flow_operativo_previsionale === null ||
        cash_flow_operativo_previsionale === "" ||
        cash_flow_operativo_previsionale === undefined
          ? null
          : Number(cash_flow_operativo_previsionale);

      const payload = {
        studio_id,
        cliente_id,
        controllo_id,
        import_id,

        debiti_finanziari_bt: bt,
        debiti_finanziari_mlt: mlt,

        rate_finanziarie_12_mesi: rate,

        cash_flow_operativo_previsionale:
          cashFlow,

        note:
          note != null && String(note).trim()
            ? String(note).trim()
            : null,

        updated_at:
          new Date().toISOString(),
      };

      const { data, error } = await supabaseAdmin
        .from("tbcontrollo_gestione_integrazioni")
        .upsert(payload, {
          onConflict: "import_id",
        })
        .select("*")
        .single();

      if (error) {
        throw error;
      }

      return res.status(200).json({
        success: true,
        data,
      });
    }

    return res.status(405).json({
      success: false,
      error: "Metodo non consentito",
    });
  } catch (error: any) {
    console.error(
      "Errore API controllo-gestione/integrazioni:",
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
