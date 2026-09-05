import { useEffect } from "react";

const HEADERS = [
  "cognome",
  "nome",
  "cell",
  "tel",
  "altro_telefono",
  "email",
  "pec",
  "email_secondaria",
  "email_altro",
  "contatto_principale",
  "note",
] as const;

async function downloadExcelTemplate() {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("DATI DA IMPORTARE", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  worksheet.addRow([...HEADERS]);
  worksheet.getRow(1).height = 34;
  worksheet.getRow(1).eachCell((cell, columnNumber) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: columnNumber === 1 ? "FFB91C1C" : "FF0369A1" },
    };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  });

  const widths = [30, 22, 18, 18, 18, 30, 30, 30, 30, 28, 42];
  worksheet.columns.forEach((column, index) => {
    column.width = widths[index] ?? 20;
  });

  for (let row = 2; row <= 1001; row += 1) {
    [3, 4, 5].forEach((column) => {
      worksheet.getCell(row, column).numFmt = "@";
    });
  }

  worksheet.autoFilter = { from: "A1", to: "K1" };

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
    "Dott. Bianchi",
    "Contatto importante",
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

export function ContattiImportExcelEnhancer() {
  useEffect(() => {
    const updateDialog = () => {
      document.querySelectorAll<HTMLElement>('[role="dialog"]').forEach((dialog) => {
        const title = dialog.querySelector<HTMLElement>("h2");
        if (!title?.textContent?.includes("Importazione Contatti")) return;

        title.textContent = "Importazione Contatti da Excel (.xlsx)";

        const description = dialog.querySelector<HTMLElement>('[data-radix-dialog-description]');
        if (description) {
          description.textContent = "Carica un file Excel (.xlsx) per importare più contatti contemporaneamente";
        }

        dialog.querySelectorAll<HTMLElement>("li").forEach((li) => {
          if (li.textContent?.includes("template CSV")) {
            li.textContent = li.textContent.replace("template CSV", "template Excel");
          }
        });

        dialog.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
          if (button.textContent?.trim() === "Scarica Template CSV") {
            button.textContent = "Scarica Template Excel";
            button.dataset.contattiExcelTemplate = "1";
          }
        });

        const fileInput = dialog.querySelector<HTMLInputElement>('input[type="file"]');
        if (fileInput) {
          fileInput.accept = ".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
          fileInput.dataset.contattiExcelOnly = "1";
        }

        dialog.querySelectorAll<HTMLElement>("label").forEach((label) => {
          if (label.textContent?.includes("Carica File Excel")) {
            label.textContent = "Carica File Excel .xlsx";
          }
        });
      });
    };

    const onClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      const button = target?.closest<HTMLButtonElement>('button[data-contatti-excel-template="1"]');
      if (!button) return;

      event.preventDefault();
      event.stopPropagation();
      void downloadExcelTemplate();
    };

    const onChange = (event: Event) => {
      const input = event.target as HTMLInputElement | null;
      if (!input?.matches('input[type="file"][data-contatti-excel-only="1"]')) return;
      const file = input.files?.[0];
      if (!file) return;

      if (!/\.xlsx$/i.test(file.name)) {
        input.value = "";
        window.alert("Formato non valido. Per la Rubrica Contatti usa esclusivamente il file Excel .xlsx del template SMP.");
      }
    };

    updateDialog();
    const observer = new MutationObserver(updateDialog);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("click", onClick, true);
    document.addEventListener("change", onChange, true);

    return () => {
      observer.disconnect();
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("change", onChange, true);
    };
  }, []);

  return null;
}
