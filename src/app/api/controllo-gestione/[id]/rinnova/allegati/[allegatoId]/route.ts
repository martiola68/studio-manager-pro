import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const supabaseAdmin = getSupabaseAdmin();

const BUCKET = "controllo-gestione-allegati";

export async function GET(
  req: Request,
  { params }: { params: { allegatoId: string } }
) {
  const { data: allegato, error } = await supabaseAdmin
    .from("tbcontrollo_gestione_allegati")
    .select("*")
    .eq("id", params.allegatoId)
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
  req: Request,
  { params }: { params: { allegatoId: string } }
) {
  const { data: allegato, error } = await supabaseAdmin
    .from("tbcontrollo_gestione_allegati")
    .select("*")
    .eq("id", params.allegatoId)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabaseAdmin.storage.from(BUCKET).remove([allegato.file_path]);

  const { error: deleteError } = await supabaseAdmin
    .from("tbcontrollo_gestione_allegati")
    .delete()
    .eq("id", params.allegatoId);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
