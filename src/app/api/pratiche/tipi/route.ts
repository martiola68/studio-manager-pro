import { NextResponse } from "next/server";
import { pool } from "@/lib/postgres";

export async function GET() {
  const result = await pool.query(`
    SELECT 
      id,
      ente,
      nome,
      codice
    FROM tbpratiche_tipi
    WHERE attiva = TRUE
    ORDER BY ente ASC, nome ASC
  `);

  return NextResponse.json(result.rows);
}
