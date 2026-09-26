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
  utente_operatore_ids,
  utente_professionista_ids,
  utente_payroll_ids,
  professionista_payroll_ids,
  utente_consulenza_ids,
  professionista_consulenza_ids,
  tipo_prestazione_ids,
  tipi_redditi,
  tipi_cliente,
  inclusione_stampa,
  settori,

  // Compatibilità con eventuali link vecchi già salvati.
  utente_operatore_id,
  utente_professionista_id,
  tipo_prestazione_id,
  tipo_redditi,
  tipo_cliente,
  settore_fiscale,
  settore_lavoro,
  settore_consulenza,
} = req.query;

  const parseMulti = (value: string | string[] | undefined) => {
    const raw = Array.isArray(value) ? value.join(",") : String(value || "");
    if (!raw || raw.toLowerCase() === "tutti") return [];
    return Array.from(
      new Set(
        raw
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      )
    );
  };

  const operatoriIds = parseMulti(
    (utente_operatore_ids ?? utente_operatore_id) as string | string[] | undefined
  );
  const professionistiIds = parseMulti(
    (utente_professionista_ids ?? utente_professionista_id) as string | string[] | undefined
  );
  const utentiPayrollIds = parseMulti(
    utente_payroll_ids as string | string[] | undefined
  );
  const professionistiPayrollIds = parseMulti(
    professionista_payroll_ids as string | string[] | undefined
  );
  const utentiConsulenzaIds = parseMulti(
    utente_consulenza_ids as string | string[] | undefined
  );
  const professionistiConsulenzaIds = parseMulti(
    professionista_consulenza_ids as string | string[] | undefined
  );
  const prestazioniIds = parseMulti(
    (tipo_prestazione_ids ?? tipo_prestazione_id) as string | string[] | undefined
  );
  const redditiSelezionati = parseMulti(
    (tipi_redditi ?? tipo_redditi) as string | string[] | undefined
  );
  const tipiClienteSelezionati = parseMulti(
    (tipi_cliente ?? tipo_cliente) as string | string[] | undefined
  );
  const inclusioneStampaSelezionata = parseMulti(
    inclusione_stampa as string | string[] | undefined
  );

  let settoriSelezionatiNuovi = parseMulti(settori as string | string[] | undefined);

  // Compatibilità con il vecchio filtro a tre SI/NO.
  if (settoriSelezionatiNuovi.length === 0 && !settori) {
    if (settore_fiscale === "true") settoriSelezionatiNuovi.push("fiscale");
    if (settore_lavoro === "true") settoriSelezionatiNuovi.push("lavoro");
    if (settore_consulenza === "true") settoriSelezionatiNuovi.push("consulenza");
  }

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
tipo_cliente,
tipo_redditi,
settore_fiscale,
        settore_lavoro,
        settore_consulenza,
        utente_operatore_id,
        utente_professionista_id,
        utente_payroll_id,
        professionista_payroll_id,
        utente_consulenza_id,
        professionista_consulenza_id,
        tipo_prestazione_id,
        utente_fiscale:tbutenti!tbclienti_utente_operatore_id_fkey(nome, cognome),
        professionista:tbutenti!tbclienti_utente_professionista_id_fkey(nome, cognome),
        prestazione:tbprestazioni!tbclienti_tipo_prestazione_id_fkey(descrizione)
      `)
      .eq("studio_id", studio_id)
      .eq("cliente", true)
      .eq("attivo", true)
      .order("ragione_sociale", { ascending: true });

    if (operatoriIds.length > 0) {
      query = query.in("utente_operatore_id", operatoriIds);
    }

    if (professionistiIds.length > 0) {
      query = query.in("utente_professionista_id", professionistiIds);
    }

    if (utentiPayrollIds.length > 0) {
      query = query.in("utente_payroll_id", utentiPayrollIds);
    }

    if (professionistiPayrollIds.length > 0) {
      query = query.in("professionista_payroll_id", professionistiPayrollIds);
    }

    if (utentiConsulenzaIds.length > 0) {
      query = query.in("utente_consulenza_id", utentiConsulenzaIds);
    }

    if (professionistiConsulenzaIds.length > 0) {
      query = query.in("professionista_consulenza_id", professionistiConsulenzaIds);
    }

    if (prestazioniIds.length > 0) {
      query = query.in("tipo_prestazione_id", prestazioniIds);
    }

    if (redditiSelezionati.length > 0) {
      query = query.in("tipo_redditi", redditiSelezionati);
    }

    if (tipiClienteSelezionati.length > 0) {
      query = query.in("tipo_cliente", tipiClienteSelezionati);
    }

    const stampaInclusi = inclusioneStampaSelezionata.includes("inclusi");
    const stampaEsclusi = inclusioneStampaSelezionata.includes("esclusi");

    if (stampaInclusi && !stampaEsclusi) {
      query = query.eq("flag_stampa_lista_clienti", true);
    } else if (stampaEsclusi && !stampaInclusi) {
      query = query.eq("flag_stampa_lista_clienti", false);
    }

    const condizioniSettore: string[] = [];
    if (settoriSelezionatiNuovi.includes("fiscale")) {
      condizioniSettore.push("settore_fiscale.eq.true");
    }
    if (settoriSelezionatiNuovi.includes("lavoro")) {
      condizioniSettore.push("settore_lavoro.eq.true");
    }
    if (settoriSelezionatiNuovi.includes("consulenza")) {
      condizioniSettore.push("settore_consulenza.eq.true");
    }

    if (condizioniSettore.length > 0) {
      query = query.or(condizioniSettore.join(","));
    }

    const { data, error } = await query;

    if (error) {
      console.error("Errore stampa lista clienti:", error);
      return res.status(500).json({ error: error.message });
    }

  const clienti = data ?? [];

  const tuttiResponsabiliIds = Array.from(
    new Set([
      ...operatoriIds,
      ...professionistiIds,
      ...utentiPayrollIds,
      ...professionistiPayrollIds,
      ...utentiConsulenzaIds,
      ...professionistiConsulenzaIds,
    ])
  );

  const nomiResponsabili = new Map<string, string>();

  if (tuttiResponsabiliIds.length > 0) {
    const { data: responsabili, error: responsabiliError } = await supabase
      .from("tbutenti")
      .select("id, nome, cognome")
      .in("id", tuttiResponsabiliIds);

    if (responsabiliError) {
      console.error("Errore lettura responsabili stampa:", responsabiliError);
    } else {
      (responsabili || []).forEach((utente: any) => {
        nomiResponsabili.set(String(utente.id), nomeCompleto(utente));
      });
    }
  }

  const nomiDaIds = (ids: string[]) =>
    ids.length > 0
      ? ids
          .map((id) => nomiResponsabili.get(id) || id)
          .filter(Boolean)
          .join(", ")
      : "Tutti";

  const settoriPerIntestazione =
    settoriSelezionatiNuovi.length > 0
      ? settoriSelezionatiNuovi
      : ["fiscale", "lavoro", "consulenza"];

  const righeResponsabili: string[] = [];

  if (settoriPerIntestazione.includes("fiscale")) {
    righeResponsabili.push(
      `Fiscale - Utente: ${nomiDaIds(operatoriIds)} | Professionista: ${nomiDaIds(professionistiIds)}`
    );
  }

  if (settoriPerIntestazione.includes("lavoro")) {
    righeResponsabili.push(
      `Payroll - Utente: ${nomiDaIds(utentiPayrollIds)} | Professionista: ${nomiDaIds(professionistiPayrollIds)}`
    );
  }

  if (settoriPerIntestazione.includes("consulenza")) {
    righeResponsabili.push(
      `Consulenza - Utente: ${nomiDaIds(utentiConsulenzaIds)} | Professionista: ${nomiDaIds(professionistiConsulenzaIds)}`
    );
  }

  const titoloReport = "Lista Clienti";

    if (format === "excel") {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Clienti");

      worksheet.columns = [
        { key: "cod_cliente", width: 18 },
        { key: "ragione_sociale", width: 40 },
        { key: "partita_iva", width: 16 },
        { key: "codice_fiscale", width: 18 },
        { key: "prestazione", width: 30 },
        { key: "tipo_redditi", width: 14 },
        { key: "settore_fiscale", width: 16 },
        { key: "settore_lavoro", width: 16 },
        { key: "settore_consulenza", width: 20 },
      ];

      worksheet.mergeCells("A1:I1");
      worksheet.getCell("A1").value = "STUDIO MANAGER PRO";
      worksheet.getCell("A1").font = { bold: true, size: 16 };
      worksheet.getCell("A1").alignment = { horizontal: "center" };

      worksheet.mergeCells("A2:I2");
      worksheet.getCell("A2").value = titoloReport;
      worksheet.getCell("A2").font = { bold: true, size: 13 };
      worksheet.getCell("A2").alignment = { horizontal: "center" };

      worksheet.getCell("A3").value = `Data stampa: ${new Date().toLocaleDateString("it-IT")}`;

      let metadataRow = 4;
      righeResponsabili.forEach((riga) => {
        worksheet.mergeCells(`A${metadataRow}:I${metadataRow}`);
        worksheet.getCell(`A${metadataRow}`).value = riga;
        worksheet.getCell(`A${metadataRow}`).font = { italic: true };
        metadataRow += 1;
      });

      const headerRow = metadataRow + 1;
      const intestazioni = [
        "Codice Cliente",
        "Ragione Sociale",
        "P.IVA",
        "Codice Fiscale",
        "Prestazione",
        "Tipo Redditi",
        "Settore Fiscale",
        "Settore Lavoro",
        "Settore Consulenza",
      ];

      worksheet.addRow([]);
      const header = worksheet.addRow(intestazioni);
      header.font = { bold: true };

      clienti.forEach((c: any) => {
        worksheet.addRow({
          cod_cliente: c.cod_cliente || "",
          ragione_sociale: c.ragione_sociale || "",
          partita_iva: c.partita_iva || "",
          codice_fiscale: c.codice_fiscale || "",
          prestazione: c.prestazione?.descrizione || "",
          tipo_redditi: c.tipo_redditi || "",
          settore_fiscale: c.settore_fiscale ? "SI" : "NO",
          settore_lavoro: c.settore_lavoro ? "SI" : "NO",
          settore_consulenza: c.settore_consulenza ? "SI" : "NO",
        });
      });

      worksheet.views = [{ state: "frozen", ySplit: headerRow }];

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
      doc.fontSize(13).text(titoloReport, { align: "center" });
      doc.moveDown(0.5);
      doc
        .fontSize(9)
        .text(`Data stampa: ${new Date().toLocaleDateString("it-IT")}`);

      if (righeResponsabili.length > 0) {
        doc.moveDown(0.35);
        doc.font("Helvetica").fontSize(8);
        righeResponsabili.forEach((riga) => {
          doc.text(riga, { align: "left" });
        });
      }

      doc.moveDown();

      const startX = 30;
      let y = doc.y;

      const columns = [
        { label: "Cod.", x: startX, width: 70 },
        { label: "Ragione Sociale", x: startX + 75, width: 255 },
        { label: "P.IVA", x: startX + 335, width: 85 },
        { label: "Codice Fiscale", x: startX + 425, width: 105 },
        { label: "Tipo Redditi", x: startX + 535, width: 80 },
        { label: "Prestazione", x: startX + 620, width: 170 },
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
          c.partita_iva || "",
          c.codice_fiscale || "",
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
