import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
};

export default function FeriePermessiPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [richieste, setRichieste] = useState<Richiesta[]>([]);
  const [note, setNote] = useState<Record<string, string>>({});
  const [isResponsabilePaghe, setIsResponsabilePaghe] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [studioId, setStudioId] = useState<string | null>(null);

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const email = session?.user?.email;

      if (!email) {
        router.push('/login');
        return;
      }

      const { data: userRow, error: userError } = await supabase
        .from('tbutenti')
        .select('id, studio_id, responsabile_paghe')
        .eq('email', email)
        .single();

      if (userError || !userRow) throw userError;

      setCurrentUserId(userRow.id);
      setStudioId(userRow.studio_id as string);
      setIsResponsabilePaghe(Boolean(userRow.responsabile_paghe));

      let query = (supabase as any)
  .from('tbferie_permessi_richieste')
  .select('*')
  .eq('studio_id', userRow.studio_id as string)
  .order('created_at', { ascending: false });

      if (!userRow.responsabile_paghe) {
        query = query.eq('utente_id', userRow.id);
      }

     const { data, error } = await (query as any);

      if (error) throw error;

      setRichieste(data || []);

      const initialNotes: Record<string, string> = {};
      (data || []).forEach((r: Richiesta) => {
        initialNotes[r.id] = r.note_responsabile || '';
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

      const response = await fetch(`/api/payroll/ferie-permessi/richieste/${id}/gestisci`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
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

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Richieste ferie/permessi</h1>
          <p className="text-sm text-muted-foreground">
            Riepilogo richieste e gestione approvazioni.
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push('/presenze')}>
            Torna a presenze
          </Button>

          <Button onClick={() => router.push('/presenze/richiesta-ferie-permessi')}>
            Nuova richiesta
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
        <div className="space-y-4">
          {richieste.map((richiesta) => {
            const isPending = richiesta.stato === 'inviata';

            return (
              <Card key={richiesta.id}>
                <CardHeader>
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <CardTitle className="text-base">
                      {richiesta.tipo_richiesta === 'ferie' ? 'Ferie' : 'Permesso'}
                    </CardTitle>
                    {statoBadge(richiesta.stato)}
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-4">
                    <div>
                      <div className="text-xs text-muted-foreground">Data inizio</div>
                      <div className="font-medium">{richiesta.data_inizio}</div>
                    </div>

                    <div>
                      <div className="text-xs text-muted-foreground">Data fine</div>
                      <div className="font-medium">{richiesta.data_fine || '-'}</div>
                    </div>

                    <div>
                      <div className="text-xs text-muted-foreground">Giorni</div>
                      <div className="font-medium">{richiesta.giorni ?? '-'}</div>
                    </div>

                    <div>
                      <div className="text-xs text-muted-foreground">Ore</div>
                      <div className="font-medium">{richiesta.ore ?? '-'}</div>
                    </div>
                  </div>

                  {richiesta.motivazione && (
                    <div className="rounded-md bg-slate-50 p-3 text-sm">
                      <div className="mb-1 text-xs font-medium text-muted-foreground">
                        Motivazione / note richiedente
                      </div>
                      {richiesta.motivazione}
                    </div>
                  )}

                  {isResponsabilePaghe && (
                    <div className="space-y-2">
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
                        rows={3}
                      />
                    </div>
                  )}

                  {isResponsabilePaghe && isPending && (
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
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
