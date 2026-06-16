import { useEffect, useState } from "react";
import Head from "next/head";
import { getSupabaseClient } from "@/lib/supabaseClient";
import {
  Plus,
  Pencil,
  Trash2,
  FileText,
  RefreshCw,
} from "lucide-react";

export default function PraticheVariazioniPage() {
  const [loading, setLoading] = useState(true);
  const [variazioni, setVariazioni] = useState<any[]>([]);
  const [clienti, setClienti] = useState<any[]>([]);
  const [utente, setUtente] = useState<any>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [form, setForm] = useState({
    cliente_id: "",
    titolo: "",
    descrizione: "",
    tipo_variazione: "",
    ente_principale: "CCIAA",
    priorita: "normale",
    data_atto: "",
    obbligo_ade: false,
    genera_verbale: false,
    richiede_pratica: false,
    note: "",
  });

  async function loadData() {
    try {
      setLoading(true);

      const supabase = getSupabaseClient();

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user?.email) return;

      const { data: user } = await supabase
        .from("tbutenti")
        .select("*")
        .eq("email", session.user.email)
        .single();

      if (!user?.studio_id) return;

setUtente(user);

const studioId = String(user.studio_id);

const { data: clientiData } = await supabase
  .from("tbclienti")
  .select("id, ragione_sociale")
  .eq("studio_id", studioId)
  .order("ragione_sociale");

      setClienti(clientiData || []);

    const response = await fetch(
  `/api/pratiche/variazioni?studio_id=${studioId}`
);

      const result = await response.json();

      setVariazioni(result.data || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function salva() {
    if (!utente) return;

    const payload = {
      ...form,
      studio_id: utente.studio_id,
    };

    const response = await fetch("/api/pratiche/variazioni", {
      method: editingId ? "PUT" : "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        editingId
          ? {
              id: editingId,
              ...payload,
            }
          : payload
      ),
    });

    const result = await response.json();

    if (!result.success) {
      alert(result.error);
      return;
    }

    resetForm();
    await loadData();
  }

  function resetForm() {
    setEditingId(null);

    setForm({
      cliente_id: "",
      titolo: "",
      descrizione: "",
      tipo_variazione: "",
      ente_principale: "CCIAA",
      priorita: "normale",
      data_atto: "",
      obbligo_ade: false,
      genera_verbale: false,
      richiede_pratica: false,
      note: "",
    });

    setShowForm(false);
  }

  function modifica(record: any) {
    setEditingId(record.id);

    setForm({
      cliente_id: record.cliente_id || "",
      titolo: record.titolo || "",
      descrizione: record.descrizione || "",
      tipo_variazione: record.tipo_variazione || "",
      ente_principale: record.ente_principale || "CCIAA",
      priorita: record.priorita || "normale",
      data_atto: record.data_atto || "",
      obbligo_ade: record.obbligo_ade || false,
      genera_verbale: record.genera_verbale || false,
      richiede_pratica: record.richiede_pratica || false,
      note: record.note || "",
    });

    setShowForm(true);
  }

  async function elimina(id: string) {
    if (!confirm("Eliminare la variazione?")) return;

    await fetch(`/api/pratiche/variazioni?id=${id}`, {
      method: "DELETE",
    });

    await loadData();
  }

  async function creaPraticaDaVariazione(variazioneId: string) {
  const tipoPraticaId = prompt(
    "Inserisci ID tipo pratica da creare. Esempio: messa_liquidazione / cambio_amministratore va poi automatizzato con select."
  );

  if (!tipoPraticaId) return;

  const response = await fetch("/api/pratiche/variazioni/crea-pratica", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      variazione_id: variazioneId,
      tipo_pratica_id: Number(tipoPraticaId),
    }),
  });

  const result = await response.json();

  if (!result.success) {
    alert(result.error || "Errore creazione pratica");
    return;
  }

  alert("Pratica creata e collegata alla variazione.");
  await loadData();
}

  return (
    <>
      <Head>
        <title>Variazioni CCIAA / AdE</title>
      </Head>

      <div className="max-w-[1800px] mx-auto p-4">

        <div className="flex justify-between mb-4">
          <h1 className="text-2xl font-bold">
            Variazioni CCIAA / Agenzia Entrate
          </h1>

          <div className="flex gap-2">
            <button
              onClick={loadData}
              className="border px-4 py-2 rounded"
            >
              <RefreshCw className="h-4 w-4" />
            </button>

            <button
              onClick={() => setShowForm(true)}
              className="bg-black text-white px-4 py-2 rounded flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Nuova variazione
            </button>
          </div>
        </div>

        {showForm && (
          <div className="border rounded p-4 mb-4 bg-white">

            <div className="grid grid-cols-2 gap-3">

              <select
                value={form.cliente_id}
                onChange={(e) =>
                  setForm({
                    ...form,
                    cliente_id: e.target.value,
                  })
                }
                className="border p-2 rounded"
              >
                <option value="">Seleziona cliente</option>

                {clienti.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.ragione_sociale}
                  </option>
                ))}
              </select>

              <input
                className="border p-2 rounded"
                placeholder="Tipo variazione"
                value={form.tipo_variazione}
                onChange={(e) =>
                  setForm({
                    ...form,
                    tipo_variazione: e.target.value,
                  })
                }
              />

              <input
                className="border p-2 rounded col-span-2"
                placeholder="Titolo"
                value={form.titolo}
                onChange={(e) =>
                  setForm({
                    ...form,
                    titolo: e.target.value,
                  })
                }
              />

              <textarea
                className="border p-2 rounded col-span-2"
                placeholder="Descrizione"
                value={form.descrizione}
                onChange={(e) =>
                  setForm({
                    ...form,
                    descrizione: e.target.value,
                  })
                }
              />

              <input
                type="date"
                className="border p-2 rounded"
                value={form.data_atto}
                onChange={(e) =>
                  setForm({
                    ...form,
                    data_atto: e.target.value,
                  })
                }
              />

              <select
                className="border p-2 rounded"
                value={form.ente_principale}
                onChange={(e) =>
                  setForm({
                    ...form,
                    ente_principale: e.target.value,
                  })
                }
              >
                <option value="CCIAA">CCIAA</option>
                <option value="AGENZIA_ENTRATE">
                  Agenzia Entrate
                </option>
              </select>

              <label>
                <input
                  type="checkbox"
                  checked={form.obbligo_ade}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      obbligo_ade: e.target.checked,
                    })
                  }
                />
                {" "}Obbligo AdE
              </label>

              <label>
                <input
                  type="checkbox"
                  checked={form.genera_verbale}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      genera_verbale: e.target.checked,
                    })
                  }
                />
                {" "}Genera verbale
              </label>

              <label>
                <input
                  type="checkbox"
                  checked={form.richiede_pratica}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      richiede_pratica: e.target.checked,
                    })
                  }
                />
                {" "}Richiede pratica
              </label>
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={resetForm}
                className="border px-4 py-2 rounded"
              >
                Annulla
              </button>

              <button
                onClick={salva}
                className="bg-black text-white px-4 py-2 rounded"
              >
                Salva
              </button>
            </div>
          </div>
        )}

        <div className="border rounded overflow-hidden bg-white">

          <table className="w-full text-sm">

            <thead className="bg-gray-100">
              <tr>
                <th className="p-2 text-left">Cliente</th>
                <th className="p-2 text-left">Tipo</th>
                <th className="p-2 text-left">Titolo</th>
                <th className="p-2 text-left">Data atto</th>
                <th className="p-2 text-left">Stato</th>
                <th className="p-2 text-center">AdE</th>
                <th className="p-2 text-center">Pratica</th>
                <th className="p-2 text-right">Azioni</th>
              </tr>
            </thead>

            <tbody>
              {variazioni.map((v) => (
                <tr key={v.id} className="border-t">

                  <td className="p-2">
                    {v.cliente?.ragione_sociale}
                  </td>

                  <td className="p-2">
                    {v.tipo_variazione}
                  </td>

                  <td className="p-2">
                    {v.titolo}
                  </td>

                  <td className="p-2">
                    {v.data_atto}
                  </td>

                  <td className="p-2">
                    {v.stato}
                  </td>

                  <td className="p-2 text-center">
                    {v.obbligo_ade ? "SI" : "NO"}
                  </td>

                  <td className="p-2 text-center">
                    {v.pratica_id ? "✓" : "-"}
                  </td>

                  <td className="p-2">
                    <div className="flex justify-end gap-2">

                      <button
                        onClick={() => modifica(v)}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>

                      <button
                        onClick={() => elimina(v.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </button>

                     <button
  title="Crea pratica"
  onClick={() => creaPraticaDaVariazione(v.id)}
  disabled={!!v.pratica_id}
>
  <FileText
    className={`h-4 w-4 ${
      v.pratica_id ? "text-gray-400" : "text-blue-600"
    }`}
  />
</button>

                    </div>
                  </td>

                </tr>
              ))}
            </tbody>

          </table>

        </div>

      </div>
    </>
  );
}
