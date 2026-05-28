import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type Params = {
  params: Promise<{ id: string }>;
};

export async function POST(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const supabaseAdmin = getSupabaseAdmin();

    const { data: documenti, error: docError } = await supabaseAdmin
      .from("tbpratiche_documenti")
      .select("id")
      .eq("pratica_id", id)
      .limit(1);

    if (docError) {
      return NextResponse.json(
        { error: docError.message },
        { status: 500 }
      );
    }

    if (!documenti || documenti.length === 0) {
      return NextResponse.json(
        {
          error:
            "Non puoi chiudere la pratica: non risulta alcun documento generato o caricato.",
        },
        { status: 400 }
      );
    }

    const { data: pratica, error } = await supabaseAdmin
      .from("tbpratiche")
      .update({
        stato: "chiusa",
        avanzamento: 100,
        data_chiusura: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      pratica,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: error.message || "Errore chiusura pratica.",
      },
      { status: 500 }
    );
  }
}
