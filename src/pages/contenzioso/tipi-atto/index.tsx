import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";

type TipoAtto = {
  id: string;
  descrizione: string;
  giorni_scadenza: number;
  attivo: boolean;
};

export default function TipiAttoPage() {
  const [tipi, setTipi] = useState<TipoAtto[]>([]);
  const [loading, setLoading] = useState(false);
  const [errore, setErrore] = useState("");
  const [successo, setSuccesso] = useState("");

  const [form, setForm] = useState({
    descrizione: "",
    giorni_scadenza: 60,
  });

  const loadTipi = async () => {
    const supabase = getSupabaseClient();

    setLoading(true);
    setErrore("");

    const { data, error } = await (supabase as any)
      .from("tbcontenzioso_tipi_atto")
      .select("id, descrizione, giorni_scadenza, attivo")
      .order("descrizione", { ascending: true });

    if (error) {
      console.error(error);
      setErrore("Errore caricamento tipi atto.");
      setLoading(false);
      return;
    }

    setTipi((data || []) as TipoAtto[]);
    setLoading(false);
  };

  useEffect(() => {
    loadTipi();
  }, []);

  const handleSave = async () => {
    setErrore("");
    setSuccesso("");

    if (!form.descrizione.trim()) {
      setErrore("Inserisci la descrizione del tipo atto.");
      return;
    }

    if (!form.giorni_scadenza || form.giorni_scadenza <= 0) {
      setErrore("Inserisci giorni scadenza validi.");
      return;
    }

    const supabase = getSupabaseClient();

    const { error } = await (supabase as any)
      .from("tbcontenzioso_tipi_atto")
      .insert({
        descrizione: form.descrizione.trim(),
        giorni_scadenza: form.giorni_scadenza,
        attivo: true,
      });

    if (error) {
      console.error(error);
      setErrore("Errore salvataggio tipo atto. Verifica che non esista già.");
      return;
    }

    setForm({
      descrizione: "",
      giorni_scadenza: 60,
    });

    setSuccesso("Tipo atto salvato correttamente.");
    loadTipi();
  };

  const toggleAttivo = async (tipo: TipoAtto) => {
    const supabase = getSupabaseClient();

    const { error } = await (supabase as any)
      .from("tbcontenzioso_tipi_atto")
      .update({ attivo: !tipo.attivo })
      .eq("id", tipo.id);

    if (error) {
      console.error(error);
      setErrore("Errore aggiornamento stato.");
      return;
    }

    loadTipi();
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-6xl rounded-2xl bg-white p-6 shadow">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Tipi atto</h1>
          <p className="text-sm text-gray-500">
            Archivio tipologie atto e giorni di scadenza
          </p>
        </div>

        {errore && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {errore}
          </div>
        )}

        {successo && (
          <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
            {successo}
          </div>
        )}

        <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium">
              Tipo atto
            </label>
            <input
              placeholder="Es. Avviso bonario"
              value={form.descrizione}
              onChange={(e) =>
                setForm({ ...form, descrizione: e.target.value })
              }
              className="w-full rounded-lg border p-2"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Giorni scadenza
            </label>
            <input
              type="number"
              value={form.giorni_scadenza}
              onChange={(e) =>
                setForm({
                  ...form,
                  giorni_scadenza: Number(e.target.value),
                })
              }
              className="w-full rounded-lg border p-2"
            />
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={handleSave}
              className="w-full rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              Salva tipo atto
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border">
          <table className="w-full">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-3 text-left text-sm font-semibold">
                  Tipo atto
                </th>
                <th className="p-3 text-left text-sm font-semibold">
                  Giorni scadenza
                </th>
                <th className="p-3 text-left text-sm font-semibold">Stato</th>
                <th className="p-3 text-right text-sm font-semibold">
                  Azioni
                </th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="p-4 text-center text-gray-500">
                    Caricamento...
                  </td>
                </tr>
              ) : tipi.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-4 text-center text-gray-500">
                    Nessun tipo atto presente
                  </td>
                </tr>
              ) : (
                tipi.map((tipo) => (
                  <tr key={tipo.id} className="border-t">
                    <td className="p-3">{tipo.descrizione}</td>
                    <td className="p-3">{tipo.giorni_scadenza} giorni</td>
                    <td className="p-3">
                      {tipo.attivo ? (
                        <span className="rounded-full bg-green-100 px-3 py-1 text-xs text-green-700">
                          Attivo
                        </span>
                      ) : (
                        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600">
                          Disattivo
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <button
                        type="button"
                        onClick={() => toggleAttivo(tipo)}
                        className="rounded-lg border px-3 py-1 text-sm hover:bg-gray-100"
                      >
                        {tipo.attivo ? "Disattiva" : "Attiva"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
