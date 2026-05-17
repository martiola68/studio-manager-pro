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

    const { data, error } = await supabaseAdmin
      .from("tbpratiche_documenti")
      .select("*")
      .eq("pratica_id", id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      documenti: data || [],
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Errore caricamento documenti" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const supabaseAdmin = getSupabaseAdmin();

    const formData = await req.formData();

    const file = formData.get("file") as File | null;
    const tipo_documento = String(formData.get("tipo_documento") || "altro");
    const note = String(formData.get("note") || "");

    if (!file) {
      return NextResponse.json({ error: "File mancante" }, { status: 400 });
    }

    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = `${id}/${timestamp}-${safeName}`;

    const arrayBuffer = await file.arrayBuffer();

    const { error: uploadError } = await supabaseAdmin.storage
      .from("pratiche-documenti")
      .upload(filePath, arrayBuffer, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json(
        { error: uploadError.message },
        { status: 500 }
      );
    }

    const { data: documento, error: dbError } = await supabaseAdmin
      .from("tbpratiche_documenti")
      .insert({
        pratica_id: id,
        tipo_documento,
        nome_file: file.name,
        file_path: filePath,
        stato: "caricato",
        origine: "manuale",
        note: note || null,
      })
      .select()
      .single();

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      documento,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Errore caricamento documento" },
      { status: 500 }
    );
  }
}
