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

   const { data: fileData, error: downloadError } = await supabaseAdmin.storage
  .from("pratiche-documenti")
  .download(documento.file_path);

if (downloadError || !fileData) {
  return NextResponse.json(
    { error: downloadError?.message || "Errore download file" },
    { status: 500 }
  );
}

const arrayBuffer = await fileData.arrayBuffer();

return new NextResponse(arrayBuffer, {
  headers: {
    "Content-Type":
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "Content-Disposition": `attachment; filename="${documento.nome_file || "documento.docx"}"`,
  },
});
    
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Errore download documento" },
      { status: 500 }
    );
  }
}
