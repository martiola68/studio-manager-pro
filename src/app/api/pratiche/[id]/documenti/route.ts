import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type Params = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(
  req: Request,
  { params }: Params
) {
  try {
    const { id } = await params;

    const supabaseAdmin = getSupabaseAdmin();

    const { data, error } = await supabaseAdmin
      .from("tbpratiche_documenti")
      .select("*")
      .eq("pratica_id", id)
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      return NextResponse.json(
        {
          error: error.message,
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json({
      documenti: data || [],
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error:
          error.message ||
          "Errore caricamento documenti",
      },
      {
        status: 500,
      }
    );
  }
}
