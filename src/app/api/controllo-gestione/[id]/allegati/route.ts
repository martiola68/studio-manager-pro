import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const supabaseAdmin = getSupabaseAdmin();
const BUCKET = "controllo-gestione-allegati";

type Params = Promise<{
  id: string;
}>;

export async function GET(
  req: NextRequest,
  context: { params: Params }
) {
  const { id } = await context.params;

  const { data, error } = await supabaseAdmin
    .from("tbcontrollo_gestione_allegati")
    .select("*")
    .eq("controllo_id", id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(
  req: NextRequest,
  context: { params: Params }
) {
  const { id } = await context.params;

  const formData = await req.formData();
  const files = formData.getAll("files") as File[];

  const uploaded = [];

  for (const file of files) {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const filePath = `${id}/${crypto.randomUUID()}-${file.name}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data, error } = await supabaseAdmin
      .from("tbcontrollo_gestione_allegati")
      .insert({
        controllo_id: id,
        nome_file: file.name,
        file_path: filePath,
        mime_type: file.type,
        size_bytes: file.size,
      })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    uploaded.push(data);
  }

  return NextResponse.json(uploaded);
}
