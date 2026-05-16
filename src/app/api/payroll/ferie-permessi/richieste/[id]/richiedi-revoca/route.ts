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
    throw new Error('Token Microsoft non trovato per l’utente richiedente.');
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
    const motivoRevoca = String(body?.motivo_revoca || '').trim();

    if (!motivoRevoca) {
      return NextResponse.json(
        { success: false, error: 'Motivo richiesta revoca obbligatorio.' },
        { status: 400 },
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

    if (richiesta.stato !== 'approvata') {
      return NextResponse.json(
        { success: false, error: 'Puoi richiedere la revoca solo di richieste approvate.' },
        { status: 400 },
      );
    }

    const { data: richiedente, error: richiedenteError } = await (supabaseAdmin as any)
      .from('tbutenti')
      .select('id, studio_id, nome, cognome, email')
      .eq('email', authData.user.email)
      .single();

    if (richiedenteError || !richiedente) {
      throw new Error('Utente richiedente non trovato.');
    }

    if (String(richiedente.id) !== String(richiesta.utente_id)) {
      return NextResponse.json(
        { success: false, error: 'Puoi richiedere la revoca solo delle tue richieste.' },
        { status: 403 },
      );
    }

    if (String(richiedente.studio_id) !== String(richiesta.studio_id)) {
      return NextResponse.json(
        { success: false, error: 'Richiesta non appartenente al tuo studio.' },
        { status: 403 },
      );
    }

    const { data: studio, error: studioError } = await (supabaseAdmin as any)
      .from('tbstudio')
      .select('id, mail_alert_ferie_permessi')
      .eq('id', richiesta.studio_id)
      .single();

    if (studioError || !studio) {
      throw new Error('Studio non trovato.');
    }

    const emailResponsabile = String(
      richiesta.email_responsabile || studio.mail_alert_ferie_permessi || '',
    )
      .trim()
      .toLowerCase();

    if (!emailResponsabile) {
      throw new Error('Email responsabile ferie/permessi non configurata.');
    }

    const richiedenteNome =
      `${richiedente.nome ?? ''} ${richiedente.cognome ?? ''}`.trim() ||
      richiedente.email ||
      'Dipendente';

    const periodo =
      richiesta.tipo_richiesta === 'ferie'
        ? `${formatDateIT(richiesta.data_inizio)} - ${formatDateIT(
            richiesta.data_fine || richiesta.data_inizio,
          )}`
        : formatDateIT(richiesta.data_inizio);

    const durata =
      richiesta.tipo_richiesta === 'ferie'
        ? `${richiesta.giorni ?? '-'} giorni`
        : `${richiesta.ore ?? '-'} ore`;

    const html = `
      <div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#111827;">
        <p>
          Il dipendente <strong>${escapeHtml(richiedenteNome)}</strong> ha richiesto la revoca
          di una richiesta <strong>${escapeHtml(richiesta.tipo_richiesta)}</strong> già approvata.
        </p>

        <p><strong>Periodo:</strong> ${escapeHtml(periodo)}</p>
        <p><strong>Durata:</strong> ${escapeHtml(durata)}</p>

        ${
          richiesta.motivazione
            ? `<p><strong>Motivazione originale:</strong><br/>${escapeHtml(richiesta.motivazione)}</p>`
            : ''
        }

        <p>
          <strong>Motivo richiesta revoca:</strong><br/>
          ${escapeHtml(motivoRevoca)}
        </p>

        <p style="margin-top:16px;color:#475569;">
          Per completare la revoca, accedere alla pagina Richieste ferie/permessi e usare il pulsante Revoca sulla richiesta approvata.
        </p>
      </div>
    `;

    await sendEmailFromLoggedUser({
      request,
      token,
      studioId: String(richiedente.studio_id),
      senderUserId: String(richiedente.id),
      toEmail: emailResponsabile,
      subject: `Richiesta revoca ${richiesta.tipo_richiesta} - ${richiedenteNome}`,
      html,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Errore richiesta revoca ferie/permessi:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
