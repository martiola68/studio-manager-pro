import { useEffect } from "react";
import { useStudio } from "@/contexts/StudioContext";
import { getSupabaseClient } from "@/lib/supabase/client";

const HEADERS = [
  "Tipo Cliente",
  "Tipologia Cliente",
  "Settore Fiscale (VERO/FALSO)",
  "Settore Lavoro (VERO/FALSO)",
  "Settore Consulenza (VERO/FALSO)",
  "Ragione Sociale",
  "Partita IVA",
  "Codice Fiscale",
  "Indirizzo",
  "CAP",
  "Città",
  "Provincia",
  "Email",
  "Attivo",
  "Note",
];

const FIELD_RULES = [
  ["Tipo Cliente", "Sì", "Persona fisica | Altro", "-", "Per le persone fisiche usare Persona fisica; per società/enti usare Altro."],
  ["Tipologia Cliente", "Sì", "Interno | Esterno", "-", "Indicare la tipologia anagrafica."],
  ["Settore Fiscale (VERO/FALSO)", "No", "VERO | FALSO", "-", "Se tutti i settori sono vuoti viene impostato automaticamente Settore Fiscale = VERO."],
  ["Settore Lavoro (VERO/FALSO)", "No", "VERO | FALSO", "-", "Usare esclusivamente VERO oppure FALSO."],
  ["Settore Consulenza (VERO/FALSO)", "No", "VERO | FALSO", "-", "Usare esclusivamente VERO oppure FALSO."],
  ["Ragione Sociale", "Sì", "Testo", "255", "Per persona fisica indicare COGNOME NOME; per società indicare la denominazione completa."],
  ["Partita IVA", "No", "11 cifre", "11", "Solo numeri, senza spazi o prefisso IT."],
  ["Codice Fiscale", "Sì", "16 caratteri PF oppure 11 cifre altri soggetti", "16", "Senza spazi. Il file viene controllato prima dell'inserimento."],
  ["Indirizzo", "No", "Testo", "255", "Via/piazza e numero civico."],
  ["CAP", "No", "5 cifre", "5", "Formato testo per conservare eventuali zeri iniziali."],
  ["Città", "No", "Testo", "100", "Comune/località."],
  ["Provincia", "No", "Sigla provincia", "2", "Esempio: RM, MI, TO."],
  ["Email", "No", "Indirizzo email", "255", "Esempio: amministrazione@cliente.it"],
  ["Attivo", "No", "VERO | FALSO", "-", "Se vuoto viene impostato VERO."],
  ["Note", "No", "Testo libero", "1000", "Eventuali annotazioni sul cliente."],
] as const;

function normalizeBoolean(value: string, defaultValue: boolean) {
  const normalized = value.trim().toUpperCase();
  if (!normalized) return defaultValue;
  if (["VERO", "TRUE", "1", "SI", "SÌ"].includes(normalized)) return true;
  if (["FALSO", "FALSE", "0", "NO"].includes(normalized)) return false;
  throw new Error(`Valore booleano non valido: ${value}. Usare VERO o FALSO.`);
}

function validateRow(row: Record<string, string>, rowNumber: number) {
  const tipo = row["Tipo Cliente"].trim();
  const tipologia = row["Tipologia Cliente"].trim();
  const ragione = row["Ragione Sociale"].trim();
  const cf = row["Codice Fiscale"].trim().toUpperCase();

  if (!tipo || !["Persona fisica", "Altro"].includes(tipo)) {
    throw new Error(`Riga ${rowNumber}: Tipo Cliente deve essere Persona fisica oppure Altro.`);
  }
  if (!tipologia || !["Interno", "Esterno"].includes(tipologia)) {
    throw new Error(`Riga ${rowNumber}: Tipologia Cliente deve essere Interno oppure Esterno.`);
  }
  if (!ragione) throw new Error(`Riga ${rowNumber}: Ragione Sociale obbligatoria.`);
  if (!cf) throw new Error(`Riga ${rowNumber}: Codice Fiscale obbligatorio.`);

  if (tipo === "Persona fisica" && !/^[A-Z0-9]{16}$/.test(cf)) {
    throw new Error(`Riga ${rowNumber}: il Codice Fiscale della persona fisica deve avere 16 caratteri.`);
  }
  if (tipo === "Altro" && !/^\d{11}$/.test(cf)) {
    throw new Error(`Riga ${rowNumber}: per società/enti il Codice Fiscale deve contenere 11 cifre.`);
  }

  const piva = row["Partita IVA"].trim();
  if (piva && !/^\d{11}$/.test(piva)) {
    throw new Error(`Riga ${rowNumber}: la Partita IVA deve contenere 11 cifre.`);
  }
  const cap = row["CAP"].trim();
  if (cap && !/^\d{5}$/.test(cap)) {
    throw new Error(`Riga ${rowNumber}: il CAP deve contenere 5 cifre.`);
  }
  const provincia = row["Provincia"].trim();
  if (provincia && provincia.length !== 2) {
    throw new Error(`Riga ${rowNumber}: la Provincia deve essere una sigla di 2 caratteri.`);
  }
}

async function downloadExcelTemplate() {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Studio Manager Pro";
  workbook.created = new Date();

  const instructions = workbook.addWorksheet("ISTRUZIONI", {
    views: [{ state: "frozen", ySplit: 5 }],
  });

  instructions.mergeCells("A1:E1");
  instructions.getCell("A1").value = "STUDIO MANAGER PRO - TEMPLATE IMPORTAZIONE CLIENTI";
  instructions.getCell("A1").font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
  instructions.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF166534" } };
  instructions.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
  instructions.getRow(1).height = 28;

  instructions.mergeCells("A2:E2");
  instructions.getCell("A2").value = "Compilare esclusivamente il foglio DATI DA IMPORTARE. Non modificare, rinominare o spostare le colonne.";
  instructions.getCell("A2").font = { bold: true, color: { argb: "FF7F1D1D" } };
  instructions.getCell("A2").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF2F2" } };
  instructions.getCell("A2").alignment = { wrapText: true };

  instructions.mergeCells("A3:E3");
  instructions.getCell("A3").value = "ROSSO = obbligatorio. VERDE = facoltativo. I campi a scelta dispongono di menu a tendina.";
  instructions.getCell("A3").alignment = { wrapText: true };

  instructions.getRow(5).values = ["Campo", "Obbligatorio", "Formato / valori ammessi", "Max caratteri", "Istruzioni / esempio"];
  instructions.getRow(5).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E78" } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  });

  FIELD_RULES.forEach((rule, index) => {
    const row = instructions.addRow([...rule]);
    row.alignment = { vertical: "top", wrapText: true };
    if (rule[1] === "Sì") {
      row.getCell(1).font = { bold: true };
      row.getCell(2).font = { bold: true, color: { argb: "FFB91C1C" } };
      row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF7ED" } };
    } else if (index % 2 === 1) {
      row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
    }
  });

  instructions.columns = [
    { width: 34 },
    { width: 15 },
    { width: 40 },
    { width: 16 },
    { width: 68 },
  ];

  const data = workbook.addWorksheet("DATI DA IMPORTARE", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  data.addRow(HEADERS);

  const mandatory = new Set(["Tipo Cliente", "Tipologia Cliente", "Ragione Sociale", "Codice Fiscale"]);
  data.getRow(1).height = 42;
  data.getRow(1).eachCell((cell) => {
    const required = mandatory.has(String(cell.value));
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: required ? "FFB91C1C" : "FF166534" } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  });

  const widths = [18, 20, 24, 24, 28, 34, 16, 20, 30, 10, 20, 12, 30, 12, 42];
  data.columns.forEach((col, idx) => {
    col.width = widths[idx] ?? 18;
  });

  for (let row = 2; row <= 1001; row += 1) {
    data.getCell(row, 1).dataValidation = {
      type: "list",
      allowBlank: false,
      formulae: ['"Persona fisica,Altro"'],
      showErrorMessage: true,
      errorTitle: "Valore non valido",
      error: "Seleziona Persona fisica oppure Altro.",
    };
    data.getCell(row, 2).dataValidation = {
      type: "list",
      allowBlank: false,
      formulae: ['"Interno,Esterno"'],
      showErrorMessage: true,
      errorTitle: "Valore non valido",
      error: "Seleziona Interno oppure Esterno.",
    };
    [3, 4, 5, 14].forEach((col) => {
      data.getCell(row, col).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: ['"VERO,FALSO"'],
        showErrorMessage: true,
        errorTitle: "Valore non valido",
        error: "Inserire esclusivamente VERO oppure FALSO.",
      };
    });
    [7, 8, 10].forEach((col) => {
      data.getCell(row, col).numFmt = "@";
    });
  }

  data.autoFilter = { from: "A1", to: "O1" };

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "Template_Importazione_Clienti_SMP.xlsx";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function readExcelRows(file: File) {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());

  const sheet = workbook.getWorksheet("DATI DA IMPORTARE");
  if (!sheet) throw new Error("Manca il foglio DATI DA IMPORTARE.");

  const actualHeaders = HEADERS.map((_, index) => sheet.getRow(1).getCell(index + 1).text.trim());
  if (actualHeaders.join("|") !== HEADERS.join("|")) {
    throw new Error("Le colonne del foglio DATI DA IMPORTARE sono state modificate. Scarica un nuovo template.");
  }

  const rows: { rowNumber: number; values: Record<string, string> }[] = [];
  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const excelRow = sheet.getRow(rowNumber);
    const values: Record<string, string> = {};
    HEADERS.forEach((header, index) => {
      values[header] = excelRow.getCell(index + 1).text.trim();
    });
    if (HEADERS.every((header) => !values[header])) continue;
    rows.push({ rowNumber, values });
  }
  return rows;
}

export function ClientiImportTemplateEnhancer() {
  const { studioId } = useStudio();

  useEffect(() => {
    const enhanceDialog = () => {
      const input = document.getElementById("csv-file-clienti") as HTMLInputElement | null;
      if (input) {
        input.accept = ".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv";
        const label = document.querySelector('label[for="csv-file-clienti"]');
        if (label) label.textContent = "Carica File Excel/CSV";
      }

      document.querySelectorAll("button").forEach((button) => {
        if (button.textContent?.trim() === "Scarica Template CSV") {
          button.textContent = "Scarica Template Excel";
          button.setAttribute("data-smp-clienti-template", "excel");
        }
      });
    };

    const observer = new MutationObserver(enhanceDialog);
    observer.observe(document.body, { childList: true, subtree: true });
    enhanceDialog();

    const onClickCapture = (event: MouseEvent) => {
      const target = event.target as Element | null;
      const button = target?.closest("button");
      if (!button || button.getAttribute("data-smp-clienti-template") !== "excel") return;

      event.preventDefault();
      event.stopImmediatePropagation();
      void downloadExcelTemplate().catch((error) => {
        console.error("Errore generazione template Excel clienti", error);
        window.alert("Impossibile generare il template Excel. Riprova.");
      });
    };

    const onChangeCapture = (event: Event) => {
      const input = event.target as HTMLInputElement | null;
      if (!input || input.id !== "csv-file-clienti") return;
      const file = input.files?.[0];
      if (!file || !/\.xlsx$/i.test(file.name)) return;

      event.preventDefault();
      event.stopImmediatePropagation();

      void (async () => {
        try {
          if (!studioId) throw new Error("Studio non disponibile. Ricarica la pagina e riprova.");

          input.disabled = true;
          const rows = await readExcelRows(file);
          if (!rows.length) throw new Error("Il foglio DATI DA IMPORTARE non contiene righe da importare.");

          const supabase = getSupabaseClient();
          let imported = 0;
          let duplicates = 0;
          const errors: string[] = [];

          for (const item of rows) {
            try {
              const row = item.values;
              validateRow(row, item.rowNumber);

              const cf = row["Codice Fiscale"].trim().toUpperCase();
              const { data: existing, error: duplicateError } = await supabase
                .from("tbclienti")
                .select("id")
                .eq("studio_id", studioId)
                .eq("codice_fiscale", cf)
                .maybeSingle();

              if (duplicateError) throw duplicateError;
              if (existing?.id) {
                duplicates += 1;
                continue;
              }

              const fiscalRaw = row["Settore Fiscale (VERO/FALSO)"];
              const lavoroRaw = row["Settore Lavoro (VERO/FALSO)"];
              const consulenzaRaw = row["Settore Consulenza (VERO/FALSO)"];
              const nessunSettoreCompilato = !fiscalRaw.trim() && !lavoroRaw.trim() && !consulenzaRaw.trim();

              const payload = {
                studio_id: studioId,
                tipo_cliente: row["Tipo Cliente"],
                tipologia_cliente: row["Tipologia Cliente"],
                ragione_sociale: row["Ragione Sociale"],
                codice_fiscale: cf,
                partita_iva: row["Partita IVA"].trim() || null,
                indirizzo: row["Indirizzo"].trim() || null,
                cap: row["CAP"].trim() || null,
                citta: row["Città"].trim() || null,
                provincia: row["Provincia"].trim().toUpperCase() || null,
                email: row["Email"].trim() || null,
                settore_fiscale: nessunSettoreCompilato ? true : normalizeBoolean(fiscalRaw, false),
                settore_lavoro: normalizeBoolean(lavoroRaw, false),
                settore_consulenza: normalizeBoolean(consulenzaRaw, false),
                attivo: normalizeBoolean(row["Attivo"], true),
                cliente: true,
                note: row["Note"].trim() || null,
              };

              const { error: insertError } = await supabase.from("tbclienti").insert(payload);
              if (insertError) throw insertError;
              imported += 1;
            } catch (error) {
              const message = error instanceof Error ? error.message : "Errore sconosciuto";
              errors.push(message.startsWith("Riga ") ? message : `Riga ${item.rowNumber}: ${message}`);
            }
          }

          const summary = [
            `${imported} clienti importati`,
            duplicates ? `${duplicates} duplicati saltati` : "",
            errors.length ? `${errors.length} righe con errore` : "",
          ].filter(Boolean).join("\n");

          if (errors.length) {
            console.error("Errori importazione Excel clienti:", errors);
            window.alert(`${summary}\n\nPrimi errori:\n${errors.slice(0, 5).join("\n")}`);
          } else {
            window.alert(summary);
          }

          input.value = "";
          if (imported > 0) window.location.reload();
        } catch (error) {
          console.error("Errore importazione Excel clienti", error);
          window.alert(error instanceof Error ? error.message : "Errore nell'importazione del file Excel.");
          input.value = "";
        } finally {
          input.disabled = false;
        }
      })();
    };

    document.addEventListener("click", onClickCapture, true);
    document.addEventListener("change", onChangeCapture, true);

    return () => {
      observer.disconnect();
      document.removeEventListener("click", onClickCapture, true);
      document.removeEventListener("change", onChangeCapture, true);
    };
  }, [studioId]);

  return null;
}
