import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

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
  stato: 'inviata' | 'approvata' | 'rifiutata';
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
  const fullName = `${richiesta.richiedente_cognome ?? ''} ${richiesta.richiedente_nome ?? ''}`.trim();
  return fullName || richiesta.email_richiedente || '-';
}

export default function FeriePermessiPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [richieste, setRichieste] = useState<Richiesta[]>([]);
  const [note, setNote] = useState<Record<string, string>>({});
  const [isResponsabilePaghe, setIsResponsabilePaghe] = useState(false);

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
        .select('id, studio_id, email, responsabile_paghe')
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

  async function gestisciRichiesta(id: string, azione: 'approvata' | 'rifiutata') {
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
          note_responsabile: note[id] || '',
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Errore aggiornamento richiesta.');
      }

      toast({
        title: 'Richiesta aggiornata',
        description: `Richiesta ${azione === 'approvata' ? 'approvata' : 'rifiutata'} correttamente.`,
      });

      await loadData();
    } catch (error: any) {
      console.error(error);
      toast({
        title: 'Errore',
        description: error?.message || 'Impossibile aggiornare la richiesta.',
        variant: 'destructive',
      });
    } finally {
      setSavingId(null);
    }
  }

  function statoBadge(stato: string) {
    if (stato === 'approvata') {
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Approvata</Badge>;
    }

    if (stato === 'rifiutata') {
      return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Rifiutata</Badge>;
    }

    return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Inviata</Badge>;
  }

  const riepilogo = useMemo(() => {
    const pending = richieste.filter((r) => r.stato === 'inviata').length;
    const approved = richieste.filter((r) => r.stato === 'approvata').length;
    const rejected = richieste.filter((r) => r.stato === 'rifiutata').length;

    return { pending, approved, rejected };
  }, [richieste]);

  return (
    <div className="mx-auto max-w-[1500px] p-6">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Richieste ferie/permessi</h1>
          <p className="text-sm text-muted-foreground">
            Riepilogo richieste e gestione approvazioni.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
            Inviate: {riepilogo.pending}
          </Badge>
          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
            Approvate: {riepilogo.approved}
          </Badge>
          <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
            Rifiutate: {riepilogo.rejected}
          </Badge>
          <Button variant="outline" onClick={() => router.push('/presenze')}>
            Torna a presenze
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">
          Caricamento richieste...
        </div>
      ) : richieste.length === 0 ? (
        <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">
          Nessuna richiesta trovata.
        </div>
      ) : (
        <div className="space-y-2">
          {richieste.map((richiesta) => {
            const isPending = richiesta.stato === 'inviata';

            return (
              <Card key={richiesta.id} className="shadow-sm">
                <CardContent className="p-3">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-[110px_230px_120px_120px_80px_80px_minmax(220px,1fr)_240px] md:items-start">
                    <div className="flex flex-col gap-2">
                      <div className="font-semibold">
                        {richiesta.tipo_richiesta === 'ferie' ? 'Ferie' : 'Permesso'}
                      </div>
                      {statoBadge(richiesta.stato)}
                    </div>

                    <div className="text-sm">
                      <div className="text-xs text-muted-foreground">Richiedente</div>
                      <div className="font-medium">{getRichiedenteName(richiesta)}</div>
                      <div className="text-xs text-muted-foreground">
                        {richiesta.richiedente_email || richiesta.email_richiedente || '-'}
                      </div>
                    </div>

                    <div className="text-sm">
                      <div className="text-xs text-muted-foreground">Data inizio</div>
                      <div className="font-medium">{formatDateIT(richiesta.data_inizio)}</div>
                    </div>

                    <div className="text-sm">
                      <div className="text-xs text-muted-foreground">Data fine</div>
                      <div className="font-medium">{formatDateIT(richiesta.data_fine)}</div>
                    </div>

                    <div className="text-sm">
                      <div className="text-xs text-muted-foreground">Giorni</div>
                      <div className="font-medium">{richiesta.giorni ?? '-'}</div>
                    </div>

                    <div className="text-sm">
                      <div className="text-xs text-muted-foreground">Ore</div>
                      <div className="font-medium">{richiesta.ore ?? '-'}</div>
                    </div>

                    <div className="text-sm">
                      <div className="text-xs text-muted-foreground">Motivazione</div>
                      <div className="min-h-[38px] rounded-md bg-slate-50 p-2">
                        {richiesta.motivazione || '-'}
                      </div>
                    </div>

                    <div className="space-y-2">
                      {isResponsabilePaghe ? (
                        <>
                          <div className="text-xs font-medium text-muted-foreground">
                            Note responsabile
                          </div>
                          <Textarea
                            value={note[richiesta.id] || ''}
                            onChange={(e) =>
                              setNote((prev) => ({
                                ...prev,
                                [richiesta.id]: e.target.value,
                              }))
                            }
                            disabled={!isPending}
                            rows={2}
                            className="min-h-[58px]"
                          />

                          {isPending ? (
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                disabled={savingId === richiesta.id}
                                onClick={() => gestisciRichiesta(richiesta.id, 'rifiutata')}
                              >
                                Rifiuta
                              </Button>

                              <Button
                                disabled={savingId === richiesta.id}
                                onClick={() => gestisciRichiesta(richiesta.id, 'approvata')}
                              >
                                Approva
                              </Button>
                            </div>
                          ) : (
                            <div className="text-right text-xs text-muted-foreground">
                              Richiesta già gestita
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="text-xs text-muted-foreground">
                          {richiesta.note_responsabile ? (
                            <>
                              <div className="font-medium">Note responsabile</div>
                              <div>{richiesta.note_responsabile}</div>
                            </>
                          ) : (
                            'In attesa di gestione'
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
