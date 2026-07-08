import type { NextApiRequest, NextApiResponse } from "next";
import PDFDocument from "pdfkit";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("it-IT");
}

function pdfBuffer(richiesta: any, cliente: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: "A4" });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(18).text("Richiesta di assunzione", { align: "center" });
    doc.moveDown();

    doc.fontSize(11);
    doc.text(`Numero richiesta: ${richiesta.numero_richiesta || "-"}`);
    doc.text(`Cliente: ${cliente?.ragione_sociale || "-"}`);
    doc.text(`Data richiesta: ${formatDate(richiesta.created_at)}`);
    doc.moveDown();

    doc.fontSize(14).text("Dati lavoratore");
    doc.moveDown(0.5);

    doc.fontSize(11);
    doc.text(`Lavoratore: ${richiesta.cognome_nome || "-"}`);
    doc.text(`Codice fiscale: ${richiesta.codice_fiscale || "-"}`);
    doc.text(`Data nascita: ${formatDate(richiesta.data_nascita)}`);
    doc.text(`Luogo nascita: ${richiesta.luogo_nascita || "-"}`);
    doc.text(`Residenza: ${richiesta.indirizzo_residenza || "-"}`);
    doc.moveDown();

    doc.fontSize(14).text("Dati assunzione");
    doc.moveDown(0.5);

    doc.fontSize(11);
    doc.text(`Decorrenza: ${formatDate(richiesta.decorrenza_assunzione)}`);
    doc.text(`Tipologia contratto: ${richiesta.tipologia_contratto || "-"}`);
    doc.text(`Mansione: ${richiesta.mansione || "-"}`);
    doc.text(`Qualifica: ${richiesta.qualifica || "-"}`);
    doc.text(`Livello: ${richiesta.livello || "-"}`);
    doc.text(`Orario settimanale: ${richiesta.orario_settimanale || "-"}`);
    doc.text(`Sede lavoro: ${richiesta.sede_lavoro || "-"}`);
    doc.moveDown();

    doc.fontSize(14).text("Note");
    doc.moveDown(0.5);
    doc.fontSize(11).text(richiesta.note || "-");

    doc.end();
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Metodo non consentito" });
  }

  try {
    const id = String(req.query.id || "");

    if (!id) {
      return res.status(400).json({ error: "ID richiesta mancante" });
    }

    const supabase = getSupabaseAdmin();

    const { data: richiesta, error } = await supabase
      .from("tbassunzioni_richieste")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !richiesta) {
      return res.status(404).json({ error: "Richiesta non trovata" });
    }

    const { data: cliente } = await supabase
      .from("tbclienti")
      .select("ragione_sociale")
      .eq("id", richiesta.cliente_id)
      .maybeSingle();

    const buffer = await pdfBuffer(richiesta, cliente);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="richiesta-assunzione-${richiesta.numero_richiesta || id}.pdf"`
    );

    return res.status(200).send(buffer);
  } catch (error: any) {
    return res.status(500).json({
      error: error?.message || "Errore generazione PDF pratica",
    });
  }
}
