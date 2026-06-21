import { useEffect, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { FileText, Save, ArrowLeft } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";

type Modello = {
  id: string;
  codice: string;
  titolo: string;
  tipo_incarico: string | null;
  testo: string;
  attivo: boolean;
};

type Controllo = {
  id: string;
  incarico_id: string;
  ragione_sociale: string;
  tipo_incarico: string;
  anno: number;
  trimestre: number;
  data_scadenza: string;
  data_controllo: string | null;
  stato: string;
  esito: string | null;
  note: string | null;
};

function formatDateIT(value?: string | null) {
  if (!value) return "-";
  return new Date(`${value}T00:00:00`).toLocaleDateString("it-IT");
}

export default function RelazioniRevisionePage() {
  const router = useRouter();
  const controlloId =
    typeof router.query.controllo_id === "string" ? router.query.controllo_id : "";

  const [studioId, setStudioId] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");

  const [controllo, setControllo] = useState<Controllo | null>(null);
  const [modelli, setModelli] = useState<Modello[]>([]);
  const [modelloId, setModelloId] = useState("");

  const [testoGenerato, setTestoGenerato] = useState("");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
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
      .select("id, studio_id")
      .eq("email", email)
      .single();

    if (error) throw error;
    if (!data?.studio_id) throw new Error("Studio utente non trovato.");

    setStudioId(data.studio_id);
    setCurrentUserId(data.id);

    return data;
  }

  async function loadData() {
    try {
      setLoading(true);
      setError("");
      setSuccess("");

      const user = await loadCurrentUser();

      const modelliRes = await fetch(
        `/api/revisione-controllo/modelli?studio_id=${user.studio_id}&attivo=true`
      );
      const modelliJson = await modelliRes.json();

      if (!modelliRes.ok || !modelliJson.success) {
        throw new Error(modelliJson.error || "Errore caricamento modelli.");
      }

      setModelli(modelliJson.data || []);

      if (controlloId) {
        const controlliRes = await fetch(
          `/api/revisione-controllo/controlli?studio_id=${user.studio_id}`
        );
        const controlliJson = await controlliRes.json();

        if (!controlliRes.ok || !controlliJson.success) {
          throw new Error(controlliJson.error || "Errore caricamento controllo.");
        }

        const found = (controlliJson.data || []).find(
          (c: Controllo) => c.id === controlloId
        );

        if (!found) {
          throw new Error("Controllo non trovato.");
        }

        setControllo(found);
      }
    } catch (err: any) {
      setError(err?.message || "Errore caricamento pagina.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (router.isReady) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, controlloId]);

  async function generaRelazione() {
    try {
      setGenerating(true);
      setError("");
      setSuccess("");

      if (!controlloId) throw new Error("controllo_id mancante.");
      if (!modelloId) throw new Error("Seleziona un modello.");

      const res = await fetch("/api/revisione-controllo/genera-relazione", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          controllo_id: controlloId,
          modello_id: modelloId,
          generata_da: currentUserId || null,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || "Errore generazione relazione.");
      }

      setTestoGenerato(json.testo_generato || "");
      setSuccess("Relazione generata e salvata correttamente.");
    } catch (err: any) {
      setError(err?.message || "Errore generazione relazione.");
    } finally {
      setGenerating(false);
    }
  }

  function scaricaTxt() {
    const blob = new Blob([testoGenerato], {
      type: "text/plain;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `relazione_revisione_${controllo?.ragione_sociale || "cliente"}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  }

  const modelliFiltrati = modelli.filter((m) => {
    if (!controllo) return true;
    if (!m.tipo_incarico) return true;
    return m.tipo_incarico === controllo.tipo_incarico;
  });

  return (
    <>
      <Head>
        <title>Relazioni Revisione e Controllo</title>
      </Head>

      <div className="mx-auto max-w-[1400px] p-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Relazioni / Verbali</h1>
            <p className="text-sm text-gray-500">
              Generazione documenti da modelli con stampa unione.
            </p>
          </div>

          <button
            onClick={() => router.push("/revisione-controllo/controlli")}
            className="inline-flex items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm hover:bg-gray-50"
          >
            <ArrowLeft size={16} />
            Indietro
          </button>
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

        {loading ? (
          <div className="rounded-lg border bg-white p-8 text-center text-sm text-gray-500">
            Caricamento...
          </div>
        ) : (
          <div className="space-y-5">
            {controllo && (
              <div className="rounded-lg border bg-white p-5">
                <h2 className="mb-3 text-lg font-semibold">Controllo selezionato</h2>

                <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-4">
                  <div>
                    <div className="text-xs text-gray-500">Società</div>
                    <div className="font-medium">{controllo.ragione_sociale}</div>
                  </div>

                  <div>
                    <div className="text-xs text-gray-500">Anno / trimestre</div>
                    <div className="font-medium">
                      {controllo.anno} - {controllo.trimestre}°
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-gray-500">Scadenza</div>
                    <div className="font-medium">
                      {formatDateIT(controllo.data_scadenza)}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-gray-500">Data controllo</div>
                    <div className="font-medium">
                      {formatDateIT(controllo.data_controllo)}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-lg border bg-white p-5">
              <h2 className="mb-4 text-lg font-semibold">Genera relazione</h2>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto]">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">
                    Modello
                  </label>
                  <select
                    value={modelloId}
                    onChange={(e) => setModelloId(e.target.value)}
                    className="h-10 w-full rounded-md border px-3 text-sm"
                  >
                    <option value="">Seleziona modello</option>
                    {modelliFiltrati.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.titolo} ({m.codice})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-end">
                  <button
                    onClick={generaRelazione}
                    disabled={generating}
                    className="inline-flex h-10 items-center gap-2 rounded-md bg-blue-600 px-4 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    <FileText size={16} />
                    {generating ? "Generazione..." : "Genera"}
                  </button>
                </div>
              </div>
            </div>

            {testoGenerato && (
              <div className="rounded-lg border bg-white p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Testo generato</h2>

                  <button
                    onClick={scaricaTxt}
                    className="inline-flex items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm hover:bg-gray-50"
                  >
                    <Save size={16} />
                    Scarica TXT
                  </button>
                </div>

                <textarea
                  value={testoGenerato}
                  onChange={(e) => setTestoGenerato(e.target.value)}
                  rows={20}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                />
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
