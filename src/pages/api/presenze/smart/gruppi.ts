import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const supabaseAdmin = getSupabaseAdmin();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === "GET") {
    const { data, error } = await supabaseAdmin
      .from("tbpresenze_smart_gruppi")
      .select(`
        *,
        utenti:tbpresenze_smart_gruppi_utenti(
          id,
          utente_id,
          ordine,
          giorni_presenza,
          utente:tbutenti(id, nome, cognome, email, settore, tipo_rapporto)
        )
      `)
      .eq("attivo", true)
      .order("settore", { ascending: true });

    if (error) {
      return res.status(500).json({
        error: error.message,
      });
    }

    return res.status(200).json(data || []);
  }

  if (req.method === "POST") {
    const {
      settore,
      tipo_rapporto,
      nome_gruppo,
      giorno_fisso,
      presenze_settimanali,
      scelta_libera,
      utenti,
    } = req.body;

    if (!settore || !nome_gruppo || !Array.isArray(utenti)) {
      return res.status(400).json({
        error: "settore, nome_gruppo e utenti sono obbligatori",
      });
    }

    const { data: gruppo, error: gruppoError } = await supabaseAdmin
      .from("tbpresenze_smart_gruppi")
      .insert({
        settore,
        tipo_rapporto: tipo_rapporto || null,
        nome_gruppo,
        giorno_fisso: giorno_fisso || 2,
        presenze_settimanali: presenze_settimanali || 2,
        scelta_libera: !!scelta_libera,
      })
      .select("*")
      .single();

    if (gruppoError) {
      return res.status(500).json({
        error: gruppoError.message,
      });
    }

    if (utenti.length > 0) {
      const rows = utenti.map((item: any, index: number) => {
        const utente_id = typeof item === "string" ? item : item.utente_id;
        const giorni = Array.isArray(item?.giorni_presenza)
          ? item.giorni_presenza.map(Number).filter((g: number) => g >= 1 && g <= 5)
          : null;

        return {
          gruppo_id: gruppo.id,
          utente_id,
          ordine: index,
          giorni_presenza: !!scelta_libera ? giorni : null,
        };
      });

      const { error: utentiError } = await supabaseAdmin
        .from("tbpresenze_smart_gruppi_utenti")
        .insert(rows);

      if (utentiError) {
        return res.status(500).json({
          error: utentiError.message,
        });
      }
    }

    return res.status(200).json(gruppo);
  }

  return res.status(405).json({
    error: "Metodo non consentito",
  });
}
