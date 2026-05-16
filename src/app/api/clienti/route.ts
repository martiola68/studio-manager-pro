import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("tbclienti")
    .select("id, ragione_sociale")
    .eq("attivo", true)
    .order("ragione_sociale", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(
    (data || []).map((cliente) => ({
      id: cliente.id,
      nome: cliente.ragione_sociale,
    }))
  );
}
