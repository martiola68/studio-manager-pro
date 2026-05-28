import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { data, error } = await supabaseAdmin.rpc(
    "rinnova_controllo_gestione",
    {
      p_controllo_id: params.id,
    }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: data });
}
