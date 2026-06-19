import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function toDate(date: Date) {
  return date.toISOString().split("T")[0];
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Metodo non consentito" });
  }

  try {
    const oggi = new Date();
    oggi.setHours(0, 0, 0, 0);

    const inizioMese = toDate(new Date(oggi.getFullYear(), oggi.getMonth(), 1));
    const fineMese = toDate(new Date(oggi.getFullYear(), oggi.getMonth() + 1, 0));

    const { data: dipendenti, error } = await supabase
      .from("tbutenti")
      .select("id, nome, cognome, email")
      .eq("attivo", true)
      .eq("tipo_rapporto", "Dipendente")
      .not("email", "is", null);

    if (error) throw error;

    const incompleti: any[] = [];

    for (const dipendente of dipendenti || []) {
      const { count, error: countError } = await supabase
        .from("tbpresenze_dipendenti")
        .select("id", { count: "exact", head: true })
        .eq("utente_id", dipendente.id)
        .gte("data_presenza", inizioMese)
        .lte("data_presenza", fineMese);

      if (countError) throw countError;

     const presenzeCompilate = count || 0;
if (presenzeCompilate >= 4) continue;

const oggiKey = toDate(oggi);

const { count: giorniLavorativiTrascorsi, error: giorniError } = await supabase
  .from("tbpresenze_dipendenti")
  .select("data_presenza", { count: "exact", head: true })
  .eq("utente_id", dipendente.id)
  .gte("data_presenza", inizioMese)
  .lte("data_presenza", oggiKey);

if (giorniError) throw giorniError;

const mancanti = Math.max(
  Number(giorniLavorativiTrascorsi || 0) - presenzeCompilate,
  4 - presenzeCompilate
);

      incompleti.push({
        utente_id: dipendente.id,
        nome: dipendente.nome,
        cognome: dipendente.cognome,
        email: dipendente.email,
        presenze_compilate: presenzeCompilate,
        mancanti,
        livello: mancanti >= 3 ? "urgente" : "normale",
        selezionato: true,
      });
    }

    return res.status(200).json({
      ok: true,
      mese: { inizio: inizioMese, fine: fineMese },
      count: incompleti.length,
      dipendenti: incompleti,
    });
  } catch (error: any) {
    console.error("Errore anteprima solleciti:", error);
    return res.status(500).json({
      ok: false,
      error: error?.message || "Errore anteprima solleciti",
    });
  }
}
