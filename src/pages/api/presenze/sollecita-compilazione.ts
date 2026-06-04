import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function toDate(date: Date) {
  return date.toISOString().split("T")[0];
}

function isWeekend(date: Date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "Metodo non consentito",
    });
  }

  try {
    const oggi = new Date();

    const limite = new Date();
    limite.setDate(oggi.getDate() - 4);

    const dataLimite = toDate(limite);

    const { data: dipendenti, error } = await supabase
      .from("tbutenti")
      .select("id, nome, cognome, email")
      .eq("attivo", true)
      .eq("tipo_rapporto", "Dipendente");

    if (error) throw error;

    const daSollecitare = [];

    for (const dipendente of dipendenti || []) {
      let nonCompilato = false;

      for (
        let d = new Date(2026, 3, 1);
        d <= limite;
        d.setDate(d.getDate() + 1)
      ) {
        if (isWeekend(d)) continue;

        const data = toDate(d);

        const { data: presenza } = await supabase
          .from("tbpresenze_dipendenti")
          .select("id")
          .eq("utente_id", dipendente.id)
          .eq("data_presenza", data)
          .maybeSingle();

        if (!presenza) {
          nonCompilato = true;
          break;
        }
      }

      if (!nonCompilato) continue;
      if (!dipendente.email) continue;

      daSollecitare.push({
        id: dipendente.id,
        nome: dipendente.nome,
        cognome: dipendente.cognome,
        email: dipendente.email,
      });
    }

    return res.status(200).json({
      ok: true,
      dataLimite,
      count: daSollecitare.length,
      dipendenti: daSollecitare,
    });
  } catch (error: any) {
    console.error(error);

    return res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
}
