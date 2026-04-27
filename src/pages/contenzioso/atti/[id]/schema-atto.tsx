import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { getSupabaseClient } from "@/lib/supabaseClient";

type SchemaAttoForm = {
  id?: string;
  processo_id: string;
  data_notifica_schema: string;
  data_effettiva_osservazioni: string;
  data_emissione_atto_definitivo: string;
  note: string;
};

const initialForm: SchemaAttoForm = {
  processo_id: "",
  data_notifica_schema: "",
  data_effettiva_osservazioni: "",
  data_emissione_atto_definitivo: "",
  note: "",
};

export default function SchemaAttoPage() {
  const router = useRouter();
  const { id } = router.query;

  const [form, setForm] = useState<SchemaAttoForm>(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [errore, setErrore] = useState("");
  const [successo, setSuccesso] = useState("");

  useEffect(() => {
    if (id) {
      loadSchemaAtto(String(id));
    }
  }, [id]);

  const handleChange = (field: keyof SchemaAttoForm, value: string) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const addDays = (dateString: string, days: number) => {
    if (!dateString) return "";

    const date = new Date(dateString);
    date.setDate(date.getDate() + days);

    return date.toISOString().split("T")[0];
  };

  const dataScadenzaOsservazioni = form.data_notifica_schema
    ? addDays(form.data_notifica_schema, 60)
    : "";

  const loadSchemaAtto = async (processoId: string) => {
    const supabase = getSupabaseClient();

    setLoading(true);
    setErrore("");

    const { data, error } = await (supabase as any)
      .from("tbcontenzioso_schema_atto")
      .select("*")
      .eq("processo_id", processoId)
      .maybeSingle();

    if (error) {
      console.error(error);
      setErrore("Errore durante il caricamento dello schema d'atto.");
      setLoading(false);
      return;
    }

    if (data) {
      setForm({
        id: data.id,
        processo_id: data.processo_id,
        data_notifica_schema: data.data_notifica_schema || "",
        data_effettiva_osservazioni:
          data.data_effettiva_osservazioni || "",
        data_emissione_atto_definitivo:
          data.data_emissione_atto_definitivo || "",
        note: data.note || "",
      });
    } else {
      setForm({
        ...initialForm,
        processo_id: processoId,
      });
    }

    setLoading(false);
  };

  const handleSave = async () => {
    const supabase = getSupabaseClient();

    setErrore("");
    setSuccesso("");

    if (!id) {
      setErrore("Pratica non trovata.");
      return;
    }

    if (!form.data_notifica_schema) {
      setErrore("Inserisci la data notifica schema d'atto.");
      return;
    }

    setSaving(true);

    const payload = {
      processo_id: String(id),
      data_notifica_schema: form.data_notifica_schema || null,
      data_effettiva_osservazioni:
        form.data_effettiva_osservazioni || null,
      data_emissione_atto_definitivo:
        form.data_emissione_atto_definitivo || null,
      note: form.note || null,
    };

    let error = null;

    if (form.id) {
      const res = await (supabase as any)
        .from("tbcontenzioso_schema_atto")
        .update(payload)
        .eq("id", form.id);

      error = res.error;
    } else {
      const res = await (supabase as any)
        .from("tbcontenzioso_schema_atto")
        .insert(payload)
        .select("id")
        .single();

      error = res.error;
    }

    setSaving(false);

    if (error) {
      console.error(error);
      setErrore("Errore durante il salvataggio dello schema d'atto.");
      return;
    }

    router.push(`/contenzioso/atti/${id}`);
  };

  if (loading) {
    return <div className="p-6">Caricamento schema d'atto...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-5xl rounded-2xl bg-white p-6 shadow">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Schema d'atto
            </h1>
            <p className="text-sm text-gray-500">
              Gestione schema d'atto e osservazioni
            </p>
          </div>

          <button
            type="button"
            onClick={() => router.push(`/contenzioso/atti/${id}`)}
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

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium">
              Data notifica schema d'atto
            </label>
            <input
              type="date"
              value={form.data_notifica_schema}
              onChange={(e) =>
                handleChange("data_notifica_schema", e.target.value)
              }
              className="w-full rounded-lg border p-2"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Scadenza osservazioni
            </label>
            <input
              type="date"
              value={dataScadenzaOsservazioni}
              disabled
              className="w-full rounded-lg border bg-gray-100 p-2"
            />
            <p className="mt-1 text-xs text-gray-500">
              Calcolata automaticamente: notifica schema + 60 giorni
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Data effettiva osservazioni
            </label>
            <input
              type="date"
              value={form.data_effettiva_osservazioni}
              onChange={(e) =>
                handleChange("data_effettiva_osservazioni", e.target.value)
              }
              className="w-full rounded-lg border p-2"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Data emissione atto definitivo
            </label>
            <input
              type="date"
              value={form.data_emissione_atto_definitivo}
              onChange={(e) =>
                handleChange(
                  "data_emissione_atto_definitivo",
                  e.target.value
                )
              }
              className="w-full rounded-lg border p-2"
            />
          </div>

          <div className="md:col-span-3">
            <label className="mb-1 block text-sm font-medium">Note</label>
            <textarea
              value={form.note}
              onChange={(e) => handleChange("note", e.target.value)}
              className="w-full rounded-lg border p-2"
              rows={4}
            />
          </div>
        </div>

        <div className="mt-8 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => router.push(`/contenzioso/atti/${id}`)}
            className="rounded-lg border px-5 py-2 hover:bg-gray-100"
          >
            Annulla
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-blue-600 px-5 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Salvataggio..." : "Salva schema d'atto"}
          </button>
        </div>
      </div>
    </div>
  );
}
