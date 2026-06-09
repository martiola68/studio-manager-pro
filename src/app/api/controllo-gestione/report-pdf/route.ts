import { NextRequest, NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const supabaseAdmin = getSupabaseAdmin();

function formatDateIT(value?: string | null) {
  if (!value) return "—";
  const [y, m, d] = value.split("-");
  return `${d}/${m}/${y}`;
}

function utentiLabel(record: any) {
  return (
    record.utenti
      ?.map((u: any) =>
        [u.utente?.nome, u.utente?.cognome].filter(Boolean).join(" ") ||
        u.utente?.email
      )
      .filter(Boolean)
      .join(", ") || "—"
  );
}

function completatoLabel(value: any) {
  return value ? "SI" : "NO";
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const clienteId = searchParams.get("cliente_id");
    const anno = searchParams.get("anno");

    if (!clienteId) {
      return NextResponse.json({ error: "cliente_id mancante" }, { status: 400 });
    }

    if (!anno) {
      return NextResponse.json({ error: "anno mancante" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("tbcontrollo_gestione")
      .select(`
        *,
        cliente:tbclienti(*),
        utenti:tbcontrollo_gestione_utenti(*, utente:tbutenti(*)),
        allegati:tbcontrollo_gestione_allegati(*)
      `)
      .eq("cliente_id", clienteId)
      .order("data_esecuzione", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const records = (data || []).filter((r: any) => {
      const dataRif = r.data_storico || r.data_esecuzione;
      return dataRif?.startsWith(anno);
    });

    const societa =
      records[0]?.cliente?.ragione_sociale ||
      records[0]?.cliente?.denominazione ||
      "Società";

    const doc = new PDFDocument({
      size: "A4",
      margin: 40,
    });

    const chunks: Buffer[] = [];

    doc.on("data", (chunk) => chunks.push(chunk));

    const pdfBufferPromise = new Promise<Buffer>((resolve) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)));
    });

    doc.fontSize(18).text("REPORT CONTROLLO DI GESTIONE", { align: "center" });
    doc.moveDown();

    doc.fontSize(11);
    doc.text(`Società: ${societa}`);
    doc.text(`Anno: ${anno}`);
    doc.text(`Data stampa: ${formatDateIT(new Date().toISOString().slice(0, 10))}`);
    doc.moveDown();

    doc.fontSize(13).text("Riepilogo controlli", { underline: true });
    doc.moveDown(0.5);

    if (records.length === 0) {
      doc.fontSize(11).text("Nessun controllo presente per l'anno selezionato.");
    }

    records.forEach((r: any, index: number) => {
      const dataControllo = r.data_storico || r.data_esecuzione;

      doc.fontSize(12).text(
        `${index + 1}. Controllo del ${formatDateIT(dataControllo)}`,
        { underline: true }
      );

      doc.fontSize(10);
      doc.text(`Cadenza: ${r.cadenza_controllo || "—"}`);
      doc.text(`Utenti assegnati: ${utentiLabel(r)}`);
      doc.text(`Note: ${r.note || "—"}`);
      doc.text(`Link: ${r.link || "—"}`);
      doc.moveDown(0.5);

      doc.text("Checklist:");
      doc.text(`- Rilevamento dati: ${completatoLabel(r.step_1_completato)}`);
      if (r.step_1_note) doc.text(`  Note: ${r.step_1_note}`);

      doc.text(`- Analisi scostamenti: ${completatoLabel(r.step_2_completato)}`);
      if (r.step_2_note) doc.text(`  Note: ${r.step_2_note}`);

      doc.text(`- Reporting: ${completatoLabel(r.step_3_completato)}`);
      if (r.step_3_note) doc.text(`  Note: ${r.step_3_note}`);

      doc.text(`- Azioni correttive: ${completatoLabel(r.step_4_completato)}`);
      if (r.step_4_note) doc.text(`  Note: ${r.step_4_note}`);

      doc.moveDown();

      if (doc.y > 720) {
        doc.addPage();
      }
    });

    doc.moveDown();
    doc.fontSize(9).text("Report generato da Studio Manager Pro", {
      align: "center",
    });

    doc.end();

    const pdfBuffer = await pdfBufferPromise;

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="report-controllo-gestione-${anno}.pdf"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Errore generazione PDF" },
      { status: 500 }
    );
  }
}
