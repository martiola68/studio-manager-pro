import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function nullableText(value: unknown): string | null {
  const valueText = text(value);
  return valueText || null;
}

function bool(value: unknown): boolean {
  return value === true;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ ok: false, error: "Metodo non consentito" });
  }

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRole) {
      return res.status(500).json({ ok: false, error: "Configurazione Supabase server mancante" });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const token = text(body.token);
    const av4Id = text(body.av4_id);
    const payload = body.payload || {};

    if (!token || !av4Id) {
      return res.status(400).json({ ok: false, error: "Token o AV4 mancante" });
    }

    const supabase = createClient(supabaseUrl, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: av4, error: av4Error } = await supabase
      .from("tbAV4")
      .select("id,public_token,public_enabled,compilato_da_cliente")
      .eq("id", av4Id)
      .eq("public_token", token)
      .maybeSingle();

    if (av4Error) {
      return res.status(500).json({ ok: false, error: av4Error.message });
    }

    if (!av4) {
      return res.status(404).json({ ok: false, error: "Link AV4 non valido" });
    }

    if (!av4.public_enabled || av4.compilato_da_cliente) {
      return res.status(409).json({ ok: false, error: "Link AV4 non più attivo" });
    }

    const sezioniDaControllare: Array<"domanda7" | "domanda8" | "domanda9"> = [];
    if (bool(payload.domanda7)) sezioniDaControllare.push("domanda7");
    if (bool(payload.domanda8)) sezioniDaControllare.push("domanda8");
    if (bool(payload.domanda9)) sezioniDaControllare.push("domanda9");

    for (const sezione of sezioniDaControllare) {
      const { data: titolari, error: titolariError } = await supabase
        .from("tbAV4_titolari")
        .select("id,codice_fiscale")
        .eq("av4_id", av4.id)
        .eq("sezione", sezione);

      if (titolariError) {
        return res.status(500).json({ ok: false, error: titolariError.message });
      }

      if (!titolari?.length) {
        return res.status(400).json({
          ok: false,
          error: `Inserire e salvare almeno un titolare effettivo per la sezione ${sezione}.`,
        });
      }

      const senzaCf = titolari.find((row: any) => !text(row?.codice_fiscale));
      if (senzaCf) {
        return res.status(400).json({
          ok: false,
          error: `Codice fiscale obbligatorio per tutti i titolari della sezione ${sezione}.`,
        });
      }
    }

    const submittedAt = new Date().toISOString();

    const updatePayload = {
      natura_prestazione: nullableText(payload.natura_prestazione),

      domanda1: bool(payload.domanda1),
      domanda2: bool(payload.domanda2),
      domanda3: bool(payload.domanda3),
      domanda4: bool(payload.domanda4),
      domanda5: bool(payload.domanda5),
      spec_domanda5: nullableText(payload.spec_domanda5),

      domanda6: bool(payload.domanda6),
      domanda7: bool(payload.domanda7),
      domanda8: bool(payload.domanda8),
      domanda9: bool(payload.domanda9),

      nome_soc: nullableText(payload.nome_soc),
      sede_legale: nullableText(payload.sede_legale),
      indirizzo_sede: nullableText(payload.indirizzo_sede),
      reg_imprese: nullableText(payload.reg_imprese),
      num_reg_imprese: nullableText(payload.num_reg_imprese),
      cod_fiscale_soc: nullableText(payload.cod_fiscale_soc),

      nome_soc_bis: nullableText(payload.nome_soc_bis),
      sede_legale_bis: nullableText(payload.sede_legale_bis),
      indirizzo_sede_bis: nullableText(payload.indirizzo_sede_bis),
      reg_imprese_bis: nullableText(payload.reg_imprese_bis),
      num_reg_imprese_bis: nullableText(payload.num_reg_imprese_bis),
      cod_fiscale_soc_bis: nullableText(payload.cod_fiscale_soc_bis),
      nome_soc_ter: nullableText(payload.nome_soc_ter),

      domanda10: bool(payload.domanda10),
      domanda11: bool(payload.domanda11),
      specifica12: nullableText(payload.specifica12),

      specifica10b: nullableText(payload.specifica10b),
      specifica10c: nullableText(payload.specifica10c),
      specifica11c: nullableText(payload.specifica11c),
      specifica10d: nullableText(payload.specifica10d),
      specifica10e: nullableText(payload.specifica10e),
      specifica10f: nullableText(payload.specifica10f),

      luogo_firma: nullableText(payload.luogo_firma),
      data_firma: nullableText(payload.data_firma),
      luogo_firma_bis: nullableText(payload.luogo_firma_bis),
      data_firma_bis: nullableText(payload.data_firma_bis),
      allegato_pdf_cliente: nullableText(payload.allegato_pdf_cliente),

      compilato_da_cliente: true,
      public_submitted_at: submittedAt,
      public_enabled: false,
      public_token: null,
    };

    const { error: updateError } = await supabase
      .from("tbAV4")
      .update(updatePayload)
      .eq("id", av4.id);

    if (updateError) {
      return res.status(500).json({ ok: false, error: updateError.message });
    }

    return res.status(200).json({
      ok: true,
      submittedAt,
      message: "AV4 completato correttamente",
    });
  } catch (error: any) {
    console.error("API public AV4 save error:", error);
    return res.status(500).json({
      ok: false,
      error: error?.message || "Errore interno server",
    });
  }
}
