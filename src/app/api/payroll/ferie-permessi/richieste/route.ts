import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const TIPI_PERMESSO = ['P', 'PF', '104', 'AL'] as const;

function escapeHtml(value: string) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization') || '';
    const token = authHeader.replace('Bearer ', '').trim();

    if (!token) {
      return NextResponse.json({ success: false, error: 'Token mancante.' }, { status: 401 });
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !authData.user?.email) {
      return NextResponse.json({ success: false, error: 'Utente non autenticato.' }, { status: 401 });
    }

    const body = await request.json();

    const tipoRichiesta = body.tipo_richiesta;
    const tipoPermesso = body.tipo_permesso ? String(body.tipo_permesso).trim().toUpperCase() : null;
    const oraRichiesta = body.ora_richiesta ? String(body.ora_richiesta).trim() : null;
    const dataInizio = body.data_inizio;
    const dataFine = body.data_fine || body.data_inizio;
    const giorni = body.giorni ? Number(body.giorni) : null;
    const ore = body.ore ? Number(body.ore) : null;
    const motivazione = body.motivazione || null;

    if (!['ferie', 'permesso'].includes(tipoRichiesta)) {
      return NextResponse.json({ success: false, error: 'Tipo richiesta non valido.' }, { status: 400 });
    }

    if (!dataInizio) {
      return NextResponse.json({ success: false, error: 'Data richiesta obbligatoria.' }, { status: 400 });
    }

    if (tipoRichiesta === 'ferie' && !giorni) {
      return NextResponse.json({ success: false, error: 'Giorni ferie obbligatori.' }, { status: 400 });
    }

    if (tipoRichiesta === 'permesso') {
      if (!tipoPermesso || !TIPI_PERMESSO.includes(tipoPermesso as (typeof TIPI_PERMESSO)[number])) {
        return NextResponse.json(
          { success: false, error: 'Tipo permesso non valido. Valori ammessi: P, PF, 104, AL.' },
          { status: 400 },
        );
      }

      if (!oraRichiesta || !/^([01]\d|2[0-3]):[0-5]\d$/.test(oraRichiesta)) {
        return NextResponse.json(
          { success: false, error: 'Ora richiesta obbligatoria e non valida.' },
          { status: 400 },
        );
      }

      if (!ore || ore <= 0 || ore > 8 || Math.round(ore * 4) !== ore * 4) {
        return NextResponse.json(
          { success: false, error: 'Le ore di permesso devono essere comprese tra 0,25 e 8, a intervalli di 15 minuti.' },
          { status: 400 },
        );
      }

      if (tipoPermesso === 'AL' && ![1, 2].includes(ore)) {
        return NextResponse.json(
          { success: false, error: 'Per il permesso AL sono ammesse 1 oppure 2 ore.' },
          { status: 400 },
        );
      }
    }

    const { data: utente, error: userError } = await supabaseAdmin
      .from('tbutenti')
      .select('id, studio_id, nome, cognome, email')
      .eq('email', authData.user.email)
      .single();

    if (userError || !utente) throw new Error('Utente non trovato.');

    const { data: studio, error: studioError } = await supabaseAdmin
      .from('tbstudio')
      .select('id, mail_alert_ferie_permessi')
      .eq('id', utente.studio_id)
      .single();

    if (studioError || !studio) throw new Error('Studio non trovato.');

    const emailResponsabile = studio.mail_alert_ferie_permessi?.trim();

    if (!emailResponsabile) {
      throw new Error('Email alert ferie/permessi non configurata nello studio.');
    }

    const richiedente =
      `${utente.nome ?? ''} ${utente.cognome ?? ''}`.trim() ||
      utente.email ||
      'Dipendente';

    const { data: richiesta, error: insertError } = await (supabaseAdmin as any)
      .from('tbferie_permessi_richieste')
      .insert({
        studio_id: utente.studio_id,
        utente_id: utente.id,
        tipo_richiesta: tipoRichiesta,
        tipo_permesso: tipoRichiesta === 'permesso' ? tipoPermesso : null,
        ora_richiesta: tipoRichiesta === 'permesso' ? oraRichiesta : null,
        data_inizio: dataInizio,
        data_fine: tipoRichiesta === 'ferie' ? dataFine : null,
        giorni: tipoRichiesta === 'ferie' ? giorni : null,
        ore: tipoRichiesta === 'permesso' ? ore : null,
        motivazione,
        stato: 'inviata',
        email_responsabile: emailResponsabile,
        email_richiedente: utente.email,
      })
      .select('id')
      .single();

    if (insertError) throw insertError;

    function formatDateIT(date: string) {
      return new Date(`${date}T00:00:00`).toLocaleDateString('it-IT');
    }

    const html = `
      <div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#111827;">
        <p>Nuova richiesta ${tipoRichiesta === 'ferie' ? 'ferie' : 'permesso'}.</p>
        <p><strong>Richiedente:</strong> ${escapeHtml(richiedente)}</p>
        <p><strong>Data inizio:</strong> ${escapeHtml(formatDateIT(dataInizio))}</p>
        ${
          tipoRichiesta === 'ferie'
            ? `<p><strong>Data fine:</strong> ${escapeHtml(formatDateIT(dataFine))}</p><p><strong>Giorni:</strong> ${giorni}</p>`
            : `<p><strong>Tipo permesso:</strong> ${escapeHtml(tipoPermesso || '')}</p><p><strong>Ora richiesta:</strong> ${escapeHtml(oraRichiesta || '')}</p><p><strong>Ore permesso:</strong> ${ore}</p>`
        }
        ${motivazione ? `<p><strong>Note:</strong><br/>${escapeHtml(motivazione)}</p>` : ''}
        <p>Accedi al gestionale per approvare o rifiutare la richiesta.</p>
      </div>
    `;

    await sendEmailFromLoggedUser({
      request,
      token,
      studioId: String(utente.studio_id),
      senderUserId: String(utente.id),
      toEmail: emailResponsabile,
      subject: `Nuova richiesta ${tipoRichiesta === 'ferie' ? 'ferie' : `permesso ${tipoPermesso}`} - ${richiedente}`,
      html,
    });

    return NextResponse.json({
      success: true,
      id: richiesta.id,
    });
  } catch (error) {
    console.error('Errore richiesta ferie/permessi:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Errore richiesta ferie/permessi.',
      },
      { status: 500 },
    );
  }
}
