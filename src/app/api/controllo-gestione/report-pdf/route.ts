import { NextRequest, NextResponse } from "next/server";
import {
  PDFDocument,
  StandardFonts,
  rgb,
} from "pdf-lib";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const supabaseAdmin = getSupabaseAdmin();

function formatDateIT(value?: string | null) {
  if (!value) return "—";

  const data = String(value).slice(0, 10);
  const [y, m, d] = data.split("-");

  if (!y || !m || !d) return value;

  return `${d}/${m}/${y}`;
}

function euro(value: any) {
  const numero = Number(value || 0);

  return numero.toLocaleString("it-IT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function percentuale(value: any) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "—";
  }

  return `${Number(value).toLocaleString("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}

function numero(value: any) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "—";
  }

  return Number(value).toLocaleString("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function yesNo(value: any) {
  return value ? "SI" : "NO";
}

function cleanText(value: any) {
  return String(value || "—")
    .replace(/\r?\n/g, " ")
    .trim();
}

function utentiLabel(record: any) {
  return (
    record?.utenti
      ?.map((u: any) =>
        [u.utente?.nome, u.utente?.cognome]
          .filter(Boolean)
          .join(" ") ||
        u.utente?.email
      )
      .filter(Boolean)
      .join(", ") || "—"
  );
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const clienteId =
      searchParams.get("cliente_id");

    const anno =
      searchParams.get("anno");

    if (!clienteId) {
      return NextResponse.json(
        {
          error: "cliente_id mancante",
        },
        {
          status: 400,
        }
      );
    }

    if (!anno) {
      return NextResponse.json(
        {
          error: "anno mancante",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * 1. Anagrafica società.
     *
     * La leggiamo direttamente da tbclienti:
     * non dipendiamo più dal fatto che esistano
     * controlli per poter stampare l'intestazione.
     */
    const {
      data: cliente,
      error: clienteError,
    } = await supabaseAdmin
      .from("tbclienti")
      .select(`
        id,
        ragione_sociale,
        codice_fiscale
      `)
      .eq("id", clienteId)
      .maybeSingle();

    if (clienteError) {
      throw clienteError;
    }

    if (!cliente) {
      return NextResponse.json(
        {
          error: "Società non trovata",
        },
        {
          status: 404,
        }
      );
    }

    /*
     * 2. Recuperiamo TUTTI i controlli
     * della società.
     *
     * NON filtriamo l'anno su data_esecuzione:
     * l'anno contabile deriva dall'import.
     */
    const {
      data: controlli,
      error: controlliError,
    } = await supabaseAdmin
      .from("tbcontrollo_gestione")
      .select(`
        *,
        utenti:tbcontrollo_gestione_utenti(
          *,
          utente:tbutenti(*)
        )
      `)
      .eq("cliente_id", clienteId)
      .order("data_esecuzione", {
        ascending: true,
      });

    if (controlliError) {
      throw controlliError;
    }

    const controlloIds =
      (controlli || []).map((r: any) => r.id);

    /*
     * 3. Recuperiamo gli import appartenenti
     * all'ANNO CONTABILE selezionato.
     */
    let importRecords: any[] = [];

    if (controlloIds.length > 0) {
      const {
        data: imports,
        error: importsError,
      } = await supabaseAdmin
        .from("tbcontrollo_gestione_import")
        .select(`
          id,
          controllo_id,
          software_contabile,
          data_riferimento,
          numero_conti,
          conti_mappati,
          conti_da_mappare,
          stato,
          created_at
        `)
        .in("controllo_id", controlloIds)
        .gte(
          "data_riferimento",
          `${anno}-01-01`
        )
        .lte(
          "data_riferimento",
          `${anno}-12-31`
        )
        .order("data_riferimento", {
          ascending: true,
        })
        .order("created_at", {
          ascending: false,
        });

      if (importsError) {
        throw importsError;
      }

      /*
       * Possono esistere più tentativi di import
       * dello stesso controllo.
       * Manteniamo il più recente per controllo.
       */
      const seen = new Set<string>();

      importRecords = (imports || []).filter(
        (imp: any) => {
          if (seen.has(imp.controllo_id)) {
            return false;
          }

          seen.add(imp.controllo_id);
          return true;
        }
      );
    }

    const controlloIdsReport =
      importRecords.map(
        (imp: any) => imp.controllo_id
      );

    /*
     * 4. Risultati economico-finanziari.
     */
    let indiciRecords: any[] = [];

    if (controlloIdsReport.length > 0) {
      const {
        data: indici,
        error: indiciError,
      } = await supabaseAdmin
        .from("tbcontrollo_gestione_indici")
        .select(`
          *
        `)
        .in(
          "controllo_gestione_id",
          controlloIdsReport
        );

      if (indiciError) {
        throw indiciError;
      }

      indiciRecords = indici || [];
    }

    /*
     * 5. Integrazioni gestionali.
     */
    let integrazioniRecords: any[] = [];

    if (controlloIdsReport.length > 0) {
      const {
        data: integrazioni,
        error: integrazioniError,
      } = await supabaseAdmin
        .from(
          "tbcontrollo_gestione_integrazioni"
        )
        .select(`
          *
        `)
        .in(
          "controllo_id",
          controlloIdsReport
        );

      if (integrazioniError) {
        throw integrazioniError;
      }

      integrazioniRecords =
        integrazioni || [];
    }

    const controlliMap = new Map(
      (controlli || []).map((r: any) => [
        r.id,
        r,
      ])
    );

    const indiciMap = new Map(
      indiciRecords.map((r: any) => [
        r.controllo_gestione_id,
        r,
      ])
    );

    const integrazioniMap = new Map(
      integrazioniRecords.map((r: any) => [
        r.controllo_id,
        r,
      ])
    );

    const records = importRecords.map(
      (imp: any) => ({
        import: imp,
        controllo:
          controlliMap.get(
            imp.controllo_id
          ) || null,
        indici:
          indiciMap.get(
            imp.controllo_id
          ) || null,
        integrazione:
          integrazioniMap.get(
            imp.controllo_id
          ) || null,
      })
    );

    /*
     * 6. PDF
     */
    const pdfDoc =
      await PDFDocument.create();

    const font =
      await pdfDoc.embedFont(
        StandardFonts.Helvetica
      );

    const boldFont =
      await pdfDoc.embedFont(
        StandardFonts.HelveticaBold
      );

    const pageWidth = 595.28;
    const pageHeight = 841.89;

    let page =
      pdfDoc.addPage([
        pageWidth,
        pageHeight,
      ]);

    let y = pageHeight - 50;

    function newPage() {
      page =
        pdfDoc.addPage([
          pageWidth,
          pageHeight,
        ]);

      y = pageHeight - 50;
    }

    function addPageIfNeeded(
      requiredHeight = 50
    ) {
      if (
        y - requiredHeight < 55
      ) {
        newPage();
      }
    }

    function drawText(
      value: any,
      options?: {
        x?: number;
        size?: number;
        bold?: boolean;
        color?: ReturnType<typeof rgb>;
        maxWidth?: number;
      }
    ) {
      const x =
        options?.x ?? 50;

      const size =
        options?.size ?? 10;

      const bold =
        options?.bold ?? false;

      const color =
        options?.color ??
        rgb(0.08, 0.1, 0.15);

      const maxWidth =
        options?.maxWidth ?? 495;

      const text =
        cleanText(value);

      addPageIfNeeded(size + 14);

      page.drawText(
        text.slice(0, 180),
        {
          x,
          y,
          size,
          font:
            bold
              ? boldFont
              : font,
          color,
          maxWidth,
        }
      );

      y -= size + 7;
    }

    function drawLine() {
      addPageIfNeeded(20);

      page.drawLine({
        start: {
          x: 50,
          y,
        },
        end: {
          x: pageWidth - 50,
          y,
        },
        thickness: 0.6,
        color: rgb(
          0.8,
          0.82,
          0.85
        ),
      });

      y -= 14;
    }

    function section(
      titolo: string
    ) {
      y -= 5;

      drawText(titolo, {
        size: 13,
        bold: true,
        color: rgb(
          0.05,
          0.1,
          0.2
        ),
      });

      drawLine();
    }

    function row(
      label: string,
      value: any,
      bold = false
    ) {
      addPageIfNeeded(22);

      page.drawText(
        cleanText(label),
        {
          x: 60,
          y,
          size: 9.5,
          font:
            bold
              ? boldFont
              : font,
          color: rgb(
            0.12,
            0.14,
            0.18
          ),
        }
      );

      page.drawText(
        cleanText(value),
        {
          x: 330,
          y,
          size: 9.5,
          font:
            bold
              ? boldFont
              : font,
          color: rgb(
            0.12,
            0.14,
            0.18
          ),
          maxWidth: 200,
        }
      );

      y -= 18;
    }

    const societa =
      cliente.ragione_sociale ||
      "Società";

    /*
     * INTESTAZIONE
     */
    drawText(
      "STUDIO MANAGER PRO",
      {
        size: 10,
        bold: true,
        color: rgb(
          0.35,
          0.4,
          0.5
        ),
      }
    );

    drawText(
      "REPORT CONTROLLO DI GESTIONE",
      {
        size: 19,
        bold: true,
      }
    );

    drawLine();

    drawText(
      `Società: ${societa}`,
      {
        size: 11,
        bold: true,
      }
    );

    drawText(
      `Codice fiscale: ${
        cliente.codice_fiscale ||
        "—"
      }`,
      {
        size: 10,
      }
    );

    drawText(
      `Esercizio: ${anno}`,
      {
        size: 10,
      }
    );

    drawText(
      `Data stampa: ${formatDateIT(
        new Date()
          .toISOString()
          .slice(0, 10)
      )}`,
      {
        size: 10,
      }
    );

    y -= 8;

    /*
     * RIEPILOGO PERIODI
     */
    section(
      "RIEPILOGO CONTROLLI"
    );

    row(
      "Periodi contabili presenti",
      records.length,
      true
    );

    if (records.length === 0) {
      drawText(
        `Nessuna situazione contabile relativa all'esercizio ${anno}.`,
        {
          size: 11,
          color: rgb(
            0.65,
            0.15,
            0.15
          ),
        }
      );
    }

    /*
     * UN BLOCCO PER OGNI PERIODO
     */
    for (
      let index = 0;
      index < records.length;
      index++
    ) {
      const record =
        records[index];

      const imp =
        record.import;

      const controllo =
        record.controllo;

      const indici =
        record.indici;

      const integrazione =
        record.integrazione;

      if (index > 0) {
        newPage();
      } else {
        y -= 12;
      }

      drawText(
        `${index + 1}. CONTROLLO AL ${formatDateIT(
          imp.data_riferimento
        )}`,
        {
          size: 15,
          bold: true,
        }
      );

      drawLine();

      section(
        "DATI DEL CONTROLLO"
      );

      row(
        "Periodo contabile",
        formatDateIT(
          imp.data_riferimento
        )
      );

      row(
        "Cadenza",
        controllo
          ?.cadenza_controllo ||
          "—"
      );

      row(
        "Software contabile",
        String(
          imp.software_contabile ||
          "—"
        )
          .replaceAll("_", " ")
          .toUpperCase()
      );

      row(
        "Conti importati",
        imp.numero_conti ?? 0
      );

      row(
        "Conti classificati",
        imp.conti_mappati ?? 0
      );

      row(
        "Conti da classificare",
        imp.conti_da_mappare ?? 0
      );

      row(
        "Stato",
        imp.stato || "—"
      );

      row(
        "Utenti assegnati",
        utentiLabel(controllo)
      );

      /*
       * CONTO ECONOMICO
       */
      if (indici) {
        section(
          "CONTO ECONOMICO"
        );

        row(
          "Ricavi",
          euro(indici.ricavi)
        );

        row(
          "Costi operativi",
          euro(
            indici.costi_operativi
          )
        );

        row(
          "EBITDA",
          euro(indici.ebitda),
          true
        );

        row(
          "Ammortamenti",
          euro(
            indici.ammortamenti
          )
        );

        row(
          "Accantonamenti",
          euro(
            indici.accantonamenti
          )
        );

        row(
          "EBIT",
          euro(indici.ebit),
          true
        );

        row(
          "Oneri finanziari",
          euro(
            indici.oneri_finanziari
          )
        );

        row(
          "EBT",
          euro(indici.ebt),
          true
        );

        row(
          "Imposte",
          euro(indici.imposte)
        );

        row(
          "Risultato",
          euro(
            indici.utile_netto
          ),
          true
        );

        /*
         * STATO PATRIMONIALE
         */
        section(
          "STATO PATRIMONIALE"
        );

        row(
          "Totale attivo",
          euro(
            indici.totale_attivo
          )
        );

        row(
          "Capitale investito",
          euro(
            indici.capitale_investito
          )
        );

        row(
          "Attivo corrente",
          euro(
            indici.attivo_corrente
          )
        );

        row(
          "Patrimonio netto",
          euro(
            indici.patrimonio_netto
          ),
          true
        );

        row(
          "Passivo corrente",
          euro(
            indici.passivo_corrente
          )
        );

        row(
          "Debiti totali",
          euro(
            indici.debiti_totali
          )
        );

        /*
         * INDICI
         */
        section(
          "INDICI ECONOMICO-FINANZIARI"
        );

        row(
          "ROI",
          percentuale(
            indici.roi
          )
        );

        row(
          "ROE",
          percentuale(
            indici.roe
          )
        );

        row(
          "ROS",
          percentuale(
            indici.ros
          )
        );

        row(
          "ROA",
          percentuale(
            indici.roa
          )
        );

        row(
          "Indice di indebitamento",
          numero(
            indici.indebitamento
          )
        );

        row(
          "Indice di liquidità",
          numero(
            indici.liquidita
          )
        );

        row(
          "DSCR",
          indici.dscr === null ||
          indici.dscr === undefined
            ? "—"
            : numero(
                indici.dscr
              )
        );
      } else {
        section(
          "DATI ECONOMICO-FINANZIARI"
        );

        drawText(
          "Elaborazione degli indici non disponibile.",
          {
            color: rgb(
              0.65,
              0.15,
              0.15
            ),
          }
        );
      }

      /*
       * DEBITI / INTEGRAZIONI
       */
      if (integrazione) {
        section(
          "INTEGRAZIONI GESTIONALI"
        );

        const bt =
          Number(
            integrazione
              .debiti_finanziari_bt ||
              0
          );

        const mlt =
          Number(
            integrazione
              .debiti_finanziari_mlt ||
              0
          );

        row(
          "Debiti finanziari complessivi",
          euro(bt + mlt),
          true
        );

        row(
          "Debiti finanziari entro 12 mesi",
          euro(bt)
        );

        row(
          "Debiti finanziari oltre 12 mesi",
          euro(mlt)
        );

        row(
          "Rate finanziarie prossimi 12 mesi",
          euro(
            integrazione
              .rate_finanziarie_12_mesi
          )
        );

        row(
          "Cash flow operativo previsionale",
          integrazione
              .cash_flow_operativo_previsionale ===
            null
            ? "—"
            : euro(
                integrazione
                  .cash_flow_operativo_previsionale
              )
        );

        if (
          integrazione.note
        ) {
          row(
            "Note integrazioni",
            integrazione.note
          );
        }
      }

      /*
       * CHECKLIST
       */
      if (controllo) {
        section(
          "CHECKLIST CONTROLLO"
        );

        row(
          "Step 1 - Rilevamento dati",
          yesNo(
            controllo
              .step_1_completato
          )
        );

        if (
          controllo.step_1_note
        ) {
          row(
            "Note Step 1",
            controllo.step_1_note
          );
        }

        row(
          "Step 2 - Analisi scostamenti",
          yesNo(
            controllo
              .step_2_completato
          )
        );

        if (
          controllo.step_2_note
        ) {
          row(
            "Note Step 2",
            controllo.step_2_note
          );
        }

        row(
          "Step 3 - Reporting",
          yesNo(
            controllo
              .step_3_completato
          )
        );

        if (
          controllo.step_3_note
        ) {
          row(
            "Note Step 3",
            controllo.step_3_note
          );
        }

        row(
          "Step 4 - Azioni correttive",
          yesNo(
            controllo
              .step_4_completato
          )
        );

        if (
          controllo.step_4_note
        ) {
          row(
            "Note Step 4",
            controllo.step_4_note
          );
        }
      }
    }

    /*
     * Footer su tutte le pagine.
     */
    const pages =
      pdfDoc.getPages();

    pages.forEach(
      (pdfPage, index) => {
        pdfPage.drawLine({
          start: {
            x: 50,
            y: 42,
          },
          end: {
            x:
              pageWidth - 50,
            y: 42,
          },
          thickness: 0.5,
          color: rgb(
            0.82,
            0.84,
            0.87
          ),
        });

        pdfPage.drawText(
          "Studio Manager Pro - Controllo di gestione",
          {
            x: 50,
            y: 27,
            size: 8,
            font,
            color: rgb(
              0.4,
              0.43,
              0.5
            ),
          }
        );

        pdfPage.drawText(
          `Pagina ${index + 1} di ${pages.length}`,
          {
            x: 455,
            y: 27,
            size: 8,
            font,
            color: rgb(
              0.4,
              0.43,
              0.5
            ),
          }
        );
      }
    );

    const pdfBytes =
      await pdfDoc.save();

    return new NextResponse(
      Buffer.from(pdfBytes),
      {
        status: 200,
        headers: {
          "Content-Type":
            "application/pdf",

          "Content-Disposition":
            `inline; filename="controllo-gestione-${societa
              .replace(
                /[^a-zA-Z0-9]+/g,
                "-"
              )
              .toLowerCase()}-${anno}.pdf"`,
        },
      }
    );
  } catch (err: any) {
    console.error(
      "Errore report controllo di gestione:",
      err
    );

    return NextResponse.json(
      {
        error:
          err?.message ||
          "Errore generazione PDF",
      },
      {
        status: 500,
      }
    );
  }
}
