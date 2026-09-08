import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabase/admin";

function getBearerToken(req: NextApiRequest): string | null {
  const authHeader = req.headers.authorization || "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) return null;
  return authHeader.slice(7).trim() || null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Metodo non consentito" });
  }

  try {
    const token = getBearerToken(req);
    if (!token) {
      return res.status(401).json({ ok: false, error: "Non autenticato" });
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
    const authUser = authData.user;

    if (authError || !authUser) {
      return res.status(401).json({ ok: false, error: "Sessione non valida" });
    }

    const { data: utente, error: utenteError } = await supabaseAdmin
      .from("tbutenti")
      .select("id, studio_id")
      .or(`user_id.eq.${authUser.id},email.eq.${authUser.email || ""}`)
      .limit(1)
      .maybeSingle();

    if (utenteError || !utente?.studio_id) {
      return res.status(403).json({ ok: false, error: "Studio utente non disponibile" });
    }

    const studioId = utente.studio_id;
    const {
      cliente_id,
      societa_id,
      operatore_responsabile_id,
      data_apertura,
      tipo_prestazione,
      allow_duplicate,
    } = req.body || {};

    if (!cliente_id || !tipo_prestazione || !data_apertura) {
      return res.status(400).json({ ok: false, error: "Dati pratica incompleti" });
    }

    const { data: cliente, error: clienteError } = await supabaseAdmin
      .from("tbclienti")
      .select("id")
      .eq("id", cliente_id)
      .eq("studio_id", studioId)
      .maybeSingle();

    if (clienteError || !cliente?.id) {
      return res.status(403).json({ ok: false, error: "Cliente non appartenente allo studio" });
    }

    if (societa_id) {
      const { data: societa, error: societaError } = await supabaseAdmin
        .from("tbRespAVSocieta")
        .select("id")
        .eq("id", societa_id)
        .eq("studio_id", studioId)
        .maybeSingle();

      if (societaError || !societa?.id) {
        return res.status(403).json({ ok: false, error: "Soggetto responsabile non appartenente allo studio" });
      }
    }

    if (operatore_responsabile_id) {
      const { data: operatore, error: operatoreError } = await supabaseAdmin
        .from("tbutenti")
        .select("id")
        .eq("id", operatore_responsabile_id)
        .eq("studio_id", studioId)
        .maybeSingle();

      if (operatoreError || !operatore?.id) {
        return res.status(403).json({ ok: false, error: "Operatore non appartenente allo studio" });
      }
    }

    const { data: duplicata, error: duplicataError } = await supabaseAdmin
      .from("tbPraticheAML")
      .select("id")
      .eq("studio_id", studioId)
      .eq("cliente_id", cliente_id)
      .eq("tipo_prestazione", tipo_prestazione)
      .eq("data_apertura", data_apertura)
      .limit(1)
      .maybeSingle();

    if (duplicataError) throw duplicataError;

    if (duplicata?.id && !allow_duplicate) {
      return res.status(409).json({
        ok: false,
        duplicate: true,
        error: "Esiste già una pratica con lo stesso cliente, la stessa prestazione e la stessa data di apertura.",
      });
    }

    const { data: praticaData, error: praticaError } = await supabaseAdmin
      .from("tbPraticheAML")
      .insert({
        studio_id: studioId,
        cliente_id,
        societa_id: societa_id || null,
        operatore_responsabile_id: operatore_responsabile_id || null,
        data_apertura,
        tipo_prestazione,
        stato: "aperta",
      })
      .select("id")
      .single();

    if (praticaError || !praticaData?.id) {
      throw praticaError || new Error("Errore creazione pratica");
    }

    const praticaId = praticaData.id;

    try {
      const { data: av1Data, error: av1Error } = await supabaseAdmin
        .from("tbAV1")
        .insert({
          studio_id: studioId,
          cliente_id,
          societa_id: societa_id || null,
          pratica_id: praticaId,
          incaricato_adeguata_verifica_id: null,
          DataVerifica: data_apertura,
          ScadenzaVerifica: null,
          AV1Conferma: false,
          AV2Generato: true,
          AV4Generato: true,
          Prestazione: tipo_prestazione,
        })
        .select("id")
        .single();

      if (av1Error || !av1Data?.id) {
        throw av1Error || new Error("Errore creazione AV1");
      }

      const av1Id = av1Data.id;

      const { data: av2Data, error: av2Error } = await supabaseAdmin
        .from("tbAV2")
        .insert({
          studio_id: studioId,
          cliente_id,
          societa_id: societa_id || null,
          pratica_id: praticaId,
          av1_id: av1Id,
        })
        .select("id")
        .single();

      if (av2Error || !av2Data?.id) {
        throw av2Error || new Error("Errore creazione AV2");
      }

      const { data: av4Data, error: av4Error } = await supabaseAdmin
        .from("tbAV4")
        .insert({
          studio_id: studioId,
          cliente_id,
          societa_id: societa_id || null,
          pratica_id: praticaId,
          av1_id: av1Id,
          stato: "bozza",
        })
        .select("id")
        .single();

      if (av4Error || !av4Data?.id) {
        throw av4Error || new Error("Errore creazione AV4");
      }
    } catch (childError) {
      await supabaseAdmin.from("tbPraticheAML").delete().eq("id", praticaId);
      throw childError;
    }

    return res.status(200).json({ ok: true, id: praticaId });
  } catch (error: any) {
    console.error("Errore API creazione pratica AML:", error);
    return res.status(500).json({ ok: false, error: error?.message || "Errore creazione pratica AML" });
  }
}
