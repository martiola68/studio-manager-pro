import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  const { data, error } = await supabase
    .from("tbclienti")
    .select("id, ragione_sociale")
    .eq("attivo", true)
    .order("ragione_sociale", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const clienti = (data || []).map((cliente) => ({
    id: cliente.id,
    nome: cliente.ragione_sociale,
  }));

  return NextResponse.json(clienti);
}
