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

const mesi = [
  { value: '1', label: 'Gennaio' },
  { value: '2', label: 'Febbraio' },
  { value: '3', label: 'Marzo' },
  { value: '4', label: 'Aprile' },
  { value: '5', label: 'Maggio' },
  { value: '6', label: 'Giugno' },
  { value: '7', label: 'Luglio' },
  { value: '8', label: 'Agosto' },
  { value: '9', label: 'Settembre' },
  { value: '10', label: 'Ottobre' },
  { value: '11', label: 'Novembre' },
  { value: '12', label: 'Dicembre' },
];

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

function statoBadge(stato: StatoRichiesta) {
  if (stato === 'approvata') {
    return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Approvata</Badge>;
  }

  if (stato === 'rifiutata') {
    return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Rifiutata</Badge>;
  }

  if (stato === 'revocata') {
    return <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100">Revocata</Badge>;
  }

  return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Inviata</Badge>;
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

  async function gestisciRichiesta(
    id: string,
    azione: 'approvata' | 'rifiutata' | 'revocata',
  ) {
    try {
      setSavingId(id);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error('Sessione non valida. Effettua nuovamente il login.');
      }

      const response = await fetch(`/api/payroll/ferie-permessi/richieste/${id}/gestisci`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          azione,
          note_responsabile: note[id] || null,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.error || 'Impossibile gestire la richiesta.');
      }

      const description =
        azione === 'approvata'
          ? 'Richiesta approvata correttamente.'
          : azione === 'rifiutata'
            ? 'Richiesta rifiutata correttamente.'
            : 'Richiesta revocata correttamente.';

      toast({
        title: 'Operazione completata',
        description,
      });

      await loadData();
    } catch (error: any) {
      console.error(error);
      toast({
        title: 'Errore',
        description: error?.message || 'Impossibile gestire la richiesta.',
        variant: 'destructive',
      });
    } finally {
      setSavingId(null);
    }
  }

  const dipendentiOptions = useMemo(() => {
    const map = new Map<string, string>();

    richieste.forEach((richiesta) => {
      map.set(richiesta.utente_id, getRichiedenteFiltroName(richiesta));
    });

    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1], 'it'));
  }, [richieste]);

  const anniOptions = useMemo(() => {
    const anni = new Set<string>([String(currentYear)]);

    richieste.forEach((richiesta) => {
      if (richiesta.data_inizio) {
        anni.add(String(new Date(`${richiesta.data_inizio}T00:00:00`).getFullYear()));
      }
    });

    return Array.from(anni).sort((a, b) => Number(b) - Number(a));
  }, [richieste, currentYear]);

  const richiesteFiltrate = useMemo(() => {
    return richieste.filter((richiesta) => {
      const data = new Date(`${richiesta.data_inizio}T00:00:00`);
      const mese = String(data.getMonth() + 1);
      const anno = String(data.getFullYear());

      const matchDipendente =
        filtroDipendente === 'tutti' || richiesta.utente_id === filtroDipendente;

      const matchMese = filtroMese === 'tutti' || mese === filtroMese;
      const matchAnno = filtroAnno === 'tutti' || anno === filtroAnno;
      const matchStato = filtroStato === 'tutti' || richiesta.stato === filtroStato;

      return matchDipendente && matchMese && matchAnno && matchStato;
    });
  }, [richieste, filtroDipendente, filtroMese, filtroAnno, filtroStato]);

  const riepilogo = useMemo(() => {
    return {
      inviate: richiesteFiltrate.filter((r) => r.stato === 'inviata').length,
      approvate: richiesteFiltrate.filter((r) => r.stato === 'approvata').length,
      rifiutate: richiesteFiltrate.filter((r) => r.stato === 'rifiutata').length,
      revocate: richiesteFiltrate.filter((r) => r.stato === 'revocata').length,
    };
  }, [richiesteFiltrate]);

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Caricamento richieste...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
     <div className="flex items-center justify-between gap-4">
  <div>
    <h1 className="text-2xl font-semibold">Richieste ferie/permessi</h1>
    <p className="text-sm text-muted-foreground">
      Gestione richieste ferie e permessi dei dipendenti.
    </p>
  </div>

  <Button
    variant="outline"
    onClick={() => router.push('/presenze')}
  >
    Torna alle presenze
  </Button>
</div>

      <div className="grid gap-3 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Inviate</p>
            <p className="text-2xl font-semibold">{riepilogo.inviate}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Approvate</p>
            <p className="text-2xl font-semibold">{riepilogo.approvate}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Rifiutate</p>
            <p className="text-2xl font-semibold">{riepilogo.rifiutate}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Revocate</p>
            <p className="text-2xl font-semibold">{riepilogo.revocate}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="grid gap-4 p-4 md:grid-cols-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">Dipendente</label>
            <select
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={filtroDipendente}
              onChange={(event) => setFiltroDipendente(event.target.value)}
            >
              <option value="tutti">Tutti</option>
              {dipendentiOptions.map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Mese</label>
            <select
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={filtroMese}
              onChange={(event) => setFiltroMese(event.target.value)}
            >
              <option value="tutti">Tutti</option>
              {mesi.map((mese) => (
                <option key={mese.value} value={mese.value}>
                  {mese.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Anno</label>
            <select
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={filtroAnno}
              onChange={(event) => setFiltroAnno(event.target.value)}
            >
              {anniOptions.map((anno) => (
                <option key={anno} value={anno}>
                  {anno}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Stato</label>
            <select
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={filtroStato}
              onChange={(event) => setFiltroStato(event.target.value)}
            >
              <option value="tutti">Tutti</option>
              <option value="inviata">Inviata</option>
              <option value="approvata">Approvata</option>
              <option value="rifiutata">Rifiutata</option>
              <option value="revocata">Revocata</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {richiesteFiltrate.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Nessuna richiesta trovata.</p>
          </CardContent>
        </Card>
      ) : (
            <div className="space-y-0.5">
          {richiesteFiltrate.map((richiesta) => (

<Card key={richiesta.id} className="rounded-md">
  <CardContent className="p-2">
    <div className="grid grid-cols-[250px_80px_170px_60px_1fr_300px_130px_140px] items-center gap-2 text-[14px]">
      <div className="flex items-center gap-2 font-semibold">
        <span className="truncate">{getRichiedenteName(richiesta)}</span>
        {statoBadge(richiesta.stato)}
      </div>

      <div className="text-muted-foreground">
        {richiesta.tipo_richiesta === 'ferie' ? 'Ferie' : 'Permesso'}
      </div>

      <div className="truncate text-muted-foreground">
        {formatDateIT(richiesta.data_inizio)}
        {richiesta.data_fine ? ` - ${formatDateIT(richiesta.data_fine)}` : ''}
      </div>

      <div className="text-muted-foreground">
        {richiesta.giorni ? `${richiesta.giorni} gg` : ''}
        {richiesta.ore ? `${richiesta.ore} ore` : ''}
      </div>

<div className="truncate rounded bg-muted px-2 py-1">
  {richiesta.motivazione ? (
    <>
      <strong>Motivo:</strong> {richiesta.motivazione}
    </>
  ) : (
    <span className="text-muted-foreground">-</span>
  )}
</div>

{isResponsabilePaghe && richiesta.stato === 'inviata' ? (
  <Textarea
    className="h-8 min-h-0 w-full resize-none py-1 text-xs"
    value={note[richiesta.id] || ''}
    onChange={(event) =>
      setNote((prev) => ({
        ...prev,
        [richiesta.id]: event.target.value,
      }))
    }
    placeholder="Note responsabile..."
  />
) : (
  <div className="truncate text-xs text-muted-foreground">
    {richiesta.note_responsabile || '-'}
  </div>
)}

      <div className="text-xs text-muted-foreground">
        Inviata il {new Date(richiesta.created_at).toLocaleDateString('it-IT')}
      </div>

     <div className="flex justify-end gap-2">
  {isResponsabilePaghe && richiesta.stato === 'inviata' && (
    <>
      <Button
        size="sm"
        className="h-8 bg-green-600 px-3 text-white hover:bg-green-700"
        disabled={savingId === richiesta.id}
        onClick={() => gestisciRichiesta(richiesta.id, 'approvata')}
      >
        Approva
      </Button>

      <Button
        size="sm"
        variant="destructive"
        className="h-8 px-3"
        disabled={savingId === richiesta.id}
        onClick={() => gestisciRichiesta(richiesta.id, 'rifiutata')}
      >
        Rifiuta
      </Button>
    </>
  )}

  {isResponsabilePaghe && richiesta.stato === 'approvata' && (
    <Button
      size="sm"
      className="h-8 bg-orange-500 px-3 text-white hover:bg-orange-600"
      disabled={savingId === richiesta.id}
      onClick={() => gestisciRichiesta(richiesta.id, 'revocata')}
    >
      Revoca
    </Button>
  )}
</div>
    </div>
  </CardContent>
</Card>
          
          ))}
        </div>
      )}
    </div>
  );
}
