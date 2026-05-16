import { NextResponse } from "next/server";
import { pool } from "@/lib/postgres";

export async function GET() {
  try {
    const result = await pool.query(`
      SELECT id, ente, nome, codice
      FROM public.tbpratiche_tipi
      WHERE attiva = TRUE
      ORDER BY ente ASC, nome ASC
    `);

    return NextResponse.json(result.rows);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
