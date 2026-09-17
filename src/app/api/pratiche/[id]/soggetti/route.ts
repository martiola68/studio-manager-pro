import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type Params = {
  params: Promise<{ id: string }>;
};

type Nominativo = {
  id: string;
  nome_cognome?: string | null;
  ragione_sociale?: string | null;
  codice_fiscale?: string | null;
  partita_iva?: string | null;
  indirizzo?: string | null;
  citta?: string | null;
  provincia?: string | null;
  cap?: string | null;
};

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const supabaseAdmin = getSupabaseAdmin();

  const { data: soggetti, error } = await supabaseAdmin
    .from("tbpratiche_soggetti")
    .select("*")
    .eq("pratica_id", id)
    .order("ordine");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const nominativoIds = Array.from(
    new Set(
      (soggetti || [])
        .map((row: any) => row.nominativo_id)
        .filter((value: unknown): value is string => Boolean(value))
    )
  );

  let nominativi: Nominativo[] = [];

  if (nominativoIds.length > 0) {
    const { data, error: nominativiError } = await supabaseAdmin
      .from("tbclienti")
      .select("id, ragione_sociale, codice_fiscale, partita_iva, indirizzo, citta, provincia, cap")
      .in("id", nominativoIds);

    if (nominativiError) {
      return NextResponse.json({ error: nominativiError.message }, { status: 500 });
    }

    nominativi = (data || []).map((row: any) => ({
      ...row,
      nome_cognome: row.ragione_sociale || "",
    })) as Nominativo[];
  }

  const nominativiById = new Map(nominativi.map((item) => [String(item.id), item]));

  const soggettiCompleti = (soggetti || []).map((row: any) => ({
    ...row,
    nominativo: row.nominativo_id
      ? nominativiById.get(String(row.nominativo_id)) || null
      : null,
  }));

  return NextResponse.json({ soggetti: soggettiCompleti });
}

export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  const body = await req.json();
  const supabaseAdmin = getSupabaseAdmin();

  const { data, error } = await supabaseAdmin
    .from("tbpratiche_soggetti")
    .insert({
      pratica_id: id,
      tipo_soggetto: body.tipo_soggetto,
      nominativo_id: body.nominativo_id || null,
      carica: body.carica || null,
      note: body.note || null,
      ordine: body.ordine || 0,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, soggetto: data });
}
