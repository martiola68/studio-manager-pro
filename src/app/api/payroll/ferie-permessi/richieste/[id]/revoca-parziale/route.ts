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

function parseDate(date: string) {
  return new Date(`${date}T00:00:00`);
}

function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

function formatDateIT(date: string | null) {
  if (!date) return '-';
  return parseDate(date).toLocaleDateString('it-IT');
}

function addDays(date: string, days: number) {
  const value = parseDate(date);
  value.setDate(value.getDate() + days);
  return formatDateKey(value);
}

function countWorkingDays(start: string, end: string, holidays: Set<string>) {
  if (!start || !end || end < start) return 0;

  let total = 0;
  const current = parseDate(start);
  const last = parseDate(end);

  while (current <= last) {
    const key = formatDateKey(current);
    const day = current.getDay();

    if (day !== 0 && day !== 6 && !holidays.has(key)) {
      total += 1;
    }

    current.setDate(current.getDate() + 1);
  }

  return total;
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
  const response = await fetch(`${origin}/api/microsoft365/graph`, {
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

  const text = await response.text().catch(() => '');

  if (!response.ok) {
    throw new Error(text || `Errore invio email Microsoft Graph (${response.status}).`);
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
    const revocaDal = String(body.revoca_dal || '');
    const revocaAl = String(body.revoca_al || '');
    const noteResponsabile = body.note_responsabile
      ? String(body.note_responsabile).trim()
      : null;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(revocaDal) || !/^\d{4}-\d{2}-\d{2}$/.test(revocaAl)) {
      return NextResponse.json(
        { success: false, error: 'Indica correttamente il periodo da revocare.' },
        { status: 400 },
      );
    }

    if (revocaAl < revocaDal) {
      return NextResponse.json(
        { success: false, error: 'La data fine revoca non può precedere la data inizio.' },
        { status: 400 },
      );
    }

    const { data: gestore, error: gestoreError } = await supabaseAdmin
      .from('tbutenti')
      .select('id, studio_id, nome, cognome, email, responsabile_paghe, responsabile_ferie_permessi')
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
    const emailGestoreFerie = String(studio.mail_alert_ferie_permessi || '')
      .trim()
      .toLowerCase();

    const isGestoreFeriePermessi =
      Boolean(gestore.responsabile_ferie_permessi) ||
      Boolean(gestore.responsabile_paghe) ||
      gestoreEmail === emailGestoreFerie;

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

    if (richiesta.tipo_richiesta !== 'ferie' || richiesta.stato !== 'approvata') {
      return NextResponse.json(
        { success: false, error: 'La revoca parziale è disponibile solo per ferie approvate.' },
        { status: 400 },
      );
    }

    const originalStart = String(richiesta.data_inizio);
    const originalEnd = String(richiesta.data_fine || richiesta.data_inizio);

    if (revocaDal < originalStart || revocaAl > originalEnd) {
      return NextResponse.json(
        {
          success: false,
          error: `Il periodo da revocare deve essere compreso tra ${formatDateIT(originalStart)} e ${formatDateIT(originalEnd)}.`,
        },
        { status: 400 },
      );
    }

    if (revocaDal === originalStart && revocaAl === originalEnd) {
      return NextResponse.json(
        {
          success: false,
          error: 'Hai selezionato l’intero periodo. Usa la revoca totale.',
        },
        { status: 400 },
      );
    }

    const { data: festivitaData, error: festivitaError } = await (supabaseAdmin as any)
      .from('tbfestivita')
      .select('data_festivita')
      .gte('data_festivita', originalStart)
      .lte('data_festivita', originalEnd)
      .in('tipo', ['nazionale', 'locale', 'aziendale']);

    if (festivitaError) throw festivitaError;

    const holidays = new Set<string>(
      (festivitaData || []).map((item: { data_festivita: string }) => item.data_festivita),
    );

    const revokedWorkingDays = countWorkingDays(revocaDal, revocaAl, holidays);

    if (revokedWorkingDays <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Il periodo selezionato non contiene giorni lavorativi di ferie da revocare.',
        },
        { status: 400 },
      );
    }

    const leftStart = originalStart;
    const leftEnd = addDays(revocaDal, -1);
    const rightStart = addDays(revocaAl, 1);
    const rightEnd = originalEnd;

    const hasLeft = leftEnd >= leftStart;
    const hasRight = rightStart <= rightEnd;
    const leftDays = hasLeft ? countWorkingDays(leftStart, leftEnd, holidays) : 0;
    const rightDays = hasRight ? countWorkingDays(rightStart, rightEnd, holidays) : 0;

    if (hasLeft && leftDays <= 0 && hasRight && rightDays <= 0) {
      return NextResponse.json(
        { success: false, error: 'La revoca non lascia giorni lavorativi residui.' },
        { status: 400 },
      );
    }

    const noteRevoca = [
      `Revoca parziale della richiesta ${richiesta.id}: ${formatDateIT(revocaDal)} - ${formatDateIT(revocaAl)}.`,
      noteResponsabile,
    ]
      .filter(Boolean)
      .join(' ');

    const baseInsert = {
      studio_id: richiesta.studio_id,
      utente_id: richiesta.utente_id,
      tipo_richiesta: 'ferie',
      ore: null,
      motivazione: richiesta.motivazione || null,
      email_responsabile: richiesta.email_responsabile || null,
      email_richiedente: richiesta.email_richiedente || null,
    };

    // Registriamo sempre il tratto revocato come record storico autonomo.
    const { data: revokedRow, error: revokedInsertError } = await (supabaseAdmin as any)
      .from('tbferie_permessi_richieste')
      .insert({
        ...baseInsert,
        data_inizio: revocaDal,
        data_fine: revocaAl,
        giorni: revokedWorkingDays,
        stato: 'revocata',
        note_responsabile: noteRevoca,
      })
      .select('id')
      .single();

    if (revokedInsertError) throw revokedInsertError;

    let primaryStart = '';
    let primaryEnd = '';
    let primaryDays = 0;
    let secondaryId: string | null = null;

    if (hasLeft && leftDays > 0) {
      primaryStart = leftStart;
      primaryEnd = leftEnd;
      primaryDays = leftDays;
    } else if (hasRight && rightDays > 0) {
      primaryStart = rightStart;
      primaryEnd = rightEnd;
      primaryDays = rightDays;
    }

    if (!primaryStart) {
      // Sicurezza: non dovrebbe essere raggiunto, ma evita di lasciare dati incoerenti.
      await (supabaseAdmin as any)
        .from('tbferie_permessi_richieste')
        .delete()
        .eq('id', revokedRow.id);
      return NextResponse.json(
        { success: false, error: 'Nessun periodo residuo valido dopo la revoca.' },
        { status: 400 },
      );
    }

    const { error: primaryUpdateError } = await (supabaseAdmin as any)
      .from('tbferie_permessi_richieste')
      .update({
        data_inizio: primaryStart,
        data_fine: primaryEnd,
        giorni: primaryDays,
        stato: 'approvata',
        note_responsabile: richiesta.note_responsabile || null,
      })
      .eq('id', richiesta.id);

    if (primaryUpdateError) throw primaryUpdateError;

    // Se la revoca è nel mezzo, il secondo tratto residuo diventa una nuova richiesta approvata.
    if (hasLeft && leftDays > 0 && hasRight && rightDays > 0) {
      const { data: secondaryRow, error: secondaryInsertError } = await (supabaseAdmin as any)
        .from('tbferie_permessi_richieste')
        .insert({
          ...baseInsert,
          data_inizio: rightStart,
          data_fine: rightEnd,
          giorni: rightDays,
          stato: 'approvata',
          note_responsabile: richiesta.note_responsabile || null,
        })
        .select('id')
        .single();

      if (secondaryInsertError) throw secondaryInsertError;
      secondaryId = String(secondaryRow.id);
    }

    const { error: deletePresenzeError } = await (supabaseAdmin as any)
      .from('tbpresenze_dipendenti')
      .delete()
      .eq('studio_id', richiesta.studio_id)
      .eq('utente_id', richiesta.utente_id)
      .eq('richiesta_ferie_permessi_id', richiesta.id)
      .eq('generata_da_richiesta_ferie_permessi', true)
      .gte('data_presenza', revocaDal)
      .lte('data_presenza', revocaAl);

    if (deletePresenzeError) throw deletePresenzeError;

    // Nel caso di spezzatura centrale, riallineiamo le presenze del secondo tratto al nuovo record.
    if (secondaryId) {
      const { error: reassignError } = await (supabaseAdmin as any)
        .from('tbpresenze_dipendenti')
        .update({ richiesta_ferie_permessi_id: secondaryId })
        .eq('studio_id', richiesta.studio_id)
        .eq('utente_id', richiesta.utente_id)
        .eq('richiesta_ferie_permessi_id', richiesta.id)
        .eq('generata_da_richiesta_ferie_permessi', true)
        .gte('data_presenza', rightStart)
        .lte('data_presenza', rightEnd);

      if (reassignError) throw reassignError;
    }

    const gestoreNome =
      `${gestore.nome ?? ''} ${gestore.cognome ?? ''}`.trim() ||
      gestore.email ||
      'Responsabile';

    if (richiesta.email_richiedente) {
      const residui = [
        hasLeft && leftDays > 0
          ? `${formatDateIT(leftStart)} - ${formatDateIT(leftEnd)} (${leftDays} gg)`
          : null,
        hasRight && rightDays > 0
          ? `${formatDateIT(rightStart)} - ${formatDateIT(rightEnd)} (${rightDays} gg)`
          : null,
      ].filter(Boolean);

      const html = `
        <div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#111827;">
          <p>È stata effettuata una <strong style="color:#ea580c;">revoca parziale</strong> delle tue ferie.</p>
          <p><strong>Gestita da:</strong> ${escapeHtml(gestoreNome)}</p>
          <p><strong>Periodo originario:</strong> ${escapeHtml(formatDateIT(originalStart))} - ${escapeHtml(formatDateIT(originalEnd))}</p>
          <p><strong>Periodo revocato:</strong> ${escapeHtml(formatDateIT(revocaDal))} - ${escapeHtml(formatDateIT(revocaAl))} (${revokedWorkingDays} gg)</p>
          <p><strong>Ferie residue approvate:</strong><br/>${residui.map((item) => escapeHtml(String(item))).join('<br/>')}</p>
          ${noteResponsabile ? `<p><strong>Note responsabile:</strong><br/>${escapeHtml(noteResponsabile)}</p>` : ''}
        </div>
      `;

      await sendEmailFromLoggedUser({
        request,
        token,
        studioId: String(gestore.studio_id),
        senderUserId: String(gestore.id),
        toEmail: String(richiesta.email_richiedente),
        subject: 'Revoca parziale ferie',
        html,
      });
    }

    return NextResponse.json({
      success: true,
      revocata: {
        id: revokedRow.id,
        data_inizio: revocaDal,
        data_fine: revocaAl,
        giorni: revokedWorkingDays,
      },
    });
  } catch (error) {
    console.error('Errore revoca parziale ferie:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
