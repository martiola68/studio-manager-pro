import { checkAmlLicense } from "@/lib/aml/checkLicense";
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { verifyAV7AccessProof } from "@/lib/aml/av7AccessProof";
import { mesiControlloAV7, calcolaScadenzaAV7 } from "@/lib/aml/scadenzaAV7";

const ESITI = new Set([
  "nessuna_variazione", "variazione_titolare_ppe", "variazione_rischio",
  "variazione_entrambi", "aggiornamento_dati", "approfondimento",
]);

const isDate = (value: unknown): value is string =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(value + "T12:00:00Z"));

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Metodo non consentito" });
  }

  try {
    const authHeader = String(req.headers.authorization || "");
    const token = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
    if (!token) return res.status(401).json({ error: "Autenticazione richiesta" });

    const { data: auth, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !auth.user) return res.status(401).json({ error: "Sessione non valida" });

    // Non accettare utenti disattivati e non scegliere utenti di altri studi
    // tramite una condizione OR che ignora la priorità dello user_id Auth.
    let { data: user, error: userError } = await supabaseAdmin
      .from("tbutenti")
      .select("id, studio_id")
      .eq("user_id", auth.user.id)
      .eq("attivo", true)
      .limit(1)
      .maybeSingle();

    if (!user && !userError && auth.user.email) {
      const fallback = await supabaseAdmin
        .from("tbutenti")
        .select("id, studio_id")
        .ilike("email", auth.user.email)
        .eq("attivo", true)
        .limit(1)
        .maybeSingle();
      user = fallback.data;
      userError = fallback.error;
    }

    if (userError || !user?.studio_id) return res.status(403).json({ error: "Utente attivo dello studio non disponibile" });

    const authorized=await checkAmlLicense(String(user.studio_id));
    if(!authorized.allowed)return res.status(403).json({error:authorized.reason});
    const praticaId = String((req.method === "GET" ? req.query.pratica_id : req.body?.pratica_id) || "").trim();
    if (!praticaId) return res.status(400).json({ error: "Pratica obbligatoria" });

    const { data: pratica, error: praticaError } = await supabaseAdmin
      .from("tbPraticheAML")
      .select("id, studio_id, cliente_id, societa_id, data_prossimo_rinnovo")
      .eq("id", praticaId)
      .eq("studio_id", user.studio_id)
      .maybeSingle();
    if (praticaError) throw praticaError;
    if (!pratica?.cliente_id || !pratica.societa_id) return res.status(404).json({ error: "Pratica non trovata nello studio" });

    const { data: societa, error: societaError } = await supabaseAdmin
      .from("tbRespAVSocieta")
      .select("id, antiriciclaggio_enabled")
      .eq("id", pratica.societa_id)
      .eq("studio_id", user.studio_id)
      .maybeSingle();
    if (societaError || !societa) return res.status(403).json({ error: "Soggetto AML non autorizzato" });
    if (societa.antiriciclaggio_enabled) {
      const proof = String(req.headers["x-aml-av7-proof"] || "");
      if (!verifyAV7AccessProof(proof, {
        uid: auth.user.id, studio: user.studio_id, societa: pratica.societa_id,
      })) return res.status(403).json({ error: "Sblocca di nuovo il soggetto responsabile dall'elenco AML prima di aprire AV7." });
    }

    // La periodicità è quella già calcolata nell'AV1 corrente.
    // Non si deduce dalla data del vecchio rinnovo: si legge dal modulo valido.
    const { data: dettaglioPratica, error: dettaglioError } = await supabaseAdmin
      .from("tbPraticheAML")
      .select("av1_corrente_id, av1_id")
      .eq("id", praticaId)
      .eq("studio_id", user.studio_id)
      .single();
    if (dettaglioError) throw dettaglioError;
    const av1Id = dettaglioPratica?.av1_corrente_id ?? dettaglioPratica?.av1_id;
    let adeguataVerifica: string | null = null;
    if (av1Id != null) {
      const { data: av1, error: av1Error } = await supabaseAdmin
        .from("tbAV1")
        .select("AdeguataVerifica, AV1Conferma")
        .eq("id", av1Id)
        .eq("pratica_id", praticaId)
        .eq("studio_id", user.studio_id)
        .eq("cliente_id", pratica.cliente_id)
        .maybeSingle();
      if (av1Error) throw av1Error;
      if (av1?.AV1Conferma) adeguataVerifica = av1.AdeguataVerifica || null;
    }
    const periodicitaMesi = mesiControlloAV7(adeguataVerifica);

    if (req.method === "GET") {
      const { data, error } = await supabaseAdmin
        .from("tbAMLControlliCostanti")
        .select("id, data_controllo, esito, verifiche, fonti, note, adeguata_verifica, prossima_scadenza, created_at")
        .eq("studio_id", user.studio_id)
        .eq("pratica_id", praticaId)
        .order("data_controllo", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return res.status(200).json({ ok: true, controlli: data || [], pratica, adeguataVerifica, periodicitaMesi });
    }

    const payload = req.body || {};
    if (!isDate(payload.data_controllo) || payload.data_controllo > new Date().toISOString().slice(0, 10)) {
      return res.status(400).json({ error: "Data del controllo non valida" });
    }
    if (!ESITI.has(payload.esito)) return res.status(400).json({ error: "Esito non valido" });

    const verifiche = payload.verifiche && typeof payload.verifiche === "object" && !Array.isArray(payload.verifiche)
      ? payload.verifiche : {};
    const checks = ["anagrafica", "titolare_effettivo", "ppe", "prestazione", "operativita", "rischio", "documenti"];
    if (!checks.every(k => verifiche[k] === true)) return res.status(400).json({ error: "Completa tutti i controlli prima della conferma" });

    const fonti = String(payload.fonti || "").trim().slice(0, 8000);
    const note = String(payload.note || "").trim().slice(0, 12000);
    if (!fonti) return res.status(400).json({ error: "Indicare le fonti delle verifiche effettuate" });
    if (!note) return res.status(400).json({ error: "Descrivere l'esito del controllo" });

    const scadenzaCalcolata = periodicitaMesi
      ? calcolaScadenzaAV7(payload.data_controllo, periodicitaMesi)
      : "";
    const scadenza = payload.esito === "nessuna_variazione"
      ? (payload.prossima_scadenza || scadenzaCalcolata)
      : null;
    if (payload.esito === "nessuna_variazione" && (!isDate(scadenza) || scadenza <= payload.data_controllo)) {
      return res.status(400).json({ error: "Indicare una data successiva al controllo. Se manca un AV1 confermato la scadenza deve essere verificata manualmente." });
    }
    if (scadenza && scadenzaCalcolata && scadenza > scadenzaCalcolata) {
      return res.status(400).json({ error: "La prossima verifica può essere anticipata, ma non posticipata oltre la periodicità dell'AV1 confermato." });
    }

    const { data: record, error } = await supabaseAdmin
      .from("tbAMLControlliCostanti")
      .insert({
        studio_id: user.studio_id,
        cliente_id: pratica.cliente_id,
        pratica_id: praticaId,
        data_controllo: payload.data_controllo,
        esito: payload.esito,
        verifiche,
        fonti,
        note,
        adeguata_verifica: adeguataVerifica,
        prossima_scadenza: scadenza,
        created_by: auth.user.id,
      })
      .select("id")
      .single();
    if (error) throw error;
    return res.status(201).json({ ok: true, id: record.id });
  } catch (error: any) {
    console.error("[AML AV7]", error);
    return res.status(500).json({ error: error?.message || "Errore controllo costante" });
  }
}
