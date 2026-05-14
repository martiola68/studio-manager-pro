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
    throw new Error('Connessione Microsoft non trovata.');
  }

const { data: tokenOwner, error: tokenError } = await supabaseAdmin
  .from('tbmicrosoft365_user_tokens')
  .select('user_id')
  .eq('studio_id', params.studioId || params.studio_id || studio.id)
  .eq('microsoft_connection_id', studio.microsoft_connection_id)
  .is('revoked_at', null)
  .order('updated_at', { ascending: false })
  .limit(1)
  .maybeSingle();

if (tokenError || !tokenOwner?.user_id) {
  throw new Error('Token Microsoft non trovato per la connessione dello studio.');
}
  await microsoftGraphService.sendEmail(
    String(tokenOwner.user_id),
    String(studio.microsoft_connection_id),
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
      return NextResponse.json({ success: false, error: 'Utente non autenticato.' }, { status: 401 });
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

    if (!gestore.responsabile_paghe) {
      return NextResponse.json({ success: false, error: 'Operazione consentita solo al responsabile paghe.' }, { status: 403 });
    }

    const { data: richiesta, error: richiestaError } = await (supabaseAdmin as any)
      .from('tbferie_permessi_richieste')
      .select('*')
      .eq('id', id)
      .single();

    if (richiestaError || !richiesta) {
      throw new Error('Richiesta non trovata.');
    }

    const { data: studio, error: studioError } = await supabaseAdmin
      .from('tbstudio')
      .select('email, mail_alert_paghe, mail_alert_ferie_permessi')
      .eq('id', richiesta.studio_id)
      .single();

    if (studioError || !studio) {
      throw new Error('Studio non trovato.');
    }

    const fromEmail =
      studio.mail_alert_ferie_permessi?.trim() ||
      studio.mail_alert_paghe?.trim() ||
      studio.email?.trim();

    if (!fromEmail) {
      throw new Error('Email mittente non configurata.');
    }

    const { error: updateError } = await (supabaseAdmin as any)
      .from('tbferie_permessi_richieste')
      .update({
        stato: azione,
        note_responsabile: noteResponsabile,
        gestito_da: gestore.id,
        gestito_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) throw updateError;

    const statoLabel = azione === 'approvata' ? 'approvata' : 'rifiutata';

    const html = `
      <div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#111827;">
        <p>La tua richiesta ${escapeHtml(richiesta.tipo_richiesta)} è stata <strong>${statoLabel}</strong>.</p>
        <p><strong>Data inizio:</strong> ${escapeHtml(richiesta.data_inizio)}</p>
        ${
          richiesta.tipo_richiesta === 'ferie'
            ? `<p><strong>Data fine:</strong> ${escapeHtml(richiesta.data_fine || richiesta.data_inizio)}</p><p><strong>Giorni:</strong> ${richiesta.giorni}</p>`
            : `<p><strong>Ore:</strong> ${richiesta.ore}</p>`
        }
        ${noteResponsabile ? `<p><strong>Note responsabile:</strong><br/>${escapeHtml(noteResponsabile)}</p>` : ''}
      </div>
    `;

    if (richiesta.email_richiedente) {
      await sendEmail({
        studioId: String(richiesta.studio_id),
        fromEmail,
        toEmail: String(richiesta.email_richiedente),
        subject: `Richiesta ${richiesta.tipo_richiesta} ${statoLabel}`,
        html,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Errore gestione richiesta.',
      },
      { status: 500 },
    );
  }
}
