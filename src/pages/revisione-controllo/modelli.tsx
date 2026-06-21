import { useEffect, useState } from "react";
import Head from "next/head";
import { Plus, Save, Trash2, Pencil, RefreshCw } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";

type Modello = {
  id: string;
  studio_id: string;
  codice: string;
  titolo: string;
  tipo_incarico: string | null;
  testo: string;
  attivo: boolean;
};

const TIPI_INCARICO = [
  { value: "", label: "Tutti i tipi incarico" },
  { value: "REVISIONE_LEGALE", label: "Revisione legale" },
  { value: "SOCIETA_REVISIONE", label: "Società di revisione" },
  { value: "SINDACO_UNICO", label: "Sindaco unico" },
  { value: "COLLEGIO_SINDACALE", label: "Collegio sindacale" },
  { value: "ORGANO_UNICO_DOPPIA_FUNZIONE", label: "Organo unico doppia funzione" },
  { value: "SINDACO_COLLEGIO_PIU_REVISORE", label: "Sindaco/Collegio + Revisore" },
];

const VARIABILI = [
  "[CLIENTE]",
  "[CODICE_FISCALE]",
  "[PARTITA_IVA]",
  "[SEDE]",
  "[TIPO_INCARICO]",
  "[TRIMESTRE]",
  "[ANNO]",
  "[DATA_SCADENZA]",
  "[DATA_CONTROLLO]",
  "[ESITO_CONTROLLO]",
  "[NOTE_CONTROLLO]",
  "[REVISORE]",
  "[SINDACO_UNICO]",
  "[PRESIDENTE_COLLEGIO]",
  "[SINDACI_EFFETTIVI]",
  "[SINDACI_SUPPLENTI]",
];

const EMPTY_MODELLO = {
  id: "",
  studio_id: "",
  codice: "",
  titolo: "",
  tipo_incarico: "",
  testo: "",
  attivo: true,
};

export default function ModelliRevisionePage() {
  const [studioId, setStudioId] = useState("");
  const [modelli, setModelli] = useState<Modello[]>([]);
  const [form, setForm] = useState<any>(EMPTY_MODELLO);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadCurrentUser() {
    const supabase = getSupabaseClient();

    const {
      data: { session },
    } = await supabase.auth.getSession();

    const email = session?.user?.email;
    if (!email) throw new Error("Sessione non trovata.");

    const { data, error } = await supabase
      .from("tbutenti")
      .select("studio_id")
      .eq("email", email)
      .single();

    if (error) throw error;
    if (!data?.studio_id) throw new Error("Studio utente non trovato.");

    setStudioId(data.studio_id);
    return data.studio_id as string;
  }

  async function loadModelli(studio?: string) {
    try {
      setLoading(true);
      setError("");
      setSuccess("");

      const sid = studio || studioId || (await loadCurrentUser());

      const res = await fetch(
        `/api/revisione-controllo/modelli?studio_id=${sid}`
      );
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || "Errore caricamento modelli.");
      }

      setModelli(json.data || []);
    } catch (err: any) {
      setError(err?.message || "Errore caricamento modelli.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadModelli();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function nuovoModello() {
    setForm({
      ...EMPTY_MODELLO,
      studio_id: studioId,
      attivo: true,
    });
    setSuccess("");
    setError("");
  }

  function modificaModello(item: Modello) {
    setForm({
      id: item.id,
      studio_id: item.studio_id,
      codice: item.codice,
      titolo: item.titolo,
      tipo_incarico: item.tipo_incarico || "",
      testo: item.testo,
      attivo: item.attivo !== false,
    });
    setSuccess("");
    setError("");
  }

  async function salvaModello() {
    try {
      setSaving(true);
      setError("");
      setSuccess("");

      if (!studioId) throw new Error("Studio non trovato.");
      if (!form.codice) throw new Error("Codice modello obbligatorio.");
      if (!form.titolo) throw new Error("Titolo modello obbligatorio.");
      if (!form.testo) throw new Error("Testo modello obbligatorio.");

      const res = await fetch("/api/revisione-controllo/modelli", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: form.id || null,
          studio_id: studioId,
          codice: form.codice,
          titolo: form.titolo,
          tipo_incarico: form.tipo_incarico || null,
          testo: form.testo,
          attivo: form.attivo !== false,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || "Errore salvataggio modello.");
      }

      setSuccess("Modello salvato correttamente.");
      setForm({
        ...EMPTY_MODELLO,
        studio_id: studioId,
      });
      await loadModelli(studioId);
    } catch (err: any) {
      setError(err?.message || "Errore salvataggio modello.");
    } finally {
      setSaving(false);
    }
  }

  async function eliminaModello(id: string) {
    const ok = window.confirm("Confermi l'eliminazione del modello?");
    if (!ok) return;

    try {
      setError("");
      setSuccess("");

      const res = await fetch(`/api/revisione-controllo/modelli?id=${id}`, {
        method: "DELETE",
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || "Errore eliminazione modello.");
      }

      setSuccess("Modello eliminato.");
      await loadModelli(studioId);
    } catch (err: any) {
      setError(err?.message || "Errore eliminazione modello.");
    }
  }

  function inserisciVariabile(variable: string) {
    setForm((prev: any) => ({
      ...prev,
      testo: `${prev.testo || ""}${prev.testo ? " " : ""}${variable}`,
    }));
  }

  return (
    <>
      <Head>
        <title>Modelli revisione</title>
      </Head>

      <div className="mx-auto max-w-[1600px] p-6">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Modelli relazioni revisione</h1>
            <p className="text-sm text-gray-500">
              Gestione testi modello per verbali e relazioni con stampa unione.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => loadModelli(studioId)}
              className="inline-flex items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm hover:bg-gray-50"
            >
              <RefreshCw size={16} />
              Aggiorna
            </button>

            <button
              onClick={nuovoModello}
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700"
            >
              <Plus size={16} />
              Nuovo modello
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {success}
          </div>
        )}

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[480px_1fr]">
          <div className="rounded-lg border bg-white p-5">
            <h2 className="mb-4 text-lg font-semibold">
              {form.id ? "Modifica modello" : "Nuovo modello"}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">
                  Codice
                </label>
                <input
                  value={form.codice}
                  onChange={(e) =>
                    setForm((prev: any) => ({
                      ...prev,
                      codice: e.target.value.toUpperCase().replace(/\s+/g, "_"),
                    }))
                  }
                  placeholder="VERBALE_SINDACO_UNICO_TRIMESTRALE"
                  className="h-10 w-full rounded-md border px-3 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">
                  Titolo
                </label>
                <input
                  value={form.titolo}
                  onChange={(e) =>
                    setForm((prev: any) => ({ ...prev, titolo: e.target.value }))
                  }
                  placeholder="Verbale sindaco unico trimestrale"
                  className="h-10 w-full rounded-md border px-3 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">
                  Tipo incarico
                </label>
                <select
                  value={form.tipo_incarico || ""}
                  onChange={(e) =>
                    setForm((prev: any) => ({
                      ...prev,
                      tipo_incarico: e.target.value,
                    }))
                  }
                  className="h-10 w-full rounded-md border px-3 text-sm"
                >
                  {TIPI_INCARICO.map((t) => (
                    <option key={t.value || "ALL"} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="attivo"
                  type="checkbox"
                  checked={form.attivo}
                  onChange={(e) =>
                    setForm((prev: any) => ({
                      ...prev,
                      attivo: e.target.checked,
                    }))
                  }
                />
                <label htmlFor="attivo" className="text-sm">
                  Modello attivo
                </label>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">
                  Testo modello
                </label>
                <textarea
                  value={form.testo}
                  onChange={(e) =>
                    setForm((prev: any) => ({ ...prev, testo: e.target.value }))
                  }
                  rows={18}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="Inserisci il testo con variabili, ad esempio [CLIENTE], [TRIMESTRE], [ANNO]..."
                />
              </div>

              <button
                onClick={salvaModello}
                disabled={saving}
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <Save size={16} />
                {saving ? "Salvataggio..." : "Salva modello"}
              </button>
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-lg border bg-white p-5">
              <h2 className="mb-3 text-lg font-semibold">Variabili disponibili</h2>

              <div className="flex flex-wrap gap-2">
                {VARIABILI.map((v) => (
                  <button
                    key={v}
                    onClick={() => inserisciVariabile(v)}
                    className="rounded-md border bg-gray-50 px-2 py-1 text-xs hover:bg-blue-50 hover:text-blue-700"
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border bg-white">
              <div className="border-b p-4">
                <h2 className="text-lg font-semibold">Archivio modelli</h2>
              </div>

              {loading ? (
                <div className="p-8 text-center text-sm text-gray-500">
                  Caricamento modelli...
                </div>
              ) : modelli.length === 0 ? (
                <div className="p-8 text-center text-sm text-gray-500">
                  Nessun modello trovato.
                </div>
              ) : (
                <div className="overflow-auto">
                  <table className="w-full min-w-[900px] text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="p-3 text-left">Codice</th>
                        <th className="p-3 text-left">Titolo</th>
                        <th className="p-3 text-left">Tipo incarico</th>
                        <th className="p-3 text-center">Attivo</th>
                        <th className="p-3 text-center">Azioni</th>
                      </tr>
                    </thead>

                    <tbody>
                      {modelli.map((m) => (
                        <tr key={m.id} className="border-t hover:bg-gray-50">
                          <td className="p-3 font-mono text-xs">{m.codice}</td>
                          <td className="p-3 font-medium">{m.titolo}</td>
                          <td className="p-3">{m.tipo_incarico || "Tutti"}</td>
                          <td className="p-3 text-center">
                            <span
                              className={`rounded-full px-2 py-1 text-xs font-semibold ${
                                m.attivo
                                  ? "bg-green-100 text-green-700"
                                  : "bg-gray-100 text-gray-600"
                              }`}
                            >
                              {m.attivo ? "Sì" : "No"}
                            </span>
                          </td>
                          <td className="p-3">
                            <div className="flex justify-center gap-2">
                              <button
                                onClick={() => modificaModello(m)}
                                className="rounded-md border bg-white p-2 hover:bg-gray-50"
                                title="Modifica"
                              >
                                <Pencil size={16} />
                              </button>

                              <button
                                onClick={() => eliminaModello(m.id)}
                                className="rounded-md border bg-white p-2 text-red-600 hover:bg-red-50"
                                title="Elimina"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
