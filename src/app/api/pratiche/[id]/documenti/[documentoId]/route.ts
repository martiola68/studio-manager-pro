import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type Params = {
  params: Promise<{
    id: string;
    documentoId: string;
  }>;
};

export async function DELETE(req: Request, { params }: Params) {
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

    if (documento.file_path) {
      await supabaseAdmin.storage
        .from("pratiche-documenti")
        .remove([documento.file_path]);
    }

    const { error: deleteError } = await supabaseAdmin
      .from("tbpratiche_documenti")
      .delete()
      .eq("id", documentoId)
      .eq("pratica_id", id);

    if (deleteError) {
      return NextResponse.json(
        { error: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Errore eliminazione documento" },
      { status: 500 }
    );
  }
}
