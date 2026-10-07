import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type PrestazioneAR = {
  id: number;
  TipoPrestazioneAR: string;
  RischioTipoPrestAR: string;
  PunteggioPrestAR: number;
  TipoTB?: string | null;
  RegolaDiCondotta?: string | null;
};

type FormDataType = {
  TipoPrestazioneAR: string;
  RischioTipoPrestAR: string;
  PunteggioPrestAR: number;
  TipoTB: string;
  RegolaDiCondotta: string;
};

const initialFormData: FormDataType = {
  TipoPrestazioneAR: "",
  RischioTipoPrestAR: "Non significativo",
  PunteggioPrestAR: 1,
  TipoTB: "",
  RegolaDiCondotta: "",
};

export default function ElencoPrestazioniARPage() {
  const [rows, setRows] = useState<PrestazioneAR[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<FormDataType>(initialFormData);
  const [filtroTipoTB, setFiltroTipoTB] = useState("");
  const [filtroRischio, setFiltroRischio] = useState("");

  const loadData = async () => {
    setLoading(true);
    setError(null);

    const { data, error } = await (supabase as any)
      .from("tbElencoPrestAR")
      .select("id, TipoPrestazioneAR, RischioTipoPrestAR, PunteggioPrestAR, TipoTB, RegolaDiCondotta")
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

  const handleChange = (field: keyof FormDataType, value: string | number) => {
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
      TipoTB: row.TipoTB || "",
      RegolaDiCondotta: row.RegolaDiCondotta || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSave = async () => {
    if (!formData.TipoPrestazioneAR.trim()) {
      alert("Inserisci il tipo prestazione.");
      return;
    }

    if (!formData.TipoTB) {
      alert("Seleziona il tipo TB.");
      return;
    }

    setSaving(true);
    setError(null);

    if (editingId === null) {
      const { error } = await (supabase as any).from("tbElencoPrestAR").insert([
        {
          TipoPrestazioneAR: formData.TipoPrestazioneAR.trim(),
          RischioTipoPrestAR: formData.RischioTipoPrestAR,
          PunteggioPrestAR: formData.PunteggioPrestAR,
          TipoTB: formData.TipoTB,
          RegolaDiCondotta: formData.RegolaDiCondotta.trim() || null,
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
          TipoTB: formData.TipoTB,
          RegolaDiCondotta: formData.RegolaDiCondotta.trim() || null,
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

  const filteredRows = rows.filter((row) => {
    const matchTipoTB = !filtroTipoTB || (row.TipoTB || "") === filtroTipoTB;
    const matchRischio = !filtroRischio || row.RischioTipoPrestAR === filtroRischio;
    return matchTipoTB && matchRischio;
  });

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Elenco Prestazioni AR</h1>
        <p className="text-gray-500 mt-1">
          Gestione prestazioni antiriciclaggio con rischio, punteggio e tipo TB
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
              <label className="block text-sm font-medium mb-1">Tipo Prestazione AR</label>
              <input
                type="text"
                value={formData.TipoPrestazioneAR}
                onChange={(e) => handleChange("TipoPrestazioneAR", e.target.value)}
                className="w-full border rounded-md px-3 py-2"
                placeholder="Inserisci la prestazione"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Rischio</label>
                <select
                  value={formData.RischioTipoPrestAR}
                  onChange={(e) => handleChange("RischioTipoPrestAR", e.target.value)}
                  className="w-full border rounded-md px-3 py-2"
                >
                  <option value="Non significativo">Non significativo</option>
                  <option value="Poco significativo">Poco significativo</option>
                  <option value="Abbastanza significativo">Abbastanza significativo</option>
                  <option value="Molto significativo">Molto significativo</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Punteggio</label>
                <select
                  value={formData.PunteggioPrestAR}
                  onChange={(e) => handleChange("PunteggioPrestAR", Number(e.target.value))}
                  className="w-full border rounded-md px-3 py-2"
                >
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                  <option value={4}>4</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Tipo TB</label>
                <select
                  value={formData.TipoTB}
                  onChange={(e) => handleChange("TipoTB", e.target.value)}
                  className="w-full border rounded-md px-3 py-2"
                >
                  <option value="">Seleziona</option>
                  <option value="TB1">TB1</option>
                  <option value="TB2">TB2</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Regola di condotta</label>
              <textarea
                value={formData.RegolaDiCondotta}
                onChange={(e) => handleChange("RegolaDiCondotta", e.target.value)}
                className="min-h-32 w-full resize-y rounded-md border px-3 py-2"
                placeholder="Inserisci la regola di condotta associata alla prestazione"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Salvataggio..." : editingId === null ? "Salva" : "Aggiorna"}
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
          <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Filtro Tipo TB</label>
              <select
                value={filtroTipoTB}
                onChange={(e) => setFiltroTipoTB(e.target.value)}
                className="w-full rounded-md border px-3 py-2"
              >
                <option value="">Tutti</option>
                <option value="TB1">TB1</option>
                <option value="TB2">TB2</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Filtro Tipo rischio</label>
              <select
                value={filtroRischio}
                onChange={(e) => setFiltroRischio(e.target.value)}
                className="w-full rounded-md border px-3 py-2"
              >
                <option value="">Tutti</option>
                <option value="Non significativo">Non significativo</option>
                <option value="Poco significativo">Poco significativo</option>
                <option value="Abbastanza significativo">Abbastanza significativo</option>
                <option value="Molto significativo">Molto significativo</option>
              </select>
            </div>
          </div>

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
                    <th className="border p-3 text-left">Tipo TB</th>
                    <th className="border p-3 text-left">Regola di condotta</th>
                    <th className="border p-3 text-left">Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => (
                    <tr key={row.id}>
                      <td className="border p-3">{row.TipoPrestazioneAR}</td>
                      <td className="border p-3">{row.RischioTipoPrestAR}</td>
                      <td className="border p-3">{row.PunteggioPrestAR}</td>
                      <td className="border p-3">{row.TipoTB || ""}</td>
                      <td className="max-w-md whitespace-pre-wrap border p-3">{row.RegolaDiCondotta || ""}</td>
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

                  {filteredRows.length === 0 && (
                    <tr>
                      <td className="border p-3" colSpan={6}>
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
