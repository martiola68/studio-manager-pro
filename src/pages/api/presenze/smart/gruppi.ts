import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const supabaseAdmin = getSupabaseAdmin();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === "GET") {
    const enhanced = await supabaseAdmin
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

    if (!enhanced.error) {
      return res.status(200).json(enhanced.data || []);
    }

    const legacy = await supabaseAdmin
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

    if (legacy.error) {
      return res.status(500).json({ error: legacy.error.message });
    }

    return res.status(200).json(
      (legacy.data || []).map((gruppo: any) => ({
        ...gruppo,
        scelta_libera: false,
        utenti: (gruppo.utenti || []).map((utente: any) => ({
          ...utente,
          giorni_presenza: null,
        })),
      }))
    );
  }

  if (req.method === "POST" || req.method === "PUT") {
    const {
      gruppo_id,
      settore,
      tipo_rapporto,
      nome_gruppo,
      giorno_fisso,
      presenze_settimanali,
      scelta_libera,
      studio_id,
      utenti,
    } = req.body;

    if (!settore || !nome_gruppo || !studio_id || !Array.isArray(utenti)) {
      return res.status(400).json({
        error: "studio_id, settore, nome_gruppo e utenti sono obbligatori",
      });
    }

    if (req.method === "PUT" && !gruppo_id) {
      return res.status(400).json({ error: "gruppo_id obbligatorio" });
    }

    const gruppoPayload = {
      studio_id,
      settore,
      tipo_rapporto: tipo_rapporto || null,
      nome_gruppo,
      giorno_fisso: giorno_fisso || 2,
      presenze_settimanali: presenze_settimanali || 2,
      scelta_libera: !!scelta_libera,
    };

    let gruppo: any = null;

    if (req.method === "POST") {
      const result = await supabaseAdmin
        .from("tbpresenze_smart_gruppi")
        .insert(gruppoPayload)
        .select("*")
        .single();

      if (result.error) {
        return res.status(500).json({ error: result.error.message });
      }

      gruppo = result.data;
    } else {
      const result = await supabaseAdmin
        .from("tbpresenze_smart_gruppi")
        .update(gruppoPayload)
        .eq("id", gruppo_id)
        .eq("studio_id", studio_id)
        .select("*")
        .single();

      if (result.error) {
        return res.status(500).json({ error: result.error.message });
      }

      gruppo = result.data;

      const { error: deleteUsersError } = await supabaseAdmin
        .from("tbpresenze_smart_gruppi_utenti")
        .delete()
        .eq("gruppo_id", gruppo_id)
        .eq("studio_id", studio_id);

      if (deleteUsersError) {
        return res.status(500).json({ error: deleteUsersError.message });
      }
    }

    if (utenti.length > 0) {
      const rows = utenti.map((item: any, index: number) => {
        const utente_id = typeof item === "string" ? item : item.utente_id;
        const giorni = Array.isArray(item?.giorni_presenza)
          ? item.giorni_presenza.map(Number).filter((g: number) => g >= 1 && g <= 5)
          : null;

        return {
          studio_id,
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
        if (req.method === "POST") {
          await supabaseAdmin
            .from("tbpresenze_smart_gruppi")
            .delete()
            .eq("id", gruppo.id);
        }

        return res.status(500).json({ error: utentiError.message });
      }
    }

    return res.status(200).json(gruppo);
  }

  return res.status(405).json({
    error: "Metodo non consentito",
  });
}
