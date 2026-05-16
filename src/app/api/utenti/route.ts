import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  const { data, error } = await supabase
    .from("tbutenti")
    .select("id, nome, cognome")
    .eq("attivo", true)
    .order("cognome", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const utenti = (data || []).map((utente) => ({
    id: utente.id,
    nome: `${utente.nome} ${utente.cognome}`,
  }));

  return NextResponse.json(utenti);
}
