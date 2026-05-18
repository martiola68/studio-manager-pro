import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type Params = {
  params: Promise<{
    id: string;
    soggettoId: string;
  }>;
};

export async function DELETE(req: Request, { params }: Params) {
  const { id, soggettoId } = await params;
  const supabaseAdmin = getSupabaseAdmin();

  const { error } = await supabaseAdmin
    .from("tbpratiche_soggetti")
    .delete()
    .eq("id", soggettoId)
    .eq("pratica_id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
