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
  matricola_paghe: string | null;
  nome: string | null;
  cognome: string | null;
  email: string | null;
  codice_fiscale: string | null;
  orario_giornaliero: number | null;
  ore_settimanali: number | null;
  giorni_lavorativi_settimana: number | null;
  percentuale_part_time: number | null;
  qualifica: string | null;
  qualifica_id: string | null;
  livello: string | null;
  tipo_contratto: string | null;
  sede_lavoro: string | null;
  centro_costo: string | null;
  codice_soggetto_paghe: string | null;
  numero_rapporto_paghe: string | null;
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
        .select('studio_id, responsabile_paghe')
        .eq('email', email)
        .single();

      if (userError) throw userError;

      if (!user?.responsabile_paghe) {
        setDipendenti([]);
        return;
      }

    const [{ data, error }, { data: qualificheData, error: qualificheError }] =
  await Promise.all([
    supabase
      .from('tbdipendenti')
      .select('*')
      .eq('studio_id', user.studio_id)
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
          matricola_paghe: dipendente.matricola_paghe,
          codice_fiscale: dipendente.codice_fiscale,
          orario_giornaliero: dipendente.orario_giornaliero,
          ore_settimanali: dipendente.ore_settimanali,
          giorni_lavorativi_settimana: dipendente.giorni_lavorativi_settimana,
          percentuale_part_time: dipendente.percentuale_part_time,
          qualifica: dipendente.qualifica,
          qualifica_id: dipendente.qualifica_id,
          livello: dipendente.livello,
          tipo_contratto: dipendente.tipo_contratto,
          sede_lavoro: dipendente.sede_lavoro,
          centro_costo: dipendente.centro_costo,
          attivo: dipendente.attivo,
          codice_soggetto_paghe: dipendente.codice_soggetto_paghe,
          numero_rapporto_paghe: dipendente.numero_rapporto_paghe,
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
                      <th className="p-2 text-left">Matricola</th>
                      <th className="p-2 text-left">Cod. fiscale</th>
                      <th className="p-2 text-left">Ore giorno</th>
                      <th className="p-2 text-left">Ore sett.</th>
                      <th className="p-2 text-left">Giorni sett.</th>
                      <th className="p-2 text-left">% PT</th>
                      <th className="p-2 text-left">Qualifica</th>
                      <th className="p-2 text-left">Livello</th>
                      <th className="p-2 text-left">Contratto</th>
                      <th className="p-2 text-left">Centro costo</th>
                      <th className="p-2 text-left">Cod. sogg. paghe</th>
                      <th className="p-2 text-left">Num. rapp.</th>
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
                          <Input value={dip.matricola_paghe ?? ''} onChange={(e) => updateField(dip.id, 'matricola_paghe', e.target.value)} />
                        </td>

                        <td className="p-2">
                          <Input value={dip.codice_fiscale ?? ''} onChange={(e) => updateField(dip.id, 'codice_fiscale', e.target.value)} />
                        </td>

                        <td className="p-2">
                          <Input type="number" step="0.25" value={dip.orario_giornaliero ?? 8} onChange={(e) => updateField(dip.id, 'orario_giornaliero', Number(e.target.value))} />
                        </td>

                        <td className="p-2">
                          <Input type="number" step="0.25" value={dip.ore_settimanali ?? ''} onChange={(e) => updateField(dip.id, 'ore_settimanali', e.target.value ? Number(e.target.value) : null)} />
                        </td>

                        <td className="p-2">
                          <Input type="number" value={dip.giorni_lavorativi_settimana ?? 5} onChange={(e) => updateField(dip.id, 'giorni_lavorativi_settimana', Number(e.target.value))} />
                        </td>

                        <td className="p-2">
                          <Input type="number" step="0.01" value={dip.percentuale_part_time ?? 100} onChange={(e) => updateField(dip.id, 'percentuale_part_time', Number(e.target.value))} />
                        </td>

                       <td className="p-2">
  <select
    value={dip.qualifica_id ?? ''}
    onChange={(e) => updateField(dip.id, 'qualifica_id', e.target.value || null)}
    className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
  >
    <option value="">-</option>
    {qualifiche.map((qualifica) => (
      <option key={qualifica.id} value={qualifica.id}>
        {qualifica.codice} - {qualifica.descrizione}
      </option>
    ))}
  </select>
</td>

                        <td className="p-2">
                          <Input value={dip.livello ?? ''} onChange={(e) => updateField(dip.id, 'livello', e.target.value)} />
                        </td>

                        <td className="p-2">
                          <Input value={dip.tipo_contratto ?? ''} onChange={(e) => updateField(dip.id, 'tipo_contratto', e.target.value)} />
                        </td>

                        <td className="p-2">
                          <Input value={dip.centro_costo ?? ''} onChange={(e) => updateField(dip.id, 'centro_costo', e.target.value)} />
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
