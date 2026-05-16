import { NextResponse } from "next/server";
import { pool } from "@/lib/postgres";

export async function GET() {
  const result = await pool.query(`
    SELECT 
      id::text AS id,
      nome || ' ' || cognome AS nome
    FROM tbutenti
    WHERE attivo = TRUE
    ORDER BY cognome ASC, nome ASC
  `);

  return NextResponse.json(result.rows);
}
