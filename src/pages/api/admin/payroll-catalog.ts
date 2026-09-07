import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });

function normalize(value: unknown) { return String(value ?? '').trim().replace(/\s+/g, ' ').toLocaleUpperCase('it-IT'); }
async function getAuthorizedCatalogAdmin(req: NextApiRequest) {
  const authHeader = req.headers.authorization || ''; const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length).trim() : ''; if (!token) return null;
  const { data: { user: authUser }, error: authError } = await supabaseAdmin.auth.getUser(token); if (authError || !authUser) return null;
  let userRow: any = null;
  const { data: byUserId } = await supabaseAdmin.from('tbutenti').select('id, user_id, email, nome, cognome, tipo_utente, studio_id, attivo, amministratore_sistema_generale').eq('user_id', authUser.id).limit(1).maybeSingle(); userRow = byUserId;
  if (!userRow && authUser.email) { const { data: byEmail } = await supabaseAdmin.from('tbutenti').select('id, user_id, email, nome, cognome, tipo_utente, studio_id, attivo, amministratore_sistema_generale').ilike('email', authUser.email).limit(1).maybeSingle(); userRow = byEmail; }
  if (!userRow) return null;
  const authorized = userRow.attivo !== false && userRow.amministratore_sistema_generale === true;
  return authorized ? userRow : null;
}
function cleanNullable(value: unknown) { const text = String(value ?? '').trim(); return text || null; }
function pad2(value: number) { return String(value).padStart(2, '0'); }
function easterSunday(year: number) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}
function nationalHolidays(year: number) {
  const easter = easterSunday(year); const monday = new Date(easter); monday.setUTCDate(easter.getUTCDate() + 1);
  const fixed = [
    ['01-01', 'Capodanno'], ['01-06', 'Epifania'], ['04-25', 'Festa della Liberazione'], ['05-01', 'Festa dei Lavoratori'],
    ['06-02', 'Festa della Repubblica'], ['08-15', 'Ferragosto'], ['11-01', 'Ognissanti'], ['12-08', 'Immacolata Concezione'], ['12-25', 'Natale'], ['12-26', 'Santo Stefano'],
  ];
  return [
    ...fixed.map(([date, descrizione]) => ({ data_festivita: `${year}-${date}`, descrizione, tipo: 'nazionale', comune: null, provincia: null, codice_catastale: null })),
    { data_festivita: `${year}-${pad2(easter.getUTCMonth() + 1)}-${pad2(easter.getUTCDate())}`, descrizione: 'Pasqua', tipo: 'nazionale', comune: null, provincia: null, codice_catastale: null },
    { data_festivita: `${year}-${pad2(monday.getUTCMonth() + 1)}-${pad2(monday.getUTCDate())}`, descrizione: "Lunedì dell'Angelo", tipo: 'nazionale', comune: null, provincia: null, codice_catastale: null },
  ].sort((a, b) => a.data_festivita.localeCompare(b.data_festivita));
}
async function ensureNationalHolidays(year: number) {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new Error('Anno festività non valido');
  const start = `${year}-01-01`, end = `${year}-12-31`;
  const { data: existing, error: readError } = await supabaseAdmin.from('tbfestivita').select('data_festivita, descrizione, tipo').gte('data_festivita', start).lte('data_festivita', end).eq('tipo', 'nazionale');
  if (readError) throw readError;
  const keys = new Set((existing || []).map((row: any) => `${row.data_festivita}|${normalize(row.descrizione)}`));
  const missing = nationalHolidays(year).filter((row) => !keys.has(`${row.data_festivita}|${normalize(row.descrizione)}`));
  if (missing.length) { const { error } = await supabaseAdmin.from('tbfestivita').insert(missing); if (error) throw error; }
  return missing.length;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const admin = await getAuthorizedCatalogAdmin(req);
    if (req.method === 'GET') return res.status(200).json({ canEdit: Boolean(admin) });
    if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo non consentito' });
    if (!admin) return res.status(403).json({ error: 'Archivio in sola lettura. La modifica è riservata all’Amministratore Generale di Sistema.' });
    const { catalog, action, key, payload = {} } = req.body || {};

    if (catalog === 'festivita') {
      if (!['create', 'update', 'delete', 'ensure_year'].includes(action)) return res.status(400).json({ error: 'Azione festività non valida' });
      if (action === 'ensure_year') { const year = Number(payload.year); const created = await ensureNationalHolidays(year); return res.status(200).json({ success: true, created }); }
      if (action === 'delete') { if (!key) return res.status(400).json({ error: 'ID festività mancante' }); const { error } = await supabaseAdmin.from('tbfestivita').delete().eq('id', key); if (error) throw error; return res.status(200).json({ success: true }); }
      const tipo = String(payload.tipo || '').trim().toLowerCase(), dataFestivita = String(payload.data_festivita || '').trim(), descrizione = String(payload.descrizione || '').trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dataFestivita)) return res.status(400).json({ error: 'Data festività non valida' });
      if (!descrizione) return res.status(400).json({ error: 'Descrizione obbligatoria' });
      if (!['nazionale', 'locale', 'aziendale'].includes(tipo)) return res.status(400).json({ error: 'Tipo festività non valido' });
      const record = { data_festivita: dataFestivita, descrizione, tipo, comune: cleanNullable(payload.comune), provincia: cleanNullable(payload.provincia), codice_catastale: cleanNullable(payload.codice_catastale) };
      if (action === 'create') { const { error } = await supabaseAdmin.from('tbfestivita').insert(record); if (error) throw error; } else { if (!key) return res.status(400).json({ error: 'ID festività mancante' }); const { error } = await supabaseAdmin.from('tbfestivita').update(record).eq('id', String(key)); if (error) throw error; }
      return res.status(200).json({ success: true });
    }

    if (catalog === 'codici_presenza') {
      if (!['create', 'update', 'delete', 'toggle'].includes(action)) return res.status(400).json({ error: 'Azione codice presenza non valida' });
      if (action === 'delete') { if (!key) return res.status(400).json({ error: 'Codice presenza mancante' }); const { error } = await supabaseAdmin.from('tbpresenze_codici').delete().eq('codice', String(key)); if (error) throw error; return res.status(200).json({ success: true }); }
      if (action === 'toggle') { if (!key || typeof payload.attivo !== 'boolean') return res.status(400).json({ error: 'Dati stato codice presenza non validi' }); const { error } = await supabaseAdmin.from('tbpresenze_codici').update({ attivo: payload.attivo }).eq('codice', String(key)); if (error) throw error; return res.status(200).json({ success: true }); }
      const codice = String(payload.codice || '').trim(), descrizione = String(payload.descrizione || '').trim(), tipo = String(payload.tipo || '').trim().toLowerCase(), ordine = Number(payload.ordine);
      if (!codice) return res.status(400).json({ error: 'Codice presenza obbligatorio' }); if (!descrizione) return res.status(400).json({ error: 'Descrizione obbligatoria' });
      if (!['presenza', 'assenza', 'permesso', 'festivo'].includes(tipo)) return res.status(400).json({ error: 'Tipo codice presenza non valido' }); if (!Number.isFinite(ordine)) return res.status(400).json({ error: 'Ordine non valido' });
      const record = { codice, descrizione, tipo, ordine, attivo: payload.attivo !== false };
      if (action === 'create') { const { error } = await supabaseAdmin.from('tbpresenze_codici').insert(record); if (error) throw error; } else { if (!key) return res.status(400).json({ error: 'Codice presenza originale mancante' }); const { error } = await supabaseAdmin.from('tbpresenze_codici').update(record).eq('codice', String(key)); if (error) throw error; }
      return res.status(200).json({ success: true });
    }
    return res.status(400).json({ error: 'Archivio non valido' });
  } catch (error: any) { console.error('Errore gestione archivi payroll:', error); return res.status(500).json({ error: error?.message || 'Errore interno del server' }); }
}
