import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const supabaseAdmin = getSupabaseAdmin();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Metodo non consentito",
    });
  }

  const {
    gruppo_id,
    richiedente_id,
    data_richiedente,
    sostituto_id,
    data_sostituto,
  } = req.body;

  if (
    !gruppo_id ||
    !richiedente_id ||
    !data_richiedente ||
    !sostituto_id ||
    !data_sostituto
  ) {
    return res.status(400).json({
      error: "Dati cambio turno incompleti",
    });
  }

  if (richiedente_id === sostituto_id) {
    return res.status(400).json({
      error:
        "Il richiedente e il sostituto devono essere diversi",
    });
  }

  const { data: righe, error: readError } =
    await supabaseAdmin
      .from("tbpresenze_smart_calendario")
      .select("*")
      .eq("gruppo_id", gruppo_id)
      .in("utente_id", [
        richiedente_id,
        sostituto_id,
      ])
      .in("data", [
        data_richiedente,
        data_sostituto,
      ]);

  if (readError) {
    return res.status(500).json({
      error: readError.message,
    });
  }

  const presenzaRichiedente = righe?.find(
    (r) =>
      r.utente_id === richiedente_id &&
      r.data === data_richiedente &&
      r.presenza === true
  );

  const presenzaSostituto = righe?.find(
    (r) =>
      r.utente_id === sostituto_id &&
      r.data === data_sostituto &&
      r.presenza === true
  );

  if (!presenzaRichiedente) {
    return res.status(400).json({
      error:
        "Il richiedente non risulta presente nel giorno selezionato",
    });
  }

  if (!presenzaSostituto) {
    return res.status(400).json({
      error:
        "Il sostituto non risulta presente nel giorno selezionato",
    });
  }

  const operazioni = [
    {
      utente_id: richiedente_id,
      data: data_richiedente,
      presenza: false,
      nota: "Cambio turno ceduto",
    },
    {
      utente_id: sostituto_id,
      data: data_richiedente,
      presenza: true,
      nota: "Cambio turno ricevuto",
    },
    {
      utente_id: sostituto_id,
      data: data_sostituto,
      presenza: false,
      nota: "Cambio turno ceduto",
    },
    {
      utente_id: richiedente_id,
      data: data_sostituto,
      presenza: true,
      nota: "Cambio turno ricevuto",
    },
  ];

  for (const op of operazioni) {
    const { error } = await supabaseAdmin
      .from("tbpresenze_smart_calendario")
      .update({
        presenza: op.presenza,
        nota: op.nota,
        generato_auto: false,
      })
      .eq("gruppo_id", gruppo_id)
      .eq("utente_id", op.utente_id)
      .eq("data", op.data);

    if (error) {
      return res.status(500).json({
        error: error.message,
      });
    }
  }

  return res.status(200).json({
    ok: true,
  });
}
