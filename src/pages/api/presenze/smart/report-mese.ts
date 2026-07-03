import type { NextApiRequest, NextApiResponse } from "next";
import PDFDocument from "pdfkit";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Metodo non consentito" });
  }

  const gruppo_id = String(req.query.gruppo_id || "");
  const anno = Number(req.query.anno);
  const mese = Number(req.query.mese);

  if (!gruppo_id || !anno || !mese) {
    return res.status(400).json({ error: "gruppo_id, anno e mese obbligatori" });
  }

  const { data: gruppo, error: gruppoError } = await supabaseAdmin
    .from("tbpresenze_smart_gruppi")
    .select("*")
    .eq("id", gruppo_id)
    .single();

  if (gruppoError || !gruppo) {
    return res.status(404).json({ error: "Gruppo non trovato" });
  }

  const { data: utentiGruppo, error: utentiError } = await supabaseAdmin
  .from("tbpresenze_smart_gruppi_utenti")
  .select("utente_id, ordine")
  .eq("gruppo_id", gruppo_id)
  .eq("attivo", true)
  .order("ordine", { ascending: true });

if (utentiError) {
  return res.status(500).json({ error: utentiError.message });
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
    nome:
      [anagrafica?.nome, anagrafica?.cognome].filter(Boolean).join(" ") ||
      anagrafica?.email ||
      ug.utente_id,
  };
});

  const { data: presenze, error: presenzeError } = await supabaseAdmin
    .from("tbpresenze_smart_calendario")
    .select("data, giorno_settimana, utente_id, presenza, festivo, nota")
    .eq("gruppo_id", gruppo_id)
    .eq("anno", anno)
    .eq("mese", mese)
    .order("data", { ascending: true });

  if (presenzeError) {
    return res.status(500).json({ error: presenzeError.message });
  }

  const doc = new PDFDocument({ margin: 30, size: "A4", layout: "landscape" });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `inline; filename=riepilogo-smart-${anno}-${pad(mese)}.pdf`
  );

  doc.pipe(res);

  doc.fontSize(16).text(`Riepilogo smart working - ${meseNome(mese)} ${anno}`);
  doc.moveDown(0.5);

  doc.fontSize(10).text(`Gruppo: ${gruppo.nome_gruppo || gruppo.nome || "-"}`);
  doc.text(`Settore: ${gruppo.settore || "-"}`);
  doc.text(`Giorno fisso: ${giornoNome(Number(gruppo.giorno_fisso || 2))}`);
  doc.text(`Presenze settimanali: ${gruppo.presenze_settimanali || "-"}`);
  doc.moveDown();

  const utentiAttivi = utenti;
  const righePerData = new Map<string, any[]>();

  (presenze || []).forEach((r) => {
    if (!righePerData.has(r.data)) righePerData.set(r.data, []);
    righePerData.get(r.data)!.push(r);
  });

  const startX = 30;
  let y = doc.y + 10;
  const colData = 80;
  const colGiorno = 90;
  const colUtente = 120;

  doc.fontSize(8).font("Helvetica-Bold");
  doc.text("Data", startX, y, { width: colData });
  doc.text("Giorno", startX + colData, y, { width: colGiorno });

  utentiAttivi.forEach((u, index) => {
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
      isFestivo ? `${giornoNome(primaRiga.giorno_settimana)} - ${primaRiga.nota}` : giornoNome(primaRiga.giorno_settimana),
      startX + colData,
      y,
      { width: colGiorno }
    );

    utentiAttivi.forEach((u, index) => {
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
}
