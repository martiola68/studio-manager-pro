import { NextResponse } from "next/server";
import { pool } from "@/lib/postgres";

export async function GET() {
  const result = await pool.query(`
    SELECT 
      id,
      COALESCE(ragione_sociale, nome, cognome, 'Cliente senza nome') AS nome
    FROM tbclienti
    ORDER BY nome ASC
  `);

  return NextResponse.json(result.rows);
}
