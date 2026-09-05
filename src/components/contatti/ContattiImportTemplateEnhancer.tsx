import { useEffect, useState } from "react";
import { Download, FileSpreadsheet, Loader2, Upload } from "lucide-react";
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
import { contattoService } from "@/services/contattoService";
import { getSupabaseClient } from "@/lib/supabase/client";
import {
  encryptContattoSensitiveData,
  isEncryptionEnabled,
  isEncryptionLocked,
} from "@/services/encryptionService";

const HEADERS = [
  "Cognome/Denominazione",
  "Nome",
  "Cellulare",
  "Telefono",
  "Altro Telefono",
  "Email",
  "PEC",
  "Email Secondaria",
  "Email Altro",
  "Contatto Principale",
  "Via",
  "CAP",
  "Città",
  "Provincia",
  "Nazione",
  "Riceve Newsletter (VERO/FALSO)",
  "Contatto Attivo (VERO/FALSO)",
  "Note",
] as const;

type Header = (typeof HEADERS)[number];
type RowValues = Record<Header, string>;
type ParsedRow = { rowNumber: number; values: RowValues };

function blankRow(): RowValues {
  return Object.fromEntries(HEADERS.map((header) => [header, ""])) as RowValues;
}

function normalizeBoolean(value: string, fallback: boolean) {
  const normalized = value.trim().toUpperCase();
  if (!normalized) return fallback;
  if (["VERO", "TRUE", "1", "SI", "SÌ"].includes(normalized)) return true;
  if (["FALSO", "FALSE", "0", "NO"].includes(normalized)) return false;
  throw new Error(`valore "${value}" non valido: usare VERO oppure FALSO`);
}

function validEmail(value: string) {
  return !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validateRow(row: RowValues, rowNumber: number) {
  const errors: string[] = [];
  if (!row["Cognome/Denominazione"].trim()) {
    errors.push("Cognome/Denominazione obbligatorio");
  }

  for (const field of ["Email", "PEC", "Email Secondaria", "Email Altro"] as Header[]) {
    if (!validEmail(row[field].trim())) errors.push(`${field} non valida`);
  }

  try {
    normalizeBoolean(row["Riceve Newsletter (VERO/FALSO)"], false);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }
  try {
    normalizeBoolean(row["Contatto Attivo (VERO/FALSO)"], true);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  if (errors.length) {
    throw new Error(`Riga ${rowNumber}: ${errors.join("; ")}`);
  }
}

async function createTemplate() {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("DATI DA IMPORTARE", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  worksheet.addRow([...HEADERS]);
  worksheet.getRow(1).height = 38;
  worksheet.getRow(1).eachCell((cell, columnNumber) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: columnNumber === 1 ? "FFB91C1C" : "FF0369A1" },
    };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  });

  const widths = [30, 20, 18, 18, 18, 30, 30, 30, 30, 26, 30, 10, 20, 12, 16, 24, 24, 42];
  worksheet.columns.forEach((column, index) => {
    column.width = widths[index] ?? 20;
  });

  for (let row = 2; row <= 1001; row += 1) {
    [3, 4, 5, 12].forEach((column) => {
      worksheet.getCell(row, column).numFmt = "@";
    });
    [16, 17].forEach((column) => {
      worksheet.getCell(row, column).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: ['"VERO,FALSO"'],
      };
    });
  }

  worksheet.autoFilter = { from: "A1", to: "R1" };

  const example = worksheet.addRow([
    "Rossi",
    "Mario",
    "3331234567",
    "0212345678",
    "",
    "mario.rossi@email.it",
    "mario.rossi@pec.it",
    "",
    "",
    "Responsabile amministrativo",
    "Via Roma 1",
    "00100",
    "Roma",
    "RM",
    "Italia",
    "FALSO",
    "VERO",
    "Esempio: eliminare questa riga prima dell'importazione",
  ]);
  example.font = { italic: true, color: { argb: "FF64748B" } };

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "Template_Importazione_Contatti_SMP.xlsx";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function readRows(file: File): Promise<ParsedRow[]> {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const worksheet = workbook.getWorksheet("DATI DA IMPORTARE") ?? workbook.worksheets[0];
  if (!worksheet) throw new Error("Il file Excel non contiene fogli");

  const actualHeaders = HEADERS.map((_, index) =>
    worksheet.getRow(1).getCell(index + 1).text.trim()
  );
  if (actualHeaders.join("|") !== HEADERS.join("|")) {
    throw new Error("Le intestazioni non corrispondono al template ufficiale. Scarica un nuovo template Excel e non modificare i titoli delle colonne.");
  }

  const rows: ParsedRow[] = [];
  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const values = blankRow();
    HEADERS.forEach((header, index) => {
      values[header] = worksheet.getRow(rowNumber).getCell(index + 1).text.trim();
    });
    if (!HEADERS.every((header) => !values[header])) rows.push({ rowNumber, values });
  }
  return rows;
}

async function resolveStudioId() {
  const cached = typeof window !== "undefined" ? localStorage.getItem("studio_id") : null;
  if (cached) return cached;

  const supabase = getSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.email) throw new Error("Utente non autenticato");

  const { data, error } = await supabase
    .from("tbutenti")
    .select("studio_id")
    .eq("email", session.user.email)
    .single();
  if (error) throw error;
  if (!data?.studio_id) throw new Error("studio_id non disponibile");
  return String(data.studio_id);
}

export function ContattiImportTemplateEnhancer() {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    const onTrigger = (event: MouseEvent) => {
      const button = (event.target as Element | null)?.closest("button");
      if (!button || button.closest('[role="dialog"]')) return;
      const label = button.textContent?.trim();
      if (label !== "Importa Excel" && label !== "Importa Excel/CSV") return;

      event.preventDefault();
      event.stopPropagation();
      setFile(null);
      setMessage("");
      setErrors([]);
      setOpen(true);
    };

    window.addEventListener("click", onTrigger, true);
    return () => window.removeEventListener("click", onTrigger, true);
  }, []);

  const importFile = async () => {
    if (!file || busy) return;
    setBusy(true);
    setMessage("");
    setErrors([]);

    try {
      if (!/\.xlsx$/i.test(file.name)) {
        throw new Error("Formato non valido: usare esclusivamente il file Excel .xlsx del template SMP.");
      }

      const rows = await readRows(file);
      if (!rows.length) throw new Error("Il file Excel non contiene righe da importare");

      const validationErrors: string[] = [];
      rows.forEach((row) => {
        try {
          validateRow(row.values, row.rowNumber);
        } catch (error) {
          validationErrors.push(error instanceof Error ? error.message : String(error));
        }
      });
      if (validationErrors.length) {
        setMessage(`0 contatti importati · ${validationErrors.length} righe con errore`);
        setErrors(validationErrors);
        return;
      }

      const studioId = await resolveStudioId();
      const encryptionEnabled = await isEncryptionEnabled(studioId);
      if (encryptionEnabled && isEncryptionLocked()) {
        throw new Error("I dati sensibili sono bloccati. Chiudi l'importazione, sblocca i dati della Rubrica e riprova.");
      }

      let imported = 0;
      const importErrors: string[] = [];

      for (const item of rows) {
        try {
          const row = item.values;
          let payload: any = {
            studio_id: studioId,
            cognome: row["Cognome/Denominazione"].trim(),
            nome: row["Nome"].trim() || "",
            cell: row["Cellulare"].trim() || null,
            tel: row["Telefono"].trim() || null,
            altro_telefono: row["Altro Telefono"].trim() || null,
            email: row["Email"].trim() || null,
            pec: row["PEC"].trim() || null,
            email_secondaria: row["Email Secondaria"].trim() || null,
            email_altro: row["Email Altro"].trim() || null,
            contatto_principale: row["Contatto Principale"].trim() || null,
            via: row["Via"].trim() || null,
            cap: row["CAP"].trim() || null,
            citta: row["Città"].trim() || null,
            provincia: row["Provincia"].trim().toUpperCase() || null,
            nazione: row["Nazione"].trim() || "Italia",
            riceve_newsletter: normalizeBoolean(row["Riceve Newsletter (VERO/FALSO)"], false),
            attivo: normalizeBoolean(row["Contatto Attivo (VERO/FALSO)"], true),
            note: row["Note"].trim() || null,
          };

          if (encryptionEnabled) {
            payload = {
              ...payload,
              ...(await encryptContattoSensitiveData({
                cell: payload.cell,
                tel: payload.tel,
                altro_telefono: payload.altro_telefono,
                email: payload.email,
                pec: payload.pec,
                email_secondaria: payload.email_secondaria,
                email_altro: payload.email_altro,
                note: payload.note,
              })),
            };
          }

          await contattoService.createContatto(payload);
          imported += 1;
        } catch (error) {
          importErrors.push(`Riga ${item.rowNumber}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      setMessage(`${imported} contatti importati${importErrors.length ? ` · ${importErrors.length} righe con errore` : ""}`);
      setErrors(importErrors);
      if (!importErrors.length) setFile(null);
    } catch (error) {
      setErrors([error instanceof Error ? error.message : String(error)]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Importazione Contatti da Excel</DialogTitle>
          <DialogDescription>
            Esporta il template SMP in formato .xlsx, compilalo per colonne e reimporta lo stesso file.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm text-slate-700">
            Il file è un vero foglio Excel compatibile (.xlsx): ogni dato ha la propria colonna. Non viene usato CSV.
          </div>

          <Button type="button" variant="outline" className="w-full" onClick={() => void createTemplate()}>
            <Download className="mr-2 h-4 w-4" />
            Esporta Template Excel (.xlsx)
          </Button>

          <div className="space-y-2">
            <Label htmlFor="rubrica-import-xlsx">Importa file Excel compilato</Label>
            <Input
              id="rubrica-import-xlsx"
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </div>

          {message && <div className="rounded-md border border-sky-200 bg-sky-50 p-3 text-sm">{message}</div>}
          {errors.length > 0 && (
            <div className="max-h-48 overflow-auto rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {errors.map((error, index) => <div key={`${index}-${error}`}>{error}</div>)}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy}>Annulla</Button>
          <Button type="button" onClick={() => void importFile()} disabled={!file || busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            Importa Excel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
