import { useEffect, useState } from "react";
import Head from "next/head";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { Plus, Pencil, Trash2, FileText, RefreshCw } from "lucide-react";

const FORM_INIZIALE = {
  cliente_id: "",
  tipo_variazione: "",
  ente_principale: "CCIAA",
  priorita: "normale",

  data_atto: "",
  giorni_scadenza_cciaa: 30,
  data_scadenza_cciaa: "",
  data_evasione_cciaa: "",

  obbligo_ade: false,
  giorni_scadenza_ade: 30,
  data_scadenza_ade: "",
  data_comunicazione_ade: "",
  ricevuta_telematica_ade: "",
  conferma_record: false,

  genera_verbale: false,
  note: "",
};

function aggiungiGiorni(data: string, giorni: number) {
  if (!data) return "";
  const d = new Date(data);
  d.setDate(d.getDate() + Number(giorni || 0));
  return d.toISOString().slice(0, 10);
}

export default function PraticheVariazioniPage() {
  const [loading, setLoading] = useState(true);
  const [variazioni, setVariazioni] = useState<any[]>([]);
 const [clienti, setClienti] = useState<any[]>([]);
const [tipiVariazione, setTipiVariazione] = useState<any[]>([]);
const [utente, setUtente] = useState<any>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(FORM_INIZIALE);

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

      const { data: tipiData } = await supabase
  .from("tbpratiche_variazioni_tipi")
  .select("*")
  .eq("attivo", true)
  .order("ordine", { ascending: true });

setTipiVariazione(tipiData || []);

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
    void loadData();
  }, []);

  async function salva() {
    if (!utente) return;

    if (!form.cliente_id) {
      alert("Seleziona un cliente.");
      return;
    }

    if (!form.tipo_variazione) {
      alert("Seleziona il tipo di variazione.");
      return;
    }

    const payload = {
      ...form,
      studio_id: utente.studio_id,
      utente_id: utente.id,
      assegnato_a: utente.id,
      titolo: form.tipo_variazione,
      descrizione: form.note || form.tipo_variazione,
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
    setForm(FORM_INIZIALE);
    setShowForm(false);
  }

  function modifica(record: any) {
    setEditingId(record.id);

    setForm({
      cliente_id: record.cliente_id || "",
      tipo_variazione: record.tipo_variazione || "",
      ente_principale: record.ente_principale || "CCIAA",
      priorita: record.priorita || "normale",

      data_atto: record.data_atto || "",
      giorni_scadenza_cciaa: record.giorni_scadenza_cciaa || 30,
      data_scadenza_cciaa: record.data_scadenza_cciaa || "",
      data_evasione_cciaa: record.data_evasione_cciaa || "",

      obbligo_ade: record.obbligo_ade || false,
      giorni_scadenza_ade: record.giorni_scadenza_ade || 30,
      data_scadenza_ade: record.data_scadenza_ade || "",
      data_comunicazione_ade: record.data_comunicazione_ade || "",
      ricevuta_telematica_ade: record.ricevuta_telematica_ade || "",
      conferma_record: record.conferma_record || false,

      genera_verbale: record.genera_verbale || false,
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
  const response = await fetch("/api/pratiche/variazioni/crea-pratica", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      variazione_id: variazioneId,
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

  function aggiornaDataAtto(value: string) {
    setForm({
      ...form,
      data_atto: value,
      data_scadenza_cciaa: aggiungiGiorni(
        value,
        form.giorni_scadenza_cciaa
      ),
    });
  }

  function aggiornaGiorniCciaa(value: number) {
    setForm({
      ...form,
      giorni_scadenza_cciaa: value,
      data_scadenza_cciaa: aggiungiGiorni(form.data_atto, value),
    });
  }

  function aggiornaDataEvasioneCciaa(value: string) {
    setForm({
      ...form,
      data_evasione_cciaa: value,
      data_scadenza_ade: form.obbligo_ade
        ? aggiungiGiorni(value, form.giorni_scadenza_ade)
        : form.data_scadenza_ade,
    });
  }

  function aggiornaGiorniAde(value: number) {
    setForm({
      ...form,
      giorni_scadenza_ade: value,
      data_scadenza_ade: aggiungiGiorni(form.data_evasione_cciaa, value),
    });
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
            <button onClick={loadData} className="border px-4 py-2 rounded">
              <RefreshCw className="h-4 w-4" />
            </button>

            <button
              onClick={() => {
                setEditingId(null);
                setForm(FORM_INIZIALE);
                setShowForm(true);
              }}
              className="bg-black text-white px-4 py-2 rounded flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Nuova variazione
            </button>
          </div>
        </div>

        {showForm && (
          <div className="border rounded p-4 mb-4 bg-white space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="space-y-1 md:col-span-2">
                <label className="text-sm font-medium">Cliente</label>

                <select
                  value={form.cliente_id}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      cliente_id: e.target.value,
                    })
                  }
                  className="border p-2 rounded w-full"
                >
                  <option value="">Seleziona cliente</option>
                  {clienti.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.ragione_sociale}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1 md:col-span-2">
                <label className="text-sm font-medium">Tipo variazione</label>

                <select
                  className="border p-2 rounded w-full"
                  value={form.tipo_variazione}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      tipo_variazione: e.target.value,
                    })
                  }
                >
                  <option value="">Seleziona tipo variazione</option>
                  {tipiVariazione.map((tipo) => (
  <option key={tipo.id} value={tipo.descrizione_variazione}>
    {tipo.descrizione_variazione}
  </option>
))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Ente principale</label>

                <select
                  className="border p-2 rounded w-full"
                  value={form.ente_principale}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      ente_principale: e.target.value,
                    })
                  }
                >
                  <option value="CCIAA">Camera di Commercio</option>
                  <option value="AGENZIA_ENTRATE">Agenzia Entrate</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Priorità</label>

                <select
                  className="border p-2 rounded w-full"
                  value={form.priorita}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      priorita: e.target.value,
                    })
                  }
                >
                  <option value="normale">Normale</option>
                  <option value="alta">Alta</option>
                  <option value="urgente">Urgente</option>
                  <option value="bassa">Bassa</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Utente assegnato</label>

                <input
                  type="text"
                  className="border p-2 rounded w-full bg-gray-100"
                  value={
                    utente
                      ? [utente.nome, utente.cognome].filter(Boolean).join(" ")
                      : ""
                  }
                  disabled
                  placeholder="Utente"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">
                  Data atto / Data pratica
                </label>

                <input
                  type="date"
                  className="border p-2 rounded w-full"
                  value={form.data_atto}
                  onChange={(e) => aggiornaDataAtto(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">
                  Giorni lavorazione CCIAA
                </label>

                <input
                  type="number"
                  className="border p-2 rounded w-full"
                  value={form.giorni_scadenza_cciaa}
                  onChange={(e) =>
                    aggiornaGiorniCciaa(Number(e.target.value))
                  }
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">
                  Data scadenza CCIAA
                </label>

                <input
                  type="date"
                  className="border p-2 rounded w-full"
                  value={form.data_scadenza_cciaa}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      data_scadenza_cciaa: e.target.value,
                    })
                  }
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">
                  Data protocollazione / evasione CCIAA
                </label>

                <input
                  type="date"
                  className="border p-2 rounded w-full"
                  value={form.data_evasione_cciaa}
                  onChange={(e) => aggiornaDataEvasioneCciaa(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.obbligo_ade}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      obbligo_ade: e.target.checked,
                      data_scadenza_ade: e.target.checked
                        ? aggiungiGiorni(
                            form.data_evasione_cciaa,
                            form.giorni_scadenza_ade
                          )
                        : "",
                    })
                  }
                />
                Obbligo comunicazione Agenzia Entrate
              </label>

              <label className="flex items-center gap-2">
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
                Genera pratica / verbale
              </label>
            </div>

            {form.obbligo_ade && (
              <div className="border rounded p-3 bg-gray-50">
                <div className="font-semibold text-lg mb-3">
                  DATI AGENZIA DELLE ENTRATE
                </div>

                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                  <div className="space-y-1">
                    <label className="text-sm font-medium">
                      Giorni lavorazione AdE
                    </label>

                    <input
                      type="number"
                      className="border p-2 rounded w-full"
                      value={form.giorni_scadenza_ade}
                      onChange={(e) =>
                        aggiornaGiorniAde(Number(e.target.value))
                      }
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-sm font-medium">
                      Data scadenza AdE
                    </label>

                    <input
                      type="date"
                      className="border p-2 rounded w-full"
                      value={form.data_scadenza_ade}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          data_scadenza_ade: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-sm font-medium">
                      Data invio AdE
                    </label>

                    <input
                      type="date"
                      className="border p-2 rounded w-full"
                      value={form.data_comunicazione_ade}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          data_comunicazione_ade: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-sm font-medium">
                      Ricevuta telematica
                    </label>

                    <input
                      className="border p-2 rounded w-full"
                      placeholder="Numero / riferimento ricevuta"
                      value={form.ricevuta_telematica_ade}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          ricevuta_telematica_ade: e.target.value,
                        })
                      }
                    />
                  </div>

                  <label className="flex items-center gap-2 mt-6">
                    <input
                      type="checkbox"
                      checked={form.conferma_record}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          conferma_record: e.target.checked,
                        })
                      }
                    />
                    Conferma record AdE
                  </label>
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-sm font-medium">Note operative</label>

              <textarea
                className="border p-2 rounded w-full"
                placeholder="Annotazioni interne"
                value={form.note}
                onChange={(e) =>
                  setForm({
                    ...form,
                    note: e.target.value,
                  })
                }
              />
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <button onClick={resetForm} className="border px-4 py-2 rounded">
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
                <th className="p-2 text-left">Tipo variazione</th>
                <th className="p-2 text-left">Data atto</th>
                <th className="p-2 text-left">Scadenza CCIAA</th>
                <th className="p-2 text-left">Evasione CCIAA</th>
                <th className="p-2 text-left">Scadenza AdE</th>
                <th className="p-2 text-left">Invio AdE</th>
                <th className="p-2 text-center">Pratica collegata</th>
                <th className="p-2 text-left">Stato</th>
                <th className="p-2 text-right">Azioni</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="p-6 text-center text-gray-500">
                    Caricamento...
                  </td>
                </tr>
              ) : variazioni.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-6 text-center text-gray-500">
                    Nessuna variazione presente.
                  </td>
                </tr>
              ) : (
                variazioni.map((v) => (
                  <tr key={v.id} className="border-t">
                    <td className="p-2">{v.cliente?.ragione_sociale || "-"}</td>
                    <td className="p-2">{v.tipo_variazione || "-"}</td>
                    <td className="p-2">{v.data_atto || "-"}</td>
                    <td className="p-2">{v.data_scadenza_cciaa || "-"}</td>
                    <td className="p-2">{v.data_evasione_cciaa || "-"}</td>
                    <td className="p-2">{v.data_scadenza_ade || "-"}</td>
                    <td className="p-2">{v.data_comunicazione_ade || "-"}</td>
                    <td className="p-2 text-center">
                      {v.pratica_id ? "✓" : "-"}
                    </td>
                    <td className="p-2">{v.stato || "-"}</td>
                    <td className="p-2">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => modifica(v)} title="Modifica">
                          <Pencil className="h-4 w-4" />
                        </button>

                        <button onClick={() => elimina(v.id)} title="Elimina">
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
