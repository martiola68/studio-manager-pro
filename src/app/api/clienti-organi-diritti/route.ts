import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const tipiDirittoAmmessi = [
  "nuda_proprieta",
  "usufrutto",
  "pegno",
  "sequestro",
  "intestazione_fiduciaria",
  "altro",
];

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();

    const { searchParams } = new URL(req.url);

    const organoId = searchParams.get("organo_id");
    const clienteId = searchParams.get("cliente_id");

    if (!organoId && !clienteId) {
      return NextResponse.json(
        {
          error:
            "Indicare organo_id oppure cliente_id",
        },
        { status: 400 }
      );
    }

    let query = supabase
      .from("tbclienti_organi_diritti")
      .select(`
        id,
        organo_id,
        soggetto_cliente_id,
        tipo_diritto,
        percentuale_quota,
        percentuale_diritti_voto,
        percentuale_diritti_utili,
        diritto_voto,
        diritto_utili,
        data_inizio,
        data_fine,
        attivo,
        note,
        created_at,
        updated_at,

        soggetto_cliente:tbclienti!tbclienti_organi_diritti_soggetto_cliente_id_fkey (
          id,
          ragione_sociale,
          cognome,
          nome,
          codice_fiscale,
          partita_iva,
          tipo_cliente
        ),

        organo:tbclienti_organi!tbclienti_organi_diritti_organo_id_fkey (
          id,
          cliente_id,
          soggetto_cliente_id,
          ruolo,
          percentuale_partecipazione,
          titolo_possesso
        )
      `)
      .order("created_at", { ascending: true });

    if (organoId) {
      query = query.eq("organo_id", organoId);
    }

    if (clienteId) {
      query = query.eq(
        "organo.cliente_id",
        clienteId
      );
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    const dirittiNormalizzati = (data || []).map(
      (row: any) => {
        const soggetto = row.soggetto_cliente;

        return {
          ...row,

          nominativo_nome:
            soggetto?.ragione_sociale ||
            [soggetto?.cognome, soggetto?.nome]
              .filter(Boolean)
              .join(" ") ||
            "",

          nominativo_codice_fiscale:
            soggetto?.codice_fiscale ||
            soggetto?.partita_iva ||
            "",
        };
      }
    );

    return NextResponse.json({
      diritti: dirittiNormalizzati,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error:
          error?.message ||
          "Errore caricamento diritti collegati",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const payload = await req.json();

    if (!payload.organo_id) {
      return NextResponse.json(
        { error: "organo_id mancante" },
        { status: 400 }
      );
    }

    if (!payload.soggetto_cliente_id) {
      return NextResponse.json(
        { error: "soggetto_cliente_id mancante" },
        { status: 400 }
      );
    }

    if (
      !tipiDirittoAmmessi.includes(
        String(payload.tipo_diritto || "")
      )
    ) {
      return NextResponse.json(
        { error: "Tipo diritto non valido" },
        { status: 400 }
      );
    }

    const percentualeQuota = Number(
      payload.percentuale_quota
    );

    if (
      !Number.isFinite(percentualeQuota) ||
      percentualeQuota <= 0 ||
      percentualeQuota > 100
    ) {
      return NextResponse.json(
        {
          error:
            "La percentuale della quota deve essere maggiore di 0 e non superiore a 100",
        },
        { status: 400 }
      );
    }

    const { data: organo, error: organoError } =
      await supabase
        .from("tbclienti_organi")
        .select(`
          id,
          ruolo,
          percentuale_partecipazione
        `)
        .eq("id", payload.organo_id)
        .single();

    if (organoError || !organo) {
      return NextResponse.json(
        {
          error:
            organoError?.message ||
            "Partecipazione principale non trovata",
        },
        { status: 404 }
      );
    }

    if (organo.ruolo !== "socio") {
      return NextResponse.json(
        {
          error:
            "I diritti collegati possono essere associati soltanto a una partecipazione societaria",
        },
        { status: 400 }
      );
    }

    const quotaPrincipale = Number(
      organo.percentuale_partecipazione || 0
    );

    if (percentualeQuota > quotaPrincipale) {
      return NextResponse.json(
        {
          error: `La quota collegata non può superare la partecipazione principale del ${quotaPrincipale}%`,
        },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("tbclienti_organi_diritti")
      .insert({
        organo_id: payload.organo_id,
        soggetto_cliente_id:
          payload.soggetto_cliente_id,

        tipo_diritto: payload.tipo_diritto,

        percentuale_quota: percentualeQuota,

        percentuale_diritti_voto:
          payload.percentuale_diritti_voto !== "" &&
          payload.percentuale_diritti_voto != null
            ? Number(
                payload.percentuale_diritti_voto
              )
            : null,

        percentuale_diritti_utili:
          payload.percentuale_diritti_utili !== "" &&
          payload.percentuale_diritti_utili != null
            ? Number(
                payload.percentuale_diritti_utili
              )
            : null,

        diritto_voto:
          payload.diritto_voto === true,

        diritto_utili:
          payload.diritto_utili === true,

        data_inizio:
          payload.data_inizio || null,

        data_fine:
          payload.data_fine || null,

        attivo:
          payload.attivo ?? true,

        note:
          payload.note || null,
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
      diritto: data,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error:
          error?.message ||
          "Errore salvataggio diritto collegato",
      },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const payload = await req.json();

    if (!payload.id) {
      return NextResponse.json(
        { error: "id mancante" },
        { status: 400 }
      );
    }

    const aggiornamento: Record<string, any> = {};

    if (payload.soggetto_cliente_id !== undefined) {
      aggiornamento.soggetto_cliente_id =
        payload.soggetto_cliente_id;
    }

    if (payload.tipo_diritto !== undefined) {
      if (
        !tipiDirittoAmmessi.includes(
          String(payload.tipo_diritto)
        )
      ) {
        return NextResponse.json(
          { error: "Tipo diritto non valido" },
          { status: 400 }
        );
      }

      aggiornamento.tipo_diritto =
        payload.tipo_diritto;
    }

    if (payload.percentuale_quota !== undefined) {
      const percentualeQuota = Number(
        payload.percentuale_quota
      );

      if (
        !Number.isFinite(percentualeQuota) ||
        percentualeQuota <= 0 ||
        percentualeQuota > 100
      ) {
        return NextResponse.json(
          {
            error:
              "La percentuale della quota deve essere maggiore di 0 e non superiore a 100",
          },
          { status: 400 }
        );
      }

      aggiornamento.percentuale_quota =
        percentualeQuota;
    }

    if (
      payload.percentuale_diritti_voto !==
      undefined
    ) {
      aggiornamento.percentuale_diritti_voto =
        payload.percentuale_diritti_voto === "" ||
        payload.percentuale_diritti_voto == null
          ? null
          : Number(
              payload.percentuale_diritti_voto
            );
    }

    if (
      payload.percentuale_diritti_utili !==
      undefined
    ) {
      aggiornamento.percentuale_diritti_utili =
        payload.percentuale_diritti_utili === "" ||
        payload.percentuale_diritti_utili == null
          ? null
          : Number(
              payload.percentuale_diritti_utili
            );
    }

    if (payload.diritto_voto !== undefined) {
      aggiornamento.diritto_voto =
        payload.diritto_voto === true;
    }

    if (payload.diritto_utili !== undefined) {
      aggiornamento.diritto_utili =
        payload.diritto_utili === true;
    }

    if (payload.data_inizio !== undefined) {
      aggiornamento.data_inizio =
        payload.data_inizio || null;
    }

    if (payload.data_fine !== undefined) {
      aggiornamento.data_fine =
        payload.data_fine || null;
    }

    if (payload.attivo !== undefined) {
      aggiornamento.attivo =
        payload.attivo === true;
    }

    if (payload.note !== undefined) {
      aggiornamento.note =
        payload.note || null;
    }

    aggiornamento.updated_at =
      new Date().toISOString();

    const { data, error } = await supabase
      .from("tbclienti_organi_diritti")
      .update(aggiornamento)
      .eq("id", payload.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      diritto: data,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error:
          error?.message ||
          "Errore aggiornamento diritto collegato",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const payload = await req.json();

    if (!payload.id) {
      return NextResponse.json(
        { error: "id mancante" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("tbclienti_organi_diritti")
      .delete()
      .eq("id", payload.id);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error:
          error?.message ||
          "Errore eliminazione diritto collegato",
      },
      { status: 500 }
    );
  }
}
