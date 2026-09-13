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

function isoDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function daysInMonth(year: number, monthZeroBased: number) {
  return new Date(year, monthZeroBased + 1, 0).getDate();
}

function addMonthsKeepingDay(date: Date, months: number, day: number) {
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const safeDay = Math.min(Math.max(1, day), daysInMonth(target.getFullYear(), target.getMonth()));
  return new Date(target.getFullYear(), target.getMonth(), safeDay);
}

function pianoPeriodicita(periodicita: string) {
  const map: Record<string, { rate: number; mesi: number }> = {
    mensile: { rate: 12, mesi: 1 },
    bimestrale: { rate: 6, mesi: 2 },
    trimestrale: { rate: 4, mesi: 3 },
    semestrale: { rate: 2, mesi: 6 },
    annuale: { rate: 1, mesi: 12 },
  };
  return map[periodicita] || null;
}

async function verificaContratto(studioId: string, contrattoId: string) {
  const { data, error } = await admin
    .from("tbcdg_contratti_clienti")
    .select("*")
    .eq("id", contrattoId)
    .eq("studio_id", studioId)
    .maybeSingle();
  if (error) throw error;
  return data;
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
      const contrattoId = typeof req.query.contratto_id === "string" ? req.query.contratto_id.trim() : "";

      const [contrattiResult, scadenzeResult, clientiResult] = await Promise.all([
        admin
          .from("tbcdg_contratti_clienti")
          .select("*")
          .eq("studio_id", studioId)
          .eq("esercizio", esercizio)
          .order("created_at", { ascending: false }),
        admin
          .from("tbcdg_contratti_scadenze")
          .select("*")
          .eq("studio_id", studioId)
          .order("data_scadenza", { ascending: true })
          .order("numero_rata", { ascending: true }),
        admin
          .from("tbclienti")
          .select("id,ragione_sociale,codice_fiscale")
          .eq("studio_id", studioId),
      ]);

      if (contrattiResult.error) throw contrattiResult.error;
      if (scadenzeResult.error) throw scadenzeResult.error;
      if (clientiResult.error) throw clientiResult.error;

      const clientiMap = new Map((clientiResult.data || []).map((c: any) => [c.id, c]));
      const oggi = isoDate(new Date());
      const scadenzePerContratto = new Map<string, any[]>();

      for (const s of scadenzeResult.data || []) {
        const statoDb = String(s.stato || "previsto");
        const scaduta = String(s.data_scadenza || "") < oggi && !["incassato", "annullato"].includes(statoDb);
        const row = {
          ...s,
          stato_calcolato: scaduta ? "scaduto" : statoDb,
          residuo: round(Math.max(0, n(s.importo) - n(s.importo_incassato)), 2),
        };
        const arr = scadenzePerContratto.get(s.contratto_id) || [];
        arr.push(row);
        scadenzePerContratto.set(s.contratto_id, arr);
      }

      const latestByCliente = new Map<string, any>();
      for (const c of contrattiResult.data || []) {
        if (!latestByCliente.has(c.cliente_id)) latestByCliente.set(c.cliente_id, c);
      }

      const contratti = Array.from(latestByCliente.values()).map((c: any) => {
        const scadenze = scadenzePerContratto.get(c.id) || [];
        const totalePrevisto = scadenze.filter((s) => s.stato_calcolato !== "annullato").reduce((sum, s) => sum + n(s.importo), 0);
        const totaleIncassato = scadenze.reduce((sum, s) => sum + n(s.importo_incassato), 0);
        const scaduto = scadenze
          .filter((s) => s.stato_calcolato === "scaduto")
          .reduce((sum, s) => sum + Math.max(0, n(s.importo) - n(s.importo_incassato)), 0);
        const residuo = scadenze
          .filter((s) => s.stato_calcolato !== "annullato")
          .reduce((sum, s) => sum + Math.max(0, n(s.importo) - n(s.importo_incassato)), 0);

        return {
          ...c,
          cliente: clientiMap.get(c.cliente_id) || null,
          numero_rate: scadenze.length,
          totale_previsto: round(totalePrevisto, 2),
          totale_incassato: round(totaleIncassato, 2),
          residuo: round(residuo, 2),
          scaduto: round(scaduto, 2),
        };
      });

      if (contrattoId) {
        const contratto = contratti.find((c: any) => c.id === contrattoId);
        if (!contratto) return res.status(404).json({ success: false, error: "Contratto non trovato" });
        return res.status(200).json({
          success: true,
          contratto,
          scadenze: scadenzePerContratto.get(contrattoId) || [],
        });
      }

      const tutte = contratti.flatMap((c: any) => scadenzePerContratto.get(c.id) || []);
      const riepilogo = {
        contrattuale_annuo: round(contratti.reduce((sum: number, c: any) => sum + n(c.totale_annuo), 0), 2),
        piano_rate: round(tutte.filter((s: any) => s.stato_calcolato !== "annullato").reduce((sum: number, s: any) => sum + n(s.importo), 0), 2),
        incassato: round(tutte.reduce((sum: number, s: any) => sum + n(s.importo_incassato), 0), 2),
        residuo: round(tutte.filter((s: any) => s.stato_calcolato !== "annullato").reduce((sum: number, s: any) => sum + Math.max(0, n(s.importo) - n(s.importo_incassato)), 0), 2),
        scaduto: round(tutte.filter((s: any) => s.stato_calcolato === "scaduto").reduce((sum: number, s: any) => sum + Math.max(0, n(s.importo) - n(s.importo_incassato)), 0), 2),
      };

      return res.status(200).json({ success: true, contratti, riepilogo });
    }

    if (req.method === "POST") {
      const action = String(req.body?.action || "").trim();
      const contrattoId = String(req.body?.contratto_id || "").trim();

      if (action === "genera_rate") {
        if (!contrattoId) return res.status(400).json({ success: false, error: "contratto_id obbligatorio" });
        const contratto = await verificaContratto(studioId, contrattoId);
        if (!contratto || Number(contratto.esercizio) !== esercizio) {
          return res.status(404).json({ success: false, error: "Contratto non trovato" });
        }

        const config = pianoPeriodicita(String(contratto.periodicita || ""));
        if (!config) {
          return res.status(400).json({ success: false, error: "Per periodicità personalizzata aggiungi le scadenze manualmente" });
        }

        const { data: esistenti, error: esistentiError } = await admin
          .from("tbcdg_contratti_scadenze")
          .select("id,stato,importo_incassato,data_fatturazione,data_incasso")
          .eq("studio_id", studioId)
          .eq("contratto_id", contrattoId);
        if (esistentiError) throw esistentiError;

        const bloccanti = (esistenti || []).filter((s: any) =>
          !["previsto", "scaduto"].includes(String(s.stato || "")) ||
          n(s.importo_incassato) > 0 ||
          Boolean(s.data_fatturazione) ||
          Boolean(s.data_incasso)
        );
        if (bloccanti.length > 0) {
          return res.status(409).json({
            success: false,
            error: "Il piano contiene rate già fatturate o incassate: non può essere rigenerato automaticamente",
          });
        }

        const { error: deleteError } = await admin
          .from("tbcdg_contratti_scadenze")
          .delete()
          .eq("studio_id", studioId)
          .eq("contratto_id", contrattoId);
        if (deleteError) throw deleteError;

        const totale = round(n(contratto.totale_annuo), 2);
        const base = Math.floor((totale / config.rate) * 100) / 100;
        const decorrenzaRaw = contratto.data_decorrenza || `${esercizio}-01-01`;
        const [year, month, dayRaw] = String(decorrenzaRaw).split("-").map(Number);
        const giorno = Math.min(31, Math.max(1, Math.trunc(n(contratto.giorno_scadenza) || dayRaw || 1)));
        const start = new Date(year || esercizio, Math.max(0, (month || 1) - 1), 1);

        const righe = Array.from({ length: config.rate }, (_, index) => {
          const data = addMonthsKeepingDay(start, index * config.mesi, giorno);
          const importo = index === config.rate - 1 ? round(totale - base * (config.rate - 1), 2) : base;
          return {
            studio_id: studioId,
            contratto_id: contrattoId,
            cliente_id: contratto.cliente_id,
            numero_rata: index + 1,
            data_scadenza: isoDate(data),
            importo,
            stato: "previsto",
            importo_incassato: 0,
          };
        });

        const { data, error } = await admin
          .from("tbcdg_contratti_scadenze")
          .insert(righe)
          .select("*")
          .order("numero_rata", { ascending: true });
        if (error) throw error;
        return res.status(200).json({ success: true, scadenze: data || [] });
      }

      if (action === "aggiungi_scadenza") {
        if (!contrattoId) return res.status(400).json({ success: false, error: "contratto_id obbligatorio" });
        const contratto = await verificaContratto(studioId, contrattoId);
        if (!contratto || Number(contratto.esercizio) !== esercizio) {
          return res.status(404).json({ success: false, error: "Contratto non trovato" });
        }

        const dataScadenza = String(req.body?.data_scadenza || "").trim();
        const importo = Math.max(0, n(req.body?.importo));
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dataScadenza)) {
          return res.status(400).json({ success: false, error: "Data scadenza non valida" });
        }
        if (importo <= 0) return res.status(400).json({ success: false, error: "Importo obbligatorio" });

        const { data: last, error: lastError } = await admin
          .from("tbcdg_contratti_scadenze")
          .select("numero_rata")
          .eq("studio_id", studioId)
          .eq("contratto_id", contrattoId)
          .order("numero_rata", { ascending: false })
          .limit(1);
        if (lastError) throw lastError;

        const payload = {
          studio_id: studioId,
          contratto_id: contrattoId,
          cliente_id: contratto.cliente_id,
          numero_rata: n(last?.[0]?.numero_rata) + 1,
          data_scadenza: dataScadenza,
          importo: round(importo, 2),
          stato: "previsto",
          importo_incassato: 0,
          note: String(req.body?.note || "").trim() || null,
        };

        const { data, error } = await admin.from("tbcdg_contratti_scadenze").insert(payload).select("*").single();
        if (error) throw error;
        return res.status(200).json({ success: true, data });
      }

      if (action === "aggiorna_scadenza") {
        const scadenzaId = String(req.body?.scadenza_id || "").trim();
        if (!scadenzaId) return res.status(400).json({ success: false, error: "scadenza_id obbligatorio" });

        const { data: corrente, error: currentError } = await admin
          .from("tbcdg_contratti_scadenze")
          .select("*")
          .eq("id", scadenzaId)
          .eq("studio_id", studioId)
          .maybeSingle();
        if (currentError) throw currentError;
        if (!corrente) return res.status(404).json({ success: false, error: "Scadenza non trovata" });

        const stato = String(req.body?.stato || corrente.stato || "previsto").trim();
        if (!["previsto", "fatturato", "incassato", "scaduto", "annullato"].includes(stato)) {
          return res.status(400).json({ success: false, error: "Stato non valido" });
        }

        const payload: Record<string, any> = {
          stato,
          riferimento_fattura: String(req.body?.riferimento_fattura ?? corrente.riferimento_fattura ?? "").trim() || null,
          note: String(req.body?.note ?? corrente.note ?? "").trim() || null,
        };

        if (req.body?.data_scadenza) payload.data_scadenza = String(req.body.data_scadenza);
        if (req.body?.importo !== undefined) payload.importo = round(Math.max(0, n(req.body.importo)), 2);

        if (stato === "fatturato") {
          payload.data_fatturazione = String(req.body?.data_fatturazione || corrente.data_fatturazione || isoDate(new Date()));
          payload.data_incasso = null;
        }

        if (stato === "incassato") {
          payload.data_fatturazione = String(req.body?.data_fatturazione || corrente.data_fatturazione || isoDate(new Date()));
          payload.data_incasso = String(req.body?.data_incasso || corrente.data_incasso || isoDate(new Date()));
          payload.importo_incassato = round(
            req.body?.importo_incassato !== undefined ? Math.max(0, n(req.body.importo_incassato)) : n(corrente.importo),
            2
          );
        } else if (req.body?.importo_incassato !== undefined) {
          payload.importo_incassato = round(Math.max(0, n(req.body.importo_incassato)), 2);
        }

        if (stato === "previsto") {
          payload.data_fatturazione = null;
          payload.data_incasso = null;
          payload.importo_incassato = 0;
          payload.riferimento_fattura = null;
        }

        const { data, error } = await admin
          .from("tbcdg_contratti_scadenze")
          .update(payload)
          .eq("id", scadenzaId)
          .eq("studio_id", studioId)
          .select("*")
          .single();
        if (error) throw error;
        return res.status(200).json({ success: true, data });
      }

      return res.status(400).json({ success: false, error: "Azione non valida" });
    }

    return res.status(405).json({ success: false, error: "Metodo non consentito" });
  } catch (error: any) {
    console.error("Errore API Redditivita Incassi:", error);
    return res.status(500).json({ success: false, error: error?.message || "Errore interno server" });
  }
}
