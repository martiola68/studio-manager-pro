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
      })
      .select("*")
      .single();

    if (gruppoError) {
      return res.status(500).json({
        error: gruppoError.message,
      });
    }

    if (utenti.length > 0) {
      const rows = utenti.map((utente_id: string, index: number) => ({
        gruppo_id: gruppo.id,
        utente_id,
        ordine: index,
      }));

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
