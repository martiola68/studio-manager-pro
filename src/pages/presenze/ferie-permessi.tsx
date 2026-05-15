import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

type StatoRichiesta = 'inviata' | 'approvata' | 'rifiutata' | 'revocata';

type Richiesta = {
  id: string;
  studio_id: string;
  utente_id: string;
  tipo_richiesta: 'ferie' | 'permesso';
  data_inizio: string;
  data_fine: string | null;
  giorni: number | null;
  ore: number | null;
  motivazione: string | null;
  stato: StatoRichiesta;
  email_responsabile: string | null;
  email_richiedente: string | null;
  note_responsabile: string | null;
  created_at: string;
  richiedente_nome?: string | null;
  richiedente_cognome?: string | null;
  richiedente_email?: string | null;
};

type UtenteLookup = {
  id: string;
  nome: string | null;
  cognome: string | null;
  email: string | null;
};

function formatDateIT(date: string | null) {
  if (!date) return '-';
  return new Date(`${date}T00:00:00`).toLocaleDateString('it-IT');
}

function getRichiedenteName(richiesta: Richiesta) {
  const fullName = `${richiesta.richiedente_cognome ?? ''} ${
    richiesta.richiedente_nome ?? ''
  }`.trim();

  return fullName || richiesta.email_richiedente || '-';
}

function getRichiedenteFiltroName(richiesta: Richiesta) {
  const fullName = `${richiesta.richiedente_cognome ?? ''} ${
    richiesta.richiedente_nome ?? ''
  }`.trim();

  return fullName || richiesta.email_richiedente || 'Dipendente';
}

export default function FeriePermessiPage() {
  const router = useRouter();
  const { toast } = useToast();

  const currentYear = new Date().getFullYear();

  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [richieste, setRichieste] = useState<Richiesta[]>([]);
  const [note, setNote] = useState<Record<string, string>>({});
  const [isResponsabilePaghe, setIsResponsabilePaghe] = useState(false);

  const [filtroDipendente, setFiltroDipendente] = useState<string>('tutti');
  const [filtroMese, setFiltroMese] = useState<string>('tutti');
  const [filtroAnno, setFiltroAnno] = useState<string>(String(currentYear));
  const [filtroStato, setFiltroStato] = useState<string>('tutti');

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const email = session?.user?.email?.trim().toLowerCase();

      if (!email) {
        router.push('/login');
        return;
      }

      const { data: userRow, error: userError } = await (supabase as any)
        .from('tbutenti')
        .select('id, studio_id, email, responsabile_paghe, responsabile_ferie_permessi')
        .eq('email', email)
        .single();

      if (userError || !userRow) throw userError;

      const { data: studioRow, error: studioError } = await (supabase as any)
        .from('tbstudio')
        .select('mail_alert_ferie_permessi')
        .eq('id', userRow.studio_id)
        .single();

      if (studioError || !studioRow) throw studioError;

      const isGestoreFeriePermessi =
        Boolean(userRow.responsabile_ferie_permessi) ||
        Boolean(userRow.responsabile_paghe) ||
        String(studioRow.mail_alert_ferie_permessi || '').trim().toLowerCase() === email;

      setIsResponsabilePaghe(isGestoreFeriePermessi);

      let query = (supabase as any)
        .from('tbferie_permessi_richieste')
        .select('*')
        .eq('studio_id', userRow.studio_id as string)
        .order('created_at', { ascending: false });

      if (!isGestoreFeriePermessi) {
        query = query.eq('utente_id', userRow.id);
      }

      const { data: richiesteData, error: richiesteError } = await query;

      if (richiesteError) throw richiesteError;

      const rows = (richiesteData || []) as Richiesta[];
      const userIds = Array.from(new Set(rows.map((r) => r.utente_id).filter(Boolean)));

      let utentiMap = new Map<string, UtenteLookup>();

      if (userIds.length > 0) {
        const { data: utentiData, error: utentiError } = await (supabase as any)
          .from('tbutenti')
          .select('id, nome, cognome, email')
          .in('id', userIds);

        if (utentiError) throw utentiError;

        utentiMap = new Map(
          ((utentiData || []) as UtenteLookup[]).map((utente) => [utente.id, utente]),
        );
      }

      const enrichedRows = rows.map((richiesta) => {
        const utente = utentiMap.get(richiesta.utente_id);

        return {
          ...richiesta,
          richiedente_nome: utente?.nome ?? null,
          richiedente_cognome: utente?.cognome ?? null,
          richiedente_email: utente?.email ?? richiesta.email_richiedente,
        };
      });

      setRichieste(enrichedRows);

      const initialNotes: Record<string, string> = {};
      enrichedRows.forEach((richiesta) => {
        initialNotes[richiesta.id] = richiesta.note_responsabile || '';
      });
      setNote(initialNotes);
    } catch (error: any) {
      console.error(error);
      toast({
        title: 'Errore',
        description: error?.message || 'Impossibile caricare le richieste.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  async function gestisciRichiesta(id: string, azione: StatoRichiesta) {
    try {
      setSavingId(id);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error('Sessione non valida. Effettua nuovamente il login.');
      }

      const response = await
