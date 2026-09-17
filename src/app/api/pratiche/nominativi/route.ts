import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

async function resolveStudioId(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  praticaId?: string | null,
  studioId?: string | null
) {
  if (studioId) return studioId;
  if (!praticaId) return null;

  const { data, error } = await supabaseAdmin
    .from("tbpratiche")
    .select("studio_id")
    .eq("id", praticaId)
    .maybeSingle();

  if (error) throw error;
  return data?.studio_id || null;
}

function normalizzaCliente(row: any) {
  return {
    id: row.id,
    nome_cognome: row.ragione_sociale || "",
    ragione_sociale: row.ragione_sociale || "",
    codice_fiscale: row.codice_fiscale || "",
    partita_iva: row.partita_iva || "",
    indirizzo: row.indirizzo || "",
    citta: row.citta || "",
    provincia: row.provincia || "",
    cap: row.cap || "",
  };
}

export async function GET(req: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const praticaId = req.nextUrl.searchParams.get("pratica_id");
    const studioIdParam = req.nextUrl.searchParams.get("studio_id");
    const studioId = await resolveStudioId(supabaseAdmin, praticaId, studioIdParam);

    if (!studioId) {
      return NextResponse.json(
        { error: "studio_id o pratica_id obbligatorio" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("tbclienti")
      .select("id, ragione_sociale, codice_fiscale, partita_iva, indirizzo, citta, provincia, cap")
      .eq("studio_id", studioId)
      .eq("attivo", true)
      .order("ragione_sociale");

    if (error) throw error;

    return NextResponse.json({
      nominativi: (data || []).map(normalizzaCliente),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Errore caricamento nominativi" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const nomeCognome = String(body.nome_cognome || body.ragione_sociale || "").trim();
    const codiceFiscale = String(body.codice_fiscale || "").trim().toUpperCase();
    const partitaIva = String(body.partita_iva || "").trim();

    if (!nomeCognome) {
      return NextResponse.json({ error: "Nominativo obbligatorio" }, { status: 400 });
    }

    if (!codiceFiscale && !partitaIva) {
      return NextResponse.json(
        { error: "Codice fiscale o partita IVA obbligatori" },
        { status: 400 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();
    const studioId = await resolveStudioId(
      supabaseAdmin,
      body.pratica_id ? String(body.pratica_id) : null,
      body.studio_id ? String(body.studio_id) : null
    );

    if (!studioId) {
      return NextResponse.json(
        { error: "Impossibile determinare lo studio della pratica" },
        { status: 400 }
      );
    }

    let existingQuery = supabaseAdmin
      .from("tbclienti")
      .select("id, ragione_sociale, codice_fiscale, partita_iva, indirizzo, citta, provincia, cap")
      .eq("studio_id", studioId)
      .limit(1);

    if (codiceFiscale) {
      existingQuery = existingQuery.eq("codice_fiscale", codiceFiscale);
    } else {
      existingQuery = existingQuery.eq("partita_iva", partitaIva);
    }

    const { data: existingRows, error: searchError } = await existingQuery;
    if (searchError) throw searchError;

    if (existingRows?.[0]) {
      return NextResponse.json({
        success: true,
        nominativo: normalizzaCliente(existingRows[0]),
        already_exists: true,
      });
    }

    const tipoCliente = codiceFiscale.length === 16 ? "Persona fisica" : "Altro";
    const payload: any = {
      studio_id: studioId,
      ragione_sociale: nomeCognome,
      codice_fiscale: codiceFiscale || null,
      partita_iva: partitaIva || (codiceFiscale.length === 11 ? codiceFiscale : null),
      indirizzo: body.indirizzo || null,
      citta: body.citta || null,
      provincia: body.provincia || null,
      cap: body.cap || null,
      tipo_cliente: tipoCliente,
      tipologia_cliente: "Altro",
      cliente: false,
      attivo: true,
    };

    const { data, error } = await supabaseAdmin
      .from("tbclienti")
      .insert(payload)
      .select("id, ragione_sociale, codice_fiscale, partita_iva, indirizzo, citta, provincia, cap")
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      nominativo: normalizzaCliente(data),
      already_exists: false,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Errore salvataggio nominativo" },
      { status: 500 }
    );
  }
}
