import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { mapVisuraText } from "@/utils/visuraMapper";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Metodo non consentito" });
  }

  try {
    const { studio_id, text } = req.body as {
      studio_id?: string;
      text?: string;
    };

    if (!studio_id) {
      return res.status(400).json({ ok: false, error: "studio_id mancante" });
    }

    if (!text || !text.trim()) {
      return res.status(400).json({ ok: false, error: "Testo visura mancante" });
    }

    const mapped = mapVisuraText(text);

    const clienteCF = mapped.cliente.codice_fiscale?.trim();
    const clientePI = mapped.cliente.partita_iva?.trim();
    const rappCF = mapped.rappresentante.codice_fiscale?.trim();

    let existingCliente: any = null;
    if (clienteCF || clientePI) {
      const { data } = await supabase
        .from("tbclienti")
        .select("id, ragione_sociale, codice_fiscale, partita_iva, rapp_legale_id")
        .eq("studio_id", studio_id)
        .or(
          [
            clienteCF ? `codice_fiscale.eq.${clienteCF}` : null,
            clientePI ? `partita_iva.eq.${clientePI}` : null,
          ]
            .filter(Boolean)
            .join(",")
        )
        .maybeSingle();

      existingCliente = data || null;
    }

    let rappLegaleId: string | null = null;
    let existingRapp: any = null;

    if (rappCF) {
      const { data } = await supabase
        .from("rapp_legali")
        .select("id, nome_cognome, codice_fiscale")
        .eq("studio_id", studio_id)
        .eq("codice_fiscale", rappCF)
        .maybeSingle();

      existingRapp = data || null;

      if (existingRapp?.id) {
        rappLegaleId = existingRapp.id;
      } else {
        const { data: insertedRapp, error: insertRappError } = await supabase
          .from("rapp_legali")
          .insert([
            {
              studio_id,
              nome_cognome: mapped.rappresentante.nome_cognome || null,
              codice_fiscale: mapped.rappresentante.codice_fiscale || null,
              luogo_nascita: mapped.rappresentante.luogo_nascita || null,
              data_nascita: mapped.rappresentante.data_nascita || null,
              citta_residenza: mapped.rappresentante.citta_residenza || null,
              indirizzo_residenza: mapped.rappresentante.indirizzo_residenza || null,
              CAP: mapped.rappresentante.CAP || null,
            },
          ])
          .select("id")
          .single();

        if (insertRappError) {
          return res.status(400).json({
            ok: false,
            error: insertRappError.message || "Errore inserimento rappresentante legale",
          });
        }

        rappLegaleId = insertedRapp.id;
      }
    }

    return res.status(200).json({
      ok: true,
      mapped,
      duplicate_cliente: !!existingCliente,
      existing_cliente: existingCliente,
      duplicate_rapp_legale: !!existingRapp,
      rapp_legale_id: rappLegaleId,
      cliente_prefill: {
        ...mapped.cliente,
        rapp_legale_id: rappLegaleId,
      },
    });
  } catch (error: any) {
    return res.status(500).json({
      ok: false,
      error: error?.message || "Errore import visura",
    });
  }
}
