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
