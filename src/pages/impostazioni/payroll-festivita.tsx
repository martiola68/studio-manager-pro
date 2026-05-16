'use client';

import { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import { getSupabaseClient } from '@/lib/supabase/client';

type TipoFestivita = 'nazionale' | 'locale' | 'aziendale';

type Festivita = {
  id: string;
  data_festivita: string;
  descrizione: string;
  tipo: TipoFestivita;
  comune: string | null;
  provincia: string | null;
  codice_catastale: string | null;
  created_at?: string;
};

type FormState = {
  id: string | null;
  data_festivita: string;
  descrizione: string;
  tipo: TipoFestivita;
  comune: string;
  provincia: string;
  codice_catastale: string;
};

const emptyForm: FormState = {
  id: null,
  data_festivita: '',
  descrizione: '',
  tipo: 'nazionale',
  comune: '',
  provincia: '',
  codice_catastale: '',
};

const tipiFestivita: TipoFestivita[] = ['nazionale', 'locale', 'aziendale'];

function Button({
  children,
  className = '',
  variant,
  disabled,
  ...props
}: any) {
  return (
    <button
      className={`rounded-md border px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 ${
        variant === 'outline'
          ? 'bg-white hover:bg-gray-50'
          : variant === 'destructive'
            ? 'bg-red-600 text-white hover:bg-red-700'
            : 'bg-blue-600 text-white hover:bg-blue-700'
      } ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}

function Card({ children, className = '' }: any) {
  return <div className={`rounded-lg border bg-white shadow-sm ${className}`}>{children}</div>;
}

function CardHeader({ children, className = '' }: any) {
  return <div className={`p-6 ${className}`}>{children}</div>;
}

function CardTitle({ children, className = '' }: any) {
  return <h3 className={`font-semibold ${className}`}>{children}</h3>;
}

function CardContent({ children, className = '' }: any) {
  return <div className={`p-6 pt-0 ${className}`}>{children}</div>;
}

function formatDateIT(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString('it-IT');
}

export default function PayrollFestivitaPage() {
  const now = new Date();

  const [anno, setAnno] = useState(String(now.getFullYear()));
  const [items, setItems] = useState<Festivita[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const anniOptions = useMemo(() => {
    const current = now.getFullYear();

    return Array.from({ length: 9 }, (_, index) => String(current - 3 + index));
  }, []);

  async function loadData() {
    const supabase = getSupabaseClient();

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const startDate = `${anno}-01-01`;
      const endDate = `${anno}-12-31`;

      const { data, error: loadError } = await supabase
        .from('tbfestivita')
        .select(
          'id, data_festivita, descrizione, tipo, comune, provincia, codice_catastale, created_at',
        )
        .gte('data_festivita', startDate)
        .lte('data_festivita', endDate)
        .order('data_festivita', { ascending: true })
        .order('tipo', { ascending: true });

      if (loadError) throw loadError;

      setItems((data || []) as Festivita[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore durante il caricamento festività.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anno]);

  function resetForm() {
    setForm(emptyForm);
    setError(null);
    setSuccess(null);
  }

  function editItem(item: Festivita) {
    setForm({
      id: item.id,
      data_festivita: item.data_festivita,
      descrizione: item.descrizione || '',
      tipo: item.tipo,
      comune: item.comune || '',
      provincia: item.provincia || '',
      codice_catastale: item.codice_catastale || '',
    });

    setError(null);
    setSuccess(null);
  }

  async function saveItem(event: React.FormEvent) {
    event.preventDefault();

    const supabase = getSupabaseClient();

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      if (!form.data_festivita) {
        throw new Error('Inserisci la data festività.');
      }

      if (!form.descrizione.trim()) {
        throw new Error('Inserisci la descrizione.');
      }

      const payload = {
        data_festivita: form.data_festivita,
        descrizione: form.descrizione.trim(),
        tipo: form.tipo,
        comune: form.comune.trim() || null,
        provincia: form.provincia.trim() || null,
        codice_catastale: form.codice_catastale.trim() || null,
      };

      if (form.id) {
        const { error: updateError } = await supabase
          .from('tbfestivita')
          .update(payload)
          .eq('id', form.id);

        if (updateError) throw updateError;

        setSuccess('Festività aggiornata correttamente.');
      } else {
        const { error: insertError } = await supabase.from('tbfestivita').insert(payload);

        if (insertError) throw insertError;

        setSuccess('Festività inserita correttamente.');
      }

      resetForm();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore durante il salvataggio festività.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteItem(item: Festivita) {
    const confirmed = window.confirm(
      `Eliminare la festività "${item.descrizione}" del ${formatDateIT(item.data_festivita)}?`,
    );

    if (!confirmed) return;

    const supabase = getSupabaseClient();

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const { error: deleteError } = await supabase.from('tbfestivita').delete().eq('id', item.id);

      if (deleteError) throw deleteError;

      setSuccess('Festività eliminata correttamente.');

      if (form.id === item.id) {
        resetForm();
      }

      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore durante eliminazione festività.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Head>
        <title>Payroll Festività</title>
      </Head>

      <div className="mx-auto flex max-w-[1500px] flex-col gap-4 p-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Payroll Festività</h1>
            <p className="text-sm text-muted-foreground">
              Gestione festività nazionali, locali e aziendali usate nel modulo presenze.
            </p>
          </div>

          <Button variant="outline" onClick={() => window.history.back()}>
            Torna indietro
          </Button>
        </div>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
            {success}
          </div>
        )}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {form.id ? 'Modifica festività' : 'Nuova festività'}
            </CardTitle>
          </CardHeader>

          <CardContent>
            <form onSubmit={saveItem} className="grid gap-3 md:grid-cols-[160px_1fr_160px_180px_120px_160px_auto]">
              <div>
                <label className="mb-1 block text-xs font-medium">Data</label>
                <input
                  type="date"
                  className="h-10 w-full rounded-md border px-3 text-sm"
                  value={form.data_festivita}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, data_festivita: event.target.value }))
                  }
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium">Descrizione</label>
                <input
                  className="h-10 w-full rounded-md border px-3 text-sm"
                  value={form.descrizione}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, descrizione: event.target.value }))
                  }
                  placeholder="Es. Festa della Repubblica"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium">Tipo</label>
                <select
                  className="h-10 w-full rounded-md border px-3 text-sm"
                  value={form.tipo}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      tipo: event.target.value as TipoFestivita,
                    }))
                  }
                >
                  {tipiFestivita.map((tipo) => (
                    <option key={tipo} value={tipo}>
                      {tipo}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium">Comune</label>
                <input
                  className="h-10 w-full rounded-md border px-3 text-sm"
                  value={form.comune}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, comune: event.target.value }))
                  }
                  placeholder="Facoltativo"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium">Provincia</label>
                <input
                  className="h-10 w-full rounded-md border px-3 text-sm uppercase"
                  value={form.provincia}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, provincia: event.target.value.toUpperCase() }))
                  }
                  placeholder="RM"
                  maxLength={2}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium">Cod. catastale</label>
                <input
                  className="h-10 w-full rounded-md border px-3 text-sm uppercase"
                  value={form.codice_catastale}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      codice_catastale: event.target.value.toUpperCase(),
                    }))
                  }
                  placeholder="H501"
                />
              </div>

              <div className="flex items-end gap-2">
                <Button type="submit" disabled={saving}>
                  {saving ? 'Salvo...' : form.id ? 'Aggiorna' : 'Inserisci'}
                </Button>

                {form.id && (
                  <Button type="button" variant="outline" disabled={saving} onClick={resetForm}>
                    Annulla
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <CardTitle className="text-base">Elenco festività</CardTitle>

              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">Anno</label>
                <select
                  className="h-9 rounded-md border px-3 text-sm"
                  value={anno}
                  onChange={(event) => setAnno(event.target.value)}
                >
                  {anniOptions.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {loading ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Caricamento festività...
              </div>
            ) : items.length === 0 ? (
              <div className="rounded-md border bg-gray-50 px-4 py-6 text-center text-sm text-muted-foreground">
                Nessuna festività trovata per l’anno selezionato.
              </div>
            ) : (
              <div className="overflow-auto rounded-md border">
                <table className="w-full min-w-[1000px] text-sm">
                  <thead className="bg-gray-50 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left">Data</th>
                      <th className="px-3 py-2 text-left">Descrizione</th>
                      <th className="px-3 py-2 text-left">Tipo</th>
                      <th className="px-3 py-2 text-left">Comune</th>
                      <th className="px-3 py-2 text-left">Provincia</th>
                      <th className="px-3 py-2 text-left">Cod. catastale</th>
                      <th className="px-3 py-2 text-right">Azioni</th>
                    </tr>
                  </thead>

                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id} className="border-t">
                        <td className="px-3 py-2">{formatDateIT(item.data_festivita)}</td>
                        <td className="px-3 py-2 font-medium">{item.descrizione}</td>
                        <td className="px-3 py-2">{item.tipo}</td>
                        <td className="px-3 py-2">{item.comune || '-'}</td>
                        <td className="px-3 py-2">{item.provincia || '-'}</td>
                        <td className="px-3 py-2">{item.codice_catastale || '-'}</td>
                        <td className="px-3 py-2">
                          <div className="flex justify-end gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              className="px-3 py-1 text-xs"
                              disabled={saving}
                              onClick={() => editItem(item)}
                            >
                              Modifica
                            </Button>

                            <Button
                              type="button"
                              variant="destructive"
                              className="px-3 py-1 text-xs"
                              disabled={saving}
                              onClick={() => deleteItem(item)}
                            >
                              Elimina
                            </Button>
                          </div>
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
