import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { getSupabaseClient } from "@/lib/supabaseClient";

type Cliente = {
  id: string;
  ragione_sociale?: string | null;
  codice_fiscale?: string | null;
};

const TIPO_ATTO_AVVISO_BONARIO = "Avviso bonario";

const initialForm = {
  cliente_id: "",
  numero_atto: "",
  tipo_atto_id: TIPO_ATTO_AVVISO_BONARIO,
  tipo_atto_dettaglio: "",
  anno_riferimento: "",
  data_emissione: "",
  data_ricezione: "",
  data_scadenza: "",
  motivazione: "",
  contestazione: "No",
  tipo_contestazione: "",
  data_invio_contestazione: "",
  responso: "",
  comunicato_cliente: "No",
  data_comunicazione: "",
  fare_ricorso: "No",
  motivazione_ricorso: "",
  genera_scadenza_ricorso: false,
  allegato_atto: "",
  allegato_civis: "",
  allegato_responso: "",
};

export default function NuovoAvvisoBonario() {
  const router = useRouter();
 
  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errore, setErrore] = useState("");
  const [successo, setSuccesso] = useState("");

  useEffect(() => {
    loadClienti();
  }, []);

  const getClienteLabel = (cliente: Cliente) => {
  return `${cliente.ragione_sociale || "Cliente senza nome"}${
    cliente.codice_fiscale ? ` - ${cliente.codice_fiscale}` : ""
  }`;
};

  const addDays = (dateString: string, days: number) => {
    if (!dateString) return "";

    const date = new Date(dateString);
    date.setDate(date.getDate() + days);

    return date.toISOString().split("T")[0];
  };

 const loadClienti = async () => {
  const supabase = getSupabaseClient();

  setLoading(true);
    setErrore("");

    const { data, error } = await supabase
      .from("tbclienti")
      .select("id, ragione_sociale, codice_fiscale")
      .order("ragione_sociale", { ascending: true });

    if (error) {
      setErrore("Errore nel caricamento dei clienti.");
      setLoading(false);
      return;
    }

    setClienti(data || []);
    setLoading(false);
  };

  const handleChange = (
    field: keyof typeof initialForm,
    value: string | boolean
  ) => {
    setForm((prev) => {
      const next = {
        ...prev,
        [field]: value,
      };

      if (field === "data_ricezione" && typeof value === "string") {
        next.data_scadenza = addDays(value, 60);
      }

      return next;
    });
  };

  const handlePdfUpload = async (
  field: "allegato_atto" | "allegato_civis" | "allegato_responso",
  file: File | null
) => {
  if (!file) return;

  if (file.type !== "application/pdf") {
    setErrore("Puoi caricare solo file PDF.");
    return;
  }

  const supabase = getSupabaseClient();

  const fileExt = file.name.split(".").pop();
  const fileName = `${field}_${Date.now()}.${fileExt}`;
  const filePath = `contenzioso/avvisi-bonari/${fileName}`;

  const { error } = await supabase.storage
    .from("messaggi-allegati")
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: true,
    });

  if (error) {
    console.error(error);
    setErrore("Errore durante il caricamento del PDF.");
    return;
  }

  handleChange(field, filePath);
};

  const handleSave = async () => {
    setErrore("");
    setSuccesso("");

    if (!form.cliente_id) {
      setErrore("Seleziona un cliente.");
      return;
    }

    if (!form.numero_atto.trim()) {
      setErrore("Inserisci il numero atto.");
      return;
    }

    if (!form.data_ricezione) {
      setErrore("Inserisci la data di ricezione.");
      return;
    }

   setSaving(true);

const supabase = getSupabaseClient();


    const payload = {
      cliente_id: form.cliente_id,
      numero_atto: form.numero_atto.trim(),
      tipo_atto_id: TIPO_ATTO_AVVISO_BONARIO,
      tipo_atto_dettaglio: form.tipo_atto_dettaglio || null,
      anno_riferimento: form.anno_riferimento || null,
      data_emissione: form.data_emissione || null,
      data_ricezione: form.data_ricezione || null,
      data_scadenza: form.data_scadenza || null,
      motivazione: form.motivazione || null,
      contestazione: form.contestazione || "No",
      tipo_contestazione: form.tipo_contestazione || null,
      data_invio_contestazione: form.data_invio_contestazione || null,
      responso: form.responso || null,
      comunicato_cliente: form.comunicato_cliente || "No",
      data_comunicazione: form.data_comunicazione || null,
      fare_ricorso: form.fare_ricorso || "No",
      motivazione_ricorso: form.motivazione_ricorso || null,
      genera_scadenza_ricorso: form.genera_scadenza_ricorso,
      allegato_atto: form.allegato_atto || null,
      allegato_civis: form.allegato_civis || null,
      allegato_responso: form.allegato_responso || null,
    };

    const { error } = await (supabase as any)
  .from("tbcontenzioso_scadenze")
  .insert(payload);
    setSaving(false);

    if (error) {
      console.error(error);
      setErrore("Errore durante il salvataggio dell'avviso bonario.");
      return;
    }

    setSuccesso("Avviso bonario salvato correttamente.");
    router.push("/contenzioso/avvisi-bonari");
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-6xl rounded-2xl bg-white p-6 shadow">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Nuovo avviso bonario
            </h1>
            <p className="text-sm text-gray-500">
              Form dedicato per Avviso bonario su tbcontenzioso_scadenze
            </p>
          </div>

          <button
            type="button"
            onClick={() => router.push("/contenzioso/avvisi-bonari")}
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
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium">Cliente</label>
            <select
              value={form.cliente_id}
              onChange={(e) => handleChange("cliente_id", e.target.value)}
              className="w-full rounded-lg border p-2"
              disabled={loading}
            >
              <option value="">Seleziona cliente</option>
              {clienti.map((cliente) => (
                <option key={cliente.id} value={cliente.id}>
                  {getClienteLabel(cliente)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Tipo atto
            </label>
            <input
              value={TIPO_ATTO_AVVISO_BONARIO}
              disabled
              className="w-full rounded-lg border bg-gray-100 p-2"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Numero atto
            </label>
            <input
              value={form.numero_atto}
              onChange={(e) => handleChange("numero_atto", e.target.value)}
              className="w-full rounded-lg border p-2"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Tipo atto dettaglio
            </label>
            <select
              value={form.tipo_atto_dettaglio}
              onChange={(e) =>
                handleChange("tipo_atto_dettaglio", e.target.value)
              }
              className="w-full rounded-lg border p-2"
            >
              <option value="">---</option>
              <option value="Redditi">Redditi</option>
              <option value="IVA">IVA</option>
              <option value="770">770</option>
              <option value="IRAP">IRAP</option>
              <option value="Altro">Altro</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Anno riferimento
            </label>
            <input
              type="number"
              value={form.anno_riferimento}
              onChange={(e) =>
                handleChange("anno_riferimento", e.target.value)
              }
              className="w-full rounded-lg border p-2"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Data emissione
            </label>
            <input
              type="date"
              value={form.data_emissione}
              onChange={(e) => handleChange("data_emissione", e.target.value)}
              className="w-full rounded-lg border p-2"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Data ricezione
            </label>
            <input
              type="date"
              value={form.data_ricezione}
              onChange={(e) => handleChange("data_ricezione", e.target.value)}
              className="w-full rounded-lg border p-2"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Data scadenza automatica
            </label>
            <input
              type="date"
              value={form.data_scadenza}
              disabled
              className="w-full rounded-lg border bg-gray-100 p-2"
            />
            <p className="mt-1 text-xs text-gray-500">
              Calcolata automaticamente: data ricezione + 60 giorni
            </p>
          </div>

          <div className="md:col-span-3">
            <label className="mb-1 block text-sm font-medium">
              Motivazione
            </label>
            <textarea
              value={form.motivazione}
              onChange={(e) => handleChange("motivazione", e.target.value)}
              className="w-full rounded-lg border p-2"
              rows={3}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Contestazione
            </label>
            <select
              value={form.contestazione}
              onChange={(e) => handleChange("contestazione", e.target.value)}
              className="w-full rounded-lg border p-2"
            >
              <option value="No">No</option>
              <option value="Sì">Sì</option>
              <option value="Parziale">Parziale</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Tipo contestazione
            </label>
            <input
              value={form.tipo_contestazione}
              onChange={(e) =>
                handleChange("tipo_contestazione", e.target.value)
              }
              className="w-full rounded-lg border p-2"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Data invio contestazione
            </label>
            <input
              type="date"
              value={form.data_invio_contestazione}
              onChange={(e) =>
                handleChange("data_invio_contestazione", e.target.value)
              }
              className="w-full rounded-lg border p-2"
            />
          </div>

          <div className="md:col-span-3">
            <label className="mb-1 block text-sm font-medium">Responso</label>
            <textarea
              value={form.responso}
              onChange={(e) => handleChange("responso", e.target.value)}
              className="w-full rounded-lg border p-2"
              rows={3}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Comunicato al cliente
            </label>
            <select
              value={form.comunicato_cliente}
              onChange={(e) =>
                handleChange("comunicato_cliente", e.target.value)
              }
              className="w-full rounded-lg border p-2"
            >
              <option value="No">No</option>
              <option value="Sì">Sì</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Data comunicazione
            </label>
            <input
              type="date"
              value={form.data_comunicazione}
              onChange={(e) =>
                handleChange("data_comunicazione", e.target.value)
              }
              className="w-full rounded-lg border p-2"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Fare ricorso
            </label>
            <select
              value={form.fare_ricorso}
              onChange={(e) => handleChange("fare_ricorso", e.target.value)}
              className="w-full rounded-lg border p-2"
            >
              <option value="No">No</option>
              <option value="Sì">Sì</option>
            </select>
          </div>

          <div className="md:col-span-3">
            <label className="mb-1 block text-sm font-medium">
              Motivazione ricorso
            </label>
            <textarea
              value={form.motivazione_ricorso}
              onChange={(e) =>
                handleChange("motivazione_ricorso", e.target.value)
              }
              className="w-full rounded-lg border p-2"
              rows={3}
            />
          </div>

          <div className="md:col-span-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={form.genera_scadenza_ricorso}
                onChange={(e) =>
                  handleChange("genera_scadenza_ricorso", e.target.checked)
                }
              />
              Genera scadenza ricorso
            </label>
          </div>

    <div>
  <label className="mb-1 block text-sm font-medium">
    Allegato atto
  </label>
  <div className="flex gap-2">
    <input
      type="file"
      accept="application/pdf"
      onChange={(e) =>
        handlePdfUpload("allegato_atto", e.target.files?.[0] || null)
      }
      className="w-full rounded-lg border p-2"
    />
    <button
      type="button"
      disabled={!form.allegato_atto}
      onClick={() => openPdf(form.allegato_atto)}
      className="rounded-lg border px-4 py-2 text-sm disabled:opacity-40"
    >
      Apri
    </button>
  </div>
</div>

<div>
  <label className="mb-1 block text-sm font-medium">
    Allegato CIVIS
  </label>
  <div className="flex gap-2">
    <input
      type="file"
      accept="application/pdf"
      onChange={(e) =>
        handlePdfUpload("allegato_civis", e.target.files?.[0] || null)
      }
      className="w-full rounded-lg border p-2"
    />
    <button
      type="button"
      disabled={!form.allegato_civis}
      onClick={() => openPdf(form.allegato_civis)}
      className="rounded-lg border px-4 py-2 text-sm disabled:opacity-40"
    >
      Apri
    </button>
  </div>
</div>

<div>
  <label className="mb-1 block text-sm font-medium">
    Allegato responso
  </label>
  <div className="flex gap-2">
    <input
      type="file"
      accept="application/pdf"
      onChange={(e) =>
        handlePdfUpload("allegato_responso", e.target.files?.[0] || null)
      }
      className="w-full rounded-lg border p-2"
    />
    <button
      type="button"
      disabled={!form.allegato_responso}
      onClick={() => openPdf(form.allegato_responso)}
      className="rounded-lg border px-4 py-2 text-sm disabled:opacity-40"
    >
      Apri
    </button>
  </div>
</div>
)}
</div>    
        </div>

        <div className="mt-8 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => router.push("/contenzioso/avvisi-bonari")}
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
            {saving ? "Salvataggio..." : "Salva avviso bonario"}
          </button>
        </div>
      </div>
    </div>
  );
}
