import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const supabaseAdmin = getSupabaseAdmin();

type Params = Promise<{ id: string }>;

export async function POST(
  req: NextRequest,
  context: { params: Params }
) {
  const { id } = await context.params;
  const body = await req.json();

 const { data_esecuzione, note } = body;

  if (!data_esecuzione) {
    return NextResponse.json(
      { error: "Data esecuzione obbligatoria" },
      { status: 400 }
    );
  }

const { data, error } = await supabaseAdmin.rpc(
  "rinnova_controllo_gestione",
  {
    p_controllo_id: id,
    p_data_esecuzione: data_esecuzione,
    p_note: note || null,
  }
);
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: data });
}
