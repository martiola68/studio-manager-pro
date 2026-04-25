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

  const [form, setForm] = useState({
    descrizione: "",
    giorni_scadenza: 60,
  });

  const loadTipi = async () => {
    const supabase = getSupabaseClient();

    setLoading(true);

  const { data, error } = await (supabase as any)
  .from("tbcontenzioso_tipi_atto")
  .select("*")
  .order("descrizione");

    if (error) {
      setErrore("Errore caricamento tipi atto");
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

    if (!form.descrizione.trim()) {
      setErrore("Inserisci descrizione");
      return;
    }

    const supabase = getSupabaseClient();

   const { error } = await (supabase as any)
  .from("tbcontenzioso_tipi_atto")
  .insert({
        descrizione: form.descrizione.trim(),
        giorni_scadenza: form.giorni_scadenza,
      });

    if (error) {
      setErrore("Errore salvataggio");
      return;
    }

    setForm({ descrizione: "", giorni_scadenza: 60 });
    loadTipi();
  };

  const handleDelete = async (id: string) => {
    const supabase = getSupabaseClient();

   await (supabase as any)
  .from("tbcontenzioso_tipi_atto")
  .delete()
      .eq("id", id);

    loadTipi();
  };

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">Tipi Atto</h1>

      {errore && (
        <div className="mb-4 text-red-600 text-sm">{errore}</div>
      )}

      {/* FORM INSERIMENTO */}
      <div className="mb-6 flex gap-2">
        <input
          placeholder="Descrizione (es. Avviso bonario)"
          value={form.descrizione}
          onChange={(e) =>
            setForm({ ...form, descrizione: e.target.value })
          }
          className="border p-2 rounded w-64"
        />

        <input
          type="number"
          placeholder="Giorni"
          value={form.giorni_scadenza}
          onChange={(e) =>
            setForm({
              ...form,
              giorni_scadenza: Number(e.target.value),
            })
          }
          className="border p-2 rounded w-32"
        />

        <button
          onClick={handleSave}
          className="bg-blue-600 text-white px-4 rounded"
        >
          Salva
        </button>
      </div>

      {/* TABELLA */}
      <table className="w-full border">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-2 text-left">Descrizione</th>
            <th className="p-2 text-left">Giorni</th>
            <th className="p-2">Azioni</th>
          </tr>
        </thead>

        <tbody>
          {tipi.map((t) => (
            <tr key={t.id} className="border-t">
              <td className="p-2">{t.descrizione}</td>
              <td className="p-2">{t.giorni_scadenza}</td>
              <td className="p-2 text-center">
                <button
                  onClick={() => handleDelete(t.id)}
                  className="text-red-600 text-sm"
                >
                  Elimina
                </button>
              </td>
            </tr>
          ))}

          {tipi.length === 0 && (
            <tr>
              <td colSpan={3} className="p-4 text-center text-gray-500">
                Nessun tipo atto
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
