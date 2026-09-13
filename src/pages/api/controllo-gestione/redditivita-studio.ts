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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const studioId = String(req.method === "GET" ? req.query.studio_id || "" : req.body?.studio_id || "").trim();
    const esercizio = Number(req.method === "GET" ? req.query.esercizio : req.body?.esercizio);

    if (!studioId) return res.status(400).json({ success: false, error: "studio_id obbligatorio" });
    if (!Number.isInteger(esercizio) || esercizio < 2000 || esercizio > 2100) {
      return res.status(400).json({ success: false, error: "esercizio non valido" });
    }

    if (req.method === "GET") {
      const [parametriResult, utentiResult, costiOperatoriResult, carichiResult] = await Promise.all([
        supabaseAdmin.from("tbcdg_studio_parametri").select("*").eq("studio_id", studioId).eq("esercizio", esercizio).maybeSingle(),
        supabaseAdmin.from("tbutenti").select("id,nome,cognome,email,tipo_rapporto,settore,studio_id").eq("studio_id", studioId).order("cognome", { ascending: true }).order("nome", { ascending: true }),
        supabaseAdmin.from("tbcdg_operatori_costi").select("*").eq("studio_id", studioId).eq("esercizio", esercizio),
        supabaseAdmin.from("tbcdg_cliente_attivita_operatori").select("operatore_id,numero_operazioni_attribuite,ore_attribuite,costo_attribuito").eq("studio_id", studioId).eq("esercizio", esercizio),
      ]);

      if (parametriResult.error) throw parametriResult.error;
      if (utentiResult.error) throw utentiResult.error;
      if (costiOperatoriResult.error) throw costiOperatoriResult.error;
      if (carichiResult.error) throw carichiResult.error;

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

      return res.status(200).json({
        success: true,
        parametri: parametriResult.data || null,
        operatori,
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

      return res.status(400).json({ success: false, error: "Azione non valida" });
    }

    return res.status(405).json({ success: false, error: "Metodo non consentito" });
  } catch (error: any) {
    console.error("Errore API Redditivita Studio:", error);
    return res.status(500).json({ success: false, error: error?.message || "Errore interno server" });
  }
}
