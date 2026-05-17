import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type Params = {
  params: Promise<{
    id: string;
    documentoId: string;
  }>;
};

export async function GET(req: Request, { params }: Params) {
  try {
    const { id, documentoId } = await params;
    const supabaseAdmin = getSupabaseAdmin();

    const { data: documento, error } = await supabaseAdmin
      .from("tbpratiche_documenti")
      .select("*")
      .eq("id", documentoId)
      .eq("pratica_id", id)
      .single();

    if (error || !documento) {
      return NextResponse.json(
        { error: "Documento non trovato" },
        { status: 404 }
      );
    }

    const { data, error: signedError } = await supabaseAdmin.storage
      .from("pratiche-documenti")
      .createSignedUrl(documento.file_path, 60);

    if (signedError || !data?.signedUrl) {
      return NextResponse.json(
        { error: signedError?.message || "Errore generazione link download" },
        { status: 500 }
      );
    }

    return NextResponse.redirect(data.signedUrl);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Errore download documento" },
      { status: 500 }
    );
  }
}
