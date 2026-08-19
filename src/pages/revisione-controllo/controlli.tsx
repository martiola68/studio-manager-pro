import { useEffect, useState } from "react";
import Head from "next/head";
import {
  CheckCircle,
  FileText,
  RefreshCw,
  Trash2,
  ClipboardCheck,
  Database,
} from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";

type ImportContabile = {
  id: string;
  template_id: string | null;
  software_contabile: string | null;
  nome_file: string | null;
  data_riferimento: string | null;

  numero_conti: number | null;
  conti_mappati: number | null;
  conti_da_mappare: number | null;

  stato: string | null;
  created_at: string | null;
};

type Controllo = {
  id: string;
  incarico_id: string;
  studio_id: string;
  cliente_id: string;
  ragione_sociale: string;
  tipo_incarico: string;
  anno: number;
  trimestre: number;
  data_scadenza: string;
  data_controllo: string | null;
  stato: string;
  esito: string | null;
  note: string | null;
  controllo_gestione_import_id:
  | string
  | null;

import_contabile:
  | ImportContabile
  | null;
};

const TIPI_LABEL: Record<string, string> = {
  REVISIONE_LEGALE: "Revisione legale",
  SOCIETA_REVISIONE: "Società di revisione",
  SINDACO_UNICO: "Sindaco unico",
  COLLEGIO_SINDACALE: "Collegio sindacale",
  ORGANO_UNICO_DOPPIA_FUNZIONE: "Organo unico doppia funzione",
  SINDACO_COLLEGIO_PIU_REVISORE: "Sindaco/Collegio + Revisore",
};

function formatDateIT(value?: string | null) {
  if (!value) return "-";
  return new Date(`${value}T00:00:00`).toLocaleDateString("it-IT");
}

function statoClass(stato: string) {
  if (stato === "COMPLETATO") return "bg-green-100 text-green-700";
  if (stato === "IN_LAVORAZIONE") return "bg-blue-100 text-blue-700";
  if (stato === "SCADUTO") return "bg-red-100 text-red-700";
  return "bg-yellow-100 text-yellow-800";
}

export default function RevisioneControlliPage() {
  const now = new Date();

  const [studioId, setStudioId] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  const [controlli, setControlli] = useState<Controllo[]>([]);

  const [anno, setAnno] = useState(String(now.getFullYear()));
  const [trimestre, setTrimestre] = useState("");
  const [stato, setStato] = useState("");
  const [clienteFiltro, setClienteFiltro] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [selected, setSelected] = useState<Controllo | null>(null);
const [modalOpen, setModalOpen] = useState(false);

const [dataControllo, setDataControllo] = useState("");
const [esito, setEsito] = useState("");
const [note, setNote] = useState("");

 const [
  importModalOpen,
  setImportModalOpen,
] = useState(false);

const [
  importDisponibili,
  setImportDisponibili,
] = useState<ImportContabile[]>([]);

const [
  importSelezionatoId,
  setImportSelezionatoId,
] = useState("");

const [
  loadingImport,
  setLoadingImport,
] = useState(false);

  async function loadCurrentUser() {
    const supabase = getSupabaseClient();

    const {
      data: { session },
    } = await supabase.auth.getSession();

    const email = session?.user?.email;
    if (!email) throw new Error("Sessione non trovata.");

    const { data, error } = await supabase
      .from("tbutenti")
      .select("id, studio_id")
      .eq("email", email)
      .single();

    if (error) throw error;
    if (!data?.studio_id) throw new Error("Studio utente non trovato.");

    setStudioId(data.studio_id);
    setCurrentUserId(data.id);

    return data;
  }

  async function loadControlli() {
    try {
      setLoading(true);
      setError("");
      setSuccess("");

     const user =
  studioId && currentUserId
    ? { studio_id: studioId, id: currentUserId }
    : await loadCurrentUser();

if (!user.studio_id) {
  throw new Error("Studio utente non trovato.");
}

const params = new URLSearchParams();
params.set("studio_id", String(user.studio_id));

      if (anno) params.set("anno", anno);
      if (trimestre) params.set("trimestre", trimestre);
      if (stato) params.set("stato", stato);
      if (clienteFiltro) params.set("cliente_id", clienteFiltro);

      const res = await fetch(`/api/revisione-controllo/controlli?${params.toString()}`);
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || "Errore caricamento controlli.");
      }

      setControlli(json.data || []);
    } catch (err: any) {
      setError(err?.message || "Errore caricamento controlli.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadControlli();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anno, trimestre, stato, clienteFiltro]);

  function apriCompleta(item: Controllo) {
    setSelected(item);
    setDataControllo(item.data_controllo || new Date().toISOString().slice(0, 10));
    setEsito(item.esito || "");
    setNote(item.note || "");
    setModalOpen(true);
  }

  async function apriImportContabile(
  item: Controllo
) {
  try {
    setSelected(item);

    setImportSelezionatoId(
      item.controllo_gestione_import_id ||
        ""
    );

    setImportDisponibili([]);
    setError("");
    setSuccess("");
    setLoadingImport(true);

    const params =
      new URLSearchParams();

    params.set(
      "azione",
      "import_disponibili"
    );

    params.set(
      "studio_id",
      item.studio_id
    );

    params.set(
      "cliente_id",
      item.cliente_id
    );

    params.set(
      "anno",
      String(item.anno)
    );

    params.set(
      "trimestre",
      String(item.trimestre)
    );

    const res =
      await fetch(
        `/api/revisione-controllo/controlli?${params.toString()}`
      );

    const json =
      await res.json();

    if (
      !res.ok ||
      !json.success
    ) {
      throw new Error(
        json.error ||
          "Errore caricamento import contabili."
      );
    }

    setImportDisponibili(
      json.data || []
    );

    setImportModalOpen(true);
  } catch (err: any) {
    setError(
      err?.message ||
        "Errore caricamento import contabili."
    );
  } finally {
    setLoadingImport(false);
  }
}

  function vaiImportazioneContabile(
  item: Controllo
) {
  const params =
    new URLSearchParams();

  params.set(
    "origine",
    "revisione"
  );

  params.set(
    "cliente_id",
    item.cliente_id
  );

  params.set(
    "controllo_id",
    item.id
  );

  params.set(
    "anno",
    String(item.anno)
  );

  params.set(
    "trimestre",
    String(item.trimestre)
  );

  params.set(
    "return_to",
    `/revisione-controllo/controlli?anno=${item.anno}`
  );

  window.location.href =
    `/controllo-gestione/import-contabilita?${params.toString()}`;
}

  async function salvaImportContabile() {
  if (!selected) return;

  try {
    setSaving(true);
    setError("");
    setSuccess("");

    const res =
      await fetch(
        "/api/revisione-controllo/controlli",
        {
          method: "PUT",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            id: selected.id,

            controllo_gestione_import_id:
              importSelezionatoId ||
              null,
          }),
        }
      );

    const json =
      await res.json();

    if (
      !res.ok ||
      !json.success
    ) {
      throw new Error(
        json.error ||
          "Errore collegamento situazione contabile."
      );
    }

    setSuccess(
      importSelezionatoId
        ? "Situazione contabile collegata al controllo."
        : "Collegamento alla situazione contabile rimosso."
    );

    setImportModalOpen(false);
    setSelected(null);

    await loadControlli();
  } catch (err: any) {
    setError(
      err?.message ||
        "Errore collegamento situazione contabile."
    );
  } finally {
    setSaving(false);
  }
}

  async function salvaCompletamento() {
    if (!selected) return;

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const res = await fetch("/api/revisione-controllo/controlli", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selected.id,
          stato: "COMPLETATO",
          data_controllo: dataControllo,
          esito,
          note,
          completato_da: currentUserId || null,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || "Errore completamento controllo.");
      }

      setSuccess("Controllo completato correttamente.");
      setModalOpen(false);
      setSelected(null);
      await loadControlli();
    } catch (err: any) {
      setError(err?.message || "Errore completamento controllo.");
    } finally {
      setSaving(false);
    }
  }

  async function eliminaControllo(id: string) {
    const ok = window.confirm("Confermi l'eliminazione del controllo trimestrale?");
    if (!ok) return;

    try {
      setError("");
      setSuccess("");

      const res = await fetch(`/api/revisione-controllo/controlli?id=${id}`, {
        method: "DELETE",
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || "Errore eliminazione controllo.");
      }

      setSuccess("Controllo eliminato.");
      await loadControlli();
    } catch (err: any) {
      setError(err?.message || "Errore eliminazione controllo.");
    }
  }

  return (
    <>
      <Head>
        <title>Controlli trimestrali - Revisione</title>
      </Head>

      <div className="mx-auto max-w-[1700px] p-6">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Controlli trimestrali</h1>
            <p className="text-sm text-gray-500">
              Gestione operativa dei controlli trimestrali di revisione e controllo societario.
            </p>
          </div>

          <button
            onClick={loadControlli}
            className="inline-flex items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm hover:bg-gray-50"
          >
            <RefreshCw size={16} />
            Aggiorna
          </button>
        </div>

        <div className="mb-4 grid grid-cols-1 gap-3 rounded-lg border bg-white p-4 md:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Anno</label>
            <select
              value={anno}
              onChange={(e) => setAnno(e.target.value)}
              className="h-10 w-full rounded-md border px-3 text-sm"
            >
              {Array.from({ length: 5 }, (_, i) => now.getFullYear() - 1 + i).map((y) => (
                <option key={y} value={String(y)}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Trimestre</label>
            <select
              value={trimestre}
              onChange={(e) => setTrimestre(e.target.value)}
              className="h-10 w-full rounded-md border px-3 text-sm"
            >
              <option value="">Tutti</option>
              <option value="1">1° trimestre</option>
              <option value="2">2° trimestre</option>
              <option value="3">3° trimestre</option>
              <option value="4">4° trimestre</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Stato</label>
            <select
              value={stato}
              onChange={(e) => setStato(e.target.value)}
              className="h-10 w-full rounded-md border px-3 text-sm"
            >
              <option value="">Tutti</option>
              <option value="DA_FARE">Da fare</option>
              <option value="IN_LAVORAZIONE">In lavorazione</option>
              <option value="COMPLETATO">Completato</option>
              <option value="SCADUTO">Scaduto</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">
              Cliente ID
            </label>
            <input
              value={clienteFiltro}
              onChange={(e) => setClienteFiltro(e.target.value)}
              placeholder="Filtro tecnico cliente_id"
              className="h-10 w-full rounded-md border px-3 text-sm"
            />
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

        <div className="overflow-hidden rounded-lg border bg-white">
          {loading ? (
            <div className="p-8 text-center text-sm text-gray-500">
              Caricamento controlli...
            </div>
          ) : controlli.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-500">
              Nessun controllo trovato.
            </div>
          ) : (
            <div className="overflow-auto">
              <table className="w-full min-w-[1300px] text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-3 text-left">Società</th>
                    <th className="p-3 text-left">Tipo incarico</th>
                    <th className="p-3 text-center">Anno</th>
                    <th className="p-3 text-center">Trimestre</th>
                    <th className="p-3 text-center">
                      Dati contabili
                      </th>
                    <th className="p-3 text-center">Scadenza</th>
                    <th className="p-3 text-center">Stato</th>
                    <th className="p-3 text-center">Data controllo</th>
                    <th className="p-3 text-left">Esito</th>
                    <th className="p-3 text-center">Azioni</th>
                  </tr>
                </thead>

                <tbody>
                  {controlli.map((item) => (
                    <tr key={item.id} className="border-t hover:bg-gray-50">
                      <td className="p-3 font-medium">{item.ragione_sociale}</td>
                      <td className="p-3">
                        {TIPI_LABEL[item.tipo_incarico] || item.tipo_incarico}
                      </td>
                      <td className="p-3 text-center">{item.anno}</td>
                      <td className="p-3 text-center">{item.trimestre}°</td>
                      <td className="p-3 text-center">
  {item.import_contabile ? (
    <div className="flex flex-col items-center gap-1">
      <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-700">
        Collegata
      </span>

      <span className="text-[11px] text-gray-500">
        {formatDateIT(
          item.import_contabile
            .data_riferimento
        )}
      </span>
    </div>
  ) : (
  <span className="rounded-full bg-yellow-100 px-2 py-1 text-xs font-semibold text-yellow-800">
  Da importare
</span>
  )}
</td>
                      <td className="p-3 text-center">{formatDateIT(item.data_scadenza)}</td>
                      <td className="p-3 text-center">
                        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statoClass(item.stato)}`}>
                          {item.stato}
                        </span>
                      </td>
                      <td className="p-3 text-center">{formatDateIT(item.data_controllo)}</td>
                      <td className="p-3">{item.esito || "-"}</td>

                      <td className="p-3">
                        <div className="flex justify-center gap-2">
                          <button
                            title="Completa controllo"
                            onClick={() => apriCompleta(item)}
                            className="rounded-md border bg-white p-2 text-green-700 hover:bg-green-50"
                          >
                            <CheckCircle size={16} />
                          </button>
<button
  title={
    item.import_contabile
      ? "Gestisci situazione contabile"
      : "Importa situazione contabile"
  }
  onClick={() => {
    if (item.import_contabile) {
      void apriImportContabile(
        item
      );
      return;
    }

    vaiImportazioneContabile(
      item
    );
  }}
  className={
    item.import_contabile
      ? "rounded-md border bg-white p-2 text-slate-700 hover:bg-slate-50"
      : "rounded-md border border-blue-300 bg-blue-50 p-2 text-blue-700 hover:bg-blue-100"
  }
>
  <Database size={16} />
</button>

                          <button
                            title="Checklist"
                              onClick={() => {
                              window.location.href = `/revisione-controllo/checklist?controllo_id=${item.id}`;
                              }}
                              className="rounded-md border bg-white p-2 text-purple-700 hover:bg-purple-50"
                              >
                              <ClipboardCheck size={16} />
                            </button>

                          <button
                            title="Relazione"
                            onClick={() => {
                              window.location.href = `/revisione-controllo/relazioni?controllo_id=${item.id}`;
                            }}
                            className="rounded-md border bg-white p-2 text-blue-700 hover:bg-blue-50"
                          >
                            <FileText size={16} />
                          </button>

                          <button
                            title="Elimina"
                            onClick={() => eliminaControllo(item.id)}
                            className="rounded-md border bg-white p-2 text-red-600 hover:bg-red-50"
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

      {modalOpen && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-lg">
            <h2 className="mb-4 text-xl font-semibold">
              Completa controllo - {selected.ragione_sociale}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">
                  Data controllo
                </label>
                <input
                  type="date"
                  value={dataControllo}
                  onChange={(e) => setDataControllo(e.target.value)}
                  className="h-10 w-full rounded-md border px-3 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">
                  Esito controllo
                </label>
                <textarea
                  value={esito}
                  onChange={(e) => setEsito(e.target.value)}
                  rows={4}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="Esito sintetico del controllo..."
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">
                  Note interne
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={4}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="Note operative..."
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setModalOpen(false)}
                disabled={saving}
                className="rounded-md border bg-white px-4 py-2 text-sm hover:bg-gray-50"
              >
                Annulla
              </button>

              <button
                onClick={salvaCompletamento}
                disabled={saving}
                className="rounded-md bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700 disabled:opacity-50"
              >
                {saving ? "Salvataggio..." : "Completa controllo"}
              </button>
            </div>
          </div>
        </div>
      )}
      {importModalOpen && selected && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
    <div className="w-full max-w-3xl rounded-lg bg-white p-6 shadow-lg">
      <div className="mb-5">
        <h2 className="text-xl font-semibold">
          Situazione contabile
        </h2>

        <p className="mt-1 text-sm text-gray-500">
          {selected.ragione_sociale}
          {" · "}
          {selected.trimestre}° trimestre
          {" · "}
          {selected.anno}
        </p>
      </div>

      {loadingImport ? (
        <div className="py-8 text-center text-sm text-gray-500">
          Caricamento situazioni contabili...
        </div>
      ) : (
        <>
          <label className="mb-1 block text-xs font-medium text-gray-500">
            Situazione contabile da utilizzare
          </label>

          <select
            value={importSelezionatoId}
            onChange={(e) =>
              setImportSelezionatoId(
                e.target.value
              )
            }
            className="h-11 w-full rounded-md border px-3 text-sm"
          >
            <option value="">
              Nessuna situazione collegata
            </option>

            {importDisponibili.map(
              (item) => (
                <option
                  key={item.id}
                  value={item.id}
                >
                  {formatDateIT(
                    item.data_riferimento
                  )}
                  {" · "}
                  {item.software_contabile ||
                    "Software"}
                  {" · "}
                  {item.numero_conti || 0} conti
                  {" · "}
                  {item.stato || "-"}
                </option>
              )
            )}
          </select>

          {importDisponibili.length === 0 && (
            <div className="mt-4 rounded-md border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
              Non risulta una situazione contabile importata
              per questo trimestre.
            </div>
          )}

          {importSelezionatoId && (
            <div className="mt-4 rounded-lg border bg-gray-50 p-4">
              {(() => {
                const imp =
                  importDisponibili.find(
                    (x) =>
                      x.id ===
                      importSelezionatoId
                  );

                if (!imp) return null;

                return (
                  <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
                    <div>
                      <div className="text-xs text-gray-500">
                        Data
                      </div>
                      <div className="font-semibold">
                        {formatDateIT(
                          imp.data_riferimento
                        )}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-gray-500">
                        Conti
                      </div>
                      <div className="font-semibold">
                        {imp.numero_conti || 0}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-gray-500">
                        Mappati
                      </div>
                      <div className="font-semibold">
                        {imp.conti_mappati || 0}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-gray-500">
                        Da mappare
                      </div>

                      <div
                        className={
                          Number(
                            imp.conti_da_mappare ||
                              0
                          ) === 0
                            ? "font-semibold text-green-700"
                            : "font-semibold text-red-700"
                        }
                      >
                        {imp.conti_da_mappare || 0}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </>
      )}

     <div className="mt-5 flex flex-wrap justify-between gap-2">
 <button
  type="button"
  onClick={() =>
    vaiImportazioneContabile(
      selected
    )
  }
  className="rounded-md border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
>
  Importa nuova situazione
</button>

  <div className="flex gap-2">
    <button
      onClick={() =>
        setImportModalOpen(false)
      }
      disabled={saving}
      className="rounded-md border bg-white px-4 py-2 text-sm hover:bg-gray-50"
    >
      Annulla
    </button>

   <button
  onClick={
    salvaImportContabile
  }
  disabled={
    saving ||
    selected?.controllo_gestione_import_id ===
      importSelezionatoId
  }
  className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
>
  {saving
    ? "Salvataggio..."
    : selected?.controllo_gestione_import_id ===
        importSelezionatoId
      ? "Situazione già collegata"
      : "Collega situazione"}
</button>
  </div>
</div>
    </div>
  </div>
)}
    </>
  );
}
