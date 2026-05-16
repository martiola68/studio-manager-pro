'use client';

import { useEffect, useState } from 'react';
import Head from 'next/head';
import { getSupabaseClient } from '@/lib/supabase/client';

type TipoCodice = 'presenza' | 'assenza' | 'permesso' | 'festivo';

type CodicePresenza = {
  codice: string;
  descrizione: string;
  tipo: TipoCodice;
  ordine: number;
  attivo: boolean;
  created_at?: string;
};

type FormState = {
  originalCodice: string | null;
  codice: string;
  descrizione: string;
  tipo: TipoCodice;
  ordine: string;
  attivo: boolean;
};

const emptyForm: FormState = {
  originalCodice: null,
  codice: '',
  descrizione: '',
  tipo: 'presenza',
  ordine: '0',
  attivo: true,
};

const tipiCodice: TipoCodice[] = ['presenza', 'assenza', 'permesso', 'festivo'];

function Button({ children, className = '', variant, disabled, ...props }: any) {
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

function getTipoBadgeClass(tipo: TipoCodice) {
  if (tipo === 'presenza') return 'bg-green-100 text-green-800 border-green-200';
  if (tipo === 'assenza') return 'bg-red-100 text-red-800 border-red-200';
  if (tipo === 'permesso') return 'bg-orange-100 text-orange-800 border-orange-200';
  return 'bg-gray-100 text-gray-700 border-gray-200';
}

export default function PayrollCodiciPresenzaPage() {
  const [items, setItems] = useState<CodicePresenza[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [filtroTipo, setFiltroTipo] = useState<'tutti' | TipoCodice>('tutti');
  const [filtroAttivo, setFiltroAttivo] = useState<'tutti' | 'attivi' | 'disattivi'>('tutti');

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function loadData() {
    const supabase = getSupabaseClient() as any;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const { data, error: loadError } = await supabase
        .from('tbpresenze_codici')
        .select('codice, descrizione, tipo, ordine, attivo, created_at')
        .order('ordine', { ascending: true })
        .order('codice', { ascending: true });

      if (loadError) throw loadError;

      setItems((data || []) as CodicePresenza[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore durante il caricamento codici.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  function resetForm() {
    setForm(emptyForm);
    setError(null);
    setSuccess(null);
  }

  function editItem(item: CodicePresenza) {
    setForm({
      originalCodice: item.codice,
      codice: item.codice,
      descrizione: item.descrizione || '',
      tipo: item.tipo,
      ordine: String(item.ordine ?? 0),
      attivo: Boolean(item.attivo),
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
      const codice = form.codice.trim();

      if (!codice) {
        throw new Error('Inserisci il codice presenza.');
      }

      if (!form.descrizione.trim()) {
        throw new Error('Inserisci la descrizione.');
      }

      const ordineNumber = Number(form.ordine);

      if (!Number.isFinite(ordineNumber)) {
        throw new Error('Ordine non valido.');
      }

      const payload = {
        codice,
        descrizione: form.descrizione.trim(),
        tipo: form.tipo,
        ordine: ordineNumber,
        attivo: form.attivo,
      };

      if (form.originalCodice) {
        const { error: updateError } = await supabase
          .from('tbpresenze_codici')
          .update(payload)
          .eq('codice', form.originalCodice);

        if (updateError) throw updateError;

        setSuccess('Codice presenza aggiornato correttamente.');
      } else {
        const { error: insertError } = await supabase.from('tbpresenze_codici').insert(payload);

        if (insertError) throw insertError;

        setSuccess('Codice presenza inserito correttamente.');
      }

      resetForm();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore durante il salvataggio codice.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteItem(item: CodicePresenza) {
    const confirmed = window.confirm(
      `Eliminare il codice "${item.codice} - ${item.descrizione}"?`,
    );

    if (!confirmed) return;

    const supabase = getSupabaseClient();

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const { error: deleteError } = await supabase
        .from('tbpresenze_codici')
        .delete()
        .eq('codice', item.codice);

      if (deleteError) throw deleteError;

      setSuccess('Codice presenza eliminato correttamente.');

      if (form.originalCodice === item.codice) {
        resetForm();
      }

      await loadData();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Errore durante eliminazione codice presenza.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleAttivo(item: CodicePresenza) {
    const supabase = getSupabaseClient();

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const { error: updateError } = await supabase
        .from('tbpresenze_codici')
        .update({ attivo: !item.attivo })
        .eq('codice', item.codice);

      if (updateError) throw updateError;

      setSuccess(item.attivo ? 'Codice disattivato.' : 'Codice riattivato.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore durante aggiornamento stato codice.');
    } finally {
      setSaving(false);
    }
  }

  const filteredItems = items.filter((item) => {
    const matchTipo = filtroTipo === 'tutti' || item.tipo === filtroTipo;

    const matchAttivo =
      filtroAttivo === 'tutti' ||
      (filtroAttivo === 'attivi' && item.attivo) ||
      (filtroAttivo === 'disattivi' && !item.attivo);

    return matchTipo && matchAttivo;
  });

  return (
    <>
      <Head>
        <title>Payroll Codici Presenza</title>
      </Head>

      <div className="mx-auto flex max-w-[1300px] flex-col gap-4 p-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Payroll Codici Presenza</h1>
            <p className="text-sm text-muted-foreground">
              Gestione dei codici usati nelle presenze dipendenti.
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
              {form.originalCodice ? 'Modifica codice presenza' : 'Nuovo codice presenza'}
            </CardTitle>
          </CardHeader>

          <CardContent>
            <form
              onSubmit={saveItem}
              className="grid gap-3 md:grid-cols-[140px_1fr_160px_120px_120px_auto]"
            >
              <div>
                <label className="mb-1 block text-xs font-medium">Codice</label>
                <input
                  className="h-10 w-full rounded-md border px-3 text-sm"
                  value={form.codice}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      codice: event.target.value,
                    }))
                  }
                  placeholder="Es. Pp"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium">Descrizione</label>
                <input
                  className="h-10 w-full rounded-md border px-3 text-sm"
                  value={form.descrizione}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      descrizione: event.target.value,
                    }))
                  }
                  placeholder="Es. Presenza ufficio"
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
                      tipo: event.target.value as TipoCodice,
                    }))
                  }
                >
                  {tipiCodice.map((tipo) => (
                    <option key={tipo} value={tipo}>
                      {tipo}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium">Ordine</label>
                <input
                  type="number"
                  className="h-10 w-full rounded-md border px-3 text-sm"
                  value={form.ordine}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      ordine: event.target.value,
                    }))
                  }
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium">Attivo</label>
                <select
                  className="h-10 w-full rounded-md border px-3 text-sm"
                  value={form.attivo ? 'true' : 'false'}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      attivo: event.target.value === 'true',
                    }))
                  }
                >
                  <option value="true">Sì</option>
                  <option value="false">No</option>
                </select>
              </div>

              <div className="flex items-end gap-2">
                <Button type="submit" disabled={saving}>
                  {saving ? 'Salvo...' : form.originalCodice ? 'Aggiorna' : 'Inserisci'}
                </Button>

                {form.originalCodice && (
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
              <CardTitle className="text-base">Elenco codici presenza</CardTitle>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  className="h-9 rounded-md border px-3 text-sm"
                  value={filtroTipo}
                  onChange={(event) =>
                    setFiltroTipo(event.target.value as 'tutti' | TipoCodice)
                  }
                >
                  <option value="tutti">Tutti i tipi</option>
                  {tipiCodice.map((tipo) => (
                    <option key={tipo} value={tipo}>
                      {tipo}
                    </option>
                  ))}
                </select>

                <select
                  className="h-9 rounded-md border px-3 text-sm"
                  value={filtroAttivo}
                  onChange={(event) =>
                    setFiltroAttivo(event.target.value as 'tutti' | 'attivi' | 'disattivi')
                  }
                >
                  <option value="tutti">Tutti</option>
                  <option value="attivi">Solo attivi</option>
                  <option value="disattivi">Solo disattivi</option>
                </select>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {loading ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Caricamento codici...
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="rounded-md border bg-gray-50 px-4 py-6 text-center text-sm text-muted-foreground">
                Nessun codice trovato.
              </div>
            ) : (
              <div className="overflow-auto rounded-md border">
                <table className="w-full min-w-[900px] text-sm">
                  <thead className="bg-gray-50 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left">Ordine</th>
                      <th className="px-3 py-2 text-left">Codice</th>
                      <th className="px-3 py-2 text-left">Descrizione</th>
                      <th className="px-3 py-2 text-left">Tipo</th>
                      <th className="px-3 py-2 text-left">Attivo</th>
                      <th className="px-3 py-2 text-right">Azioni</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredItems.map((item) => (
                      <tr key={item.codice} className="border-t">
                        <td className="px-3 py-2">{item.ordine}</td>
                        <td className="px-3 py-2 font-semibold">{item.codice}</td>
                        <td className="px-3 py-2">{item.descrizione}</td>
                        <td className="px-3 py-2">
                          <span
                            className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${getTipoBadgeClass(
                              item.tipo,
                            )}`}
                          >
                            {item.tipo}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          {item.attivo ? (
                            <span className="text-green-700">Sì</span>
                          ) : (
                            <span className="text-red-700">No</span>
                          )}
                        </td>
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
                              variant="outline"
                              className="px-3 py-1 text-xs"
                              disabled={saving}
                              onClick={() => toggleAttivo(item)}
                            >
                              {item.attivo ? 'Disattiva' : 'Attiva'}
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
