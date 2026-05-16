import { NextResponse } from "next/server";
import { pool } from "@/lib/postgres";

    export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "API pratiche attiva",
  });
}

export async function POST(req: Request) {
  const client = await pool.connect();

  try {
    const body = await req.json();

    const {
      studio_id,
      cliente_id,
      tipo_pratica_id,
      titolo,
      priorita = "normale",
      assegnato_a = null,
      note = null,
    } = body;

    if (!studio_id || !cliente_id || !tipo_pratica_id || !titolo) {
      return NextResponse.json(
        { error: "Dati obbligatori mancanti" },
        { status: 400 }
      );
    }

    await client.query("BEGIN");

    const numeroResult = await client.query(
      `
      SELECT COUNT(*)::int + 1 AS progressivo
      FROM tbpratiche
      WHERE studio_id = $1
      `,
      [studio_id]
    );

    const progressivo = numeroResult.rows[0].progressivo;
    const numero_pratica = `PR-${new Date().getFullYear()}-${String(progressivo).padStart(5, "0")}`;

    const praticaResult = await client.query(
      `
      INSERT INTO tbpratiche
      (
        studio_id,
        cliente_id,
        tipo_pratica_id,
        numero_pratica,
        titolo,
        stato,
        priorita,
        data_apertura,
        assegnato_a,
        note
      )
      VALUES
      ($1, $2, $3, $4, $5, 'aperta', $6, CURRENT_DATE, $7, $8)
      RETURNING *
      `,
      [
        studio_id,
        cliente_id,
        tipo_pratica_id,
        numero_pratica,
        titolo,
        priorita,
        assegnato_a,
        note,
      ]
    );

    const pratica = praticaResult.rows[0];

    await client.query(
      `
      INSERT INTO tbpratiche_step
      (
        pratica_id,
        template_step_id,
        ordine,
        ente,
        titolo,
        descrizione,
        stato,
        obbligatorio,
        data_scadenza,
        responsabile_id
      )
      SELECT
        $1,
        id,
        ordine,
        ente,
        titolo,
        descrizione,
        'da_fare',
        obbligatorio,
        CASE
          WHEN giorni_scadenza IS NOT NULL
          THEN CURRENT_DATE + giorni_scadenza
          ELSE NULL
        END,
        $2
      FROM tbpratiche_step_template
      WHERE tipo_pratica_id = $3
      ORDER BY ordine
      `,
      [pratica.id, assegnato_a, tipo_pratica_id]
    );

    await client.query(
      `
      INSERT INTO tbpratiche_checklist
      (
        pratica_id,
        checklist_template_id,
        titolo,
        descrizione,
        obbligatorio
      )
      SELECT
        $1,
        id,
        titolo,
        descrizione,
        obbligatorio
      FROM tbpratiche_checklist_template
      WHERE tipo_pratica_id = $2
      ORDER BY ordine
      `,
      [pratica.id, tipo_pratica_id]
    );

    await client.query(
      `
      INSERT INTO tbpratiche_scadenze
      (
        studio_id,
        cliente_id,
        pratica_id,
        step_id,
        titolo,
        descrizione,
        data_scadenza,
        stato,
        priorita,
        assegnato_a
      )
      SELECT
        $1,
        $2,
        $3,
        s.id,
        s.titolo,
        s.descrizione,
        s.data_scadenza,
        'da_fare',
        $4,
        $5
      FROM tbpratiche_step s
      WHERE s.pratica_id = $3
        AND s.data_scadenza IS NOT NULL
      `,
      [studio_id, cliente_id, pratica.id, priorita, assegnato_a]
    );

    await client.query(
      `
      INSERT INTO tbpratiche_log
      (
        studio_id,
        cliente_id,
        pratica_id,
        tipo_evento,
        descrizione,
        utente_id
      )
      VALUES
      ($1, $2, $3, 'PRATICA_CREATA', 'Pratica creata automaticamente con workflow, checklist e scadenze', $4)
      `,
      [studio_id, cliente_id, pratica.id, assegnato_a]
    );

    await client.query("COMMIT");

    return NextResponse.json({
      success: true,
      pratica,
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("Errore creazione pratica:", error);

    return NextResponse.json(
      { error: "Errore durante la creazione della pratica" },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
