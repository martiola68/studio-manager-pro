import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function nomeCompleto(u: any) {
  return `${u?.nome || ""} ${u?.cognome || ""}`.trim();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Metodo non consentito" });
    }

    const {
      format,
      studio_id,
      utente_operatore_id,
      utente_professionista_id,
      tipo_prestazione_id,
      tipo_redditi,
      settore_fiscale,
      settore_lavoro,
      settore_consulenza,
    } = req.query;

    if (!studio_id || typeof studio_id !== "string") {
      return res.status(400).json({ error: "studio_id mancante" });
    }

    let query = supabase
      .from("tbclienti")
      .select(`
        id,
        cod_cliente,
        ragione_sociale,
        partita_iva,
        codice_fiscale,
        tipo_redditi,
        settore_fiscale,
        settore_lavoro,
        settore_consulenza,
        utente_operatore_id,
        utente_professionista_id,
        tipo_prestazione_id,
        utente_fiscale:tbutenti!tbclienti_utente_operatore_id_fkey(nome, cognome),
        professionista:tbutenti!tbclienti_utente_professionista_id_fkey(nome, cognome),
        prestazione:tbprestazioni!tbclienti_tipo_prestazione_id_fkey(descrizione)
      `)
      .eq("studio_id", studio_id)
      .eq("cliente", true)
      .eq("attivo", true)
      .order("ragione_sociale", { ascending: true });

    if (utente_operatore_id && utente_operatore_id !== "tutti") {
      query = query.eq("utente_operatore_id", String(utente_operatore_id));
    }

    if (utente_professionista_id && utente_professionista_id !== "tutti") {
      query = query.eq(
        "utente_professionista_id",
        String(utente_professionista_id)
      );
    }

    if (tipo_prestazione_id && tipo_prestazione_id !== "tutti") {
      query = query.eq("tipo_prestazione_id", String(tipo_prestazione_id));
    }

    if (tipo_redditi && tipo_redditi !== "tutti") {
      query = query.eq("tipo_redditi", String(tipo_redditi));
    }

    if (settore_fiscale) {
      query = query.eq("settore_fiscale", settore_fiscale === "true");
    }

    if (settore_lavoro) {
      query = query.eq("settore_lavoro", settore_lavoro === "true");
    }

    if (settore_consulenza) {
      query = query.eq("settore_consulenza", settore_consulenza === "true");
    }

    const { data, error } = await query;

    if (error) {
      console.error("Errore stampa lista clienti:", error);
      return res.status(500).json({ error: error.message });
    }

    const clienti = data ?? [];

    if (format === "excel") {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Clienti");

      worksheet.columns = [
        { header: "Codice Cliente", key: "cod_cliente", width: 18 },
        { header: "Ragione Sociale", key: "ragione_sociale", width: 35 },
        { header: "P.IVA", key: "partita_iva", width: 16 },
        { header: "Codice Fiscale", key: "codice_fiscale", width: 18 },
        { header: "Utente Fiscale", key: "utente_fiscale", width: 24 },
        { header: "Professionista", key: "professionista", width: 24 },
        { header: "Prestazione", key: "prestazione", width: 28 },
        { header: "Tipo Redditi", key: "tipo_redditi", width: 14 },
        { header: "Settore Fiscale", key: "settore_fiscale", width: 16 },
        { header: "Settore Lavoro", key: "settore_lavoro", width: 16 },
        { header: "Settore Consulenza", key: "settore_consulenza", width: 20 },
      ];

      clienti.forEach((c: any) => {
        worksheet.addRow({
          cod_cliente: c.cod_cliente || "",
          ragione_sociale: c.ragione_sociale || "",
          partita_iva: c.partita_iva || "",
          codice_fiscale: c.codice_fiscale || "",
          utente_fiscale: nomeCompleto(c.utente_fiscale),
          professionista: nomeCompleto(c.professionista),
          prestazione: c.prestazione?.descrizione || "",
          tipo_redditi: c.tipo_redditi || "",
          settore_fiscale: c.settore_fiscale ? "SI" : "NO",
          settore_lavoro: c.settore_lavoro ? "SI" : "NO",
          settore_consulenza: c.settore_consulenza ? "SI" : "NO",
        });
      });

      worksheet.getRow(1).font = { bold: true };
      worksheet.views = [{ state: "frozen", ySplit: 1 }];

      const buffer = await workbook.xlsx.writeBuffer();

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="lista_clienti.xlsx"'
      );

      return res.status(200).send(Buffer.from(buffer));
    }

    if (format === "pdf") {
      const doc = new PDFDocument({
        size: "A4",
        layout: "landscape",
        margin: 30,
      });

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="lista_clienti.pdf"'
      );

      doc.pipe(res);

      doc.fontSize(16).text("STUDIO MANAGER PRO", { align: "center" });
      doc.moveDown(0.5);
      doc.fontSize(13).text("Lista Clienti", { align: "center" });
      doc.moveDown(0.5);
      doc
        .fontSize(9)
        .text(`Data stampa: ${new Date().toLocaleDateString("it-IT")}`);
      doc.moveDown();

      const startX = 30;
      let y = doc.y;

      const columns = [
        { label: "Cod.", x: startX, width: 60 },
        { label: "Ragione Sociale", x: startX + 65, width: 180 },
        { label: "Utente Fiscale", x: startX + 250, width: 110 },
        { label: "Professionista", x: startX + 365, width: 110 },
        { label: "Tipo Redditi", x: startX + 480, width: 70 },
        { label: "Prestazione", x: startX + 555, width: 150 },
      ];

      const drawHeader = () => {
        doc.fontSize(8).font("Helvetica-Bold");

        columns.forEach((col) => {
          doc.text(col.label, col.x, y, {
            width: col.width,
          });
        });

        y += 16;
        doc.moveTo(startX, y).lineTo(810, y).stroke();
        y += 6;
        doc.font("Helvetica").fontSize(7);
      };

      drawHeader();

      clienti.forEach((c: any) => {
        if (y > 540) {
          doc.addPage();
          y = 40;
          drawHeader();
        }

        const row = [
          c.cod_cliente || "",
          c.ragione_sociale || "",
          nomeCompleto(c.utente_fiscale),
          nomeCompleto(c.professionista),
          c.tipo_redditi || "",
          c.prestazione?.descrizione || "",
        ];

        columns.forEach((col, index) => {
          doc.text(row[index], col.x, y, {
            width: col.width,
            height: 20,
            ellipsis: true,
          });
        });

        y += 18;
      });

      doc.end();
      return;
    }

    return res.status(200).json({
      success: true,
      count: clienti.length,
      clienti,
    });
  } catch (error: any) {
    console.error("Errore API stampa lista clienti:", error);
    return res.status(500).json({
      error: error?.message || "Errore interno server",
    });
  }
}
