import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function mapRappresentante(row: any) {
  if (!row) return null;
  return {
    id: row.id,
    nome_cognome:
      [text(row.cognome), text(row.nome)].filter(Boolean).join(" ") ||
      text(row.ragione_sociale),
    codice_fiscale: row.codice_fiscale || null,
    luogo_nascita: row.luogo_nascita || null,
    data_nascita: row.data_nascita || null,
    indirizzo_residenza: row.indirizzo || null,
    citta_residenza: row.citta || null,
    cap_residenza: row.cap || null,
    nazionalita: row.nazionalita || null,
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ ok: false, error: "Metodo non consentito" });
  }

  const token = text(req.query.token);
  if (!token) {
    return res.status(400).json({ ok: false, error: "Token AV4 mancante" });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRole) {
    return res.status(500).json({ ok: false, error: "Configurazione Supabase server mancante" });
  }

  const supabase = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const { data: av4, error: av4Error } = await supabase
      .from("tbAV4")
      .select("*")
      .eq("public_token", token)
      .maybeSingle();

    if (av4Error) throw av4Error;
    if (!av4) {
      return res.status(404).json({ ok: false, error: "Link AV4 non valido" });
    }

    if (!av4.public_enabled && !av4.compilato_da_cliente) {
      return res.status(403).json({ ok: false, error: "Link AV4 non più attivo" });
    }

    let cliente: any = null;
    if (av4.cliente_id) {
      const { data, error } = await supabase
        .from("tbclienti")
        .select("*")
        .eq("id", av4.cliente_id)
        .maybeSingle();
      if (error) throw error;
      cliente = data || null;
    }

    let rappresentante: any = null;
    if (av4.soggetto_cliente_id) {
      const { data, error } = await supabase
        .from("tbclienti")
        .select("id,nome,cognome,ragione_sociale,codice_fiscale,luogo_nascita,data_nascita,indirizzo,citta,cap,nazionalita")
        .eq("id", av4.soggetto_cliente_id)
        .maybeSingle();
      if (error) throw error;
      rappresentante = mapRappresentante(data);
    }

    const { data: titolari, error: titolariError } = await supabase
      .from("tbAV4_titolari")
      .select("*")
      .eq("av4_id", av4.id)
      .order("id", { ascending: true });

    if (titolariError) throw titolariError;

    return res.status(200).json({
      ok: true,
      av4,
      cliente,
      rappresentante,
      titolari: titolari || [],
    });
  } catch (error: any) {
    console.error("Errore stampa AV4 pubblico:", error);
    return res.status(500).json({
      ok: false,
      error: error?.message || "Errore caricamento stampa AV4 pubblico",
    });
  }
}
