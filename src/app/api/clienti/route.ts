import { NextResponse } from "next/server";
import { pool } from "@/lib/postgres";

export async function GET() {
  const result = await pool.query(`
    SELECT 
      id::text AS id,
      ragione_sociale AS nome
    FROM tbclienti
    WHERE attivo = TRUE
    ORDER BY ragione_sociale ASC
  `);

  return NextResponse.json(result.rows);
}
