import { NextResponse } from "next/server";
import { pool } from "@/lib/postgres";

export async function GET() {
  const result = await pool.query(`
    SELECT 
      id,
      COALESCE(nome || ' ' || cognome, username, email, 'Utente') AS nome
    FROM tbutenti
    WHERE attivo = TRUE
    ORDER BY nome ASC
  `);

  return NextResponse.json(result.rows);
}
