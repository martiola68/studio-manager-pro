import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const supabaseAdmin = getSupabaseAdmin();

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("tbutenti")
    .select("id, nome, cognome, email, settore, attivo")
    .eq("attivo", true)
    .in("settore", ["Fiscale", "Consulenza"])
    .order("nome", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json(data || []);
}
