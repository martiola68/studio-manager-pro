import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  const supabaseAdmin = getSupabaseAdmin();

  const { data, error } = await supabaseAdmin
    .from("tbclienti" as any)
    .select(`
      id,
      ragione_sociale,
      nome,
      codice_fiscale,
      indirizzo,
      cap,
      citta,
      provincia
    `)
    .order("ragione_sociale", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json(data || []);
}
