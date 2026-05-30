import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const supabaseAdmin = getSupabaseAdmin();

function weekday(date: string) {
  return new Date(`${date}T00:00:00`).getDay();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Metodo non consentito" });
  }

  const { gruppo_id, richiedente_id, data_richiedente } = req.body;

  if (!gruppo_id || !richiedente_id || !data_richiedente) {
    return res.status(400).json({ error: "Dati richiesta incompleti" });
  }

  if (weekday(data_richiedente) === 2) {
    return res.status(400).json({
      error: "Il martedì non può essere oggetto di cambio turno",
    });
  }

  const { data: presenza, error: presenzaError } = await supabaseAdmin
    .from("tbpresenze_smart_calendario")
    .select("*")
    .eq("gruppo_id", gruppo_id)
    .eq("utente_id", richiedente_id)
    .eq("data", data_richiedente)
    .eq("presenza", true)
    .eq("festivo", false)
    .maybeSingle();

  if (presenzaError) {
    return res.status(500).json({ error: presenzaError.message });
  }

  if (!presenza) {
    return res.status(400).json({
      error: "Il richiedente non risulta presente nel giorno selezionato",
    });
  }

  const { data: richiestaAperta, error: apertaError } = await supabaseAdmin
    .from("tbpresenze_smart_cambi_turno")
    .select("id")
    .eq("gruppo_id", gruppo_id)
    .eq("stato", "aperta")
    .maybeSingle();

  if (apertaError) {
    return res.status(500).json({ error: apertaError.message });
  }

  if (richiestaAperta) {
    return res.status(400).json({
      error: "Esiste già una richiesta cambio aperta per questo gruppo",
    });
  }

  const { data: richiesta, error } = await supabaseAdmin
    .from("tbpresenze_smart_cambi_turno")
    .insert({
      gruppo_id,
      richiedente_id,
      data_richiedente,
      stato: "aperta",
    })
    .select("*")
    .single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ ok: true, richiesta });
}
