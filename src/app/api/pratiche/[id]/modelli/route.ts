import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type Params = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const supabaseAdmin = getSupabaseAdmin();

    const { data: pratica, error: praticaError } = await supabaseAdmin
      .from("tbpratiche")
      .select("id, tipo_pratica_id")
      .eq("id", id)
      .single();

    if (praticaError || !pratica) {
      return NextResponse.json(
        { error: "Pratica non trovata" },
        { status: 404 }
      );
    }

   const { data: modelli, error: modelliError } = await supabaseAdmin
  .from("tbpratiche_modelli_utilita" as any)
  .select("id, nome, codice, categoria, attivo")
  .eq("attivo", true)
  .order("categoria")
  .order("nome");

    if (modelliError) {
      return NextResponse.json(
        { error: modelliError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      modelli: modelli || [],
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error:
          error.message ||
          "Errore caricamento modelli pratica",
      },
      { status: 500 }
    );
  }
}
