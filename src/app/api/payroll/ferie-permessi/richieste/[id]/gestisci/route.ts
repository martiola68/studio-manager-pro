import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

function escapeHtml(value: string) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDateIT(date: string | null) {
  if (!date) return '-';
  return new Date(`${date}T00:00:00`).toLocaleDateString('it-IT');
}

async function sendEmailFromLoggedUser(params: {
  request: Request;
  token: string;
  studioId: string;
  senderUserId: string;
  toEmail: string;
  subject: string;
  html: string;
}) {
  const { data: tokenRow, error: tokenError } = await supabaseAdmin
    .from('tbmicrosoft365_user_tokens')
    .select('microsoft_connection_id')
    .eq('studio_id', params.studioId)
    .eq('user_id', params.senderUserId)
    .is('revoked_at', null)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (tokenError || !tokenRow?.microsoft_connection_id) {
    throw new Error('Token Microsoft non trovato per l’utente gestore.');
  }

  const origin = new URL(params.request.url).origin;

  const res = await fetch(`${origin}/api/microsoft365/graph`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.token}`,
    },
    body: JSON.stringify({
      userId: params.senderUserId,
      endpoint: '/me/sendMail',
      method: 'POST',
      microsoftConnectionId: tokenRow.microsoft_connection_id,
      body: JSON.stringify({
        message: {
          subject: params.subject,
          body: {
            contentType: 'HTML',
            content: params.html,
          },
          toRecipients: [
            {
              emailAddress: {
                address: params.toEmail,
              },
            },
          ],
        },
        saveToSentItems: true,
      }),
    }),
  });

  const text = await res.text().catch(() => '');

  if (!res.ok) {
    throw new Error(text || `Errore invio email Microsoft Graph (${res.status}).`);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;

    const authHeader = request.headers.get('authorization') || '';
    const token = authHeader.replace('Bearer ', '').trim();

    if (!token) {
      return NextResponse.json({ success: false, error: 'Token mancante.' }, { status: 401 });
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !authData.user?.email) {
      return NextResponse.json(
        { success: false, error: 'Utente non autenticato.' },
        { status: 401 },
      );
    }

    const body = await request.json();
    const azione = body.azione;
    const noteResponsabile = body.note_responsabile || null;

    if (!['approvata', 'rifiutata'].includes(azione)) {
      return NextResponse.json({ success: false, error: 'Azione non valida.' }, { status: 400 });
    }

    const { data: gestore, error: gestoreError } = await supabaseAdmin
      .from('tbutenti')
      .select('id, studio_id, nome, cognome, email, responsabile_paghe')
      .eq('email', authData.user.email)
      .single();

    if (gestoreError || !gestore) {
      throw new Error('Utente gestore non trovato.');
    }

    const { data: studio, error: studioError } = await supabaseAdmin
      .from('tbstudio')
      .select('id, mail_alert_ferie_permessi')
      .eq('id', gestore.studio_id)
      .single();

    if (studioError || !studio) {
      throw new Error('Studio non trovato.');
    }

    const gestoreEmail = String(gestore.email || '').trim().toLowerCase();
    const emailGestoreFerie = String(studio.mail_alert_ferie_permessi || '').trim().toLowerCase();

    const isGestoreFeriePermessi =
      Boolean(gestore.responsabile_paghe) || gestoreEmail === emailGestoreFerie;

    if (!isGestoreFeriePermessi) {
      return NextResponse.json(
        { success: false, error: 'Operazione consentita solo al responsabile ferie/permessi.' },
        { status: 403 },
      );
    }

    const { data: richiesta, error: richiestaError } = await (supabaseAdmin as any)
      .from('tbferie_permessi_richieste')
      .select('*')
      .eq('id', id)
      .single();

    if (richiestaError || !richiesta) {
      throw new Error('Richiesta non trovata.');
    }

    if (String(richiesta.studio_id) !== String(gestore.studio_id)) {
      return NextResponse.json(
        { success: false, error: 'Richiesta non appartenente allo studio del gestore.' },
        { status: 403 },
      );
    }

    if (!richiesta.email_richiedente) {
      throw new Error('Email richiedente mancante sulla richiesta.');
    }

    const { error: updateError } = await (supabaseAdmin as any)
      .from('tbferie_permessi_richieste')
     .update({
  stato: azione,
  note_responsabile: noteResponsabile,
})
      .eq('id', id);

    if (updateError) throw updateError;

    const statoLabel = azione === 'approvata' ? 'approvata' : 'rifiutata';

    const gestoreNome =
      `${gestore.nome ?? ''} ${gestore.cognome ?? ''}`.trim() ||
      gestore.email ||
      'Responsabile';

    const html = `
      <div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#111827;">
        <p>La tua richiesta ${escapeHtml(richiesta.tipo_richiesta)} è stata <strong>${statoLabel}</strong>.</p>
        <p><strong>Gestita da:</strong> ${escapeHtml(gestoreNome)}</p>
        <p><strong>Data inizio:</strong> ${escapeHtml(formatDateIT(richiesta.data_inizio))}</p>
        ${
          richiesta.tipo_richiesta === 'ferie'
            ? `<p><strong>Data fine:</strong> ${escapeHtml(formatDateIT(richiesta.data_fine || richiesta.data_inizio))}</p><p><strong>Giorni:</strong> ${richiesta.giorni}</p>`
            : `<p><strong>Ore:</strong> ${richiesta.ore}</p>`
        }
        ${noteResponsabile ? `<p><strong>Note responsabile:</strong><br/>${escapeHtml(noteResponsabile)}</p>` : ''}
      </div>
    `;

    await sendEmailFromLoggedUser({
      request,
      token,
      studioId: String(gestore.studio_id),
      senderUserId: String(gestore.id),
      toEmail: String(richiesta.email_richiedente),
      subject: `Richiesta ${richiesta.tipo_richiesta} ${statoLabel}`,
      html,
    });

    return NextResponse.json({ success: true });
} catch (error) {
    console.error('Errore gestione richiesta:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
