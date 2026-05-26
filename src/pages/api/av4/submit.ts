import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Metodo non consentito." });
  }

  try {
    const { token, av4_id, payload, rapp_legale_id } = req.body || {};

    if (!token || !av4_id || !payload) {
      return res.status(400).json({
        ok: false,
        error: "Dati mancanti.",
      });
    }

    const { data: av4, error: checkError } = await supabaseAdmin
      .from("tbAV4")
      .select("id")
      .eq("id", av4_id)
      .eq("public_token", token)
      .eq("public_enabled", true)
      .maybeSingle();

    if (checkError) {
      console.error("Errore verifica AV4 pubblico:", checkError);
      return res.status(500).json({
        ok: false,
        error: "Errore durante la verifica del modulo.",
      });
    }

    if (!av4) {
      return res.status(403).json({
        ok: false,
        error: "Link non valido o già utilizzato.",
      });
    }

    const updatePayload = {
      ...payload,
      compilato_da_cliente: true,
      public_submitted_at: new Date().toISOString(),
      public_enabled: false,
    };

    delete updatePayload.public_token;

    const { error: updateError } = await supabaseAdmin
      .from("tbAV4")
      .update(updatePayload)
      .eq("id", av4_id)
      .eq("public_token", token)
      .eq("public_enabled", true);

    if (updateError) {
      console.error("Errore aggiornamento tbAV4:", updateError);
      return res.status(500).json({
        ok: false,
        error: "Errore durante il salvataggio del modulo.",
      });
    }

    if (rapp_legale_id) {
      const { error: rappError } = await supabaseAdmin
        .from("rapp_legali")
        .update({
          indirizzo_residenza: payload.dichiarante_indirizzo_residenza,
          citta_residenza: payload.dichiarante_citta_residenza,
          CAP: payload.dichiarante_cap_residenza,
          nazionalita: payload.dichiarante_nazionalita,
        })
        .eq("id", rapp_legale_id);

      if (rappError) {
        console.error("Errore aggiornamento rapp_legali:", rappError);
        return res.status(500).json({
          ok: false,
          error: "Modulo salvato, ma errore aggiornando il rappresentante legale.",
        });
      }
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Errore API AV4 submit:", error);
    return res.status(500).json({
      ok: false,
      error: "Errore interno durante il salvataggio.",
    });
  }
}
