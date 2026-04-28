import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { getSupabaseClient } from "@/lib/supabaseClient";

type PvcForm = {
  id?: string;
  processo_id: string;
  data_notifica_pvc: string;
  data_effettiva_osservazioni: string;
  data_incarico_parere: string;
  data_parere: string;
  data_incarico_interpello: string;
  data_interpello: string;
};

const initialForm: PvcForm = {
  processo_id: "",
  data_notifica_pvc: "",
  data_effettiva_osservazioni: "",
  data_incarico_parere: "",
  data_parere: "",
  data_incarico_interpello: "",
  data_interpello: "",
};

export default function PvcAttoPage() {
  const router = useRouter();
  const { id } = router.query;

  const [form, setForm] = useState<PvcForm>(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [errore, setErrore] = useState("");
  const [successo, setSuccesso] = useState("");

  useEffect(() => {
    if (id) {
      loadPvc(String(id));
    }
  }, [id]);

  const handleChange = (field: keyof PvcForm, value: string) => {
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

  const dataScadenzaAdesione = form.data_notifica_pvc
    ? addDays(form.data_notifica_pvc, 30)
    : "";

  const dataScadenzaOsservazioni = form.data_notifica_pvc
    ? addDays(form.data_notifica_pvc, 60)
    : "";

  const loadPvc = async (processoId: string) => {
    const supabase = getSupabaseClient();

    setLoading(true);
    setErrore("");

    const { data, error } = await (supabase as any)
      .from("tbcontenzioso_pvc")
      .select("*")
      .eq("processo_id", processoId)
      .maybeSingle();

    if (error) {
      console.error(error);
      setErrore("Errore durante il caricamento del PVC.");
      setLoading(false);
      return;
    }

    if (data) {
      setForm({
        id: data.id,
        processo_id: data.processo_id,
        data_notifica_pvc: data.data_notifica_pvc || "",
        data_effettiva_osservazioni: data.data_effettiva_osservazioni || "",
        data_incarico_parere: data.data_incarico_parere || "",
        data_parere: data.data_parere || "",
        data_incarico_interpello: data.data_incarico_interpello || "",
        data_interpello: data.data_interpello || "",
      });
   } else {
  const { data: processoData, error: processoError } = await (supabase as any)
    .from("tbcontenzioso_processo")
    .select("data_ricezione")
    .eq("id", processoId)
    .single();

  if (processoError) {
    console.error(processoError);
  }

  setForm({
    ...initialForm,
    processo_id: processoId,
    data_notifica_pvc: processoData?.data_ricezione || "",
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

    if (!form.data_notifica_pvc) {
      setErrore("Inserisci la data notifica PVC.");
      return;
    }

    setSaving(true);

    const payload = {
      processo_id: String(id),
      data_notifica_pvc: form.data_notifica_pvc || null,
      data_effettiva_osservazioni: form.data_effettiva_osservazioni || null,
      data_incarico_parere: form.data_incarico_parere || null,
      data_parere: form.data_parere || null,
      data_incarico_interpello: form.data_incarico_interpello || null,
      data_interpello: form.data_interpello || null,
    };

    let error = null;

    if (form.id) {
      const res = await (supabase as any)
        .from("tbcontenzioso_pvc")
        .update(payload)
        .eq("id", form.id);

      error = res.error;
    } else {
      const res = await (supabase as any)
        .from("tbcontenzioso_pvc")
        .insert(payload)
        .select("id")
        .single();

      error = res.error;

      if (res.data?.id) {
        setForm((prev) => ({
          ...prev,
          id: res.data.id,
        }));
      }
    }

    setSaving(false);

    if (error) {
      console.error(error);
      setErrore("Errore durante il salvataggio del PVC.");
      return;
    }

    router.push(`/contenzioso/atti/${id}`);
  };

  if (loading) {
    return <div className="p-6">Caricamento PVC...</div>;
  }

  const handleDelete = async () => {
  if (!form.id || !id) return;

  const conferma = window.confirm(
    "Vuoi eliminare il PVC collegato e le relative scadenze?"
  );

  if (!conferma) return;

  const supabase = getSupabaseClient();

  setErrore("");
  setSuccesso("");
  setSaving(true);

  const { error: scadenzeError } = await (supabase as any)
    .from("tbcontenzioso_scadenze_generate")
    .delete()
    .eq("processo_id", String(id))
    .eq("modulo", "PVC");

  if (scadenzeError) {
    console.error(scadenzeError);
    setErrore("Errore durante l'eliminazione delle scadenze PVC.");
    setSaving(false);
    return;
  }

  const { error: pvcError } = await (supabase as any)
    .from("tbcontenzioso_pvc")
    .delete()
    .eq("id", form.id);

  if (pvcError) {
    console.error(pvcError);
    setErrore("Errore durante l'eliminazione del PVC.");
    setSaving(false);
    return;
  }

  setSaving(false);
  router.push(`/contenzioso/atti/${id}`);
};

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-5xl rounded-2xl bg-white p-6 shadow">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">PVC</h1>
            <p className="text-sm text-gray-500">
              Gestione Processo Verbale di Constatazione
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
              Data notifica PVC
            </label>
            <input
              type="date"
              value={form.data_notifica_pvc}
              onChange={(e) =>
                handleChange("data_notifica_pvc", e.target.value)
              }
              className="w-full rounded-lg border p-2"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Scadenza adesione
            </label>
            <input
              type="date"
              value={dataScadenzaAdesione}
              disabled
              className="w-full rounded-lg border bg-gray-100 p-2"
            />
            <p className="mt-1 text-xs text-gray-500">
              Calcolata automaticamente: notifica PVC + 30 giorni
            </p>
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
              Calcolata automaticamente: notifica PVC + 60 giorni
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
              Data incarico parere
            </label>
            <input
              type="date"
              value={form.data_incarico_parere}
              onChange={(e) =>
                handleChange("data_incarico_parere", e.target.value)
              }
              className="w-full rounded-lg border p-2"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Data parere
            </label>
            <input
              type="date"
              value={form.data_parere}
              onChange={(e) => handleChange("data_parere", e.target.value)}
              className="w-full rounded-lg border p-2"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Data incarico interpello
            </label>
            <input
              type="date"
              value={form.data_incarico_interpello}
              onChange={(e) =>
                handleChange("data_incarico_interpello", e.target.value)
              }
              className="w-full rounded-lg border p-2"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Data interpello
            </label>
            <input
              type="date"
              value={form.data_interpello}
              onChange={(e) => handleChange("data_interpello", e.target.value)}
              className="w-full rounded-lg border p-2"
            />
          </div>
        </div>

      <div className="mt-8 flex items-center justify-between gap-3">
  <div>
    {form.id && (
      <button
        type="button"
        onClick={handleDelete}
        disabled={saving}
        className="rounded-lg bg-red-600 px-5 py-2 text-white hover:bg-red-700 disabled:opacity-50"
      >
        Elimina PVC
      </button>
    )}
  </div>

  <div className="flex gap-3">
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
      {saving ? "Salvataggio..." : "Salva PVC"}
    </button>
  </div>
</div>
  );
}
