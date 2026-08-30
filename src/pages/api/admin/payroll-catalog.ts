import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);

function normalize(value: unknown) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleUpperCase('it-IT');
}

async function getAuthorizedCatalogAdmin(req: NextApiRequest) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length).trim()
    : '';

  if (!token) return null;

  const {
    data: { user: authUser },
    error: authError,
  } = await supabaseAdmin.auth.getUser(token);

  if (authError || !authUser) return null;

  let userRow: any = null;

  const { data: byUserId } = await supabaseAdmin
    .from('tbutenti')
    .select('id, user_id, email, nome, cognome, tipo_utente, studio_id, attivo')
    .eq('user_id', authUser.id)
    .limit(1)
    .maybeSingle();

  userRow = byUserId;

  if (!userRow && authUser.email) {
    const { data: byEmail } = await supabaseAdmin
      .from('tbutenti')
      .select('id, user_id, email, nome, cognome, tipo_utente, studio_id, attivo')
      .ilike('email', authUser.email)
      .limit(1)
      .maybeSingle();

    userRow = byEmail;
  }

  if (!userRow || !userRow.studio_id) return null;

  const { data: studioRow } = await supabaseAdmin
    .from('tbstudio')
    .select('id, ragione_sociale')
    .eq('id', userRow.studio_id)
    .limit(1)
    .maybeSingle();

  if (!studioRow) return null;

  const authorized =
    userRow.attivo !== false &&
    normalize(userRow.tipo_utente) === 'ADMIN' &&
    normalize(userRow.nome) === 'MARIO' &&
    normalize(userRow.cognome) === 'ARTIOLA' &&
    normalize(studioRow.ragione_sociale) === 'REVISIONI COMMERCIALI';

  return authorized ? userRow : null;
}

function cleanNullable(value: unknown) {
  const text = String(value ?? '').trim();
  return text || null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const admin = await getAuthorizedCatalogAdmin(req);

    if (req.method === 'GET') {
      return res.status(200).json({ canEdit: Boolean(admin) });
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Metodo non consentito' });
    }

    if (!admin) {
      return res.status(403).json({
        error: 'Archivio in sola lettura. La modifica è riservata all’Amministratore di Sistema autorizzato.',
      });
    }

    const { catalog, action, key, payload = {} } = req.body || {};

    if (catalog === 'festivita') {
      if (!['create', 'update', 'delete'].includes(action)) {
        return res.status(400).json({ error: 'Azione festività non valida' });
      }

      if (action === 'delete') {
        if (!key) return res.status(400).json({ error: 'ID festività mancante' });

        const { error } = await supabaseAdmin.from('tbfestivita').delete().eq('id', key);
        if (error) throw error;

        return res.status(200).json({ success: true });
      }

      const tipo = String(payload.tipo || '').trim().toLowerCase();
      const dataFestivita = String(payload.data_festivita || '').trim();
      const descrizione = String(payload.descrizione || '').trim();

      if (!/^\d{4}-\d{2}-\d{2}$/.test(dataFestivita)) {
        return res.status(400).json({ error: 'Data festività non valida' });
      }
      if (!descrizione) {
        return res.status(400).json({ error: 'Descrizione obbligatoria' });
      }
      if (!['nazionale', 'locale', 'aziendale'].includes(tipo)) {
        return res.status(400).json({ error: 'Tipo festività non valido' });
      }

      const record = {
        data_festivita: dataFestivita,
        descrizione,
        tipo,
        comune: cleanNullable(payload.comune),
        provincia: cleanNullable(payload.provincia),
        codice_catastale: cleanNullable(payload.codice_catastale),
      };

      if (action === 'create') {
        const { error } = await supabaseAdmin.from('tbfestivita').insert(record);
        if (error) throw error;
      } else {
        if (!key) return res.status(400).json({ error: 'ID festività mancante' });
        const { error } = await supabaseAdmin.from('tbfestivita').update(record).eq('id', key);
        if (error) throw error;
      }

      return res.status(200).json({ success: true });
    }

    if (catalog === 'codici_presenza') {
      if (!['create', 'update', 'delete', 'toggle'].includes(action)) {
        return res.status(400).json({ error: 'Azione codice presenza non valida' });
      }

      if (action === 'delete') {
        if (!key) return res.status(400).json({ error: 'Codice presenza mancante' });

        const { error } = await supabaseAdmin
          .from('tbpresenze_codici')
          .delete()
          .eq('codice', String(key));
        if (error) throw error;

        return res.status(200).json({ success: true });
      }

      if (action === 'toggle') {
        if (!key || typeof payload.attivo !== 'boolean') {
          return res.status(400).json({ error: 'Dati stato codice presenza non validi' });
        }

        const { error } = await supabaseAdmin
          .from('tbpresenze_codici')
          .update({ attivo: payload.attivo })
          .eq('codice', String(key));
        if (error) throw error;

        return res.status(200).json({ success: true });
      }

      const codice = String(payload.codice || '').trim();
      const descrizione = String(payload.descrizione || '').trim();
      const tipo = String(payload.tipo || '').trim().toLowerCase();
      const ordine = Number(payload.ordine);

      if (!codice) return res.status(400).json({ error: 'Codice presenza obbligatorio' });
      if (!descrizione) return res.status(400).json({ error: 'Descrizione obbligatoria' });
      if (!['presenza', 'assenza', 'permesso', 'festivo'].includes(tipo)) {
        return res.status(400).json({ error: 'Tipo codice presenza non valido' });
      }
      if (!Number.isFinite(ordine)) {
        return res.status(400).json({ error: 'Ordine non valido' });
      }

      const record = {
        codice,
        descrizione,
        tipo,
        ordine,
        attivo: payload.attivo !== false,
      };

      if (action === 'create') {
        const { error } = await supabaseAdmin.from('tbpresenze_codici').insert(record);
        if (error) throw error;
      } else {
        if (!key) return res.status(400).json({ error: 'Codice presenza originale mancante' });
        const { error } = await supabaseAdmin
          .from('tbpresenze_codici')
          .update(record)
          .eq('codice', String(key));
        if (error) throw error;
      }

      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: 'Archivio non valido' });
  } catch (error: any) {
    console.error('Errore gestione archivi payroll:', error);
    return res.status(500).json({
      error: error?.message || 'Errore interno del server',
    });
  }
}
