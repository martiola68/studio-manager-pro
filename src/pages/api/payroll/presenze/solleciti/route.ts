import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { microsoftGraphService } from '@/services/microsoftGraphService';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

function pad2(value: number) {
  return String(value).padStart(2, '0');
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function formatItalianDate(dateKey: string) {
  return new Date(`${dateKey}T00:00:00`).toLocaleDateString('it-IT', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function getWorkingDays(start: Date, end: Date, holidays: Set<string>) {
  const days: string[] = [];
  const cursor = new Date(start);

  while (cursor <= end) {
    const key = toDateKey(cursor);
    const weekday = cursor.getDay();

    if (weekday !== 0 && weekday !== 6 && !holidays.has(key)) {
      days.push(key);
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return days;
}

function buildHtml(nome: string, missingDays: string[]) {
  const list = missingDays.map((day) => `<li>${formatItalianDate(day)}</li>`).join('');

  return `
<div style="font-family:Aptos, Arial, sans-serif; font-size:11pt; color:#111827; line-height:1.45;">
  <p style="margin:0 0 12px 0;">Gentile ${nome},</p>

  <p style="margin:0 0 12px 0;">
    risultano ancora da compilare le presenze per i seguenti giorni lavorativi:
  </p>

  <ul style="margin:0 0 12px 20px; padding:0;">
    ${list}
  </ul>

  <p style="margin:0 0 18px 0;">
    Ti chiediamo di accedere al gestionale e completare la compilazione entro oggi.
  </p>

  <p style="margin:0;">Cordiali saluti</p>
  <p style="margin:0;">Ufficio Paghe</p>
</div>
`.trim();
}

function buildText(nome: string, missingDays: string[]) {
  return `
Gentile ${nome},

risultano ancora da compilare le presenze per i seguenti giorni lavorativi:

${missingDays.map((day) => `- ${formatItalianDate(day)}`).join('\n')}

Ti chiediamo di accedere al gestionale e completare la compilazione entro oggi.

Cordiali saluti
Ufficio Paghe
`.trim();
}

async function getStudioMailContext(studioId: string) {
  const { data: studio, error: studioError } = await supabaseAdmin
    .from('tbstudio')
    .select('email, microsoft_connection_id')
    .eq('id', studioId)
    .single();

  if (studioError || !studio?.microsoft_connection_id) {
    throw new Error(`Connessione Microsoft studio non trovata per studio ${studioId}`);
  }

  const { data: tokenOwner, error: tokenError } = await supabaseAdmin
    .from('tbmicrosoft365_user_tokens')
    .select('user_id')
    .eq('microsoft_connection_id', studio.microsoft_connection_id)
    .maybeSingle();

  if (tokenError || !tokenOwner?.user_id) {
    throw new Error(`Token owner Microsoft non trovato per studio ${studioId}`);
  }

  return {
    senderUserId: String(tokenOwner.user_id),
    microsoftConnectionId: String(studio.microsoft_connection_id),
  };
}

async function sendReminderEmail(params: {
  studioId: string;
  to: string;
  subject: string;
  html: string;
}) {
  const ctx = await getStudioMailContext(params.studioId);

  await microsoftGraphService.sendEmail(ctx.senderUserId, ctx.microsoftConnectionId, {
    subject: params.subject,
    body: {
      contentType: 'HTML',
      content: params.html,
    },
    toRecipients: [
      {
        emailAddress: {
          address: params.to,
        },
      },
    ],
  });
}

async function runSolleciti() {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const year = yesterday.getFullYear();
  const monthIndex = yesterday.getMonth();

  const start = new Date(year, monthIndex, 1);
  const startDate = toDateKey(start);
  const endDate = toDateKey(yesterday);
  const reminderDate = toDateKey(today);

  const { data: dipendenti, error: dipError } = await supabaseAdmin
    .from('tbdipendenti')
    .select('studio_id, utente_id, nome, cognome, email, attivo')
    .eq('attivo', true)
    .not('email', 'is', null);

  if (dipError) throw dipError;

  const { data: festivita, error: festError } = await supabaseAdmin
    .from('tbfestivita')
    .select('data_festivita')
    .gte('data_festivita', startDate)
    .lte('data_festivita', endDate)
    .in('tipo', ['nazionale', 'aziendale']);

  if (festError) throw festError;

  const holidays = new Set((festivita ?? []).map((f) => String(f.data_festivita)));

  const { data: presenze, error: presenzeError } = await supabaseAdmin
    .from('tbpresenze_dipendenti')
    .select('utente_id, data_presenza')
    .gte('data_presenza', startDate)
    .lte('data_presenza', endDate);

  if (presenzeError) throw presenzeError;

  const compiled = new Set(
    (presenze ?? []).map((p) => `${p.utente_id}|${p.data_presenza}`),
  );

  const workingDays = getWorkingDays(start, yesterday, holidays);

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const dipendente of dipendenti ?? []) {
    const missingDays = workingDays.filter(
      (day) => !compiled.has(`${dipendente.utente_id}|${day}`),
    );

    if (missingDays.length === 0) {
      skipped++;
      continue;
    }

    const { data: existingLog } = await supabaseAdmin
      .from('tbpresenze_solleciti_log')
      .select('id')
      .eq('studio_id', dipendente.studio_id)
      .eq('utente_id', dipendente.utente_id)
      .eq('data_sollecito', reminderDate)
      .maybeSingle();

    if (existingLog) {
      skipped++;
      continue;
    }

    const nome =
      `${dipendente.nome ?? ''} ${dipendente.cognome ?? ''}`.trim() || 'Dipendente';

    try {
      await sendReminderEmail({
        studioId: String(dipendente.studio_id),
        to: String(dipendente.email),
        subject: 'Promemoria compilazione presenze',
        html: buildHtml(nome, missingDays),
      });

      await supabaseAdmin.from('tbpresenze_solleciti_log').insert({
        studio_id: String(dipendente.studio_id),
        utente_id: String(dipendente.utente_id),
        data_sollecito: reminderDate,
        periodo_da: startDate,
        periodo_a: endDate,
        giorni_mancanti: missingDays,
        email_destinatario: String(dipendente.email),
        esito: 'inviato',
      });

      sent++;
    } catch (error) {
      failed++;

      await supabaseAdmin.from('tbpresenze_solleciti_log').insert({
        studio_id: String(dipendente.studio_id),
        utente_id: String(dipendente.utente_id),
        data_sollecito: reminderDate,
        periodo_da: startDate,
        periodo_a: endDate,
        giorni_mancanti: missingDays,
        email_destinatario: String(dipendente.email),
        esito: 'errore',
        errore: error instanceof Error ? error.message : 'Errore sconosciuto',
      });
    }
  }

  return {
    success: true,
    sent,
    skipped,
    failed,
    periodo_da: startDate,
    periodo_a: endDate,
  };
}

export async function POST() {
  try {
    const result = await runSolleciti();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Errore solleciti presenze',
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  return POST();
}
