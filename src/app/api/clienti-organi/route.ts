import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { searchParams } = new URL(req.url);
    const cliente_id = searchParams.get("cliente_id");

    if (!cliente_id) {
      return NextResponse.json(
        { error: "cliente_id mancante" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("tbclienti_organi")
     .select(`
  id,
  cliente_id,
  soggetto_cliente_id,
  tipo_soggetto,
  rappresentante_legale,
  ruolo,
        percentuale_partecipazione,
        presenza,
        carica,
        principale,
        attivo,
        data_nomina,
        data_cessazione,
        durata_carica,
        data_scadenza,
    
soggetto_cliente:tbclienti!tbclienti_organi_soggetto_cliente_id_fkey (
  id,
  ragione_sociale,
  codice_fiscale,
  partita_iva,
  tipo_cliente
)
      `)
      .eq("cliente_id", cliente_id)
      .order("ruolo", { ascending: true });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    const organiNormalizzati = (data || []).map((o: any) => {
  const soggettoCliente = o.soggetto_cliente;
  const rappLegale = o.rapp_legali;

  return {
    ...o,

    nominativo_id:
      o.soggetto_cliente_id ||
      o.rapp_legale_id ||
      null,

    nominativo_nome:
      soggettoCliente?.ragione_sociale ||
      rappLegale?.nome_cognome ||
      "",

    nominativo_codice_fiscale:
      soggettoCliente?.codice_fiscale ||
      rappLegale?.codice_fiscale ||
      "",

    nominativo_tipo:
      o.soggetto_cliente_id
        ? "cliente"
        : o.rapp_legale_id
        ? "rapp_legale"
        : null,
  };
});

return NextResponse.json({
  organi: organiNormalizzati,
});
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Errore server" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const payload = await req.json();

    if (!payload.cliente_id) {
      return NextResponse.json(
        { error: "cliente_id mancante" },
        { status: 400 }
      );
    }

if (!payload.soggetto_cliente_id) {
  return NextResponse.json(
    { error: "nominativo mancante" },
    { status: 400 }
  );
}

    if (!payload.ruolo) {
      return NextResponse.json(
        { error: "ruolo mancante" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("tbclienti_organi")
.insert({
  cliente_id: payload.cliente_id,
  soggetto_cliente_id: payload.soggetto_cliente_id,
  tipo_soggetto:
    payload.tipo_soggetto === "societa"
      ? "societa"
      : "persona_fisica",
  rappresentante_legale: payload.rappresentante_legale ?? false,
  ruolo: payload.ruolo,

          carica: payload.carica,
        percentuale_partecipazione: payload.percentuale_partecipazione,
        presenza: payload.presenza,
        principale: payload.principale,
        attivo: payload.attivo ?? true,
        data_nomina: payload.data_nomina || null,
        durata_carica: payload.durata_carica || null,
        data_scadenza: payload.data_scadenza || null,
        data_cessazione: payload.data_cessazione || null,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      organo: data,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Errore server" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const payload = await req.json();

     if (!payload.id) {
      return NextResponse.json(
        { error: "id mancante" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("tbclienti_organi")
.update({
  soggetto_cliente_id: payload.soggetto_cliente_id || null,

  tipo_soggetto:
    payload.tipo_soggetto === "societa"
      ? "societa"
      : "persona_fisica",

  rappresentante_legale: payload.rappresentante_legale ?? false,
  ruolo: payload.ruolo,
        carica: payload.carica,
        percentuale_partecipazione: payload.percentuale_partecipazione,
        presenza: payload.presenza,
        principale: payload.principale,
        attivo: payload.attivo,
       data_nomina: payload.data_nomina || null,
      durata_carica: payload.durata_carica || null,
      data_scadenza: payload.data_scadenza || null,
        data_cessazione: payload.data_cessazione || null,
      })
      .eq("id", payload.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ organo: data });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Errore server" },
      { status: 500 }
    );
  }
}
export async function DELETE(req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const payload = await req.json();

    if (!payload.id) {
      return NextResponse.json(
        { error: "id mancante" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("tbclienti_organi")
      .delete()
      .eq("id", payload.id);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Errore server" },
      { status: 500 }
    );
  }
}
