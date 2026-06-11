'use client';

import { useEffect, useState } from 'react';
import Head from 'next/head';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

type Dipendente = {
  id: string;
  studio_id: string;
  utente_id: string;

  codice_ditta: string | null;
  codice_dipendente: string | null;

  codice_soggetto_paghe: string | null;
  numero_rapporto_paghe: string | null;

  nome: string | null;
  cognome: string | null;
  email: string | null;

  orario_giornaliero: number | null;

data_cessazione: string | null;
tipo_rapporto: string | null;

attivo: boolean | null;
};

type Qualifica = {
  id: string;
  codice: string;
  descrizione: string;
  attivo: boolean | null;
};

export default function DipendentiPayrollPage() {
const [dipendenti, setDipendenti] = useState<Dipendente[]>([]);
const [qualifiche, setQualifiche] = useState<Qualifica[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

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
        .select(`
  studio_id,
  responsabile_paghe,
  responsabile_ferie_permessi,
  tipo_rapporto
`)
        .eq('email', email)
        .single();

      if (userError) throw userError;

    const puoAccedere =
  user?.tipo_rapporto === "Dipendente" ||
  user?.responsabile_paghe === true ||
  user?.responsabile_ferie_permessi === true;

if (!puoAccedere) {
  alert(
    "Accesso consentito solo ai dipendenti o ai responsabili autorizzati."
  );

  setDipendenti([]);
  return;
}

const oggi = new Date();

const primoGiornoMese = new Date(
  oggi.getFullYear(),
  oggi.getMonth(),
  1
)
  .toISOString()
  .slice(0, 10);

const [{ data, error }, { data: qualificheData, error: qualificheError }] =
  await Promise.all([
    supabase
      .from('tbdipendenti')
      .select('*')
      .eq('studio_id', user.studio_id)
      .eq('tipo_rapporto', 'Dipendente')
      .or(`data_cessazione.is.null,data_cessazione.gte.${primoGiornoMese}`)
      .order('cognome', { ascending: true })
      .order('nome', { ascending: true }),

    supabase
      .from('tbpayroll_qualifiche')
      .select('id, codice, descrizione, attivo')
      .eq('studio_id', user.studio_id)
      .eq('attivo', true)
      .order('codice', { ascending: true }),
  ]);
  .from('tbdipendenti')
  .select('*')
  .eq('studio_id', user.studio_id)
  .eq('tipo_rapporto', 'Dipendente')
  .or(`data_cessazione.is.null,data_cessazione.gte.${primoGiornoMese}`)
  .order('cognome', { ascending: true })
  .order('nome', { ascending: true }),
    supabase
      .from('tbpayroll_qualifiche')
      .select('id, codice, descrizione, attivo')
      .eq('studio_id', user.studio_id)
      .eq('attivo', true)
      .order('codice', { ascending: true }),
  ]);

if (error) throw error;
if (qualificheError) throw qualificheError;

setDipendenti(data ?? []);
setQualifiche(qualificheData ?? []);
    } catch (error) {
      console.error('Errore caricamento dipendenti payroll:', error);
      alert('Errore caricamento dipendenti payroll');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const updateField = (id: string, field: keyof Dipendente, value: string | number | boolean | null) => {
    setDipendenti((prev) =>
      prev.map((dip) =>
        dip.id === id
          ? {
              ...dip,
              [field]: value,
            }
          : dip,
      ),
    );
  };

  const saveDipendente = async (dipendente: Dipendente) => {
    setSavingId(dipendente.id);

    try {
      const supabase = getSupabaseClient() as any;

      const { error } = await supabase
        .from('tbdipendenti')
        .update({
         codice_ditta: dipendente.codice_ditta,
          codice_dipendente: dipendente.codice_dipendente,
          codice_soggetto_paghe: dipendente.codice_soggetto_paghe,
            numero_rapporto_paghe: dipendente.numero_rapporto_paghe,
          data_cessazione: dipendente.data_cessazione || null,
            orario_giornaliero: dipendente.orario_giornaliero,
              attivo: dipendente.attivo,
                  updated_at: new Date().toISOString(),
                    })
                  .eq('id', dipendente.id);

      if (error) throw error;

      alert('Dipendente aggiornato.');
    } catch (error) {
      console.error('Errore salvataggio dipendente:', error);
      alert('Errore salvataggio dipendente');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <>
      <Head>
        <title>Payroll - Dipendenti</title>
      </Head>

      <div className="mx-auto max-w-[1800px] p-4">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Dipendenti Payroll</h1>
            <p className="text-sm text-muted-foreground">
              Anagrafica dipendenti per export presenze e software paghe.
            </p>
          </div>

          <Button variant="outline" onClick={loadData} disabled={loading}>
            Aggiorna
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Anagrafica payroll</CardTitle>
          </CardHeader>

          <CardContent>
            {loading ? (
              <div className="py-8 text-center text-sm text-muted-foreground">Caricamento...</div>
            ) : dipendenti.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Nessun dipendente trovato oppure accesso non consentito.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <table className="min-w-[1600px] w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="p-2 text-left">Dipendente</th>
                      <th className="p-2 text-left">Email</th>
                     <th className="p-2 text-left">Cod. ditta</th>
                      <th className="p-2 text-left">Cod. dip.</th>
                        <th className="p-2 text-left">Cod. sogg. paghe</th>
                        <th className="p-2 text-left">Num. rapp.</th>
                        
                      <th className="p-2 text-left">Ore giorno</th>

                      <th className="p-2 text-left">Data cessazione</th>
                      <th className="p-2 text-center">Attivo</th>
                      <th className="p-2 text-right">Azioni</th>
                    </tr>
                  </thead>

                  <tbody>
                    {dipendenti.map((dip) => (
                      <tr key={dip.id} className="border-t">
                        <td className="p-2 font-medium">
                          {dip.cognome} {dip.nome}
                        </td>
                        <td className="p-2">{dip.email}</td>

                     <td className="p-2">
  <Input
    value={dip.codice_ditta ?? ''}
    onChange={(e) =>
      updateField(dip.id, 'codice_ditta', e.target.value)
    }
  />
</td>

<td className="p-2">
  <Input
    value={dip.codice_dipendente ?? ''}
    onChange={(e) =>
      updateField(dip.id, 'codice_dipendente', e.target.value)
    }
  />
</td>

                        <td className="p-2">
  <Input
    maxLength={8}
    value={dip.codice_soggetto_paghe ?? ''}
    onChange={(e) =>
      updateField(dip.id, 'codice_soggetto_paghe', e.target.value)
    }
  />
</td>

<td className="p-2">
  <Input
    maxLength={3}
    value={dip.numero_rapporto_paghe ?? ''}
    onChange={(e) =>
      updateField(dip.id, 'numero_rapporto_paghe', e.target.value)
    }
  />
</td>

                      
                        <td className="p-2">
                          <Input type="number" step="0.25" value={dip.orario_giornaliero ?? 8} onChange={(e) => updateField(dip.id, 'orario_giornaliero', Number(e.target.value))} />
                        </td>

                        <td className="p-2">
                        <Input
                        type="date"
                        value={dip.data_cessazione ?? ''}
                          onChange={(e) =>
                            updateField(dip.id, 'data_cessazione', e.target.value || null)
                          }
                          />
                        </td>

                        <td className="p-2 text-center">
                        <input
                          type="checkbox"
                          checked={Boolean(dip.attivo)}
                            onChange={(e) => updateField(dip.id, 'attivo', e.target.checked)}
                          className="h-4 w-4"
                        />
                        </td>

                        <td className="p-2 text-right">
                          <Button size="sm" onClick={() => saveDipendente(dip)} disabled={savingId === dip.id}>
                            {savingId === dip.id ? 'Salvo...' : 'Salva'}
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
