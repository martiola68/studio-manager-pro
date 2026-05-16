import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  try {
    const supabaseAdmin = getSupabaseAdmin();

    const { data, error } = await supabaseAdmin
      .from("tbpratiche")
      .select(`
        id,
        numero_pratica,
        titolo,
        stato,
        priorita,
        data_apertura,
        created_at,
        cliente_id,
        tipo_pratica_id,
        assegnato_a,
        tbclienti (
          nome
        ),
        tbpratiche_tipi (
          nome,
          ente
        ),
        tbutenti (
          nome,
          cognome
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    const pratiche = (data || []).map((p: any) => ({
      id: p.id,
      numero_pratica: p.numero_pratica,
      titolo: p.titolo,
      stato: p.stato,
      priorita: p.priorita,
      data_apertura: p.data_apertura,
      created_at: p.created_at,
      cliente_nome: p.tbclienti?.nome || "—",
      tipo_nome: p.tbpratiche_tipi
        ? `${p.tbpratiche_tipi.ente} - ${p.tbpratiche_tipi.nome}`
        : "—",
      assegnatario_nome: p.tbutenti
        ? `${p.tbutenti.nome || ""} ${p.tbutenti.cognome || ""}`.trim()
        : "Non assegnata",
      avanzamento: 0,
      prossima_scadenza: null,
    }));

    return NextResponse.json(pratiche);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Errore caricamento pratiche" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      cliente_id,
      tipo_pratica_id,
      titolo,
      priorita = "normale",
      assegnato_a = null,
      note = null,
    } = body;

    if (!cliente_id || !tipo_pratica_id || !titolo) {
      return NextResponse.json(
        { error: "Dati obbligatori mancanti" },
        { status: 400 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();

    const { data: cliente, error: clienteError } = await supabaseAdmin
      .from("tbclienti")
      .select("studio_id")
      .eq("id", cliente_id)
      .single();

    if (clienteError || !cliente) {
      return NextResponse.json(
        { error: "Cliente non trovato" },
        { status: 404 }
      );
    }

    const studio_id = cliente.studio_id;

    const { count } = await supabaseAdmin
      .from("tbpratiche")
      .select("id", { count: "exact", head: true })
      .eq("studio_id", studio_id);

    const progressivo = (count || 0) + 1;
    const numero_pratica = `PR-${new Date().getFullYear()}-${String(
      progressivo
    ).padStart(5, "0")}`;

    const { data: pratica, error: praticaError } = await supabaseAdmin
      .from("tbpratiche")
      .insert({
        studio_id,
        cliente_id,
        tipo_pratica_id,
        numero_pratica,
        titolo,
        stato: "aperta",
        priorita,
        data_apertura: new Date().toISOString().slice(0, 10),
        assegnato_a,
        note,
      })
      .select()
      .single();

    if (praticaError || !pratica) {
      return NextResponse.json(
        { error: praticaError?.message || "Errore creazione pratica" },
        { status: 500 }
      );
    }

    const { data: templates, error: templateError } = await supabaseAdmin
      .from("tbpratiche_step_template")
      .select("*")
      .eq("tipo_pratica_id", tipo_pratica_id)
      .order("ordine", { ascending: true });

    if (templateError) {
      return NextResponse.json(
        { error: templateError.message },
        { status: 500 }
      );
    }

    const stepDaInserire = (templates || []).map((step) => {
      const dataScadenza = step.giorni_scadenza
        ? new Date(Date.now() + step.giorni_scadenza * 86400000)
            .toISOString()
            .slice(0, 10)
        : null;

      return {
        pratica_id: pratica.id,
        template_step_id: step.id,
        ordine: step.ordine,
        ente: step.ente,
        titolo: step.titolo,
        descrizione: step.descrizione,
        stato: "da_fare",
        obbligatorio: step.obbligatorio,
        data_scadenza: dataScadenza,
        responsabile_id: assegnato_a,
      };
    });

    if (stepDaInserire.length > 0) {
      const { error: stepError } = await supabaseAdmin
        .from("tbpratiche_step")
        .insert(stepDaInserire);

      if (stepError) {
        return NextResponse.json(
          { error: stepError.message },
          { status: 500 }
        );
      }
    }

    const { data: checklistTemplate } = await supabaseAdmin
      .from("tbpratiche_checklist_template")
      .select("*")
      .eq("tipo_pratica_id", tipo_pratica_id)
      .order("ordine", { ascending: true });

    const checklistDaInserire = (checklistTemplate || []).map((item) => ({
      pratica_id: pratica.id,
      checklist_template_id: item.id,
      titolo: item.titolo,
      descrizione: item.descrizione,
      obbligatorio: item.obbligatorio,
    }));

    if (checklistDaInserire.length > 0) {
      await supabaseAdmin
        .from("tbpratiche_checklist")
        .insert(checklistDaInserire);
    }

    await supabaseAdmin.from("tbpratiche_log").insert({
      studio_id,
      cliente_id,
      pratica_id: pratica.id,
      tipo_evento: "PRATICA_CREATA",
      descrizione:
        "Pratica creata automaticamente con workflow, checklist e scadenze",
      utente_id: assegnato_a,
    });

    return NextResponse.json({
      success: true,
      pratica,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Errore durante la creazione della pratica" },
      { status: 500 }
    );
  }
}
