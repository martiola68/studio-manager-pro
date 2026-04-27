import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { getSupabaseClient } from "@/lib/supabaseClient";

type PrimoGradoForm = {
  id?: string;
  processo_id: string;
  data_notifica_ricorso: string;
  data_deposito_ricorso: string;
  data_udienza: string;
  data_deposito_documenti: string;
  data_deposito_memorie: string;
  data_deposito_repliche: string;
  data_sentenza: string;
  esito: string;
  note: string;
};

const initialForm: PrimoGradoForm = {
  processo_id: "",
  data_notifica_ricorso: "",
  data_deposito_ricorso: "",
  data_udienza: "",
  data_deposito_documenti: "",
  data_deposito_memorie: "",
  data_deposito_repliche: "",
  data_sentenza: "",
  esito: "",
  note: "",
};

export default function PrimoGradoPage() {
  const router = useRouter();
  const { id } = router.query;

  const [form, setForm] = useState<PrimoGradoForm>(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [errore, setErrore] = useState("");

  useEffect(() => {
    if (id) {
      loadData(String(id));
    }
  }, [id]);

  const handleChange = (field: keyof PrimoGradoForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const addDays = (dateString: string, days: number) => {
    if (!dateString) return "";

    const d = new Date(dateString);
    d.setDate(d.getDate() + days);

    return d.toISOString().split("T")[0];
  };

  const subtractDays = (dateString: string, days: number) => {
    if (!dateString) return "";

    const d = new Date(dateString);
    d.setDate(d.getDate() - days);

    return d.toISOString().split("T")[0];
  };

  const dataScadenzaRicorso = form.data_notifica_ricorso
    ? addDays(form.data_notifica_ricorso, 60)
    : "";

  const dataScadenzaCostituzioneRicorrente = form.data_deposito_ricorso
    ? addDays(form.data_deposito_ricorso, 30)
    : "";

  const dataScadenzaDocumenti = form.data_udienza
    ? subtractDays(form.data_udienza, 20)
    : "";

  const dataScadenzaMemorie = form.data_udienza
    ? subtractDays(form.data_udienza, 10)
    : "";

  const dataScadenzaRepliche = form.data_udienza
    ? subtractDays(form.data_udienza, 5)
    : "";

  const loadData = async (processoId: string) => {
    const supabase = getSupabaseClient();

    const { data } = await (supabase as any)
      .from("tbcontenzioso_ricorso_primo_grado")
      .select("*")
      .eq("processo_id", processoId)
      .maybeSingle();

    if (data) {
      setForm({
        id: data.id,
        processo_id: data.processo_id,
        data_notifica_ricorso: data.data_notifica_ricorso || "",
        data_deposito_ricorso: data.data_deposito_ricorso || "",
        data_udienza: data.data_udienza || "",
        data_deposito_documenti: data.data_deposito_documenti || "",
        data_deposito_memorie: data.data_deposito_memorie || "",
        data_deposito_repliche: data.data_deposito_repliche || "",
        data_sentenza: data.data_sentenza || "",
        esito: data.esito || "",
        note: data.note || "",
      });
    } else {
      setForm({ ...initialForm, processo_id: processoId });
    }

    setLoading(false);
  };

  const handleSave = async () => {
    const supabase = getSupabaseClient();

    setErrore("");

    if (!id) {
      setErrore("Pratica non trovata.");
      return;
    }

    if (!form.data_notifica_ricorso) {
      setErrore("Inserisci la data notifica ricorso.");
      return;
    }

    setSaving(true);

    const payload = {
      processo_id: String(id),
      data_notifica_ricorso: form.data_notifica_ricorso || null,
      data_deposito_ricorso: form.data_deposito_ricorso || null,
      data_udienza: form.data_udienza || null,
      data_deposito_documenti: form.data_deposito_documenti || null,
      data_deposito_memorie: form.data_deposito_memorie || null,
      data_deposito_repliche: form.data_deposito_repliche || null,
      data_sentenza: form.data_sentenza || null,

      data_scadenza_ricorso: dataScadenzaRicorso || null,
      data_scadenza_costituzione_ricorrente:
        dataScadenzaCostituzioneRicorrente || null,
      data_scadenza_documenti: dataScadenzaDocumenti || null,
      data_scadenza_memorie: dataScadenzaMemorie || null,
      data_scadenza_repliche: dataScadenzaRepliche || null,

      esito: form.esito || null,
      note: form.note || null,
    };

    let error = null;

    if (form.id) {
      const res = await (supabase as any)
        .from("tbcontenzioso_ricorso_primo_grado")
        .update(payload)
        .eq("id", form.id);

      error = res.error;
    } else {
      const res = await (supabase as any)
        .from("tbcontenzioso_ricorso_primo_grado")
        .insert(payload);

      error = res.error;
    }

    setSaving(false);

    if (error) {
      console.error(error);
      setErrore("Errore durante il salvataggio del ricorso di primo grado.");
      return;
    }

    router.push(`/contenzioso/atti/${id}`);
  };

  if (loading) {
    return <div className="p-6">Caricamento ricorso...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-6xl rounded-2xl bg-white p-6 shadow">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Ricorso 1° grado
            </h1>
            <p className="text-sm text-gray-500">
              Gestione ricorso, costituzione e depositi
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

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium">
              Data notifica ricorso
            </label>
            <input
              type="date"
              value={form.data_notifica_ricorso}
              onChange={(e) =>
                handleChange("data_notifica_ricorso", e.target.value)
              }
              className="w-full rounded-lg border p-2"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Scadenza ricorso
            </label>
            <input
              type="date"
              value={dataScadenzaRicorso}
              disabled
              className="w-full rounded-lg border bg-gray-100 p-2"
            />
            <p className="mt-1 text-xs text-gray-500">
              Calcolata: notifica + 60 giorni
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Data deposito ricorso
            </label>
            <input
              type="date"
              value={form.data_deposito_ricorso}
              onChange={(e) =>
                handleChange("data_deposito_ricorso", e.target.value)
              }
              className="w-full rounded-lg border p-2"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Scadenza costituzione ricorrente
            </label>
            <input
              type="date"
              value={dataScadenzaCostituzioneRicorrente}
              disabled
              className="w-full rounded-lg border bg-gray-100 p-2"
            />
            <p className="mt-1 text-xs text-gray-500">
              Calcolata: deposito ricorso + 30 giorni
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Data udienza
            </label>
            <input
              type="date"
              value={form.data_udienza}
              onChange={(e) => handleChange("data_udienza", e.target.value)}
              className="w-full rounded-lg border p-2"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Scadenza documenti
            </label>
            <input
              type="date"
              value={dataScadenzaDocumenti}
              disabled
              className="w-full rounded-lg border bg-gray-100 p-2"
            />
            <p className="mt-1 text-xs text-gray-500">
              Calcolata: udienza - 20 giorni
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Scadenza memorie
            </label>
            <input
              type="date"
              value={dataScadenzaMemorie}
              disabled
              className="w-full rounded-lg border bg-gray-100 p-2"
            />
            <p className="mt-1 text-xs text-gray-500">
              Calcolata: udienza - 10 giorni
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Scadenza repliche
            </label>
            <input
              type="date"
              value={dataScadenzaRepliche}
              disabled
              className="w-full rounded-lg border bg-gray-100 p-2"
            />
            <p className="mt-1 text-xs text-gray-500">
              Calcolata: udienza - 5 giorni
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Data sentenza
            </label>
            <input
              type="date"
              value={form.data_sentenza}
              onChange={(e) => handleChange("data_sentenza", e.target.value)}
              className="w-full rounded-lg border p-2"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Esito</label>
            <select
              value={form.esito}
              onChange={(e) => handleChange("esito", e.target.value)}
              className="w-full rounded-lg border p-2"
            >
              <option value="">---</option>
              <option value="Accolto">Accolto</option>
              <option value="Parzialmente accolto">Parzialmente accolto</option>
              <option value="Rigettato">Rigettato</option>
              <option value="Estinto">Estinto</option>
            </select>
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
            {saving ? "Salvataggio..." : "Salva ricorso"}
          </button>
        </div>
      </div>
    </div>
  );
}
