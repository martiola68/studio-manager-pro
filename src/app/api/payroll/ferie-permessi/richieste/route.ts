import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { microsoftGraphService } from '@/services/microsoftGraphService';

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

async function sendEmail(params: {
  studioId: string;
  senderUserId: string;
  fromEmail: string;
  toEmail: string;
  subject: string;
  html: string;
}) {
  const { data: studio, error: studioError } = await supabaseAdmin
    .from('tbstudio')
    .select('microsoft_connection_id')
    .eq('id', params.studioId)
    .single();

  if (studioError || !studio?.microsoft_connection_id) {
    throw new Error('Connessione Microsoft non trovata per lo studio.');
  }

const { data: tokenOwner, error: tokenError } = await supabaseAdmin
  .from('tbmicrosoft365_user_tokens')
  .select('user_id, microsoft_connection_id')
.eq('studio_id', params.studioId)
.eq('user_id', params.senderUserId)
  .is('revoked_at', null)
  .order('updated_at', { ascending: false })
  .limit(1)
  .maybeSingle();

if (tokenError || !tokenOwner?.user_id || !tokenOwner?.microsoft_connection_id) {
  throw new Error('Token Microsoft non trovato per l’utente richiedente.');
}
 await microsoftGraphService.sendEmail(
  String(tokenOwner.user_id),
  String(tokenOwner.microsoft_connection_id),
  {
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
);
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

    if (tipoRichiesta === 'permesso' && !ore) {
      return NextResponse.json({ success: false, error: 'Ore permesso obbligatorie.' }, { status: 400 });
    }

    const { data: utente, error: userError } = await supabaseAdmin
      .from('tbutenti')
      .select('id, studio_id, nome, cognome, email')
      .eq('email', authData.user.email)
      .single();

    if (userError || !utente) throw new Error('Utente non trovato.');

    const { data: studio, error: studioError } = await supabaseAdmin
      .from('tbstudio')
      .select('id, email, mail_alert_paghe, mail_alert_ferie_permessi')
      .eq('id', utente.studio_id)
      .single();

    if (studioError || !studio) throw new Error('Studio non trovato.');

    const emailResponsabile = studio.mail_alert_ferie_permessi?.trim();

    if (!emailResponsabile) {
      throw new Error('Email alert ferie/permessi non configurata nello studio.');
    }

    const fromEmail =
      studio.mail_alert_ferie_permessi?.trim() ||
      studio.mail_alert_paghe?.trim() ||
      studio.email?.trim();

    if (!fromEmail) {
      throw new Error('Email mittente non configurata.');
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

    const html = `
      <div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#111827;">
        <p>Nuova richiesta ${tipoRichiesta === 'ferie' ? 'ferie' : 'permesso'}.</p>
        <p><strong>Richiedente:</strong> ${escapeHtml(richiedente)}</p>
        <p><strong>Data inizio:</strong> ${escapeHtml(dataInizio)}</p>
        ${
          tipoRichiesta === 'ferie'
            ? `<p><strong>Data fine:</strong> ${escapeHtml(dataFine)}</p><p><strong>Giorni:</strong> ${giorni}</p>`
            : `<p><strong>Ore:</strong> ${ore}</p>`
        }
        ${motivazione ? `<p><strong>Note:</strong><br/>${escapeHtml(motivazione)}</p>` : ''}
        <p>Accedi al gestionale per approvare o rifiutare la richiesta.</p>
      </div>
    `;

  await sendEmail({
  studioId: String(userRow.studio_id),
  senderUserId: String(userRow.id),
  fromEmail: String(userRow.email),
  toEmail: String(studioRow.mail_alert_ferie_permessi),
  subject,
  html,
});

    return NextResponse.json({
      success: true,
      id: richiesta.id,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Errore richiesta ferie/permessi.',
      },
      { status: 500 },
    );
  }
}
