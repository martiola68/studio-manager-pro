import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { getSupabaseClient } from "@/lib/supabaseClient";

type Sospensione = {
  id: string;
  descrizione: string;
  data_inizio: string;
  data_fine: string;
  attivo: boolean;
  ordine: number;
};

const initialForm = {
  descrizione: "",
  data_inizio: "",
  data_fine: "",
  attivo: true,
  ordine: "0",
};

export default function SospensioniTerminiPage() {
  const router = useRouter();

  const [sospensioni, setSospensioni] = useState<Sospensione[]>([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [errore, setErrore] = useState("");
  const [successo, setSuccesso] = useState("");

  useEffect(() => {
    loadSospensioni();
  }, []);

  const loadSospensioni = async () => {
    const supabase = getSupabaseClient();

    setLoading(true);

    const { data, error } = await (supabase as any)
      .from("tbcontenzioso_sospensioni")
      .select("*")
      .order("data_inizio", { ascending: true });

    if (error) {
      console.error(error);
      setErrore("Errore durante il caricamento delle sospensioni.");
      setLoading(false);
      return;
    }

    setSospensioni((data || []) as Sospensione[]);
    setLoading(false);
  };

  const resetForm = () => {
    setForm(initialForm);
    setEditingId(null);
  };

  const handleEdit = (s: Sospensione) => {
    setEditingId(s.id);
    setForm({
      descrizione: s.descrizione || "",
      data_inizio: s.data_inizio || "",
      data_fine: s.data_fine || "",
      attivo: s.attivo,
      ordine: String(s.ordine ?? 0),
    });
  };

  const handleSave = async () => {
    const supabase = getSupabaseClient();

    setErrore("");
    setSuccesso("");

    if (!form.descrizione.trim()) {
      setErrore("Inserisci la descrizione.");
      return;
    }

    if (!form.data_inizio || !form.data_fine) {
      setErrore("Inserisci data inizio e data fine.");
      return;
    }

    if (form.data_fine < form.data_inizio) {
      setErrore("La data fine non può essere precedente alla data inizio.");
      return;
    }

    setSaving(true);

    const payload = {
      descrizione: form.descrizione.trim(),
      data_inizio: form.data_inizio,
      data_fine: form.data_fine,
      attivo: form.attivo,
      ordine: Number(form.ordine) || 0,
    };

    let error = null;

    if (editingId) {
      const res = await (supabase as any)
        .from("tbcontenzioso_sospensioni")
        .update(payload)
        .eq("id", editingId);

      error = res.error;
    } else {
      const res = await (supabase as any)
        .from("tbcontenzioso_sospensioni")
        .insert(payload);

      error = res.error;
    }

    setSaving(false);

    if (error) {
      console.error(error);
      setErrore("Errore durante il salvataggio della sospensione.");
      return;
    }

    setSuccesso("Sospensione salvata correttamente.");
    resetForm();
    await loadSospensioni();
  };

  const handleDelete = async (id: string) => {
    const conferma = confirm("Vuoi eliminare questa sospensione?");
    if (!conferma) return;

    const supabase = getSupabaseClient();

    const { error } = await (supabase as any)
      .from("tbcontenzioso_sospensioni")
      .delete()
      .eq("id", id);

    if (error) {
      console.error(error);
      setErrore("Errore durante l'eliminazione della sospensione.");
      return;
    }

    setSuccesso("Sospensione eliminata correttamente.");
    await loadSospensioni();
  };

  if (loading) {
    return <div className="p-6">Caricamento sospensioni...</div>;
  }

  const formatDateIT = (date?: string | null) => {
  if (!date) return "-";
  const [yyyy, mm, dd] = date.split("-");
  return `${dd}/${mm}/${yyyy}`;
};

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-7xl rounded-2xl bg-white p-6 shadow">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Sospensioni termini
            </h1>
            <p className="text-sm text-gray-500">
              Gestione dei periodi che interrompono il conteggio delle scadenze
            </p>
          </div>

          <button
            type="button"
            onClick={() => router.push("/contenzioso/regole-scadenze")}
            className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-100"
          >
            Indietro
          </button>
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

        <div className="mb-8 rounded-xl border p-4">
          <h2 className="mb-4 text-lg font-semibold">
            {editingId ? "Modifica sospensione" : "Nuova sospensione"}
          </h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium">
                Descrizione
              </label>
              <input
                value={form.descrizione}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    descrizione: e.target.value,
                  }))
                }
                className="w-full rounded-lg border p-2"
                placeholder="Es. Sospensione feriale termini"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Data inizio
              </label>
              <input
                type="date"
                value={form.data_inizio}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    data_inizio: e.target.value,
                  }))
                }
                className="w-full rounded-lg border p-2"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Data fine
              </label>
              <input
                type="date"
                value={form.data_fine}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    data_fine: e.target.value,
                  }))
                }
                className="w-full rounded-lg border p-2"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Attivo
              </label>
              <select
                value={form.attivo ? "Si" : "No"}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    attivo: e.target.value === "Si",
                  }))
                }
                className="w-full rounded-lg border p-2"
              >
                <option value="Si">Sì</option>
                <option value="No">No</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Ordine
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={form.ordine}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    ordine: e.target.value.replace(/\D/g, ""),
                  }))
                }
                className="w-full rounded-lg border p-2"
              />
            </div>

            <div className="flex items-end gap-2 md:col-span-4">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded-lg bg-blue-600 px-5 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving
                  ? "Salvataggio..."
                  : editingId
                  ? "Salva modifica"
                  : "Salva sospensione"}
              </button>

              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-lg border px-5 py-2 hover:bg-gray-100"
                >
                  Annulla modifica
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-left">
              <tr>
                <th className="p-3">Descrizione</th>
                <th className="p-3">Data inizio</th>
                <th className="p-3">Data fine</th>
                <th className="p-3">Attivo</th>
                <th className="p-3">Ordine</th>
                <th className="p-3 text-right">Azioni</th>
              </tr>
            </thead>

            <tbody>
              {sospensioni.map((s) => (
                <tr key={s.id} className="border-t">
                  <td className="p-3 font-medium">{s.descrizione}</td>
                  <td className="p-3">{formatDateIT(s.data_inizio)}</td>
                  <td className="p-3">{formatDateIT(s.data_fine)}</td>
                  <td className="p-3">
                    {s.attivo ? (
                      <span className="rounded-full bg-green-100 px-3 py-1 text-xs text-green-700">
                        Attiva
                      </span>
                    ) : (
                      <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600">
                        Disattiva
                      </span>
                    )}
                  </td>
                  <td className="p-3">{s.ordine}</td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => handleEdit(s)}
                        className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-100"
                      >
                        Modifica
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDelete(s.id)}
                        className="rounded-lg border border-red-300 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                      >
                        Elimina
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {sospensioni.length === 0 && (
          <div className="py-10 text-center text-sm text-gray-500">
            Nessuna sospensione trovata.
          </div>
        )}
      </div>
    </div>
  );
}
