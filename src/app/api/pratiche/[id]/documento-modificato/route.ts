import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type Params = {
  params: Promise<{ id: string }>;
};

function sanitizeFileName(name: string) {
  return name
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export async function POST(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const supabaseAdmin = getSupabaseAdmin();

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const documentoId = formData.get("documento_id") as string | null;

    if (!file) {
      return NextResponse.json(
        { error: "Nessun file caricato." },
        { status: 400 }
      );
    }

    if (!documentoId) {
      return NextResponse.json(
        { error: "Documento non specificato." },
        { status: 400 }
      );
    }

    const { data: documento, error: docError } = await supabaseAdmin
      .from("tbpratiche_documenti")
      .select("*")
      .eq("id", documentoId)
      .eq("pratica_id", id)
      .single();

    if (docError || !documento) {
      return NextResponse.json(
        { error: "Documento non trovato." },
        { status: 404 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const nomeFile = sanitizeFileName(file.name);
    const filePath = documento.file_path;

    await supabaseAdmin.storage
      .from("pratiche-documenti")
      .remove([filePath]);

    const { error: uploadError } = await supabaseAdmin.storage
      .from("pratiche-documenti")
      .upload(filePath, buffer, {
        contentType:
          file.type ||
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        upsert: true,
      });

    if (uploadError) {
      return NextResponse.json(
        { error: uploadError.message },
        { status: 500 }
      );
    }

    const { data: aggiornato, error: updateError } = await supabaseAdmin
      .from("tbpratiche_documenti")
      .update({
        nome_file: nomeFile,
        stato: "modificato",
        origine: "modificata",
        updated_at: new Date().toISOString(),
      })
      .eq("id", documentoId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      documento: aggiornato,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: error.message || "Errore caricamento documento modificato.",
      },
      { status: 500 }
    );
  }
}
