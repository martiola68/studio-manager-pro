import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length).trim()
      : "";

    if (!token) {
      return res.status(401).json({ error: "Token mancante" });
    }

    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: "Sessione non valida" });
    }

    let { data: utente, error: utenteError } = await supabaseAdmin
      .from("tbutenti")
      .select("id, studio_id, email")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!utente && user.email) {
      const fallback = await supabaseAdmin
        .from("tbutenti")
        .select("id, studio_id, email")
        .ilike("email", user.email)
        .maybeSingle();
      utente = fallback.data;
      utenteError = fallback.error;
    }

    if (utenteError || !utente?.studio_id) {
      return res.status(403).json({ error: "Studio utente non disponibile" });
    }

    const studioId = String(utente.studio_id);

    const { data: clienti, error: clientiError } = await supabaseAdmin
      .from("tbclienti")
      .select("id")
      .eq("studio_id", studioId);

    if (clientiError) throw clientiError;

    const clienteIdSet = new Set((clienti || []).map((c: any) => String(c.id)));

    const { data: contratti, error: contrattiError } = await supabaseAdmin
      .from("tbscadaffitti")
      .select("id, cliente_id, studio_id");

    if (contrattiError) throw contrattiError;

    const all = contratti || [];
    const matchingCliente = all.filter((r: any) =>
      clienteIdSet.has(String(r.cliente_id || ""))
    );
    const matchingStudio = all.filter(
      (r: any) => String(r.studio_id || "") === studioId
    );
    const nullStudio = all.filter((r: any) => !r.studio_id);
    const daRiparare = matchingCliente.filter(
      (r: any) => String(r.studio_id || "") !== studioId
    );

    console.info("AFFITTI_DIAGNOSTICA", {
      studioId,
      clientiStudio: clienteIdSet.size,
      contrattiTotali: all.length,
      contrattiConClienteStudio: matchingCliente.length,
      contrattiGiaStudio: matchingStudio.length,
      contrattiStudioNull: nullStudio.length,
      contrattiDaRiparare: daRiparare.length,
    });

    if (clienteIdSet.size === 0 || daRiparare.length === 0) {
      return res.status(200).json({
        repaired: 0,
        studio_id: studioId,
        diagnostics: {
          clientiStudio: clienteIdSet.size,
          contrattiTotali: all.length,
          contrattiConClienteStudio: matchingCliente.length,
          contrattiGiaStudio: matchingStudio.length,
          contrattiStudioNull: nullStudio.length,
          contrattiDaRiparare: daRiparare.length,
        },
      });
    }

    const ids = daRiparare.map((r: any) => String(r.id));
    const batchSize = 100;
    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize);
      const { error: updateError } = await supabaseAdmin
        .from("tbscadaffitti")
        .update({ studio_id: studioId })
        .in("id", batch);

      if (updateError) throw updateError;
    }

    return res.status(200).json({
      repaired: ids.length,
      studio_id: studioId,
      diagnostics: {
        clientiStudio: clienteIdSet.size,
        contrattiTotali: all.length,
        contrattiConClienteStudio: matchingCliente.length,
        contrattiGiaStudio: matchingStudio.length,
        contrattiStudioNull: nullStudio.length,
        contrattiDaRiparare: daRiparare.length,
      },
    });
  } catch (error: any) {
    console.error("Errore ripristino visibilità contratti affitto:", error);
    return res.status(500).json({
      error: error?.message || "Errore durante il ripristino dei contratti",
    });
  }
}
