import type { NextApiRequest, NextApiResponse } from "next";
import PDFDocument from "pdfkit";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "2mb",
    },
  },
};

type Payload = {
  form: any;
  risultati: any;
  indicatori: {
    nome: string;
    valore: string;
    stato: {
      label: string;
    };
    descrizione: string;
  }[];
};

function euro(value: number) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function addSectionTitle(
  doc: PDFKit.PDFDocument,
  title: string,
  size = 13
) {
  doc
    .fontSize(size)
    .fillColor("#0f172a")
    .text(title, 50, doc.y, {
      underline: true,
    });

  return doc.y + 10;
}

function addTableRow(
  doc: PDFKit.PDFDocument,
  label: string,
  value: string,
  y: number
) {
  doc
    .fontSize(10)
    .fillColor("#111827")
    .text(label, 50, y, { width: 300 });

  doc
    .fontSize(10)
    .fillColor("#111827")
    .text(value, 370, y, { width: 160, align: "right" });

  doc
    .moveTo(50, y + 16)
    .lineTo(545, y + 16)
    .strokeColor("#e5e7eb")
    .stroke();

  return y + 22;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Metodo non consentito" });
    }

    const { form, risultati, indicatori } = req.body as Payload;

    const doc = new PDFDocument({
      size: "A4",
      margin: 50,
      bufferPages: true,
    });

    const chunks: Buffer[] = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => {
      const pdfBuffer = Buffer.concat(chunks);

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="analisi_indici_${form?.anno || "report"}.pdf"`
      );
      res.send(pdfBuffer);
    });

    doc
      .fontSize(20)
      .fillColor("#0f172a")
      .text("STUDIO MANAGER PRO", { align: "center" });

    doc.moveDown(0.4);

    doc
      .fontSize(16)
      .fillColor("#0f172a")
      .text("Analisi economico-finanziaria", { align: "center" });

    doc.moveDown(1);

    doc
      .fontSize(10)
      .fillColor("#475569")
      .text(`Societa: ${form?.societa || "-"}`)
      .text(`Codice fiscale: ${form?.codice_fiscale || "-"}`)
      .text(`Anno: ${form?.anno || "-"}`)
      .text(`Data elaborazione: ${new Date().toLocaleDateString("it-IT")}`);

    doc.moveDown(1);
doc
  .fontSize(13)
  .fillColor("#0f172a")
  .text("Conto economico", 50, doc.y, {
    underline: true,
  });

let y = doc.y + 10;

    y = addTableRow(doc, "Ricavi", euro(form?.ricavi), y);
    y = addTableRow(doc, "Costi operativi", euro(form?.costi_operativi), y);
    y = addTableRow(doc, "Ammortamenti", euro(form?.ammortamenti), y);
    y = addTableRow(doc, "Accantonamenti", euro(form?.accantonamenti), y);
    y = addTableRow(doc, "Oneri finanziari", euro(form?.oneri_finanziari), y);
    y = addTableRow(doc, "Imposte", euro(form?.imposte), y);
    y = addTableRow(doc, "Utile netto", euro(form?.utile_netto), y);

    doc.moveDown(1);

doc
  .fontSize(13)
  .fillColor("#0f172a")
  .text("Stato patrimoniale", 50, doc.y, {
    underline: true,
  });

y = doc.y + 10;

    y = addTableRow(doc, "Totale attivo", euro(form?.totale_attivo), y);
    y = addTableRow(doc, "Capitale investito", euro(form?.capitale_investito), y);
    y = addTableRow(doc, "Patrimonio netto", euro(form?.patrimonio_netto), y);
    y = addTableRow(doc, "Debiti totali", euro(form?.debiti_totali), y);
    y = addTableRow(doc, "Attivo corrente", euro(form?.attivo_corrente), y);
    y = addTableRow(doc, "Passivo corrente", euro(form?.passivo_corrente), y);
    y = addTableRow(doc, "Cash flow operativo", euro(form?.cash_flow_operativo), y);
    y = addTableRow(doc, "Rate finanziarie annue", euro(form?.rate_finanziarie_annue), y);

    doc.addPage();

   doc
  .fontSize(15)
  .fillColor("#0f172a")
  .text("Risultati sintetici", 50, doc.y, {
    underline: true,
  });

y = doc.y + 10;

    y = addTableRow(doc, "MOL / EBITDA", euro(risultati?.ebitda), y);
    y = addTableRow(doc, "EBIT", euro(risultati?.ebit), y);
    y = addTableRow(doc, "EBT", euro(risultati?.ebt), y);
    y = addTableRow(doc, "Utile netto calcolato", euro(risultati?.utileNetto), y);

  doc.moveDown(1);

doc
  .fontSize(15)
  .fillColor("#0f172a")
  .text("Indicatori", 50, doc.y, {
    underline: true,
  });

y = doc.y + 10;

    (indicatori || []).forEach((item) => {
      doc
        .fontSize(10)
        .fillColor("#111827")
        .text(item.nome, 50, y, { width: 100 });

      doc
        .fontSize(10)
        .fillColor("#111827")
        .text(item.valore, 160, y, { width: 80, align: "right" });

      doc
        .fontSize(10)
        .fillColor("#111827")
        .text(item.stato?.label || "-", 260, y, { width: 90 });

      doc
        .fontSize(9)
        .fillColor("#475569")
        .text(item.descrizione || "", 360, y, { width: 180 });

      doc
        .moveTo(50, y + 20)
        .lineTo(545, y + 20)
        .strokeColor("#e5e7eb")
        .stroke();

      y += 28;
    });

    doc.moveDown(2);

    doc
      .fontSize(8)
      .fillColor("#64748b")
      .text(
        "Report generato automaticamente da Studio Manager Pro. I dati importati da XBRL devono essere verificati dal professionista prima dell'utilizzo definitivo.",
        50,
        760,
        { width: 495, align: "center" }
      );

    doc.end();
  } catch (error: any) {
    console.error("Errore report indici:", error);
    return res.status(500).json({
      error: error?.message || "Errore generazione report",
    });
  }
}
