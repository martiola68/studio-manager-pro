import type { NextApiRequest, NextApiResponse } from "next";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

function getServerSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Variabili Supabase server mancanti");
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

function parseExcelDate(value: unknown): string | null {
  if (!value) return null;

  if (typeof value === "string") {
    const trimmed = value.trim();

    const ita = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (ita) {
      const [, dd, mm, yyyy] = ita;
      return `${yyyy}-${mm}-${dd}`;
    }

    const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) return trimmed;
  }

  return null;
}

type ComuneRow = {
  codice_catastale: string;
  comune: string;
  sigla_provincia: string | null;
  data_inizio_validita: string | null;
  data_fine_validita: string | null;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Metodo non consentito" });
  }

  try {
    const supabase = getServerSupabase();

    // puoi cambiare il path se metti il file altrove
    const filePath = path.join(process.cwd(), "data", "gi_comuni_validita.xlsx");

    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    const rawRows: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      raw: false,
      blankrows: false,
    });

    const rows: ComuneRow[] = rawRows
      .map((row) => {
        const codice = String(row?.[0] || "").trim().toUpperCase();
        const comune = String(row?.[1] || "").trim();
        const sigla = String(row?.[2] || "").trim().toUpperCase();
        const dataInizio = parseExcelDate(row?.[3]);
        const dataFine = parseExcelDate(row?.[4]);

        if (!codice || !comune) return null;

        return {
          codice_catastale: codice,
          comune,
          sigla_provincia: sigla || null,
          data_inizio_validita: dataInizio,
          data_fine_validita: dataFine,
        };
      })
      .filter((x): x is ComuneRow => !!x);

    if (!rows.length) {
      return res.status(400).json({ error: "Nessuna riga valida trovata nel file Excel" });
    }

    // pulizia tabella prima del reimport completo
    const { error: deleteError } = await supabase
      .from("tb_comuni_catastali")
      .delete()
      .not("id", "is", null);

    if (deleteError) {
      throw deleteError;
    }

    const chunkSize = 500;
    let inserted = 0;

    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);

      const { error: insertError } = await supabase
        .from("tb_comuni_catastali")
        .insert(chunk);

      if (insertError) {
        throw insertError;
      }

      inserted += chunk.length;
    }

    return res.status(200).json({
      ok: true,
      message: "Import archivio comuni completato",
      inserted,
      totalRows: rows.length,
    });
  } catch (error: any) {
    console.error("Errore import comuni catastali:", error);

    return res.status(500).json({
      error: error?.message || "Errore durante import archivio comuni catastali",
    });
  }
}
