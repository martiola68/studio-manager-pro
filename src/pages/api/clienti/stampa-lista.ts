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

function aliasUtente(u: any) {
  const nome = String(u?.nome || "").trim();
  const cognome = String(u?.cognome || "").trim();
  return `${nome.charAt(0)}${cognome.charAt(0)}`.toUpperCase() || "--";
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

  type ResponsabileFiltro = {
    mode: "none" | "all" | "ids";
    ids: string[];
  };

  const parseResponsabile = (
    value: string | string[] | undefined
  ): ResponsabileFiltro => {
    const raw = Array.isArray(value) ? value.join(",") : String(value || "");
    const normalized = raw.trim().toLowerCase();

    if (!raw || normalized === "nessuno") {
      return { mode: "none", ids: [] };
    }

    if (normalized === "tutti") {
      return { mode: "all", ids: [] };
    }

    return {
      mode: "ids",
      ids: Array.from(
        new Set(
          raw
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean)
        )
      ),
    };
  };

  const operatori = parseResponsabile(
    (utente_operatore_ids ?? utente_operatore_id) as string | string[] | undefined
  );
  const professionisti = parseResponsabile(
    (utente_professionista_ids ?? utente_professionista_id) as string | string[] | undefined
  );
  const utentiPayroll = parseResponsabile(
    utente_payroll_ids as string | string[] | undefined
  );
  const professionistiPayroll = parseResponsabile(
    professionista_payroll_ids as string | string[] | undefined
  );
  const utentiConsulenza = parseResponsabile(
    utente_consulenza_ids as string | string[] | undefined
  );
  const professionistiConsulenza = parseResponsabile(
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
        professionista_fiscale:tbutenti!tbclienti_utente_professionista_id_fkey(nome, cognome),
        utente_payroll:tbutenti!tbclienti_utente_payroll_id_fkey(nome, cognome),
        professionista_payroll:tbutenti!tbclienti_professionista_payroll_id_fkey(nome, cognome),
        utente_consulenza:tbutenti!tbclienti_utente_consulenza_id_fkey(nome, cognome),
        professionista_consulenza:tbutenti!tbclienti_professionista_consulenza_id_fkey(nome, cognome),
        prestazione:tbprestazioni!tbclienti_tipo_prestazione_id_fkey(descrizione)
      `)
      .eq("studio_id", studio_id)
      .eq("cliente", true)
      .eq("attivo", true)
      .order("ragione_sociale", { ascending: true });

    const responsabili = [
      { field: "utente_operatore_id", filter: operatori },
      { field: "utente_professionista_id", filter: professionisti },
      { field: "utente_payroll_id", filter: utentiPayroll },
      { field: "professionista_payroll_id", filter: professionistiPayroll },
      { field: "utente_consulenza_id", filter: utentiConsulenza },
      { field: "professionista_consulenza_id", filter: professionistiConsulenza },
    ] as const;

    if (responsabili.every(({ filter }) => filter.mode === "none")) {
      return res.status(400).json({
        error: "Selezionare almeno un Utente o Professionista per la stampa",
      });
    }

    const condizioniResponsabili: string[] = [];

    responsabili.forEach(({ field, filter }) => {
      if (filter.mode === "all") {
        condizioniResponsabili.push(`${field}.not.is.null`);
      } else if (filter.mode === "ids" && filter.ids.length > 0) {
        condizioniResponsabili.push(`${field}.in.(${filter.ids.join(",")})`);
      }
    });

    if (condizioniResponsabili.length > 0) {
      query = query.or(condizioniResponsabili.join(","));
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
      ...operatori.ids,
      ...professionisti.ids,
      ...utentiPayroll.ids,
      ...professionistiPayroll.ids,
      ...utentiConsulenza.ids,
      ...professionistiConsulenza.ids,
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

  const descriviResponsabile = (filter: ResponsabileFiltro) => {
    if (filter.mode === "none") return "Nessuno";
    if (filter.mode === "all") return "Tutti";

    return filter.ids
      .map((id) => nomiResponsabili.get(id) || id)
      .filter(Boolean)
      .join(", ");
  };

  const righeResponsabili: string[] = [];

  if (operatori.mode !== "none" || professionisti.mode !== "none") {
    righeResponsabili.push(
      `Fiscale - Utente: ${descriviResponsabile(operatori)} | Professionista: ${descriviResponsabile(professionisti)}`
    );
  }

  if (utentiPayroll.mode !== "none" || professionistiPayroll.mode !== "none") {
    righeResponsabili.push(
      `Payroll - Utente: ${descriviResponsabile(utentiPayroll)} | Professionista: ${descriviResponsabile(professionistiPayroll)}`
    );
  }

  if (utentiConsulenza.mode !== "none" || professionistiConsulenza.mode !== "none") {
    righeResponsabili.push(
      `Consulenza - Utente: ${descriviResponsabile(utentiConsulenza)} | Professionista: ${descriviResponsabile(professionistiConsulenza)}`
    );
  }

  const titoloReport = "Lista Clienti";

  type ColonnaResponsabile = {
    key: string;
    label: string;
    filter: ResponsabileFiltro;
    relation: string;
  };

  const colonneResponsabili: ColonnaResponsabile[] = [
    { key: "uf", label: "UF", filter: operatori, relation: "utente_fiscale" },
    { key: "pf", label: "PF", filter: professionisti, relation: "professionista_fiscale" },
    { key: "up", label: "UP", filter: utentiPayroll, relation: "utente_payroll" },
    { key: "pp", label: "PP", filter: professionistiPayroll, relation: "professionista_payroll" },
    { key: "uc", label: "UC", filter: utentiConsulenza, relation: "utente_consulenza" },
    { key: "pc", label: "PC", filter: professionistiConsulenza, relation: "professionista_consulenza" },
  ].filter((colonna) => colonna.filter.mode !== "none");

  const aliasRelazione = (cliente: any, relation: string) => {
    const utente = cliente?.[relation];
    return utente ? aliasUtente(utente) : "";
  };

    if (format === "excel") {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Clienti");

      const excelColumns = [
        { key: "cod_cliente", header: "Codice Cliente", width: 18 },
        { key: "ragione_sociale", header: "Ragione Sociale", width: 40 },
        { key: "partita_iva", header: "P.IVA", width: 16 },
        { key: "codice_fiscale", header: "Codice Fiscale", width: 18 },
        ...colonneResponsabili.map((colonna) => ({
          key: colonna.key,
          header: colonna.label,
          width: 8,
        })),
        { key: "tipo_redditi", header: "Tipo Redditi", width: 14 },
        { key: "prestazione", header: "Prestazione", width: 30 },
      ];

      worksheet.columns = excelColumns.map(({ key, width }) => ({ key, width }));

      const lastColumnLetter = worksheet.getColumn(excelColumns.length).letter;

      worksheet.mergeCells(`A1:${lastColumnLetter}1`);
      worksheet.getCell("A1").value = "STUDIO MANAGER PRO";
      worksheet.getCell("A1").font = { bold: true, size: 16 };
      worksheet.getCell("A1").alignment = { horizontal: "center" };

      worksheet.mergeCells(`A2:${lastColumnLetter}2`);
      worksheet.getCell("A2").value = titoloReport;
      worksheet.getCell("A2").font = { bold: true, size: 13 };
      worksheet.getCell("A2").alignment = { horizontal: "center" };

      worksheet.getCell("A3").value = `Data stampa: ${new Date().toLocaleDateString("it-IT")}`;

      let metadataRow = 4;
      righeResponsabili.forEach((riga) => {
        worksheet.mergeCells(`A${metadataRow}:${lastColumnLetter}${metadataRow}`);
        worksheet.getCell(`A${metadataRow}`).value = riga;
        worksheet.getCell(`A${metadataRow}`).font = { italic: true };
        metadataRow += 1;
      });

      const headerRow = metadataRow + 1;
      worksheet.addRow([]);
      const header = worksheet.addRow(excelColumns.map((colonna) => colonna.header));
      header.font = { bold: true };

      clienti.forEach((c: any) => {
        const row: Record<string, string> = {
          cod_cliente: c.cod_cliente || "",
          ragione_sociale: c.ragione_sociale || "",
          partita_iva: c.partita_iva || "",
          codice_fiscale: c.codice_fiscale || "",
          tipo_redditi: c.tipo_redditi || "",
          prestazione: c.prestazione?.descrizione || "",
        };

        colonneResponsabili.forEach((colonna) => {
          row[colonna.key] = aliasRelazione(c, colonna.relation);
        });

        worksheet.addRow(row);
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

      const pdfColumnDefs = [
        { key: "cod_cliente", label: "Cod.", width: 52 },
        { key: "ragione_sociale", label: "Ragione Sociale", width: 190 },
        { key: "partita_iva", label: "P.IVA", width: 72 },
        { key: "codice_fiscale", label: "Codice Fiscale", width: 88 },
        ...colonneResponsabili.map((colonna) => ({
          key: colonna.key,
          label: colonna.label,
          width: 28,
        })),
        { key: "tipo_redditi", label: "Tipo Redditi", width: 75 },
        { key: "prestazione", label: "Prestazione", width: 110 },
      ];

      let currentX = startX;
      const columns = pdfColumnDefs.map((colonna) => {
        const result = { ...colonna, x: currentX };
        currentX += colonna.width + 4;
        return result;
      });

      const tableEndX = Math.min(currentX - 4, 810);

      const drawHeader = () => {
        doc.fontSize(8).font("Helvetica-Bold");

        columns.forEach((col) => {
          doc.text(col.label, col.x, y, {
            width: col.width,
          });
        });

        y += 16;
        doc.moveTo(startX, y).lineTo(tableEndX, y).stroke();
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

        const row: Record<string, string> = {
          cod_cliente: c.cod_cliente || "",
          ragione_sociale: c.ragione_sociale || "",
          partita_iva: c.partita_iva || "",
          codice_fiscale: c.codice_fiscale || "",
          tipo_redditi: c.tipo_redditi || "",
          prestazione: c.prestazione?.descrizione || "",
        };

        colonneResponsabili.forEach((colonna) => {
          row[colonna.key] = aliasRelazione(c, colonna.relation);
        });

        columns.forEach((col) => {
          doc.text(row[col.key] || "", col.x, y, {
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
