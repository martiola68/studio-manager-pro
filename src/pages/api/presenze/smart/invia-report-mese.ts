import type { NextApiRequest, NextApiResponse } from "next";
import PDFDocument from "pdfkit";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { sendEmailServer } from "@/services/sendEmailServer";

const supabaseAdmin = getSupabaseAdmin();

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function meseNome(mese: number) {
  return [
    "",
    "Gennaio",
    "Febbraio",
    "Marzo",
    "Aprile",
    "Maggio",
    "Giugno",
    "Luglio",
    "Agosto",
    "Settembre",
    "Ottobre",
    "Novembre",
    "Dicembre",
  ][mese];
}

function giornoNome(n: number) {
  return ["", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì"][n] || "";
}

async function generaPdfBuffer(params: {
  gruppo: any;
  utenti: any[];
  presenze: any[];
  anno: number;
  mese: number;
}) {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 30, size: "A4", layout: "landscape" });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(16).text(`Riepilogo smart working - ${meseNome(params.mese)} ${params.anno}`);
    doc.moveDown(0.5);

    doc.fontSize(10).text(`Gruppo: ${params.gruppo.nome_gruppo || "-"}`);
    doc.text(`Settore: ${params.gruppo.settore || "-"}`);
    doc.text(`Giorno fisso: ${giornoNome(Number(params.gruppo.giorno_fisso || 2))}`);
    doc.text(`Presenze settimanali: ${params.gruppo.presenze_settimanali || "-"}`);
    doc.moveDown();

    const righePerData = new Map<string, any[]>();

    params.presenze.forEach((r) => {
      if (!righePerData.has(r.data)) righePerData.set(r.data, []);
      righePerData.get(r.data)!.push(r);
    });

    const startX = 30;
    let y = doc.y + 10;
    const colData = 80;
    const colGiorno = 120;
    const colUtente = 120;

    doc.fontSize(8).font("Helvetica-Bold");
    doc.text("Data", startX, y, { width: colData });
    doc.text("Giorno", startX + colData, y, { width: colGiorno });

    params.utenti.forEach((u, index) => {
      doc.text(
        u.nome || u.utente_id,
        startX + colData + colGiorno + index * colUtente,
        y,
        { width: colUtente }
      );
    });

    y += 18;
    doc.font("Helvetica");

    Array.from(righePerData.entries()).forEach(([data, righe]) => {
      const primaRiga = righe[0];
      const isFestivo = !!primaRiga?.festivo;

      if (y > 540) {
        doc.addPage();
        y = 30;
      }

      doc.text(data.split("-").reverse().join("/"), startX, y, { width: colData });

      doc.text(
        isFestivo
          ? `${giornoNome(primaRiga.giorno_settimana)} - ${primaRiga.nota}`
          : giornoNome(primaRiga.giorno_settimana),
        startX + colData,
        y,
        { width: colGiorno }
      );

      params.utenti.forEach((u, index) => {
        const presenza = righe.find((r) => r.utente_id === u.utente_id)?.presenza;

        doc.text(
          presenza ? "Presenza" : "",
          startX + colData + colGiorno + index * colUtente,
          y,
          { width: colUtente }
        );
      });

      y += 18;
    });

    doc.end();
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Metodo non consentito" });
  }

  const {
    gruppo_id,
    anno,
    mese,
    senderUserId,
    microsoftConnectionId,
  } = req.body;

  if (!gruppo_id || !anno || !mese || !senderUserId || !microsoftConnectionId) {
    return res.status(400).json({
      error: "gruppo_id, anno, mese, senderUserId e microsoftConnectionId sono obbligatori",
    });
  }

  const { data: gruppo, error: gruppoError } = await supabaseAdmin
    .from("tbpresenze_smart_gruppi")
    .select("*")
    .eq("id", gruppo_id)
    .single();

  if (gruppoError || !gruppo) {
    return res.status(404).json({ error: "Gruppo non trovato" });
  }

  const { data: utentiGruppo, error: utentiGruppoError } = await supabaseAdmin
    .from("tbpresenze_smart_gruppi_utenti")
    .select("utente_id, ordine")
    .eq("gruppo_id", gruppo_id)
    .eq("attivo", true)
    .order("ordine", { ascending: true });

  if (utentiGruppoError) {
    return res.status(500).json({ error: utentiGruppoError.message });
  }

  const utentiIds = (utentiGruppo || []).map((u) => u.utente_id);

  const { data: utentiAnagrafica, error: utentiAnagraficaError } = await supabaseAdmin
    .from("tbutenti")
    .select("id, nome, cognome, email")
    .in("id", utentiIds);

  if (utentiAnagraficaError) {
    return res.status(500).json({ error: utentiAnagraficaError.message });
  }

  const utenti = (utentiGruppo || []).map((ug) => {
    const anagrafica = (utentiAnagrafica || []).find((u) => u.id === ug.utente_id);

    return {
      ...ug,
      email: anagrafica?.email || "",
      nome:
        [anagrafica?.nome, anagrafica?.cognome].filter(Boolean).join(" ") ||
        anagrafica?.email ||
        ug.utente_id,
    };
  });

  const destinatari = utenti.filter((u) => !!u.email);

  if (destinatari.length === 0) {
    return res.status(400).json({ error: "Nessun dipendente con email valida" });
  }

  const { data: presenze, error: presenzeError } = await supabaseAdmin
    .from("tbpresenze_smart_calendario")
    .select("data, giorno_settimana, utente_id, presenza, festivo, nota")
    .eq("gruppo_id", gruppo_id)
    .eq("anno", Number(anno))
    .eq("mese", Number(mese))
    .order("data", { ascending: true });

  if (presenzeError) {
    return res.status(500).json({ error: presenzeError.message });
  }

  const pdfBuffer = await generaPdfBuffer({
    gruppo,
    utenti,
    presenze: presenze || [],
    anno: Number(anno),
    mese: Number(mese),
  });

  const allegatoBase64 = pdfBuffer.toString("base64");

  const risultati: any[] = [];

  for (const dipendente of destinatari) {
    const result = await sendEmailServer({
      senderUserId,
      microsoftConnectionId,
      to: dipendente.email,
      subject: `Riepilogo Smart Working - ${meseNome(Number(mese))} ${anno}`,
      html: `
        <p>Buongiorno ${dipendente.nome},</p>
        <p>in allegato trovi il riepilogo delle presenze Smart Working per il mese di <strong>${meseNome(Number(mese))} ${anno}</strong>.</p>
        <p>Cordiali saluti</p>
      `,
      attachments: [
        {
          filename: `riepilogo-smart-${anno}-${pad(Number(mese))}.pdf`,
          contentType: "application/pdf",
          contentBytes: allegatoBase64,
        },
      ],
    });

    risultati.push({
      utente_id: dipendente.utente_id,
      email: dipendente.email,
      success: result.success,
      error: result.error || null,
    });
  }

  return res.status(200).json({
    ok: true,
    inviati: risultati.filter((r) => r.success).length,
    errori: risultati.filter((r) => !r.success).length,
    risultati,
  });
}
