import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const supabaseAdmin = getSupabaseAdmin();

type Params = Promise<{
  id: string;
}>;

export async function POST(
  req: NextRequest,
  context: { params: Params }
) {
  const { id } = await context.params;

  const { data, error } = await supabaseAdmin.rpc(
    "rinnova_controllo_gestione",
    {
      p_controllo_id: id,
    }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: data });
}
