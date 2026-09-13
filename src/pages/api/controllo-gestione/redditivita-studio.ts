import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function n(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function round(value: number, digits = 4) {
  const factor = Math.pow(10, digits);
  return Math.round((value + Number.EPSILON) * factor) / factor;
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

      if (clienteId) {
        const [clienteResult, serviziResult, ripartizioniResult, attivitaResult, utentiResult, costiOperatoriResult] = await Promise.all([
          supabaseAdmin
            .from("tbclienti")
            .select("id,ragione_sociale,codice_fiscale")
            .eq("id", clienteId)
            .eq("studio_id", studioId)
            .maybeSingle(),
          supabaseAdmin
            .from("tbcdg_cliente_servizi")
            .select("*")
            .eq("studio_id", studioId)
            .eq("esercizio", esercizio)
            .eq("cliente_id", clienteId)
            .eq("attivo", true),
          supabaseAdmin
            .from("tbcdg_cliente_attivita_operatori")
            .select("*")
            .eq("studio_id", studioId)
            .eq("esercizio", esercizio)
            .eq("cliente_id", clienteId),
          supabaseAdmin
            .from("tbcdg_attivita_catalogo")
            .select("*")
            .eq("studio_id", studioId)
            .order("ordinamento", { ascending: true })
            .order("area", { ascending: true })
            .order("descrizione", { ascending: true }),
          supabaseAdmin
            .from("tbutenti")
            .select("id,nome,cognome,email,tipo_rapporto,settore")
            .eq("studio_id", studioId)
            .order("cognome", { ascending: true })
            .order("nome", { ascending: true }),
          supabaseAdmin
            .from("tbcdg_operatori_costi")
            .select("operatore_id,costo_orario_pieno,ore_produttive")
            .eq("studio_id", studioId)
            .eq("esercizio", esercizio),
        ]);

        if (clienteResult.error) throw clienteResult.error;
        if (!clienteResult.data) return res.status(404).json({ success: false, error: "Cliente non trovato" });
        if (serviziResult.error) throw serviziResult.error;
        if (ripartizioniResult.error) throw ripartizioniResult.error;
        if (attivitaResult.error) throw attivitaResult.error;
        if (utentiResult.error) throw utentiResult.error;
        if (costiOperatoriResult.error) throw costiOperatoriResult.error;

        const attivitaMap = new Map((attivitaResult.data || []).map((a: any) => [a.id, a]));
        const utentiMap = new Map((utentiResult.data || []).map((u: any) => [u.id, u]));
        const costiMap = new Map((costiOperatoriResult.data || []).map((c: any) => [c.operatore_id, c]));
        const ripartizioniByServizio = new Map<string, any[]>();

        for (const r of ripartizioniResult.data || []) {
          const key = String(r.cliente_servizio_id || "");
          if (!key) continue;
          const arr = ripartizioniByServizio.get(key) || [];
          arr.push({
            ...r,
            operatore: utentiMap.get(r.operatore_id) || null,
            costo_operatore: costiMap.get(r.operatore_id) || null,
          });
          ripartizioniByServizio.set(key, arr);
        }

        const servizi = (serviziResult.data || [])
          .map((s: any) => ({
            ...s,
            attivita: attivitaMap.get(s.attivita_id) || null,
            ripartizione: ripartizioniByServizio.get(s.id) || [],
          }))
          .sort((a: any, b: any) => {
            const aa = `${a.attivita?.area || ""} ${a.attivita?.descrizione || ""}`;
            const bb = `${b.attivita?.area || ""} ${b.attivita?.descrizione || ""}`;
            return aa.localeCompare(bb, "it");
          });

        const clienteOperatoriMap = new Map<string, { numero_operazioni: number; ore: number; costo: number }>();
        for (const r of ripartizioniResult.data || []) {
          const key = String(r.operatore_id || "");
          if (!key) continue;
          const current = clienteOperatoriMap.get(key) || { numero_operazioni: 0, ore: 0, costo: 0 };
          current.numero_operazioni += n(r.numero_operazioni_attribuite);
          current.ore += n(r.ore_attribuite);
          current.costo += n(r.costo_attribuito);
          clienteOperatoriMap.set(key, current);
        }

        const totaleOperazioniCliente = Array.from(clienteOperatoriMap.values()).reduce((s, x) => s + x.numero_operazioni, 0);
        const totaleOreCliente = Array.from(clienteOperatoriMap.values()).reduce((s, x) => s + x.ore, 0);

        const operatoriCliente = (utentiResult.data || []).map((u: any) => {
          const x = clienteOperatoriMap.get(u.id) || { numero_operazioni: 0, ore: 0, costo: 0 };
          return {
            ...u,
            costo: costiMap.get(u.id) || null,
            numero_operazioni: x.numero_operazioni,
            ore_carico: x.ore,
            costo_attribuito: x.costo,
            percentuale_operazioni_cliente: totaleOperazioniCliente > 0 ? (x.numero_operazioni / totaleOperazioniCliente) * 100 : 0,
            percentuale_carico_cliente: totaleOreCliente > 0 ? (x.ore / totaleOreCliente) * 100 : 0,
          };
        });

        return res.status(200).json({
          success: true,
          cliente: clienteResult.data,
          servizi,
          attivita: attivitaResult.data || [],
          operatori: operatoriCliente,
          totali_cliente: {
            servizi: servizi.length,
            operazioni: servizi.reduce((s: number, x: any) => s + n(x.quantita_driver), 0),
            ore_equivalenti: servizi.reduce((s: number, x: any) => s + n(x.ore_equivalenti), 0),
            costo_stimato: servizi.reduce((s: number, x: any) => s + n(x.costo_stimato), 0),
          },
        });
      }

      const [parametriResult, utentiResult, costiOperatoriResult, carichiResult, attivitaResult, clientiResult, serviziClientiResult] = await Promise.all([
        supabaseAdmin.from("tbcdg_studio_parametri").select("*").eq("studio_id", studioId).eq("esercizio", esercizio).maybeSingle(),
        supabaseAdmin.from("tbutenti").select("id,nome,cognome,email,tipo_rapporto,settore,studio_id").eq("studio_id", studioId).order("cognome", { ascending: true }).order("nome", { ascending: true }),
        supabaseAdmin.from("tbcdg_operatori_costi").select("*").eq("studio_id", studioId).eq("esercizio", esercizio),
        supabaseAdmin.from("tbcdg_cliente_attivita_operatori").select("operatore_id,numero_operazioni_attribuite,ore_attribuite,costo_attribuito").eq("studio_id", studioId).eq("esercizio", esercizio),
        supabaseAdmin.from("tbcdg_attivita_catalogo").select("*").eq("studio_id", studioId).order("ordinamento", { ascending: true }).order("area", { ascending: true }).order("descrizione", { ascending: true }),
        supabaseAdmin.from("tbclienti").select("id,ragione_sociale,codice_fiscale").eq("studio_id", studioId).order("ragione_sociale", { ascending: true }),
        supabaseAdmin.from("tbcdg_cliente_servizi").select("cliente_id,attivo,quantita_driver,ore_equivalenti,costo_stimato").eq("studio_id", studioId).eq("esercizio", esercizio).eq("attivo", true),
      ]);

      if (parametriResult.error) throw parametriResult.error;
      if (utentiResult.error) throw utentiResult.error;
      if (costiOperatoriResult.error) throw costiOperatoriResult.error;
      if (carichiResult.error) throw carichiResult.error;
      if (attivitaResult.error) throw attivitaResult.error;
      if (clientiResult.error) throw clientiResult.error;
      if (serviziClientiResult.error) throw serviziClientiResult.error;

      const costiMap = new Map((costiOperatoriResult.data || []).map((r: any) => [r.operatore_id, r]));
      const carichiMap = new Map<string, { operazioni: number; ore: number; costo: number }>();

      for (const r of carichiResult.data || []) {
        const key = String(r.operatore_id || "");
        if (!key) continue;
        const current = carichiMap.get(key) || { operazioni: 0, ore: 0, costo: 0 };
        current.operazioni += n(r.numero_operazioni_attribuite);
        current.ore += n(r.ore_attribuite);
        current.costo += n(r.costo_attribuito);
        carichiMap.set(key, current);
      }

      const totaleOperazioni = Array.from(carichiMap.values()).reduce((s, x) => s + x.operazioni, 0);
      const totaleOreCarico = Array.from(carichiMap.values()).reduce((s, x) => s + x.ore, 0);

      const operatori = (utentiResult.data || []).map((u: any) => {
        const costo = costiMap.get(u.id) || null;
        const carico = carichiMap.get(u.id) || { operazioni: 0, ore: 0, costo: 0 };
        return {
          ...u,
          costo,
          numero_operazioni: carico.operazioni,
          ore_carico: carico.ore,
          costo_attribuito: carico.costo,
          percentuale_operazioni_studio: totaleOperazioni > 0 ? (carico.operazioni / totaleOperazioni) * 100 : 0,
          percentuale_carico_studio: totaleOreCarico > 0 ? (carico.ore / totaleOreCarico) * 100 : 0,
          saturazione_percentuale: costo && n(costo.ore_produttive) > 0 ? (carico.ore / n(costo.ore_produttive)) * 100 : 0,
        };
      });

      const clientiSummary = new Map<string, { servizi: number; operazioni: number; ore: number; costo: number }>();
      for (const s of serviziClientiResult.data || []) {
        const key = String(s.cliente_id || "");
        if (!key) continue;
        const current = clientiSummary.get(key) || { servizi: 0, operazioni: 0, ore: 0, costo: 0 };
        current.servizi += 1;
        current.operazioni += n(s.quantita_driver);
        current.ore += n(s.ore_equivalenti);
        current.costo += n(s.costo_stimato);
        clientiSummary.set(key, current);
      }

      const clienti = (clientiResult.data || []).map((c: any) => {
        const s = clientiSummary.get(c.id) || { servizi: 0, operazioni: 0, ore: 0, costo: 0 };
        return {
          ...c,
          servizi_attivi: s.servizi,
          numero_operazioni: s.operazioni,
          ore_equivalenti: s.ore,
          costo_stimato: s.costo,
        };
      });

      return res.status(200).json({
        success: true,
        parametri: parametriResult.data || null,
        operatori,
        attivita: attivitaResult.data || [],
        clienti,
        totali: { operazioni: totaleOperazioni, ore_carico: totaleOreCarico },
      });
    }

    if (req.method === "POST") {
      const action = String(req.body?.action || "").trim();

      if (action === "salva_costi_studio") {
        const payload = {
          studio_id: studioId,
          esercizio,
          costo_personale: n(req.body?.costo_personale),
          costo_affitto: n(req.body?.costo_affitto),
          costo_software: n(req.body?.costo_software),
          costo_assicurazioni: n(req.body?.costo_assicurazioni),
          costo_utenze: n(req.body?.costo_utenze),
          altri_costi_generali: n(req.body?.altri_costi_generali),
          ore_produttive_studio: n(req.body?.ore_produttive_studio),
          margine_obiettivo_percentuale: n(req.body?.margine_obiettivo_percentuale),
        };

        if (payload.margine_obiettivo_percentuale < 0 || payload.margine_obiettivo_percentuale >= 100) {
          return res.status(400).json({ success: false, error: "Il margine obiettivo deve essere compreso tra 0 e 99,99%" });
        }

        const { data, error } = await supabaseAdmin
          .from("tbcdg_studio_parametri")
          .upsert(payload, { onConflict: "studio_id,esercizio" })
          .select("*")
          .single();
        if (error) throw error;
        return res.status(200).json({ success: true, data });
      }

      if (action === "salva_operatore") {
        const operatoreId = String(req.body?.operatore_id || "").trim();
        if (!operatoreId) return res.status(400).json({ success: false, error: "operatore_id obbligatorio" });

        const { data: utente, error: utenteError } = await supabaseAdmin
          .from("tbutenti")
          .select("id,studio_id")
          .eq("id", operatoreId)
          .eq("studio_id", studioId)
          .maybeSingle();
        if (utenteError) throw utenteError;
        if (!utente) return res.status(404).json({ success: false, error: "Operatore non appartenente allo studio" });

        const costoAnnuo = n(req.body?.costo_annuo);
        const oreTeoriche = n(req.body?.ore_teoriche);
        const oreNonProduttive = n(req.body?.ore_non_produttive);
        const oreProduttive = Math.max(0, n(req.body?.ore_produttive));

        const { data: parametri, error: parametriError } = await supabaseAdmin
          .from("tbcdg_studio_parametri")
          .select("costo_affitto,costo_software,costo_assicurazioni,costo_utenze,altri_costi_generali,ore_produttive_studio")
          .eq("studio_id", studioId)
          .eq("esercizio", esercizio)
          .maybeSingle();
        if (parametriError) throw parametriError;

        const costiGeneraliStudio = n(parametri?.costo_affitto) + n(parametri?.costo_software) + n(parametri?.costo_assicurazioni) + n(parametri?.costo_utenze) + n(parametri?.altri_costi_generali);
        const oreStudio = n(parametri?.ore_produttive_studio);
        const overheadOrario = oreStudio > 0 ? costiGeneraliStudio / oreStudio : 0;
        const costoOrarioDiretto = oreProduttive > 0 ? costoAnnuo / oreProduttive : 0;
        const quotaCostiGenerali = overheadOrario * oreProduttive;
        const costoOrarioPieno = costoOrarioDiretto + overheadOrario;

        const payload = {
          studio_id: studioId,
          esercizio,
          operatore_id: operatoreId,
          costo_annuo: costoAnnuo,
          ore_teoriche: oreTeoriche,
          ore_non_produttive: oreNonProduttive,
          ore_produttive: oreProduttive,
          costo_orario_diretto: costoOrarioDiretto,
          quota_costi_generali: quotaCostiGenerali,
          costo_orario_pieno: costoOrarioPieno,
        };

        const { data, error } = await supabaseAdmin
          .from("tbcdg_operatori_costi")
          .upsert(payload, { onConflict: "studio_id,esercizio,operatore_id" })
          .select("*")
          .single();
        if (error) throw error;
        return res.status(200).json({ success: true, data });
      }

      if (action === "salva_attivita") {
        const id = String(req.body?.id || "").trim() || null;
        const codice = String(req.body?.codice || "").trim().toUpperCase();
        const area = String(req.body?.area || "").trim();
        const descrizione = String(req.body?.descrizione || "").trim();
        const driver = String(req.body?.driver || "").trim();
        const unitaMisura = String(req.body?.unita_misura || "n.").trim() || "n.";
        const tempoStandardMinuti = n(req.body?.tempo_standard_minuti);
        const coefficienteBase = n(req.body?.coefficiente_base || 1);
        const ordinamento = Math.trunc(n(req.body?.ordinamento));
        const attiva = req.body?.attiva !== false;

        if (!codice || !area || !descrizione || !driver) {
          return res.status(400).json({ success: false, error: "Codice, area, attività e driver sono obbligatori" });
        }
        if (tempoStandardMinuti < 0) return res.status(400).json({ success: false, error: "Il tempo standard non può essere negativo" });
        if (coefficienteBase <= 0) return res.status(400).json({ success: false, error: "Il coefficiente base deve essere maggiore di zero" });

        const payload = {
          studio_id: studioId,
          codice,
          area,
          descrizione,
          driver,
          unita_misura: unitaMisura,
          tempo_standard_minuti: tempoStandardMinuti,
          coefficiente_base: coefficienteBase,
          ordinamento,
          attiva,
        };

        const query = id
          ? supabaseAdmin.from("tbcdg_attivita_catalogo").update(payload).eq("id", id).eq("studio_id", studioId).select("*").single()
          : supabaseAdmin.from("tbcdg_attivita_catalogo").insert(payload).select("*").single();

        const { data, error } = await query;
        if (error) {
          if (String(error.code) === "23505") return res.status(409).json({ success: false, error: "Esiste già un'attività con questo codice" });
          throw error;
        }
        return res.status(200).json({ success: true, data });
      }

      if (action === "toggle_attivita") {
        const id = String(req.body?.id || "").trim();
        if (!id) return res.status(400).json({ success: false, error: "id attività obbligatorio" });

        const { data, error } = await supabaseAdmin
          .from("tbcdg_attivita_catalogo")
          .update({ attiva: Boolean(req.body?.attiva) })
          .eq("id", id)
          .eq("studio_id", studioId)
          .select("*")
          .single();
        if (error) throw error;
        return res.status(200).json({ success: true, data });
      }

      if (action === "salva_cliente_servizio") {
        const clienteId = String(req.body?.cliente_id || "").trim();
        const attivitaId = String(req.body?.attivita_id || "").trim();
        const quantitaDriver = Math.max(0, n(req.body?.quantita_driver));
        const coefficienteComplessita = n(req.body?.coefficiente_complessita || 1);

        if (!clienteId || !attivitaId) {
          return res.status(400).json({ success: false, error: "Cliente e attività sono obbligatori" });
        }
        if (coefficienteComplessita <= 0) {
          return res.status(400).json({ success: false, error: "Il coefficiente di complessità deve essere maggiore di zero" });
        }

        const [clienteResult, attivitaResult] = await Promise.all([
          supabaseAdmin.from("tbclienti").select("id").eq("id", clienteId).eq("studio_id", studioId).maybeSingle(),
          supabaseAdmin.from("tbcdg_attivita_catalogo").select("*").eq("id", attivitaId).eq("studio_id", studioId).maybeSingle(),
        ]);
        if (clienteResult.error) throw clienteResult.error;
        if (!clienteResult.data) return res.status(404).json({ success: false, error: "Cliente non appartenente allo studio" });
        if (attivitaResult.error) throw attivitaResult.error;
        if (!attivitaResult.data) return res.status(404).json({ success: false, error: "Attività non appartenente allo studio" });

        const oreEquivalenti = round(
          quantitaDriver * n(attivitaResult.data.tempo_standard_minuti) / 60 * n(attivitaResult.data.coefficiente_base || 1) * coefficienteComplessita,
          4
        );

        const payload = {
          studio_id: studioId,
          esercizio,
          cliente_id: clienteId,
          attivita_id: attivitaId,
          attivo: true,
          quantita_driver: quantitaDriver,
          coefficiente_complessita: coefficienteComplessita,
          ore_equivalenti: oreEquivalenti,
        };

        const { data: servizio, error } = await supabaseAdmin
          .from("tbcdg_cliente_servizi")
          .upsert(payload, { onConflict: "studio_id,esercizio,cliente_id,attivita_id" })
          .select("*")
          .single();
        if (error) throw error;

        const { data: ripartizioni, error: ripError } = await supabaseAdmin
          .from("tbcdg_cliente_attivita_operatori")
          .select("id,operatore_id,percentuale_ripartizione_attivita")
          .eq("cliente_servizio_id", servizio.id)
          .eq("studio_id", studioId);
        if (ripError) throw ripError;

        let costoStimato = 0;
        if ((ripartizioni || []).length > 0) {
          const operatorIds = (ripartizioni || []).map((r: any) => r.operatore_id);
          const { data: costi, error: costiError } = await supabaseAdmin
            .from("tbcdg_operatori_costi")
            .select("operatore_id,costo_orario_pieno")
            .eq("studio_id", studioId)
            .eq("esercizio", esercizio)
            .in("operatore_id", operatorIds);
          if (costiError) throw costiError;
          const costoMap = new Map((costi || []).map((c: any) => [c.operatore_id, n(c.costo_orario_pieno)]));

          for (const r of ripartizioni || []) {
            const percentuale = n(r.percentuale_ripartizione_attivita);
            const operazioni = round(quantitaDriver * percentuale / 100, 4);
            const ore = round(oreEquivalenti * percentuale / 100, 4);
            const costo = round(ore * (costoMap.get(r.operatore_id) || 0), 2);
            costoStimato += costo;
            const { error: updateError } = await supabaseAdmin
              .from("tbcdg_cliente_attivita_operatori")
              .update({ numero_operazioni_attribuite: operazioni, ore_attribuite: ore, costo_attribuito: costo })
              .eq("id", r.id)
              .eq("studio_id", studioId);
            if (updateError) throw updateError;
          }
        }

        const { data: servizioFinale, error: costoError } = await supabaseAdmin
          .from("tbcdg_cliente_servizi")
          .update({ costo_stimato: round(costoStimato, 2) })
          .eq("id", servizio.id)
          .eq("studio_id", studioId)
          .select("*")
          .single();
        if (costoError) throw costoError;

        return res.status(200).json({ success: true, data: servizioFinale });
      }

      if (action === "salva_ripartizione") {
        const clienteServizioId = String(req.body?.cliente_servizio_id || "").trim();
        const rawRipartizione = Array.isArray(req.body?.ripartizione) ? req.body.ripartizione : [];
        if (!clienteServizioId) return res.status(400).json({ success: false, error: "Servizio cliente obbligatorio" });

        const ripartizione = rawRipartizione
          .map((r: any) => ({
            operatore_id: String(r?.operatore_id || "").trim(),
            percentuale: Math.max(0, n(r?.percentuale)),
          }))
          .filter((r: any) => r.operatore_id && r.percentuale > 0);

        const totalePercentuale = round(ripartizione.reduce((s: number, r: any) => s + r.percentuale, 0), 4);
        if (ripartizione.length > 0 && Math.abs(totalePercentuale - 100) > 0.01) {
          return res.status(400).json({ success: false, error: `La ripartizione deve totalizzare 100%. Totale attuale: ${totalePercentuale}%` });
        }

        const { data: servizio, error: servizioError } = await supabaseAdmin
          .from("tbcdg_cliente_servizi")
          .select("*")
          .eq("id", clienteServizioId)
          .eq("studio_id", studioId)
          .eq("esercizio", esercizio)
          .eq("attivo", true)
          .maybeSingle();
        if (servizioError) throw servizioError;
        if (!servizio) return res.status(404).json({ success: false, error: "Servizio cliente non trovato" });

        const operatorIds = ripartizione.map((r: any) => r.operatore_id);
        const [utentiResult, costiResult] = operatorIds.length
          ? await Promise.all([
              supabaseAdmin.from("tbutenti").select("id").eq("studio_id", studioId).in("id", operatorIds),
              supabaseAdmin.from("tbcdg_operatori_costi").select("operatore_id,costo_orario_pieno").eq("studio_id", studioId).eq("esercizio", esercizio).in("operatore_id", operatorIds),
            ])
          : [{ data: [], error: null }, { data: [], error: null }];

        if (utentiResult.error) throw utentiResult.error;
        if (costiResult.error) throw costiResult.error;
        if ((utentiResult.data || []).length !== operatorIds.length) {
          return res.status(400).json({ success: false, error: "Uno o più operatori non appartengono allo studio" });
        }

        const costoMap = new Map((costiResult.data || []).map((c: any) => [c.operatore_id, n(c.costo_orario_pieno)]));

        const { error: deleteError } = await supabaseAdmin
          .from("tbcdg_cliente_attivita_operatori")
          .delete()
          .eq("cliente_servizio_id", clienteServizioId)
          .eq("studio_id", studioId);
        if (deleteError) throw deleteError;

        let costoStimato = 0;
        if (ripartizione.length > 0) {
          const righe = ripartizione.map((r: any) => {
            const operazioni = round(n(servizio.quantita_driver) * r.percentuale / 100, 4);
            const ore = round(n(servizio.ore_equivalenti) * r.percentuale / 100, 4);
            const costo = round(ore * (costoMap.get(r.operatore_id) || 0), 2);
            costoStimato += costo;
            return {
              studio_id: studioId,
              esercizio,
              cliente_id: servizio.cliente_id,
              cliente_servizio_id: clienteServizioId,
              operatore_id: r.operatore_id,
              percentuale_ripartizione_attivita: r.percentuale,
              numero_operazioni_attribuite: operazioni,
              ore_attribuite: ore,
              costo_attribuito: costo,
            };
          });

          const { error: insertError } = await supabaseAdmin.from("tbcdg_cliente_attivita_operatori").insert(righe);
          if (insertError) throw insertError;
        }

        const { error: updateCostoError } = await supabaseAdmin
          .from("tbcdg_cliente_servizi")
          .update({ costo_stimato: round(costoStimato, 2) })
          .eq("id", clienteServizioId)
          .eq("studio_id", studioId);
        if (updateCostoError) throw updateCostoError;

        return res.status(200).json({ success: true, costo_stimato: round(costoStimato, 2) });
      }

      if (action === "rimuovi_cliente_servizio") {
        const clienteServizioId = String(req.body?.cliente_servizio_id || "").trim();
        if (!clienteServizioId) return res.status(400).json({ success: false, error: "Servizio cliente obbligatorio" });

        const { error: ripError } = await supabaseAdmin
          .from("tbcdg_cliente_attivita_operatori")
          .delete()
          .eq("cliente_servizio_id", clienteServizioId)
          .eq("studio_id", studioId);
        if (ripError) throw ripError;

        const { data, error } = await supabaseAdmin
          .from("tbcdg_cliente_servizi")
          .update({ attivo: false, costo_stimato: 0 })
          .eq("id", clienteServizioId)
          .eq("studio_id", studioId)
          .eq("esercizio", esercizio)
          .select("*")
          .single();
        if (error) throw error;
        return res.status(200).json({ success: true, data });
      }

      return res.status(400).json({ success: false, error: "Azione non valida" });
    }

    return res.status(405).json({ success: false, error: "Metodo non consentito" });
  } catch (error: any) {
    console.error("Errore API Redditivita Studio:", error);
    return res.status(500).json({ success: false, error: error?.message || "Errore interno server" });
  }
}
