import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const supabaseAdmin = getSupabaseAdmin();
const BUCKET = "controllo-gestione-allegati";

type Params = Promise<{
  id: string;
  allegatoId: string;
}>;

export async function GET(
  req: NextRequest,
  context: { params: Params }
) {
  const { allegatoId } = await context.params;

  const { data: allegato, error } = await supabaseAdmin
    .from("tbcontrollo_gestione_allegati")
    .select("*")
    .eq("id", allegatoId)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data, error: signedError } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUrl(allegato.file_path, 60);

  if (signedError) {
    return NextResponse.json({ error: signedError.message }, { status: 500 });
  }

  return NextResponse.json({ url: data.signedUrl });
}

export async function DELETE(
  req: NextRequest,
  context: { params: Params }
) {
  const { allegatoId } = await context.params;

  const { data: allegato, error } = await supabaseAdmin
    .from("tbcontrollo_gestione_allegati")
    .select("*")
    .eq("id", allegatoId)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabaseAdmin.storage.from(BUCKET).remove([allegato.file_path]);

  const { error: deleteError } = await supabaseAdmin
    .from("tbcontrollo_gestione_allegati")
    .delete()
    .eq("id", allegatoId);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
