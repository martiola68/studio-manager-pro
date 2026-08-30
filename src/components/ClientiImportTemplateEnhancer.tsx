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
type ParsedRow = { rowNumber: number; values: ImportRow };

function blankRow(): ImportRow {
  return Object.fromEntries(HEADERS.map((header) => [header, ""])) as ImportRow;
}

function normalizeCap(value: string) {
  const normalized = value.trim();
  if (!normalized) return "";
  if (/^\d{1,5}$/.test(normalized)) return normalized.padStart(5, "0");
  return normalized;
}

function normalizeBoolean(value: string, fallback: boolean) {
  const normalized = value.trim().toUpperCase();
  if (!normalized) return fallback;
  if (["VERO", "TRUE", "1", "SI", "SÌ"].includes(normalized)) return true;
  if (["FALSO", "FALSE", "0", "NO"].includes(normalized)) return false;
  throw new Error(`valore "${value}" non valido: usare VERO oppure FALSO`);
}

function validPartitaIva(value: string) {
  if (!/^\d{11}$/.test(value)) return false;
  let sum = 0;
  for (let index = 0; index < 10; index += 1) {
    let digit = Number(value[index]);
    if (index % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return (10 - (sum % 10)) % 10 === Number(value[10]);
}

function validCodiceFiscale(value: string) {
  const cf = value.toUpperCase();
  if (!/^[A-Z0-9]{16}$/.test(cf)) return false;

  const odd = [
    1, 0, 5, 7, 9, 13, 15, 17, 19, 21, 2, 4, 18,
    20, 11, 3, 6, 8, 12, 14, 16, 10, 22, 25, 24, 23,
  ];
  let sum = 0;

  for (let index = 0; index < 15; index += 1) {
    const char = cf[index];
    const base = /\d/.test(char) ? Number(char) : char.charCodeAt(0) - 65;
    sum += index % 2 === 0 ? odd[base] : base;
  }

  return String.fromCharCode(65 + (sum % 26)) === cf[15];
}

function normalizeRow(row: ImportRow) {
  row["CAP"] = normalizeCap(row["CAP"]);
  row["Codice Fiscale"] = row["Codice Fiscale"].trim().toUpperCase();
  row["Partita IVA"] = row["Partita IVA"].trim();
  row["Provincia"] = row["Provincia"].trim().toUpperCase();
  return row;
}

function validateRow(row: ImportRow, rowNumber: number) {
  const errors: string[] = [];
  const tipo = row["Tipo Cliente"].trim();
  const tipologia = row["Tipologia Cliente"].trim();
  const cf = row["Codice Fiscale"];
  const piva = row["Partita IVA"];

  if (!["Persona fisica", "Altro"].includes(tipo)) {
    errors.push("Tipo Cliente deve essere Persona fisica oppure Altro");
  }
  if (!["Interno", "Esterno"].includes(tipologia)) {
    errors.push("Tipologia Cliente deve essere Interno oppure Esterno");
  }
  if (!row["Ragione Sociale"].trim()) {
    errors.push("Ragione Sociale obbligatoria");
  }
  if (!cf) {
    errors.push("Codice Fiscale obbligatorio");
  } else if (tipo === "Persona fisica" && !validCodiceFiscale(cf)) {
    errors.push(`Codice Fiscale ${cf} formalmente non valido (carattere di controllo errato)`);
  } else if (tipo === "Altro" && (!/^\d{11}$/.test(cf) || !validPartitaIva(cf))) {
    errors.push(`Codice Fiscale ${cf} della società/ente non valido`);
  }

  if (piva && !validPartitaIva(piva)) {
    errors.push(`Partita IVA ${piva} formalmente non valida (controllo checksum)`);
  }

  const cap = row["CAP"];
  if (cap && !/^\d{5}$/.test(cap)) {
    errors.push(`CAP "${cap}" non valido: deve contenere da 1 a 5 cifre`);
  }

  const provincia = row["Provincia"];
  if (provincia && provincia.length !== 2) {
    errors.push("Provincia deve contenere 2 caratteri");
  }

  const booleanHeaders: Header[] = [
    "Settore Fiscale (VERO/FALSO)",
    "Settore Lavoro (VERO/FALSO)",
    "Settore Consulenza (VERO/FALSO)",
    "Attivo",
  ];

  for (const header of booleanHeaders) {
    try {
      normalizeBoolean(row[header], header === "Attivo");
    } catch (error) {
      errors.push(`${header}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `Riga ${rowNumber} - ${row["Ragione Sociale"].trim() || "senza nominativo"}: ${errors.join("; ")}`
    );
  }
}

async function downloadExcelTemplate() {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("DATI DA IMPORTARE", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  worksheet.addRow([...HEADERS]);

  const mandatory = new Set([
    "Tipo Cliente",
    "Tipologia Cliente",
    "Ragione Sociale",
    "Codice Fiscale",
  ]);

  worksheet.getRow(1).height = 42;
  worksheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: mandatory.has(String(cell.value)) ? "FFB91C1C" : "FF166534" },
    };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  });

  const widths = [18, 20, 24, 24, 28, 34, 16, 20, 30, 10, 20, 12, 30, 12, 42];
  worksheet.columns.forEach((column, index) => {
    column.width = widths[index] ?? 18;
  });

  for (let row = 2; row <= 1001; row += 1) {
    worksheet.getCell(row, 1).dataValidation = {
      type: "list",
      allowBlank: false,
      formulae: ['"Persona fisica,Altro"'],
    };
    worksheet.getCell(row, 2).dataValidation = {
      type: "list",
      allowBlank: false,
      formulae: ['"Interno,Esterno"'],
    };
    [3, 4, 5, 14].forEach((column) => {
      worksheet.getCell(row, column).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: ['"VERO,FALSO"'],
      };
    });
    [7, 8, 10].forEach((column) => {
      worksheet.getCell(row, column).numFmt = "@";
    });
  }

  worksheet.autoFilter = { from: "A1", to: "O1" };

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

  const worksheet = workbook.getWorksheet("DATI DA IMPORTARE") ?? workbook.worksheets[0];
  if (!worksheet) throw new Error("Il file Excel non contiene fogli");

  const headers = HEADERS.map((_, index) =>
    worksheet.getRow(1).getCell(index + 1).text.trim()
  );

  if (headers.join("|") !== HEADERS.join("|")) {
    throw new Error(
      "Le intestazioni Excel non corrispondono al template ufficiale. Scarica un nuovo template e non modificare le intestazioni."
    );
  }

  const rows: ParsedRow[] = [];
  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const values = blankRow();
    HEADERS.forEach((header, index) => {
      values[header] = worksheet.getRow(rowNumber).getCell(index + 1).text.trim();
    });
    if (!HEADERS.every((header) => !values[header])) {
      rows.push({ rowNumber, values: normalizeRow(values) });
    }
  }

  return rows;
}

function errorText(value: unknown) {
  if (value instanceof Error) return value.message;
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function ClientiImportTemplateEnhancer() {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [fileInputKey, setFileInputKey] = useState(0);

  useEffect(() => {
    const renameButton = () => {
      document.querySelectorAll("button").forEach((button) => {
        if (button.textContent?.trim() !== "Importa Excel/CSV") return;
        button.childNodes.forEach((node) => {
          if (
            node.nodeType === Node.TEXT_NODE &&
            node.textContent?.includes("Importa Excel/CSV")
          ) {
            node.textContent = node.textContent.replace("Importa Excel/CSV", "Importa Excel");
          }
        });
      });
    };

    renameButton();
    const observer = new MutationObserver(renameButton);
    observer.observe(document.body, { childList: true, subtree: true });

    const handleTrigger = (event: MouseEvent) => {
      const button = (event.target as Element | null)?.closest("button");
      if (!button) return;

      // Non intercettare mai i pulsanti della modale stessa.
      if (button.closest('[role="dialog"]')) return;

      const label = button.textContent?.trim();
      if (label !== "Importa Excel" && label !== "Importa Excel/CSV") return;

      event.preventDefault();
      event.stopPropagation();
      setFile(null);
      setMessage("");
      setErrors([]);
      setFileInputKey((current) => current + 1);
      setOpen(true);
    };

    window.addEventListener("click", handleTrigger, true);
    return () => {
      observer.disconnect();
      window.removeEventListener("click", handleTrigger, true);
    };
  }, []);

  const handleImport = async () => {
    if (!file || busy) return;

    setBusy(true);
    setMessage("");
    setErrors([]);

    try {
      if (!/\.xlsx$/i.test(file.name)) {
        throw new Error(
          "Formato non valido. L'importazione clienti accetta esclusivamente file Excel .xlsx."
        );
      }

      const rows = await readExcelRows(file);
      if (!rows.length) throw new Error("Il file Excel non contiene righe da importare");

      const validationErrors: string[] = [];
      for (const row of rows) {
        try {
          validateRow(row.values, row.rowNumber);
        } catch (error) {
          validationErrors.push(errorText(error));
        }
      }

      if (validationErrors.length > 0) {
        setMessage(`0 clienti importati · ${validationErrors.length} righe con errore`);
        setErrors(validationErrors);
        return;
      }

      const supabase = getSupabaseClient();
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) throw sessionError;
      if (!session?.access_token) {
        throw new Error("Sessione non valida: effettuare nuovamente il login");
      }

      let imported = 0;
      let duplicates = 0;
      const importErrors: string[] = [];

      for (const item of rows) {
        const row = item.values;
        const fiscal = row["Settore Fiscale (VERO/FALSO)"];
        const lavoro = row["Settore Lavoro (VERO/FALSO)"];
        const consulenza = row["Settore Consulenza (VERO/FALSO)"];
        const noSector = !fiscal.trim() && !lavoro.trim() && !consulenza.trim();

        const payload = {
          tipo_cliente: row["Tipo Cliente"],
          tipologia_cliente: row["Tipologia Cliente"],
          ragione_sociale: row["Ragione Sociale"].trim(),
          codice_fiscale: row["Codice Fiscale"],
          partita_iva: row["Partita IVA"] || null,
          indirizzo: row["Indirizzo"].trim() || null,
          cap: normalizeCap(row["CAP"]) || null,
          citta: row["Città"].trim() || null,
          provincia: row["Provincia"] || null,
          email: row["Email"].trim() || null,
          settore_fiscale: noSector ? true : normalizeBoolean(fiscal, false),
          settore_lavoro: normalizeBoolean(lavoro, false),
          settore_consulenza: normalizeBoolean(consulenza, false),
          attivo: normalizeBoolean(row["Attivo"], true),
          cliente: true,
          note: row["Note"].trim() || null,
        };

        try {
          const response = await fetch("/api/clienti/create", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify(payload),
          });

          let result: any = {};
          try {
            result = await response.json();
          } catch {
            result = {};
          }

          if (response.status === 409) {
            duplicates += 1;
            continue;
          }

          if (!response.ok) {
            throw new Error(
              [result?.error, result?.details, result?.code].filter(Boolean).join(" - ") ||
                `HTTP ${response.status}`
            );
          }

          imported += 1;
        } catch (error) {
          importErrors.push(
            `Riga ${item.rowNumber} - ${row["Ragione Sociale"]}: ${errorText(error)}`
          );
        }
      }

      setMessage(
        `${imported} clienti importati${duplicates ? ` · ${duplicates} duplicati saltati` : ""}${
          importErrors.length ? ` · ${importErrors.length} righe con errore` : ""
        }`
      );
      setErrors(importErrors);

      if (imported > 0 && importErrors.length === 0) {
        window.setTimeout(() => window.location.reload(), 1000);
      }
    } catch (error) {
      setErrors([errorText(error)]);
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
          setErrors([]);
          setFileInputKey((current) => current + 1);
        }
      }}
    >
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importazione Clienti da Excel
          </DialogTitle>
          <DialogDescription>
            Scarica e compila il template Excel ufficiale. Prima dell'importazione vengono
            controllati tutti i dati, compresi Codice Fiscale, Partita IVA e CAP.
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
            <Label htmlFor="clienti-import-file">File Excel da importare</Label>
            <Input
              key={fileInputKey}
              id="clienti-import-file"
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              disabled={busy}
              onClick={(event) => {
                event.currentTarget.value = "";
              }}
              onChange={(event) => {
                const selected = event.target.files?.[0] ?? null;
                setMessage("");
                setErrors([]);

                if (selected && !/\.xlsx$/i.test(selected.name)) {
                  setFile(null);
                  setErrors(["Formato non valido: selezionare un file Excel .xlsx."]);
                  return;
                }

                setFile(selected);
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

          {errors.length > 0 && (
            <div className="max-h-64 overflow-auto rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <p className="mb-2 font-semibold">Errori rilevati ({errors.length})</p>
              <ol className="list-decimal space-y-1 pl-5">
                {errors.map((error, index) => (
                  <li key={`${index}-${error}`}>{error}</li>
                ))}
              </ol>
            </div>
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
            {busy ? "Verifica e importazione..." : "Importa Excel"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
