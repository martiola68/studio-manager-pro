import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { sendEmailServer } from "@/services/sendEmailServer";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function toDate(date: Date) {
  return date.toISOString().split("T")[0];
}

function nomeCompleto(dipendente: any) {
  return `${dipendente.nome ?? ""} ${dipendente.cognome ?? ""}`.trim() ||
    dipendente.email;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "Metodo non consentito",
    });
  }

  try {
    const oggi = new Date();
    oggi.setHours(0, 0, 0, 0);

    const currentYear = oggi.getFullYear();
    const currentMonthIndex = oggi.getMonth();

    const inizioMese = toDate(new Date(currentYear, currentMonthIndex, 1));
    const fineMese = toDate(new Date(currentYear, currentMonthIndex + 1, 0));

    const { data: dipendenti, error } = await supabase
      .from("tbutenti")
      .select("id, nome, cognome, email")
      .eq("attivo", true)
      .eq("tipo_rapporto", "Dipendente")
      .not("email", "is", null);

    if (error) throw error;

    const risultati: any[] = [];

    for (const dipendente of dipendenti || []) {
      if (!dipendente.email) continue;

      const { count, error: countError } = await supabase
        .from("tbpresenze_dipendenti")
        .select("id", { count: "exact", head: true })
        .eq("utente_id", dipendente.id)
        .gte("data_presenza", inizioMese)
        .lte("data_presenza", fineMese);

      if (countError) throw countError;

      const presenzeCompilate = count || 0;

      if (presenzeCompilate >= 4) {
        risultati.push({
          id: dipendente.id,
          email: dipendente.email,
          sent: false,
          reason: "almeno 4 presenze compilate",
          presenze_compilate: presenzeCompilate,
        });
        continue;
      }

      const mancanti = 4 - presenzeCompilate;
      const nomeDipendente = nomeCompleto(dipendente);

      const subject = "Promemoria compilazione presenze";

      const html = `
        <div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#111827;">
          <p>Ciao ${nomeDipendente},</p>

          <p>
            risultano compilate <strong>${presenzeCompilate}</strong> presenze nel mese corrente.
          </p>

          <p>
            Il minimo richiesto è di <strong>4</strong> presenze.
          </p>

          <p>
            Mancano ancora <strong>${mancanti}</strong> giornat${mancanti === 1 ? "a" : "e"}.
          </p>

          <p>
            Accedi a Studio Manager Pro e completa la compilazione delle presenze.
          </p>
        </div>
      `;

      const text = `
Ciao ${nomeDipendente},

risultano compilate ${presenzeCompilate} presenze nel mese corrente.

Il minimo richiesto è di 4 presenze.

Mancano ancora ${mancanti} giornat${mancanti === 1 ? "a" : "e"}.

Accedi a Studio Manager Pro e completa la compilazione delle presenze.
`.trim();

const emailResult = await sendEmailServer({
  senderUserId: dipendente.id,
  microsoftConnectionId: "",
  to: dipendente.email,
  subject,
  html,
});

      risultati.push({
        id: dipendente.id,
        nome: dipendente.nome,
        cognome: dipendente.cognome,
        email: dipendente.email,
        sent: emailResult.success,
        error: emailResult.success ? null : emailResult.error,
        presenze_compilate: presenzeCompilate,
        mancanti,
      });
    }

    return res.status(200).json({
      ok: true,
      mese: {
        inizio: inizioMese,
        fine: fineMese,
      },
      checked: risultati.length,
      sent: risultati.filter((r) => r.sent).length,
      results: risultati,
      note:
        "Sollecito inviato ai dipendenti attivi con meno di 4 presenze compilate nel mese corrente.",
    });
  } catch (error: any) {
    console.error("Errore sollecito compilazione presenze:", error);

    return res.status(500).json({
      ok: false,
      error: error?.message || "Errore sollecito compilazione presenze",
    });
  }
}
