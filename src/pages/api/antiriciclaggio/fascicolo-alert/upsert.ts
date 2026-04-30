import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function prossimoLunediOre9() {
  const now = new Date();
  const result = new Date(now);

  const day = result.getDay();
  const daysUntilMonday = day === 0 ? 1 : 8 - day;

  result.setDate(result.getDate() + daysUntilMonday);
  result.setHours(9, 0, 0, 0);

  return result.toISOString();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Metodo non consentito" });
  }

  try {
    const {
      av1_id,
      pratica_id,
      cliente_id,
      documenti_mancanti,
      documenti_opzionali_mancanti,
      completo,
    } = req.body;

    if (!av1_id && !pratica_id) {
      return res.status(400).json({ error: "Manca av1_id o pratica_id" });
    }

    const studioId = req.headers["x-studio-id"];

    let finalStudioId: string | null = null;
    let finalClienteId: string | null = cliente_id || null;
    let finalSocietaId: string | null = null;

    if (pratica_id) {
      const { data: pratica } = await supabaseAdmin
        .from("tbPraticheAML")
        .select("studio_id, cliente_id, societa_id")
        .eq("id", pratica_id)
        .maybeSingle();

      finalStudioId = pratica?.studio_id || null;
      finalClienteId = finalClienteId || pratica?.cliente_id || null;
      finalSocietaId = pratica?.societa_id || null;
    }

    if (!finalStudioId && av1_id) {
      const { data: av1 } = await supabaseAdmin
        .from("tbAV1")
        .select("studio_id, cliente_id")
        .eq("id", av1_id)
        .maybeSingle();

      finalStudioId = av1?.studio_id || null;
      finalClienteId = finalClienteId || av1?.cliente_id || null;
    }

    if (!finalStudioId) {
      return res.status(400).json({ error: "Studio non trovato" });
    }

    const payload = {
      studio_id: finalStudioId,
      pratica_id: pratica_id || null,
      av1_id: av1_id || null,
      cliente_id: finalClienteId,
      societa_id: finalSocietaId,
      documenti_mancanti: documenti_mancanti || [],
      documenti_opzionali_mancanti: documenti_opzionali_mancanti || [],
      completo: !!completo,
      prossimo_alert_at: completo ? null : prossimoLunediOre9(),
      updated_at: new Date().toISOString(),
    };

    const matchColumn = pratica_id ? "pratica_id" : "av1_id";
    const matchValue = pratica_id || av1_id;

    const { data: existing } = await supabaseAdmin
      .from("tbAVFascicoliAlert")
      .select("id")
      .eq(matchColumn, matchValue)
      .maybeSingle();

    if (existing?.id) {
      const { error } = await supabaseAdmin
        .from("tbAVFascicoliAlert")
        .update(payload)
        .eq("id", existing.id);

      if (error) throw error;
    } else {
      const { error } = await supabaseAdmin
        .from("tbAVFascicoliAlert")
        .insert(payload);

      if (error) throw error;
    }

    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error("Errore upsert alert fascicolo:", err);
    return res.status(500).json({ error: err?.message || "Errore server" });
  }
}
