import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type PrestazioneAR = {
  id: number;
  TipoPrestazioneAR: string;
  RischioTipoPrestAR: string;
  PunteggioPrestAR: number;
};

type FormDataType = {
  TipoPrestazioneAR: string;
  RischioTipoPrestAR: string;
  PunteggioPrestAR: number;
};

const initialFormData: FormDataType = {
  TipoPrestazioneAR: "",
  RischioTipoPrestAR: "Non significativo",
  PunteggioPrestAR: 1,
};

export default function ElencoPrestazioniARPage() {
  const [rows, setRows] = useState<PrestazioneAR[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<FormDataType>(initialFormData);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    const { data, error } = await (supabase as any)
      .from("tbElencoPrestAR")
      .select("id, TipoPrestazioneAR, RischioTipoPrestAR, PunteggioPrestAR")
      .order("TipoPrestazioneAR", { ascending: true });

    if (error) {
      setError(error.message);
      setRows([]);
    } else {
      setRows((data || []) as PrestazioneAR[]);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const resetForm = () => {
    setFormData(initialFormData);
    setEditingId(null);
  };

  const handleChange = (
    field: keyof FormDataType,
    value: string | number
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleEdit = (row: PrestazioneAR) => {
    setEditingId(row.id);
    setFormData({
      TipoPrestazioneAR: row.TipoPrestazioneAR,
      RischioTipoPrestAR: row.RischioTipoPrestAR,
      PunteggioPrestAR: row.PunteggioPrestAR,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSave = async () => {
    if (!formData.TipoPrestazioneAR.trim()) {
      alert("Inserisci il tipo prestazione.");
      return;
    }

    setSaving(true);
    setError(null);

    if (editingId === null) {
      const { error } = await (supabase as any)
        .from("tbElencoPrestAR")
        .insert([
          {
            TipoPrestazioneAR: formData.TipoPrestazioneAR.trim(),
            RischioTipoPrestAR: formData.RischioTipoPrestAR,
            PunteggioPrestAR: formData.PunteggioPrestAR,
          },
        ]);

      if (error) {
        setError(error.message);
        setSaving(false);
        return;
      }
    } else {
      const { error } = await (supabase as any)
        .from("tbElencoPrestAR")
        .update({
          TipoPrestazioneAR: formData.TipoPrestazioneAR.trim(),
          RischioTipoPrestAR: formData.RischioTipoPrestAR,
          PunteggioPrestAR: formData.PunteggioPrestAR,
        })
        .eq("id", editingId);

      if (error) {
        setError(error.message);
        setSaving(false);
        return;
      }
    }

    resetForm();
    await loadData();
    setSaving(false);
  };

  const handleDelete = async (id: number) => {
    const conferma = window.confirm("Vuoi eliminare questo record?");
    if (!conferma) return;

    setError(null);

    const { error } = await (supabase as any)
      .from("tbElencoPrestAR")
      .delete()
      .eq("id", id);

    if (error) {
      setError(error.message);
      return;
    }

    if (editingId === id) {
      resetForm();
    }

    await loadData();
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Elenco Prestazioni AR</h1>
        <p className="text-gray-500 mt-1">
          Gestione prestazioni antiriciclaggio con rischio e punteggio
        </p>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>
            {editingId === null ? "Nuova Prestazione AR" : "Modifica Prestazione AR"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Tipo Prestazione AR
              </label>
              <input
                type="text"
                value={formData.TipoPrestazioneAR}
                onChange={(e) =>
                  handleChange("TipoPrestazioneAR", e.target.value)
                }
                className="w-full border rounded-md px-3 py-2"
                placeholder="Inserisci la prestazione"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Rischio</label>
                <select
                  value={formData.RischioTipoPrestAR}
                  onChange={(e) =>
                    handleChange("RischioTipoPrestAR", e.target.value)
                  }
                  className="w-full border rounded-md px-3 py-2"
                >
                  <option value="Non significativo">Non significativo</option>
                  <option value="Poco significativo">Poco significativo</option>
                  <option value="Abbastanza significativo">
                    Abbastanza significativo
                  </option>
                  <option value="Molto significativo">Molto significativo</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Punteggio</label>
                <select
                  value={formData.PunteggioPrestAR}
                  onChange={(e) =>
                    handleChange("PunteggioPrestAR", Number(e.target.value))
                  }
                  className="w-full border rounded-md px-3 py-2"
                >
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                  <option value={4}>4</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button onClick={handleSave} disabled={saving}>
                {saving
                  ? "Salvataggio..."
                  : editingId === null
                  ? "Salva"
                  : "Aggiorna"}
              </Button>

              <Button type="button" variant="outline" onClick={resetForm}>
                Annulla
              </Button>
            </div>

            {error && <p className="text-red-600 text-sm">Errore: {error}</p>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Elenco Prestazioni</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p>Caricamento...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border p-3 text-left">Tipo Prestazione AR</th>
                    <th className="border p-3 text-left">Rischio</th>
                    <th className="border p-3 text-left">Punteggio</th>
                    <th className="border p-3 text-left">Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td className="border p-3">{row.TipoPrestazioneAR}</td>
                      <td className="border p-3">{row.RischioTipoPrestAR}</td>
                      <td className="border p-3">{row.PunteggioPrestAR}</td>
                      <td className="border p-3">
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => handleEdit(row)}
                          >
                            Modifica
                          </Button>

                          <Button
                            type="button"
                            variant="destructive"
                            onClick={() => handleDelete(row.id)}
                          >
                            Elimina
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {rows.length === 0 && (
                    <tr>
                      <td className="border p-3" colSpan={4}>
                        Nessun dato presente
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
