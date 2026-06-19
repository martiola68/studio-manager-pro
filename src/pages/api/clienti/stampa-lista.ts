import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Metodo non consentito" });
    }

    const {
      studio_id,
      utente_operatore_id,
      utente_professionista_id,
      tipo_prestazione_id,
      tipo_redditi,
      settore_fiscale,
      settore_lavoro,
      settore_consulenza,
    } = req.query;

    if (!studio_id || typeof studio_id !== "string") {
      return res.status(400).json({ error: "studio_id mancante" });
    }

    let query = supabase
      .from("tbclienti")
      .select(`
        id,
        cod_cliente,
        ragione_sociale,
        partita_iva,
        codice_fiscale,
        email,
        pec,
        telefono,
        tipo_redditi,
        settore_fiscale,
        settore_lavoro,
        settore_consulenza,
        utente_operatore_id,
        utente_professionista_id,
        tipo_prestazione_id,
        utente_fiscale:tbutenti!tbclienti_utente_operatore_id_fkey(nome, cognome),
        professionista:tbutenti!tbclienti_utente_professionista_id_fkey(nome, cognome),
        prestazione:tbprestazioni!tbclienti_tipo_prestazione_id_fkey(descrizione)
      `)
      .eq("studio_id", studio_id)
      .eq("cliente", true)
      .eq("attivo", true)
      .order("ragione_sociale", { ascending: true });

    if (utente_operatore_id && utente_operatore_id !== "tutti") {
      query = query.eq("utente_operatore_id", String(utente_operatore_id));
    }

    if (utente_professionista_id && utente_professionista_id !== "tutti") {
      query = query.eq("utente_professionista_id", String(utente_professionista_id));
    }

    if (tipo_prestazione_id && tipo_prestazione_id !== "tutti") {
      query = query.eq("tipo_prestazione_id", String(tipo_prestazione_id));
    }

    if (tipo_redditi && tipo_redditi !== "tutti") {
      query = query.eq("tipo_redditi", String(tipo_redditi));
    }

    if (settore_fiscale) {
      query = query.eq("settore_fiscale", settore_fiscale === "true");
    }

    if (settore_lavoro) {
      query = query.eq("settore_lavoro", settore_lavoro === "true");
    }

    if (settore_consulenza) {
      query = query.eq("settore_consulenza", settore_consulenza === "true");
    }

    const { data, error } = await query;

    if (error) {
      console.error("Errore stampa lista clienti:", error);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({
      success: true,
      count: data?.length ?? 0,
      clienti: data ?? [],
    });
  } catch (error: any) {
    console.error("Errore API stampa lista clienti:", error);
    return res.status(500).json({
      error: error?.message || "Errore interno server",
    });
  }
}
