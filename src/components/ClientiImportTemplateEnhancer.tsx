import { useEffect, useState } from "react";
import { FileSpreadsheet, Loader2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
] as const;

type Header = (typeof HEADERS)[number];
type ImportRow = Record<Header, string>;

type ParsedRow = {
  rowNumber: number;
  values: ImportRow;
};

const FIELD_RULES = [
  ["Tipo Cliente", "Sì", "Persona fisica | Altro", "-", "Per persona fisica usare Persona fisica; per società/enti usare Altro."],
  ["Tipologia Cliente", "Sì", "Interno | Esterno", "-", "Indicare la tipologia dell'anagrafica."],
  ["Settore Fiscale (VERO/FALSO)", "No", "VERO | FALSO", "-", "Se tutti i settori sono vuoti, viene impostato automaticamente Settore Fiscale = VERO."],
  ["Settore Lavoro (VERO/FALSO)", "No", "VERO | FALSO", "-", "Usare VERO oppure FALSO."],
  ["Settore Consulenza (VERO/FALSO)", "No", "VERO | FALSO", "-", "Usare VERO oppure FALSO."],
  ["Ragione Sociale", "Sì", "Testo", "255", "Per persona fisica indicare COGNOME NOME; per società la denominazione completa."],
  ["Partita IVA", "No", "11 cifre", "11", "Solo numeri, senza prefisso IT."],
  ["Codice Fiscale", "Sì", "16 caratteri PF oppure 11 cifre altri soggetti", "16", "Inserire senza spazi."],
  ["Indirizzo", "No", "Testo", "255", "Via/piazza e numero civico."],
  ["CAP", "No", "5 cifre", "5", "Formato testo per conservare eventuali zeri iniziali."],
  ["Città", "No", "Testo", "100", "Comune/località."],
  ["Provincia", "No", "Sigla provincia", "2", "Esempio: RM, MI, TO."],
  ["Email", "No", "Indirizzo email", "255", "Esempio: amministrazione@cliente.it"],
  ["Attivo", "No", "VERO | FALSO", "-", "Se vuoto, viene impostato VERO."],
  ["Note", "No", "Testo libero", "1000", "Eventuali annotazioni sul cliente."],
] as const;

function blankRow(): ImportRow {
  return Object.fromEntries(HEADERS.map((header) => [header, ""])) as ImportRow;
}

function normalizeBoolean(value: string, defaultValue: boolean) {
  const normalized = value.trim().toUpperCase();
  if (!normalized) return defaultValue;
  if (["VERO", "TRUE", "1", "SI", "SÌ"].includes(normalized)) return true;
  if (["FALSO", "FALSE", "0", "NO"].includes(normalized)) return false;
  throw new Error(`Valore "${value}" non valido: usare VERO oppure FALSO.`);
}

function validateRow(row: ImportRow, rowNumber: number) {
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

  normalizeBoolean(row["Settore Fiscale (VERO/FALSO)"], false);
  normalizeBoolean(row["Settore Lavoro (VERO/FALSO)"], false);
  normalizeBoolean(row["Settore Consulenza (VERO/FALSO)"], false);
  normalizeBoolean(row["Attivo"], true);
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
  const title = instructions.getCell("A1");
  title.value = "STUDIO MANAGER PRO - TEMPLATE IMPORTAZIONE CLIENTI";
  title.font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
  title.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF166534" } };
  title.alignment = { horizontal: "center", vertical: "middle" };
  instructions.getRow(1).height = 28;

  instructions.mergeCells("A2:E2");
  const instruction = instructions.getCell("A2");
  instruction.value = "Compilare esclusivamente il foglio DATI DA IMPORTARE. Non rinominare, eliminare o spostare le colonne.";
  instruction.font = { bold: true, color: { argb: "FF991B1B" } };
  instruction.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF2F2" } };
  instruction.alignment = { wrapText: true };

  instructions.mergeCells("A3:E3");
  instructions.getCell("A3").value = "ROSSO = campo obbligatorio. VERDE = campo facoltativo. I campi a scelta hanno un menu a tendina.";
  instructions.getCell("A3").alignment = { wrapText: true };

  instructions.getRow(5).values = [
    "Campo",
    "Obbligatorio",
    "Formato / valori ammessi",
    "Max caratteri",
    "Istruzioni / esempio",
  ];
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
    { width: 42 },
    { width: 16 },
    { width: 68 },
  ];

  const data = workbook.addWorksheet("DATI DA IMPORTARE", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  data.addRow([...HEADERS]);

  const mandatory = new Set<Header>([
    "Tipo Cliente",
    "Tipologia Cliente",
    "Ragione Sociale",
    "Codice Fiscale",
  ]);

  data.getRow(1).height = 42;
  data.getRow(1).eachCell((cell) => {
    const required = mandatory.has(String(cell.value) as Header);
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: required ? "FFB91C1C" : "FF166534" },
    };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  });

  const widths = [18, 20, 24, 24, 28, 34, 16, 20, 30, 10, 20, 12, 30, 12, 42];
  data.columns.forEach((column, index) => {
    column.width = widths[index] ?? 18;
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
    [3, 4, 5, 14].forEach((column) => {
      data.getCell(row, column).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: ['"VERO,FALSO"'],
        showErrorMessage: true,
        errorTitle: "Valore non valido",
        error: "Inserire esclusivamente VERO oppure FALSO.",
      };
    });
    [7, 8, 10].forEach((column) => {
      data.getCell(row, column).numFmt = "@";
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

async function readExcelRows(file: File): Promise<ParsedRow[]> {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());

  const sheet = workbook.getWorksheet("DATI DA IMPORTARE");
  if (!sheet) throw new Error("Manca il foglio DATI DA IMPORTARE.");

  const actualHeaders = HEADERS.map((_, index) =>
    sheet.getRow(1).getCell(index + 1).text.trim()
  );
  if (actualHeaders.join("|") !== HEADERS.join("|")) {
    throw new Error(
      "Le colonne del foglio DATI DA IMPORTARE sono state modificate. Scarica nuovamente il template."
    );
  }

  const rows: ParsedRow[] = [];
  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const excelRow = sheet.getRow(rowNumber);
    const values = blankRow();
    HEADERS.forEach((header, index) => {
      values[header] = excelRow.getCell(index + 1).text.trim();
    });
    if (HEADERS.every((header) => !values[header])) continue;
    rows.push({ rowNumber, values });
  }

  return rows;
}

async function readCsvRows(file: File): Promise<ParsedRow[]> {
  const Papa = (await import("papaparse")).default;
  const text = await file.text();
  const parsed = Papa.parse<string[]>(text, {
    skipEmptyLines: "greedy",
  });

  if (parsed.errors.length) {
    throw new Error(`CSV non valido: ${parsed.errors[0]?.message || "errore di lettura"}`);
  }

  const matrix = parsed.data;
  if (!matrix.length) throw new Error("Il CSV è vuoto.");

  const csvHeaders = matrix[0].map((value) => String(value ?? "").trim());
  if (csvHeaders.join("|") !== HEADERS.join("|")) {
    throw new Error(
      "Le intestazioni del CSV non corrispondono al template previsto. Scarica nuovamente il template Excel."
    );
  }

  return matrix.slice(1).flatMap((sourceRow, index) => {
    const values = blankRow();
    HEADERS.forEach((header, columnIndex) => {
      values[header] = String(sourceRow[columnIndex] ?? "").trim();
    });
    if (HEADERS.every((header) => !values[header])) return [];
    return [{ rowNumber: index + 2, values }];
  });
}

async function readRows(file: File) {
  if (/\.xlsx$/i.test(file.name)) return readExcelRows(file);
  if (/\.csv$/i.test(file.name)) return readCsvRows(file);
  throw new Error("Formato file non supportato. Usa .xlsx oppure .csv.");
}

export function ClientiImportTemplateEnhancer() {
  const { studioId } = useStudio();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const interceptOriginalTrigger = (event: MouseEvent) => {
      const target = event.target as Element | null;
      const button = target?.closest("button");
      if (!button || button.textContent?.trim() !== "Importa Excel/CSV") return;

      event.preventDefault();
      event.stopPropagation();
      setFile(null);
      setMessage("");
      setErrorMessage("");
      setOpen(true);
    };

    window.addEventListener("click", interceptOriginalTrigger, true);
    return () => window.removeEventListener("click", interceptOriginalTrigger, true);
  }, []);

  const handleImport = async () => {
    if (!file || busy) return;
    setBusy(true);
    setMessage("");
    setErrorMessage("");

    try {
      if (!studioId) throw new Error("Studio non disponibile. Ricarica la pagina e riprova.");

      const rows = await readRows(file);
      if (!rows.length) throw new Error("Il file non contiene righe da importare.");

      const supabase = getSupabaseClient();
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session?.user) throw new Error("Sessione non valida. Effettua nuovamente il login.");

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
          const noSectorProvided =
            !fiscalRaw.trim() && !lavoroRaw.trim() && !consulenzaRaw.trim();

          const { error: insertError } = await supabase.from("tbclienti").insert({
            studio_id: studioId,
            cod_cliente: `CL-${Date.now().toString().slice(-6)}-${item.rowNumber}`,
            tipo_cliente: row["Tipo Cliente"],
            tipologia_cliente: row["Tipologia Cliente"],
            ragione_sociale: row["Ragione Sociale"].trim(),
            codice_fiscale: cf,
            partita_iva: row["Partita IVA"].trim() || null,
            indirizzo: row["Indirizzo"].trim() || null,
            cap: row["CAP"].trim() || null,
            citta: row["Città"].trim() || null,
            provincia: row["Provincia"].trim().toUpperCase() || null,
            email: row["Email"].trim() || null,
            settore_fiscale: noSectorProvided ? true : normalizeBoolean(fiscalRaw, false),
            settore_lavoro: normalizeBoolean(lavoroRaw, false),
            settore_consulenza: normalizeBoolean(consulenzaRaw, false),
            attivo: normalizeBoolean(row["Attivo"], true),
            cliente: true,
            note: row["Note"].trim() || null,
          });

          if (insertError) throw insertError;
          imported += 1;
        } catch (error) {
          const text = error instanceof Error ? error.message : "Errore sconosciuto";
          errors.push(text.startsWith("Riga ") ? text : `Riga ${item.rowNumber}: ${text}`);
        }
      }

      const parts = [`${imported} clienti importati`];
      if (duplicates) parts.push(`${duplicates} duplicati saltati`);
      if (errors.length) parts.push(`${errors.length} righe con errore`);
      setMessage(parts.join(" · "));

      if (errors.length) {
        setErrorMessage(errors.slice(0, 8).join("\n"));
      }

      if (imported > 0) {
        window.setTimeout(() => window.location.reload(), 900);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Errore durante l'importazione.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (busy) return;
        setOpen(nextOpen);
        if (!nextOpen) {
          setFile(null);
          setMessage("");
          setErrorMessage("");
        }
      }}
    >
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importazione Clienti da Excel/CSV
          </DialogTitle>
          <DialogDescription>
            Usa il template Excel a due fogli. Il foglio ISTRUZIONI descrive i campi; i dati vanno inseriti nel foglio DATI DA IMPORTARE.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={busy}
            onClick={() => void downloadExcelTemplate()}
          >
            <Upload className="mr-2 h-4 w-4" />
            Scarica Template Excel
          </Button>

          <div className="space-y-2">
            <Label htmlFor="clienti-import-file">File da importare</Label>
            <Input
              id="clienti-import-file"
              type="file"
              accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
              disabled={busy}
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
                setMessage("");
                setErrorMessage("");
              }}
            />
            {file && (
              <p className="text-sm text-muted-foreground">
                Selezionato: <strong>{file.name}</strong>
              </p>
            )}
          </div>

          {message && (
            <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">
              {message}
            </div>
          )}

          {errorMessage && (
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {errorMessage}
            </pre>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => setOpen(false)}
          >
            Annulla
          </Button>
          <Button type="button" disabled={!file || busy} onClick={handleImport}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {busy ? "Importazione..." : "Importa file"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
