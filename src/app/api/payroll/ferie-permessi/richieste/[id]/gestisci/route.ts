import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

type StatoRichiesta = 'approvata' | 'rifiutata' | 'revocata';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

async function inviaEmailEsito(params: {
  to: string;
  nome?: string | null;
  azione: StatoRichiesta;
  tipoRichiesta: string;
  dataInizio: string;
  dataFine?: string | null;
  note?: string | null;
}) {
  const colore =
    params.azione === 'approvata'
      ? '#16a34a'
      : params.azione === 'rifiutata'
        ? '#dc2626'
        : '#475569';

  const esito =
    params.azione === 'approvata'
      ? 'approvata'
      : params.azione === 'rifiutata'
        ? 'rifiutata'
        : 'revocata';

  const subject = `Richiesta ${params.tipoRichiesta} ${esito}`;

  const html = `
    <div style="font-family: Arial, sans-serif; color: #111827;">
      <h2 style="color: ${colore};">Richiesta ${esito}</h2>

      <p>
        Ciao ${params.nome || ''},
        la tua richiesta di <strong>${params.tipoRichiesta}</strong> è stata
        <strong style="color: ${colore};">${esito}</strong>.
      </p>

      <p>
        <strong>Periodo:</strong>
        ${params.dataInizio}${params.dataFine ? ` - ${params.dataFine}` : ''}
      </p>

      ${
        params.note
          ? `<p><strong>Note responsabile:</strong><br />${params.note}</p>`
          : ''
      }
    </div>
  `;

  const resendApiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;

  if (!resendApiKey || !fromEmail) {
    console.warn('RESEND_API_KEY o RESEND_FROM_EMAIL non configurati. Email non inviata.');
    return;
  }

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromEmail,
      to: params.to,
      subject,
      html,
    }),
  });
}

export async function POST(
  request: NextRequest,
  context: { params: { id: string } },
) {
  try {
    const id = context.params.id;

    const authorization = request.headers.get('authorization');
    const token = authorization?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json(
        { error: 'Token mancante.' },
        { status: 401 },
      );
    }

    const supabaseUser = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    const {
      data: { user },
      error: userAuthError,
    } = await supabaseUser.auth.getUser();

    if (userAuthError || !user?.email) {
      return NextResponse.json(
        { error: 'Utente non autenticato.' },
        { status: 401 },
      );
    }

    const body = await request.json();
    const azione = body?.azione as StatoRichiesta;
    const noteResponsabile = body?.note_responsabile || null;

    if (!['approvata', 'rifiutata', 'revocata'].includes(azione)) {
      return NextResponse.json(
        { error: 'Azione non valida.' },
        { status: 400 },
      );
    }

    const { data: richiesta, error: richiestaError } = await supabaseAdmin
      .from('tbferie_permessi_richieste')
      .select('*')
      .eq('id', id)
      .single();

    if (richiestaError || !richiesta) {
      return NextResponse.json(
        { error: 'Richiesta non trovata.' },
        { status: 404 },
      );
    }

    const email = user.email.trim().toLowerCase();

    const { data: gestore, error: gestoreError } = await supabaseAdmin
      .from('tbutenti')
      .select('id, studio_id, email, responsabile_paghe, responsabile_ferie_permessi')
      .eq('studio_id', richiesta.studio_id)
      .eq('email', email)
      .single();

    if (gestoreError || !gestore) {
      return NextResponse.json(
        { error: 'Utente non autorizzato.' },
        { status: 403 },
      );
    }

    const { data: studio, error: studioError } = await supabaseAdmin
      .from('tbstudio')
      .select('mail_alert_ferie_permessi')
      .eq('id', richiesta.studio_id)
      .single();

    if (studioError || !studio) {
      return NextResponse.json(
        { error: 'Studio non trovato.' },
        { status: 404 },
      );
    }

    const isGestoreFeriePermessi =
      Boolean(gestore.responsabile_ferie_permessi) ||
      Boolean(gestore.responsabile_paghe) ||
      String(studio.mail_alert_ferie_permessi || '').trim().toLowerCase() === email;

    if (!isGestoreFeriePermessi) {
      return NextResponse.json(
        { error: 'Non sei autorizzato a gestire questa richiesta.' },
        { status: 403 },
      );
    }

    if (azione === 'revocata') {
      if (richiesta.stato !== 'approvata') {
        return NextResponse.json(
          { error: 'Puoi revocare solo richieste approvate.' },
          { status: 400 },
        );
      }

      const { error: deletePresenzeError } = await supabaseAdmin
        .from('tbpresenze_dipendenti')
        .delete()
        .eq('studio_id', richiesta.studio_id)
        .eq('utente_id', richiesta.utente_id)
        .eq('richiesta_ferie_permessi_id', richiesta.id)
        .eq('generata_da_richiesta_ferie_permessi', true);

      if (deletePresenzeError) {
        return NextResponse.json(
          { error: deletePresenzeError.message },
          { status: 500 },
        );
      }
    }

    const { error: updateError } = await supabaseAdmin
      .from('tbferie_permessi_richieste')
      .update({
        stato: azione,
        note_responsabile: noteResponsabile,
        gestita_da: gestore.id,
        gestita_at: new Date().toISOString(),
      })
      .eq('id', richiesta.id);

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 },
      );
    }

    const { data: richiedente } = await supabaseAdmin
      .from('tbutenti')
      .select('nome, cognome, email')
      .eq('id', richiesta.utente_id)
      .single();

    const emailRichiedente = richiesta.email_richiedente || richiedente?.email;

    if (emailRichiedente) {
      await inviaEmailEsito({
        to: emailRichiedente,
        nome: richiedente?.nome || null,
        azione,
        tipoRichiesta: richiesta.tipo_richiesta,
        dataInizio: richiesta.data_inizio,
        dataFine: richiesta.data_fine,
        note: noteResponsabile,
      });
    }

    return NextResponse.json({
      ok: true,
      stato: azione,
    });
  } catch (error: any) {
    console.error(error);

    return NextResponse.json(
      { error: error?.message || 'Errore interno del server.' },
      { status: 500 },
    );
  }
}
