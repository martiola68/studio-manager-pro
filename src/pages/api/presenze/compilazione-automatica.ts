import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const SECRET = process.env.CRON_SECRET;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

function getRomeDateKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function getWeekday(dateKey: string) {
  return new Date(`${dateKey}T12:00:00Z`).getUTCDay();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Metodo non consentito" });
  }

  const querySecret = typeof req.query.secret === "string" ? req.query.secret : null;
  const authorization = typeof req.headers.authorization === "string" ? req.headers.authorization : "";
  const bearerSecret = authorization.startsWith("Bearer ") ? authorization.slice(7) : null;
  const secretRicevuto = querySecret || bearerSecret;

  if (!SECRET || secretRicevuto !== SECRET) {
    return res.status(401).json({ ok: false, error: "Non autorizzato" });
  }

  try {
    const oggi = getRomeDateKey();
    const weekday = getWeekday(oggi);

    // Sabato e domenica: nessuna compilazione automatica.
    if (weekday === 0 || weekday === 6) {
      return res.status(200).json({
        ok: true,
        data: oggi,
        inserite: 0,
        saltate: 0,
        motivo: "giorno_non_lavorativo",
      });
    }

    const { data: festivita, error: festivitaError } = await supabaseAdmin
      .from("tbfestivita")
      .select("data_festivita, descrizione")
      .eq("data_festivita", oggi)
      .in("tipo", ["nazionale", "locale", "aziendale"])
      .limit(1);

    if (festivitaError) throw festivitaError;

    if ((festivita || []).length > 0) {
      return res.status(200).json({
        ok: true,
        data: oggi,
        inserite: 0,
        saltate: 0,
        motivo: "festivo",
        festivita: (festivita || [])[0]?.descrizione || null,
      });
    }

    const { data: dipendentiData, error: dipendentiError } = await (supabaseAdmin as any)
      .from("tbdipendenti")
      .select(
        "id, studio_id, utente_id, nome, cognome, attivo, data_assunzione, data_cessazione, compilazione_automatica_presenze"
      )
      .eq("attivo", true)
      .eq("compilazione_automatica_presenze", true)
      .not("utente_id", "is", null);

    if (dipendentiError) throw dipendentiError;

    const dipendenti = (dipendentiData || []).filter((d: any) => {
      if (d.data_assunzione && String(d.data_assunzione) > oggi) return false;
      if (d.data_cessazione && String(d.data_cessazione) < oggi) return false;
      return true;
    });

    if (dipendenti.length === 0) {
      return res.status(200).json({
        ok: true,
        data: oggi,
        inserite: 0,
        saltate: 0,
        motivo: "nessun_dipendente_abilitato",
      });
    }

    const userIds = Array.from(new Set(dipendenti.map((d: any) => String(d.utente_id))));
    const studioIds = Array.from(new Set(dipendenti.map((d: any) => String(d.studio_id))));

    const { data: esistentiData, error: esistentiError } = await (supabaseAdmin as any)
      .from("tbpresenze_dipendenti")
      .select("utente_id, data_presenza, codice_presenza")
      .eq("data_presenza", oggi)
      .in("utente_id", userIds);

    if (esistentiError) throw esistentiError;

    const utentiGiaCompilati = new Set(
      (esistentiData || []).map((r: any) => String(r.utente_id))
    );

    const { data: gruppiData, error: gruppiError } = await (supabaseAdmin as any)
      .from("tbpresenze_smart_gruppi")
      .select("id, studio_id, scelta_libera")
      .in("studio_id", studioIds)
      .eq("attivo", true);

    if (gruppiError) throw gruppiError;

    const gruppi = gruppiData || [];
    const gruppoIds = gruppi.map((g: any) => String(g.id));

    if (gruppoIds.length === 0) {
      return res.status(200).json({
        ok: true,
        data: oggi,
        inserite: 0,
        saltate: dipendenti.length,
        motivo: "nessun_gruppo_smart_attivo",
      });
    }

    const { data: membershipsData, error: membershipsError } = await (supabaseAdmin as any)
      .from("tbpresenze_smart_gruppi_utenti")
      .select("gruppo_id, utente_id, giorni_presenza, attivo")
      .in("gruppo_id", gruppoIds)
      .in("utente_id", userIds)
      .eq("attivo", true);

    if (membershipsError) throw membershipsError;

    const memberships = membershipsData || [];

    const { data: calendarioData, error: calendarioError } = await (supabaseAdmin as any)
      .from("tbpresenze_smart_calendario")
      .select("id, gruppo_id, utente_id, data, presenza, festivo, nota")
      .in("gruppo_id", gruppoIds)
      .in("utente_id", userIds)
      .eq("data", oggi);

    if (calendarioError) throw calendarioError;

    const gruppiById = new Map(
      gruppi.map((g: any) => [String(g.id), g])
    );

    const membershipsByUser = new Map<string, any[]>();
    for (const membership of memberships) {
      const userId = String((membership as any).utente_id);
      const list = membershipsByUser.get(userId) || [];
      list.push(membership);
      membershipsByUser.set(userId, list);
    }

    const calendarioByUser = new Map<string, any[]>();
    for (const row of calendarioData || []) {
      const userId = String((row as any).utente_id);
      const list = calendarioByUser.get(userId) || [];
      list.push(row);
      calendarioByUser.set(userId, list);
    }

    const rows: any[] = [];
    const dettagli: any[] = [];

    for (const dipendente of dipendenti) {
      const userId = String(dipendente.utente_id);

      if (utentiGiaCompilati.has(userId)) {
        dettagli.push({ utente_id: userId, esito: "saltato", motivo: "presenza_gia_esistente" });
        continue;
      }

      const userMemberships = membershipsByUser.get(userId) || [];
      if (userMemberships.length === 0) {
        dettagli.push({ utente_id: userId, esito: "saltato", motivo: "nessun_planning_settimanale" });
        continue;
      }

      const membershipGroupIds = new Set(
        userMemberships.map((m: any) => String(m.gruppo_id))
      );

      const explicitRows = (calendarioByUser.get(userId) || []).filter((r: any) =>
        membershipGroupIds.has(String(r.gruppo_id))
      );

      let codice: "Pp" | "Ps" | null = null;

      if (explicitRows.length > 0) {
        if (explicitRows.some((r: any) => Boolean(r.festivo))) {
          dettagli.push({ utente_id: userId, esito: "saltato", motivo: "festivo_planning" });
          continue;
        }

        const codiciEspliciti = Array.from(
          new Set(explicitRows.map((r: any) => (r.presenza ? "Pp" : "Ps")))
        );

        if (codiciEspliciti.length !== 1) {
          dettagli.push({ utente_id: userId, esito: "saltato", motivo: "planning_in_conflitto" });
          continue;
        }

        codice = codiciEspliciti[0] as "Pp" | "Ps";
      } else {
        const codiciDerivati: Array<"Pp" | "Ps"> = [];

        for (const membership of userMemberships) {
          const gruppo: any = gruppiById.get(String((membership as any).gruppo_id));
          if (!gruppo?.scelta_libera) continue;

          const giorniPresenza = Array.isArray((membership as any).giorni_presenza)
            ? (membership as any).giorni_presenza.map(Number)
            : [];

          codiciDerivati.push(giorniPresenza.includes(weekday) ? "Pp" : "Ps");
        }

        const unici = Array.from(new Set(codiciDerivati));

        if (unici.length !== 1) {
          dettagli.push({
            utente_id: userId,
            esito: "saltato",
            motivo: unici.length === 0 ? "planning_non_disponibile" : "planning_in_conflitto",
          });
          continue;
        }

        codice = unici[0];
      }

      rows.push({
        studio_id: dipendente.studio_id,
        utente_id: userId,
        data_presenza: oggi,
        codice_presenza: codice,
        note: null,
      });

      dettagli.push({ utente_id: userId, esito: "inserito", codice_presenza: codice });
    }

    if (rows.length > 0) {
      const { error: insertError } = await (supabaseAdmin as any)
        .from("tbpresenze_dipendenti")
        .upsert(rows, {
          onConflict: "utente_id,data_presenza",
          ignoreDuplicates: true,
        });

      if (insertError) throw insertError;
    }

    const inserite = rows.length;
    const saltate = dettagli.filter((d) => d.esito === "saltato").length;

    return res.status(200).json({
      ok: true,
      data: oggi,
      abilitate: dipendenti.length,
      inserite,
      saltate,
      dettagli,
    });
  } catch (error: any) {
    console.error("Compilazione automatica presenze:", error);
    return res.status(500).json({
      ok: false,
      error: error?.message || String(error),
    });
  }
}
