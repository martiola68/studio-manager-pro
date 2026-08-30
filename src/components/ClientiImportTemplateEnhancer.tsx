import { useEffect } from "react";

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
  ["Tipo Cliente", "Sì", "Persona fisica | Altro", "-", "Se omesso il sistema usa Persona fisica."],
  ["Tipologia Cliente", "Sì", "Interno | Esterno", "-", "Se omesso il sistema usa Interno."],
  ["Settore Fiscale (VERO/FALSO)", "No", "VERO | FALSO", "-", "Usare esclusivamente VERO oppure FALSO."],
  ["Settore Lavoro (VERO/FALSO)", "No", "VERO | FALSO", "-", "Usare esclusivamente VERO oppure FALSO."],
  ["Settore Consulenza (VERO/FALSO)", "No", "VERO | FALSO", "-", "Usare esclusivamente VERO oppure FALSO."],
  ["Ragione Sociale", "Sì", "Testo", "255", "Campo indispensabile per l'importazione. Per persona fisica indicare COGNOME NOME."],
  ["Partita IVA", "No", "11 cifre", "11", "Solo numeri, senza spazi o prefissi IT."],
  ["Codice Fiscale", "Sì", "16 caratteri PF oppure 11 cifre per altri soggetti", "16", "Inserire senza spazi. Per persona fisica usare il CF di 16 caratteri."],
  ["Indirizzo", "No", "Testo", "255", "Via/piazza e numero civico."],
  ["CAP", "No", "5 cifre", "5", "La colonna è in formato testo per conservare eventuali zeri iniziali."],
  ["Città", "No", "Testo", "100", "Comune/località."],
  ["Provincia", "No", "Sigla provincia", "2", "Esempio: RM, MI, TO."],
  ["Email", "No", "Indirizzo email", "255", "Esempio: amministrazione@cliente.it"],
  ["Attivo", "No", "VERO | FALSO", "-", "Se non valorizzato il comportamento resta quello previsto dall'importatore."],
  ["Note", "No", "Testo libero", "1000", "Eventuali annotazioni sul cliente."],
];

function csvEscape(value: string) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
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
  instructions.getCell("A2").value = "Compilare esclusivamente il foglio DATI DA IMPORTARE. Non modificare i nomi delle colonne.";
  instructions.getCell("A2").font = { bold: true, color: { argb: "FF7F1D1D" } };
  instructions.getCell("A2").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF2F2" } };
  instructions.getCell("A2").alignment = { wrapText: true };

  instructions.mergeCells("A3:E3");
  instructions.getCell("A3").value = "I campi obbligatori sono evidenziati in rosso nel foglio dati. Le colonne VERO/FALSO dispongono di menu a tendina.";
  instructions.getCell("A3").alignment = { wrapText: true };

  instructions.getRow(5).values = ["Campo", "Obbligatorio", "Formato / valori ammessi", "Max caratteri", "Istruzioni / esempio"];
  const iHeader = instructions.getRange ? null : null;
  instructions.getRow(5).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E78" } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = {
      top: { style: "thin", color: { argb: "FFD1D5DB" } },
      left: { style: "thin", color: { argb: "FFD1D5DB" } },
      bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
      right: { style: "thin", color: { argb: "FFD1D5DB" } },
    };
  });

  FIELD_RULES.forEach((rule, index) => {
    const row = instructions.addRow(rule);
    row.alignment = { vertical: "top", wrapText: true };
    row.eachCell((cell) => {
      cell.border = {
        top: { style: "thin", color: { argb: "FFE5E7EB" } },
        left: { style: "thin", color: { argb: "FFE5E7EB" } },
        bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
        right: { style: "thin", color: { argb: "FFE5E7EB" } },
      };
    });
    if (rule[1] === "Sì") {
      row.getCell(2).font = { bold: true, color: { argb: "FFB91C1C" } };
      row.getCell(1).font = { bold: true };
      row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF7ED" } };
    } else if (index % 2 === 1) {
      row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
    }
  });

  instructions.columns = [
    { width: 34 },
    { width: 15 },
    { width: 36 },
    { width: 16 },
    { width: 62 },
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
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: required ? "FFB91C1C" : "FF166534" },
    };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = {
      top: { style: "thin", color: { argb: "FFFFFFFF" } },
      left: { style: "thin", color: { argb: "FFFFFFFF" } },
      bottom: { style: "thin", color: { argb: "FFFFFFFF" } },
      right: { style: "thin", color: { argb: "FFFFFFFF" } },
    };
  });

  const example = [
    "Altro",
    "Interno",
    "VERO",
    "FALSO",
    "FALSO",
    "ESEMPIO SRL",
    "01234567890",
    "01234567890",
    "Via Roma 1",
    "00100",
    "Roma",
    "RM",
    "info@esempio.it",
    "VERO",
    "Riga di esempio: cancellarla prima dell'importazione",
  ];
  data.addRow(example);

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

  data.getRow(2).font = { italic: true, color: { argb: "FF6B7280" } };
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

async function excelToCsvFile(file: File) {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());

  const sheet =
    workbook.getWorksheet("DATI DA IMPORTARE") ||
    workbook.getWorksheet("Dati da importare") ||
    workbook.worksheets[1] ||
    workbook.worksheets[0];

  if (!sheet) throw new Error("Il file Excel non contiene fogli leggibili.");

  const headerRow = sheet.getRow(1);
  const headerCount = HEADERS.length;
  const actualHeaders = Array.from({ length: headerCount }, (_, index) =>
    headerRow.getCell(index + 1).text.trim()
  );

  if (actualHeaders.join("|") !== HEADERS.join("|")) {
    throw new Error(
      "Il foglio DATI DA IMPORTARE non ha la struttura prevista. Scarica nuovamente il template e non modificare le intestazioni."
    );
  }

  const lines = [HEADERS.map(csvEscape).join(",")];
  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const values = Array.from({ length: headerCount }, (_, index) =>
      row.getCell(index + 1).text.trim()
    );
    if (values.every((value) => !value)) continue;
    lines.push(values.map(csvEscape).join(","));
  }

  return new File([lines.join("\n")], "importazione_clienti_da_excel.csv", {
    type: "text/csv;charset=utf-8",
  });
}

export function ClientiImportTemplateEnhancer() {
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

      void excelToCsvFile(file)
        .then((csvFile) => {
          const transfer = new DataTransfer();
          transfer.items.add(csvFile);
          input.files = transfer.files;
          input.dispatchEvent(new Event("change", { bubbles: true }));
        })
        .catch((error) => {
          console.error("Errore lettura template Excel clienti", error);
          window.alert(error instanceof Error ? error.message : "Errore nella lettura del file Excel.");
          input.value = "";
        });
    };

    document.addEventListener("click", onClickCapture, true);
    document.addEventListener("change", onChangeCapture, true);

    return () => {
      observer.disconnect();
      document.removeEventListener("click", onClickCapture, true);
      document.removeEventListener("change", onChangeCapture, true);
    };
  }, []);

  return null;
}
