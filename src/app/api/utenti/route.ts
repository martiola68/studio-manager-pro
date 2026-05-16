import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("tbutenti")
    .select("id, nome, cognome")
    .eq("attivo", true)
    .order("cognome", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(
    (data || []).map((utente) => ({
      id: utente.id,
      nome: `${utente.nome} ${utente.cognome}`,
    }))
  );
}
