import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
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

function yesNo(value: any) {
  return value ? "SI" : "NO";
}

function cleanText(value: any) {
  return String(value || "—").replace(/\r?\n/g, " ");
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

    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    let page = pdfDoc.addPage([595.28, 841.89]);
    const { width, height } = page.getSize();

    let y = height - 50;

    function addPageIfNeeded(extra = 40) {
      if (y < extra) {
        page = pdfDoc.addPage([595.28, 841.89]);
        y = height - 50;
      }
    }

    function text(
      value: string,
      x = 50,
      size = 10,
      bold = false,
      color = rgb(0, 0, 0)
    ) {
      addPageIfNeeded(40);
      page.drawText(value.slice(0, 110), {
        x,
        y,
        size,
        font: bold ? boldFont : font,
        color,
      });
      y -= size + 7;
    }

    function line() {
      addPageIfNeeded(30);
      page.drawLine({
        start: { x: 50, y },
        end: { x: width - 50, y },
        thickness: 0.5,
        color: rgb(0.75, 0.75, 0.75),
      });
      y -= 14;
    }

    text("REPORT CONTROLLO DI GESTIONE", 50, 18, true);
    line();

    text(`Società: ${societa}`, 50, 11, true);
    text(`Anno: ${anno}`, 50, 11);
    text(`Data stampa: ${formatDateIT(new Date().toISOString().slice(0, 10))}`, 50, 11);
    y -= 10;

    text("RIEPILOGO CONTROLLI", 50, 13, true);
    line();

    text(`Controlli presenti: ${records.length}`, 50, 10, true);
    y -= 8;

    if (records.length === 0) {
      text("Nessun controllo presente per l'anno selezionato.", 50, 11);
    }

    records.forEach((r: any, index: number) => {
      const dataControllo = r.data_storico || r.data_esecuzione;

      addPageIfNeeded(160);

      text(`${index + 1}. Controllo del ${formatDateIT(dataControllo)}`, 50, 12, true);
      text(`Cadenza: ${cleanText(r.cadenza_controllo)}`);
      text(`Utenti assegnati: ${cleanText(utentiLabel(r))}`);
      text(`Note: ${cleanText(r.note)}`);
      text(`Link: ${cleanText(r.link)}`);

      y -= 4;
      text("Checklist", 50, 11, true);

      text(`- Rilevamento dati: ${yesNo(r.step_1_completato)}`);
      if (r.step_1_note) text(`  Note: ${cleanText(r.step_1_note)}`, 65);

      text(`- Analisi scostamenti: ${yesNo(r.step_2_completato)}`);
      if (r.step_2_note) text(`  Note: ${cleanText(r.step_2_note)}`, 65);

      text(`- Reporting: ${yesNo(r.step_3_completato)}`);
      if (r.step_3_note) text(`  Note: ${cleanText(r.step_3_note)}`, 65);

      text(`- Azioni correttive: ${yesNo(r.step_4_completato)}`);
      if (r.step_4_note) text(`  Note: ${cleanText(r.step_4_note)}`, 65);

      line();
    });

    y = Math.max(y, 60);
    page.drawText("Report generato da Studio Manager Pro", {
      x: 50,
      y: 35,
      size: 9,
      font,
      color: rgb(0.35, 0.35, 0.35),
    });

    const pdfBytes = await pdfDoc.save();

    return new NextResponse(Buffer.from(pdfBytes), {
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
