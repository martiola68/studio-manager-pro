import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const supabaseAdmin = getSupabaseAdmin();

function getWeekRange(dateString: string) {
  const date = new Date(`${dateString}T00:00:00`);
  const day = date.getDay() || 7;

  const monday = new Date(date);
  monday.setDate(date.getDate() - day + 1);

  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);

  const format = (d: Date) => d.toISOString().slice(0, 10);

  return {
    start: format(monday),
    end: format(friday),
  };
}

function weekday(dateString: string) {
  return new Date(`${dateString}T00:00:00`).getDay();
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

  const { richiesta_id, sostituto_id, data_sostituto } = req.body;

  if (!richiesta_id || !sostituto_id || !data_sostituto) {
    return res.status(400).json({
      error: "Dati cambio turno incompleti",
    });
  }

  if (weekday(data_sostituto) === 2) {
    return res.status(400).json({
      error: "Il martedì non può essere usato come giorno sostituto",
    });
  }

  const { data: richiesta, error: richiestaError } = await supabaseAdmin
    .from("tbpresenze_smart_cambi_turno")
    .select("*")
    .eq("id", richiesta_id)
    .eq("stato", "aperta")
    .maybeSingle();

  if (richiestaError) {
    return res.status(500).json({ error: richiestaError.message });
  }

  if (!richiesta) {
    return res.status(400).json({
      error: "Richiesta cambio non trovata o già gestita",
    });
  }

  if (richiesta.richiedente_id === sostituto_id) {
    return res.status(400).json({
      error: "Il sostituto deve essere diverso dal richiedente",
    });
  }

  if (weekday(richiesta.data_richiedente) === 2) {
    return res.status(400).json({
      error: "Il martedì non può essere oggetto di cambio turno",
    });
  }

  const week = getWeekRange(richiesta.data_richiedente);

  if (data_sostituto < week.start || data_sostituto > week.end) {
    return res.status(400).json({
      error: "Il giorno del sostituto deve essere nella stessa settimana",
    });
  }

  const { data: righe, error: readError } = await supabaseAdmin
    .from("tbpresenze_smart_calendario")
    .select("*")
    .eq("gruppo_id", richiesta.gruppo_id)
    .in("utente_id", [richiesta.richiedente_id, sostituto_id])
    .in("data", [richiesta.data_richiedente, data_sostituto]);

  if (readError) {
    return res.status(500).json({ error: readError.message });
  }

  const presenzaRichiedente = righe?.find(
    (r) =>
      r.utente_id === richiesta.richiedente_id &&
      r.data === richiesta.data_richiedente &&
      r.presenza === true &&
      r.festivo === false
  );

  const presenzaSostituto = righe?.find(
    (r) =>
      r.utente_id === sostituto_id &&
      r.data === data_sostituto &&
      r.presenza === true &&
      r.festivo === false
  );

  if (!presenzaRichiedente) {
    return res.status(400).json({
      error: "Il richiedente non risulta presente nel giorno richiesto",
    });
  }

  if (!presenzaSostituto) {
    return res.status(400).json({
      error: "Il sostituto non risulta presente nel giorno selezionato",
    });
  }

  const operazioni = [
    {
      utente_id: richiesta.richiedente_id,
      data: richiesta.data_richiedente,
      presenza: false,
      nota: "Cambio turno ceduto",
    },
    {
      utente_id: sostituto_id,
      data: richiesta.data_richiedente,
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
      utente_id: richiesta.richiedente_id,
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
      .eq("gruppo_id", richiesta.gruppo_id)
      .eq("utente_id", op.utente_id)
      .eq("data", op.data);

    if (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  const { error: updateRichiestaError } = await supabaseAdmin
    .from("tbpresenze_smart_cambi_turno")
    .update({
      stato: "accettata",
      sostituto_id,
      data_sostituto,
      accettata_il: new Date().toISOString(),
    })
    .eq("id", richiesta.id)
    .eq("stato", "aperta");

  if (updateRichiestaError) {
    return res.status(500).json({
      error: updateRichiestaError.message,
    });
  }

  return res.status(200).json({
    ok: true,
  });
}
