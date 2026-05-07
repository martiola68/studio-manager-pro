'use client';

import { useEffect, useState } from 'react';
import Head from 'next/head';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

type Qualifica = {
  id: string;
  studio_id: string;
  codice: string;
  descrizione: string;
  attivo: boolean | null;
};

export default function PayrollQualifichePage() {
  const [studioId, setStudioId] = useState<string | null>(null);
  const [qualifiche, setQualifiche] = useState<Qualifica[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const [newCodice, setNewCodice] = useState('');
  const [newDescrizione, setNewDescrizione] = useState('');

  const loadData = async () => {
    setLoading(true);

    try {
      const supabase = getSupabaseClient() as any;

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const email = session?.user?.email;
      if (!email) throw new Error('Sessione non trovata.');

      const { data: user, error: userError } = await supabase
        .from('tbutenti')
        .select('studio_id, responsabile_paghe, tipo_utente')
        .eq('email', email)
        .single();

      if (userError) throw userError;

      const canManagePayroll =
        user?.responsabile_paghe === true || user?.tipo_utente === 'Admin';

      if (!canManagePayroll) {
        setQualifiche([]);
        return;
      }

      setStudioId(user.studio_id);

      const { data, error } = await supabase
        .from('tbpayroll_qualifiche')
        .select('id, studio_id, codice, descrizione, attivo')
        .eq('studio_id', user.studio_id)
        .order('codice', { ascending: true });

      if (error) throw error;

      setQualifiche(data ?? []);
    } catch (error) {
      console.error('Errore caricamento qualifiche:', error);
      alert('Errore caricamento qualifiche');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const updateField = (id: string, field: keyof Qualifica, value: string | boolean) => {
    setQualifiche((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              [field]: value,
            }
          : item,
      ),
    );
  };

  const createQualifica = async () => {
    if (!studioId) return;

    if (!newCodice.trim() || !newDescrizione.trim()) {
      alert('Inserisci codice e descrizione.');
      return;
    }

    try {
      const supabase = getSupabaseClient() as any;

      const { error } = await supabase.from('tbpayroll_qualifiche').insert({
        studio_id: studioId,
        codice: newCodice.trim(),
        descrizione: newDescrizione.trim(),
        attivo: true,
      });

      if (error) throw error;

      setNewCodice('');
      setNewDescrizione('');
      await loadData();
    } catch (error: any) {
      console.error('Errore creazione qualifica:', error);
      alert(error?.message || 'Errore creazione qualifica');
    }
  };

  const saveQualifica = async (qualifica: Qualifica) => {
    setSavingId(qualifica.id);

    try {
      const supabase = getSupabaseClient() as any;

      const { error } = await supabase
        .from('tbpayroll_qualifiche')
        .update({
          codice: qualifica.codice,
          descrizione: qualifica.descrizione,
          attivo: qualifica.attivo,
          updated_at: new Date().toISOString(),
        })
        .eq('id', qualifica.id);

      if (error) throw error;

      alert('Qualifica aggiornata.');
    } catch (error: any) {
      console.error('Errore salvataggio qualifica:', error);
      alert(error?.message || 'Errore salvataggio qualifica');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <>
      <Head>
        <title>Payroll - Qualifiche</title>
      </Head>

      <div className="mx-auto max-w-6xl p-4">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Qualifiche Payroll</h1>
            <p className="text-sm text-muted-foreground">
              Tabelle qualifiche dipendenti per anagrafica payroll.
            </p>
          </div>

          <Button variant="outline" onClick={loadData} disabled={loading}>
            Aggiorna
          </Button>
        </div>

        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-base">Nuova qualifica</CardTitle>
          </CardHeader>

          <CardContent>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[180px_1fr_auto]">
              <Input
                placeholder="Codice"
                value={newCodice}
                onChange={(e) => setNewCodice(e.target.value)}
              />

              <Input
                placeholder="Descrizione"
                value={newDescrizione}
                onChange={(e) => setNewDescrizione(e.target.value)}
              />

              <Button onClick={createQualifica}>Aggiungi</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Elenco qualifiche</CardTitle>
          </CardHeader>

          <CardContent>
            {loading ? (
              <div className="py-8 text-center text-sm text-muted-foreground">Caricamento...</div>
            ) : qualifiche.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Nessuna qualifica trovata oppure accesso non consentito.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="p-2 text-left">Codice</th>
                      <th className="p-2 text-left">Descrizione</th>
                      <th className="p-2 text-center">Attivo</th>
                      <th className="p-2 text-right">Azioni</th>
                    </tr>
                  </thead>

                  <tbody>
                    {qualifiche.map((qualifica) => (
                      <tr key={qualifica.id} className="border-t">
                        <td className="p-2">
                          <Input
                            value={qualifica.codice ?? ''}
                            onChange={(e) =>
                              updateField(qualifica.id, 'codice', e.target.value)
                            }
                          />
                        </td>

                        <td className="p-2">
                          <Input
                            value={qualifica.descrizione ?? ''}
                            onChange={(e) =>
                              updateField(qualifica.id, 'descrizione', e.target.value)
                            }
                          />
                        </td>

                        <td className="p-2 text-center">
                          <input
                            type="checkbox"
                            checked={Boolean(qualifica.attivo)}
                            onChange={(e) =>
                              updateField(qualifica.id, 'attivo', e.target.checked)
                            }
                            className="h-4 w-4"
                          />
                        </td>

                        <td className="p-2 text-right">
                          <Button
                            size="sm"
                            onClick={() => saveQualifica(qualifica)}
                            disabled={savingId === qualifica.id}
                          >
                            {savingId === qualifica.id ? 'Salvo...' : 'Salva'}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
