import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { getSupabaseClient } from "@/lib/supabaseClient";

type AdesioneForm = {
  id?: string;
  processo_id: string;
  data_notifica_atto: string;
  data_presentazione_istanza: string;
  data_convocazione: string;
  data_definizione: string;
  esito: string;
  note: string;
};

const initialForm: AdesioneForm = {
  processo_id: "",
  data_notifica_atto: "",
  data_presentazione_istanza: "",
  data_convocazione: "",
  data_definizione: "",
  esito: "",
  note: "",
};

export default function AdesionePage() {
  const router = useRouter();
  const { id } = router.query;

  const [form, setForm] = useState<AdesioneForm>(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [errore, setErrore] = useState("");

  useEffect(() => {
    if (id) loadData(String(id));
  }, [id]);

  const handleChange = (field: keyof AdesioneForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const addDays = (date: string, days: number) => {
    if (!date) return "";
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d.toISOString().split("T")[0];
  };

  // 👉 Scadenza istanza = 60 giorni
  const scadenzaIstanza = addDays(form.data_notifica_atto, 60);

  const loadData = async (processoId: string) => {
    const supabase = getSupabaseClient();

    const { data } = await (supabase as any)
      .from("tbcontenzioso_adesione")
      .select("*")
      .eq("processo_id", processoId)
      .maybeSingle();

    if (data) {
      setForm({
        id: data.id,
        processo_id: data.processo_id,
        data_notifica_atto: data.data_notifica_atto || "",
        data_presentazione_istanza:
          data.data_presentazione_istanza || "",
        data_convocazione: data.data_convocazione || "",
        data_definizione: data.data_definizione || "",
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

    if (!form.data_notifica_atto) {
      setErrore("Inserisci la data notifica atto.");
      return;
    }

    setSaving(true);

    const payload = {
      processo_id: String(id),
      data_notifica_atto: form.data_notifica_atto,
      data_presentazione_istanza:
        form.data_presentazione_istanza || null,
      data_convocazione: form.data_convocazione || null,
      data_definizione: form.data_definizione || null,
      esito: form.esito || null,
      note: form.note || null,
    };

    let error = null;

    if (form.id) {
      const res = await (supabase as any)
        .from("tbcontenzioso_adesione")
        .update(payload)
        .eq("id", form.id);
      error = res.error;
    } else {
      const res = await (supabase as any)
        .from("tbcontenzioso_adesione")
        .insert(payload);
      error = res.error;
    }

    setSaving(false);

    if (error) {
      console.error(error);
      setErrore("Errore salvataggio adesione.");
      return;
    }

    router.push(`/contenzioso/atti/${id}`);
  };

  if (loading) return <div className="p-6">Caricamento...</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto bg-white rounded-xl shadow">
      <h1 className="text-xl font-bold mb-4">Accertamento con adesione</h1>

      {errore && <div className="text-red-600 mb-3">{errore}</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <input
          type="date"
          value={form.data_notifica_atto}
          onChange={(e) =>
            handleChange("data_notifica_atto", e.target.value)
          }
          className="border p-2 rounded"
        />

        <input
          type="date"
          value={scadenzaIstanza}
          disabled
          className="border p-2 rounded bg-gray-100"
        />

        <input
          type="date"
          value={form.data_presentazione_istanza}
          onChange={(e) =>
            handleChange("data_presentazione_istanza", e.target.value)
          }
          className="border p-2 rounded"
        />

        <input
          type="date"
          value={form.data_convocazione}
          onChange={(e) =>
            handleChange("data_convocazione", e.target.value)
          }
          className="border p-2 rounded"
        />

        <input
          type="date"
          value={form.data_definizione}
          onChange={(e) =>
            handleChange("data_definizione", e.target.value)
          }
          className="border p-2 rounded"
        />

        <input
          value={form.esito}
          onChange={(e) => handleChange("esito", e.target.value)}
          placeholder="Esito"
          className="border p-2 rounded"
        />
      </div>

      <textarea
        value={form.note}
        onChange={(e) => handleChange("note", e.target.value)}
        className="w-full mt-4 border p-2 rounded"
        placeholder="Note"
      />

      <div className="mt-6 flex justify-end gap-2">
        <button
          onClick={() => router.push(`/contenzioso/atti/${id}`)}
          className="border px-4 py-2 rounded"
        >
          Annulla
        </button>

        <button
          onClick={handleSave}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          Salva
        </button>
      </div>
    </div>
  );
}
