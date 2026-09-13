import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function n(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function round(value: number, digits = 2) {
  const f = Math.pow(10, digits);
  return Math.round((value + Number.EPSILON) * f) / f;
}

async function verificaCliente(studioId: string, clienteId: string) {
  const { data, error } = await admin
    .from("tbclienti")
    .select("id,ragione_sociale,codice_fiscale")
    .eq("id", clienteId)
    .eq("studio_id", studioId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function caricaMargine(studioId: string, esercizio: number) {
  const { data, error } = await admin
    .from("tbcdg_studio_parametri")
    .select("margine_obiettivo_percentuale")
    .eq("studio_id", studioId)
    .eq("esercizio", esercizio)
    .maybeSingle();
  if (error) throw error;
  return Math.min(95, Math.max(0, n(data?.margine_obiettivo_percentuale)));
}

async function caricaServizi(studioId: string, esercizio: number, clienteId: string) {
  const { data: servizi, error: serviziError } = await admin
    .from("tbcdg_cliente_servizi")
    .select("id,attivita_id,quantita_driver,coefficiente_complessita,ore_equivalenti,costo_stimato")
    .eq("studio_id", studioId)
    .eq("esercizio", esercizio)
    .eq("cliente_id", clienteId)
    .eq("attivo", true);
  if (serviziError) throw serviziError;

  const attivitaIds = [...new Set((servizi || []).map((s: any) => s.attivita_id).filter(Boolean))];
  let attivita: any[] = [];
  if (attivitaIds.length) {
    const result = await admin
      .from("tbcdg_attivita_catalogo")
      .select("id,codice,area,descrizione,driver,unita_misura")
      .eq("studio_id", studioId)
      .in("id", attivitaIds);
    if (result.error) throw result.error;
    attivita = result.data || [];
  }

  const attMap = new Map(attivita.map((a: any) => [a.id, a]));
  return (servizi || []).map((s: any) => ({ ...s, attivita: attMap.get(s.attivita_id) || null }));
}

function calcolaEconomia(servizi: any[], margine: number) {
  const ore = servizi.reduce((sum, s) => sum + n(s.ore_equivalenti), 0);
  const costo = servizi.reduce((sum, s) => sum + n(s.costo_stimato), 0);
  const minimo = costo;
  const obiettivo = margine < 100 ? costo / (1 - margine / 100) : costo;
  return {
    ore_equivalenti_totali: round(ore, 4),
    costo_pieno: round(costo, 2),
    compenso_minimo: round(minimo, 2),
    compenso_obiettivo: round(obiettivo, 2),
  };
}

async function caricaContrattoCorrente(studioId: string, esercizio: number, clienteId: string) {
  const { data, error } = await admin
    .from("tbcdg_contratti_clienti")
    .select("*")
    .eq("studio_id", studioId)
    .eq("esercizio", esercizio)
    .eq("cliente_id", clienteId)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  const contratto = data?.[0] || null;
  if (!contratto) return { contratto: null, voci: [] };

  const { data: voci, error: vociError } = await admin
    .from("tbcdg_contratti_voci")
    .select("*")
    .eq("studio_id", studioId)
    .eq("contratto_id", contratto.id)
    .order("created_at", { ascending: true });
  if (vociError) throw vociError;
  return { contratto, voci: voci || [] };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const studioId = String(req.method === "GET" ? req.query.studio_id || "" : req.body?.studio_id || "").trim();
    const esercizio = Number(req.method === "GET" ? req.query.esercizio : req.body?.esercizio);
    if (!studioId) return res.status(400).json({ success: false, error: "studio_id obbligatorio" });
    if (!Number.isInteger(esercizio) || esercizio < 2000 || esercizio > 2100) {
      return res.status(400).json({ success: false, error: "esercizio non valido" });
    }

    if (req.method === "GET") {
      const clienteId = typeof req.query.cliente_id === "string" ? req.query.cliente_id.trim() : "";
      const margine = await caricaMargine(studioId, esercizio);

      if (clienteId) {
        const cliente = await verificaCliente(studioId, clienteId);
        if (!cliente) return res.status(404).json({ success: false, error: "Cliente non trovato" });

        const [servizi, contrattoData, calcoliResult] = await Promise.all([
          caricaServizi(studioId, esercizio, clienteId),
          caricaContrattoCorrente(studioId, esercizio, clienteId),
          admin
            .from("tbcdg_calcoli_compenso")
            .select("*")
            .eq("studio_id", studioId)
            .eq("esercizio", esercizio)
            .eq("cliente_id", clienteId)
            .order("versione", { ascending: false })
            .limit(1),
        ]);
        if (calcoliResult.error) throw calcoliResult.error;

        const economia = calcolaEconomia(servizi, margine);
        const compensoAttuale = n(contrattoData.contratto?.totale_annuo);
        const margineAttuale = compensoAttuale > 0 ? ((compensoAttuale - economia.costo_pieno) / compensoAttuale) * 100 : 0;

        return res.status(200).json({
          success: true,
          cliente,
          servizi,
          margine_obiettivo: margine,
          economia: {
            ...economia,
            compenso_attuale: round(compensoAttuale, 2),
            margine_attuale_percentuale: round(margineAttuale, 2),
            scostamento_obiettivo: round(compensoAttuale - economia.compenso_obiettivo, 2),
          },
          contratto: contrattoData.contratto,
          voci_contratto: contrattoData.voci,
          ultimo_calcolo: calcoliResult.data?.[0] || null,
        });
      }

      const [clientiResult, serviziResult, contrattiResult] = await Promise.all([
        admin.from("tbclienti").select("id,ragione_sociale,codice_fiscale").eq("studio_id", studioId).order("ragione_sociale", { ascending: true }),
        admin.from("tbcdg_cliente_servizi").select("cliente_id,ore_equivalenti,costo_stimato").eq("studio_id", studioId).eq("esercizio", esercizio).eq("attivo", true),
        admin.from("tbcdg_contratti_clienti").select("id,cliente_id,totale_annuo,tipo_contratto,stato,created_at").eq("studio_id", studioId).eq("esercizio", esercizio).order("created_at", { ascending: false }),
      ]);
      if (clientiResult.error) throw clientiResult.error;
      if (serviziResult.error) throw serviziResult.error;
      if (contrattiResult.error) throw contrattiResult.error;

      const servizioMap = new Map<string, { ore: number; costo: number }>();
      for (const s of serviziResult.data || []) {
        const key = String(s.cliente_id || "");
        const cur = servizioMap.get(key) || { ore: 0, costo: 0 };
        cur.ore += n(s.ore_equivalenti);
        cur.costo += n(s.costo_stimato);
        servizioMap.set(key, cur);
      }

      const contrattoMap = new Map<string, any>();
      for (const c of contrattiResult.data || []) {
        if (!contrattoMap.has(c.cliente_id)) contrattoMap.set(c.cliente_id, c);
      }

      const clienti = (clientiResult.data || []).map((c: any) => {
        const s = servizioMap.get(c.id) || { ore: 0, costo: 0 };
        const obiettivo = margine < 100 ? s.costo / (1 - margine / 100) : s.costo;
        const contratto = contrattoMap.get(c.id) || null;
        const attuale = n(contratto?.totale_annuo);
        const margineAttuale = attuale > 0 ? ((attuale - s.costo) / attuale) * 100 : 0;
        return {
          ...c,
          ore_equivalenti: round(s.ore, 4),
          costo_pieno: round(s.costo, 2),
          compenso_minimo: round(s.costo, 2),
          compenso_obiettivo: round(obiettivo, 2),
          compenso_attuale: round(attuale, 2),
          margine_attuale_percentuale: round(margineAttuale, 2),
          scostamento_obiettivo: round(attuale - obiettivo, 2),
          contratto,
        };
      });

      return res.status(200).json({ success: true, margine_obiettivo: margine, clienti });
    }

    if (req.method === "POST") {
      const action = String(req.body?.action || "").trim();
      const clienteId = String(req.body?.cliente_id || "").trim();
      if (!clienteId) return res.status(400).json({ success: false, error: "cliente_id obbligatorio" });
      const cliente = await verificaCliente(studioId, clienteId);
      if (!cliente) return res.status(404).json({ success: false, error: "Cliente non appartenente allo studio" });

      if (action === "salva_calcolo_compenso") {
        const margine = await caricaMargine(studioId, esercizio);
        const servizi = await caricaServizi(studioId, esercizio, clienteId);
        const economia = calcolaEconomia(servizi, margine);
        const contrattoData = await caricaContrattoCorrente(studioId, esercizio, clienteId);
        const compensoAttuale = n(contrattoData.contratto?.totale_annuo);

        const { data: lastVersions, error: versionError } = await admin
          .from("tbcdg_calcoli_compenso")
          .select("versione")
          .eq("studio_id", studioId)
          .eq("esercizio", esercizio)
          .eq("cliente_id", clienteId)
          .order("versione", { ascending: false })
          .limit(1);
        if (versionError) throw versionError;
        const versione = n(lastVersions?.[0]?.versione) + 1;
        const scostamento = compensoAttuale - economia.compenso_obiettivo;
        const scostamentoPct = economia.compenso_obiettivo > 0 ? (scostamento / economia.compenso_obiettivo) * 100 : 0;

        const payload = {
          studio_id: studioId,
          esercizio,
          cliente_id: clienteId,
          versione,
          ore_equivalenti_totali: economia.ore_equivalenti_totali,
          costo_diretto: 0,
          costo_pieno: economia.costo_pieno,
          margine_obiettivo_percentuale: margine,
          compenso_minimo: economia.compenso_minimo,
          compenso_obiettivo: economia.compenso_obiettivo,
          compenso_attuale: round(compensoAttuale, 2),
          scostamento_importo: round(scostamento, 2),
          scostamento_percentuale: round(scostamentoPct, 4),
          snapshot: {
            cliente,
            margine_obiettivo: margine,
            servizi: servizi.map((s: any) => ({
              id: s.id,
              attivita_id: s.attivita_id,
              area: s.attivita?.area || null,
              descrizione: s.attivita?.descrizione || null,
              quantita_driver: n(s.quantita_driver),
              coefficiente_complessita: n(s.coefficiente_complessita),
              ore_equivalenti: n(s.ore_equivalenti),
              costo_stimato: n(s.costo_stimato),
            })),
          },
        };

        const { data, error } = await admin.from("tbcdg_calcoli_compenso").insert(payload).select("*").single();
        if (error) throw error;
        return res.status(200).json({ success: true, data });
      }

      if (action === "salva_contratto") {
        const id = String(req.body?.id || "").trim() || null;
        const tipoContratto = String(req.body?.tipo_contratto || "forfettario").trim();
        const periodicita = String(req.body?.periodicita || "mensile").trim();
        const stato = String(req.body?.stato || "bozza").trim();
        const totaleAnnuo = Math.max(0, n(req.body?.totale_annuo));
        const dataDecorrenza = req.body?.data_decorrenza ? String(req.body.data_decorrenza) : null;
        const dataScadenza = req.body?.data_scadenza ? String(req.body.data_scadenza) : null;
        const giornoScadenzaRaw = req.body?.giorno_scadenza;
        const giornoScadenza = giornoScadenzaRaw === null || giornoScadenzaRaw === undefined || giornoScadenzaRaw === "" ? null : Math.trunc(n(giornoScadenzaRaw));
        const note = String(req.body?.note || "").trim() || null;
        const voci = Array.isArray(req.body?.voci) ? req.body.voci : [];

        if (!["forfettario", "analitico", "misto", "ore"].includes(tipoContratto)) {
          return res.status(400).json({ success: false, error: "Tipo contratto non valido" });
        }
        if (!["mensile", "bimestrale", "trimestrale", "semestrale", "annuale", "personalizzata"].includes(periodicita)) {
          return res.status(400).json({ success: false, error: "Periodicità non valida" });
        }
        if (!["bozza", "attivo", "cessato", "archiviato"].includes(stato)) {
          return res.status(400).json({ success: false, error: "Stato contratto non valido" });
        }
        if (giornoScadenza !== null && (giornoScadenza < 1 || giornoScadenza > 31)) {
          return res.status(400).json({ success: false, error: "Giorno scadenza non valido" });
        }

        const { data: ultimoCalcolo, error: calcError } = await admin
          .from("tbcdg_calcoli_compenso")
          .select("id")
          .eq("studio_id", studioId)
          .eq("esercizio", esercizio)
          .eq("cliente_id", clienteId)
          .order("versione", { ascending: false })
          .limit(1);
        if (calcError) throw calcError;

        const payload = {
          studio_id: studioId,
          esercizio,
          cliente_id: clienteId,
          calcolo_compenso_id: String(req.body?.calcolo_compenso_id || ultimoCalcolo?.[0]?.id || "").trim() || null,
          tipo_contratto: tipoContratto,
          data_decorrenza: dataDecorrenza,
          data_scadenza: dataScadenza,
          totale_annuo: totaleAnnuo,
          periodicita,
          giorno_scadenza: giornoScadenza,
          stato,
          note,
        };

        let contrattoResult;
        if (id) {
          contrattoResult = await admin
            .from("tbcdg_contratti_clienti")
            .update(payload)
            .eq("id", id)
            .eq("studio_id", studioId)
            .eq("cliente_id", clienteId)
            .select("*")
            .single();
        } else {
          contrattoResult = await admin.from("tbcdg_contratti_clienti").insert(payload).select("*").single();
        }
        if (contrattoResult.error) throw contrattoResult.error;
        const contratto = contrattoResult.data;

        const { error: deleteVociError } = await admin
          .from("tbcdg_contratti_voci")
          .delete()
          .eq("studio_id", studioId)
          .eq("contratto_id", contratto.id);
        if (deleteVociError) throw deleteVociError;

        const righe = voci
          .map((v: any) => ({
            studio_id: studioId,
            contratto_id: contratto.id,
            attivita_id: String(v?.attivita_id || "").trim() || null,
            descrizione: String(v?.descrizione || "").trim(),
            quantita: Math.max(0, n(v?.quantita || 1)),
            prezzo_unitario: Math.max(0, n(v?.prezzo_unitario)),
            importo_annuo: Math.max(0, n(v?.importo_annuo)),
            incluso_nel_forfait: v?.incluso_nel_forfait !== false,
          }))
          .filter((v: any) => v.descrizione);

        if (righe.length) {
          const { error: insertVociError } = await admin.from("tbcdg_contratti_voci").insert(righe);
          if (insertVociError) throw insertVociError;
        }

        return res.status(200).json({ success: true, contratto, voci: righe });
      }

      return res.status(400).json({ success: false, error: "Azione non valida" });
    }

    return res.status(405).json({ success: false, error: "Metodo non consentito" });
  } catch (error: any) {
    console.error("Errore API Redditivita Compensi:", error);
    return res.status(500).json({ success: false, error: error?.message || "Errore interno server" });
  }
}
