import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { getStudioId } from "@/services/getStudioId";

type ClienteOption = {
  id: string;
  ragione_sociale?: string | null;
  cod_cliente?: string | null;
};

type SocietaOption = {
  id: string;
  Denominazione: string;
};

type OperatoreOption = {
  id: string;
  nome?: string | null;
  cognome?: string | null;
  email?: string | null;
};

type PrestazioneOption = {
  id: number;
  TipoPrestazioneAR?: string | null;
  RischioTipoPrestAR?: string | null;
  PunteggioPrestAR?: number | null;
};

export default function NuovaPraticaAMLPage() {
const router = useRouter();

const preselectedSocietaId =
  typeof router.query.societa_id === "string"
    ? router.query.societa_id
    : "";

const societaBloccata = !!preselectedSocietaId;
const preselectedClienteId = typeof router.query.cliente_id === "string" ? router.query.cliente_id : "";
const clienteBloccato = !!preselectedClienteId;

  const [clienti, setClienti] = useState<ClienteOption[]>([]);
  const [societaOptions, setSocietaOptions] = useState<SocietaOption[]>([]);
  const [operatori, setOperatori] = useState<OperatoreOption[]>([]);
  const [prestazioni, setPrestazioni] = useState<PrestazioneOption[]>([]);
  const [incarichiEsistenti, setIncarichiEsistenti] = useState<Array<{id: string;tipo_prestazione: string | null;data_apertura: string | null;stato: string | null;}>>([]);

  const [clienteId, setClienteId] = useState("");
  const [societaId, setSocietaId] = useState("");
  const [operatoreResponsabileId, setOperatoreResponsabileId] = useState("");
  const [tipoPrestazione, setTipoPrestazione] = useState("");
  const [dataApertura, setDataApertura] = useState(
    new Date().toISOString().slice(0, 10)
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const getPrestazioneLabel = (prestazione: PrestazioneOption) => {
    return prestazione.TipoPrestazioneAR || String(prestazione.id);
  };

  const getOperatoreLabel = (op: OperatoreOption) => {
    const nomeCompleto = [op.cognome, op.nome].filter(Boolean).join(" ");
    return op.email ? `${nomeCompleto || op.id} (${op.email})` : nomeCompleto || op.id;
  };

  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);

        const supabase = getSupabaseClient();
        const supabaseAny = supabase as any;
        const studioId = await getStudioId();

        if (!studioId) {
          alert("Studio non trovato.");
          return;
        }

        const preselectedSocietaId =
          typeof router.query.societa_id === "string"
            ? router.query.societa_id
            : "";

        if (preselectedSocietaId) {
          setSocietaId(preselectedSocietaId);
        }
        const requestedClienteId = typeof router.query.cliente_id === "string" ? router.query.cliente_id : "";
        if (requestedClienteId) setClienteId(requestedClienteId);

        const { data: clientiData, error: clientiError } = await supabaseAny
          .from("tbclienti")
          .select("id, ragione_sociale, cod_cliente")
          .eq("studio_id", studioId)
          .order("ragione_sociale", { ascending: true });

        if (clientiError) {
          throw new Error(clientiError.message || "Errore caricamento clienti.");
        }

        const { data: societaData, error: societaError } = await supabaseAny
          .from("tbRespAVSocieta")
          .select("id, Denominazione")
          .eq("studio_id", studioId)
          .order("Denominazione", { ascending: true });

        if (societaError) {
          throw new Error(societaError.message || "Errore caricamento società.");
        }

        const { data: operatoriData, error: operatoriError } = await supabaseAny
          .from("tbutenti")
          .select("id, nome, cognome, email")
          .order("cognome", { ascending: true });

        if (operatoriError) {
          throw new Error(operatoriError.message || "Errore caricamento operatori.");
        }

        const { data: prestazioniData, error: prestazioniError } =
          await supabaseAny
            .from("tbElencoPrestAR")
            .select("id, TipoPrestazioneAR, RischioTipoPrestAR, PunteggioPrestAR")
            .order("TipoPrestazioneAR", { ascending: true });

        if (prestazioniError) {
          throw new Error(
            prestazioniError.message || "Errore caricamento prestazioni."
          );
        }

        if (requestedClienteId && !(clientiData || []).some((c: any) => c.id === requestedClienteId)) {
          throw new Error("Il cliente selezionato non appartiene allo studio.");
        }
        setClienti((clientiData || []) as ClienteOption[]);
        setSocietaOptions((societaData || []) as SocietaOption[]);
        setOperatori((operatoriData || []) as OperatoreOption[]);
        setPrestazioni((prestazioniData || []) as PrestazioneOption[]);
      } catch (err: any) {
        console.error("Errore inizializzazione nuova pratica AML:", err);
        alert(err?.message || "Errore caricamento dati.");
      } finally {
        setLoading(false);
      }
    };

    void init();
  }, [router.isReady, router.query.societa_id, router.query.cliente_id]);

  useEffect(() => {
    if (!router.isReady || !clienteId || !societaId) {
      setIncarichiEsistenti([]);
      return;
    }
    let active = true;
    (async () => {
      try {
        const studioId = await getStudioId();
        if (!studioId) return;
        const supabase = getSupabaseClient() as any;
        const { data, error } = await supabase
          .from("tbPraticheAML")
          .select("id, tipo_prestazione, data_apertura, stato")
          .eq("studio_id", studioId)
          .eq("cliente_id", clienteId)
          .eq("societa_id", societaId)
          .order("data_apertura", { ascending: false });
        if (error) throw error;
        if (active) setIncarichiEsistenti(data || []);
      } catch (error) {
        console.error("Errore caricamento incarichi AML", error);
        if (active) setIncarichiEsistenti([]);
      }
    })();
    return () => { active = false; };
  }, [router.isReady, clienteId, societaId]);

  const handleCreate = async () => {
    try {
      if (!clienteId) {
        alert("Seleziona il cliente.");
        return;
      }

      if (!tipoPrestazione) {
        alert("Seleziona il tipo di prestazione.");
        return;
      }

      setSaving(true);

      const supabase = getSupabaseClient();
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        throw new Error("Sessione non valida. Effettua nuovamente l'accesso.");
      }

      const payload = {
        cliente_id: clienteId,
        societa_id: societaId || null,
        operatore_responsabile_id: operatoreResponsabileId || null,
        data_apertura: dataApertura,
        tipo_prestazione: tipoPrestazione,
        allow_duplicate: false,
      };

      let response = await fetch("/api/antiriciclaggio/pratiche/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });

      let result = await response.json().catch(() => null);

      if (response.status === 409 && result?.duplicate) {
        const conferma = window.confirm(
          "Esiste già una pratica con lo stesso cliente, la stessa prestazione e la stessa data di apertura. Vuoi proseguire comunque?"
        );

        if (!conferma) return;

        response = await fetch("/api/antiriciclaggio/pratiche/create", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ ...payload, allow_duplicate: true }),
        });

        result = await response.json().catch(() => null);
      }

      if (!response.ok || !result?.ok || !result?.id) {
        throw new Error(result?.error || "Errore creazione pratica.");
      }

      await router.push(`/antiriciclaggio?pratica_id=${encodeURIComponent(result.id)}`);
    } catch (err: any) {
      console.error("Errore creazione pratica AML:", err);
      alert(err?.message || "Errore creazione pratica.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6">
      <div className="mx-auto max-w-2xl rounded-lg border bg-white p-6 shadow-sm">
        <h1 className="mb-2 text-2xl font-bold text-slate-900">
          {clienteBloccato ? "Aggiungi prestazione AML" : "Nuova pratica AML"}
        </h1>
        <p className="mb-6 text-sm text-slate-600">
          {clienteBloccato ? "Stesso nominativo: la nuova prestazione avrà pratica, moduli e scadenze propri." : "Seleziona un cliente esistente: non verrà duplicata l'anagrafica."}
        </p>

        {loading ? (
          <div>Caricamento...</div>
        ) : (
          <div className="space-y-5">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Cliente *
              </label>
              <select
                value={clienteId}
                onChange={(e) => setClienteId(e.target.value)}
                disabled={clienteBloccato}
                className={`w-full rounded-md border px-3 py-2 ${clienteBloccato ? "cursor-not-allowed bg-gray-100" : ""}`}
              >
                <option value="">Seleziona cliente</option>
                {clienti.map((cliente) => (
                  <option key={cliente.id} value={cliente.id}>
                    {cliente.ragione_sociale || cliente.cod_cliente || cliente.id}
                  </option>
                ))}
              </select>
            </div>

            {clienteId && societaId && (
              <div className="rounded-md border border-sky-200 bg-sky-50 p-3 text-sm text-slate-800">
                <div className="font-semibold">Prestazioni già associate ({incarichiEsistenti.length})</div>
                {incarichiEsistenti.length
                  ? <ul className="mt-2 list-disc space-y-1 pl-5">
                      {incarichiEsistenti.map(p => (
                        <li key={p.id}>{p.tipo_prestazione || "Prestazione non indicata"} · {p.data_apertura || "Data non presente"} · {p.stato || "aperta"}</li>
                      ))}
                    </ul>
                  : <p className="mt-1">Nessuna prestazione già presente per questo soggetto responsabile.</p>}
              </div>
            )}

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Tipo prestazione *
              </label>
              <select
                value={tipoPrestazione}
                onChange={(e) => setTipoPrestazione(e.target.value)}
                className="w-full rounded-md border px-3 py-2"
              >
                <option value="">Seleziona prestazione</option>
                {prestazioni.map((prestazione) => (
                  <option
                    key={prestazione.id}
                    value={getPrestazioneLabel(prestazione)}
                  >
                    {getPrestazioneLabel(prestazione)}
                  </option>
                ))}
              </select>
              {tipoPrestazione && incarichiEsistenti.some(p => p.tipo_prestazione?.trim().toLocaleLowerCase("it") === tipoPrestazione.trim().toLocaleLowerCase("it")) && (
                <p className="mt-2 text-sm text-amber-800">Questa prestazione risulta già associata al cliente. Verifica che si tratti di un incarico effettivamente distinto.</p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Soggetto responsabile / tenant AML
              </label>
             <select
  value={societaId}
  onChange={(e) => setSocietaId(e.target.value)}
  disabled={societaBloccata}
  className={`w-full rounded-md border px-3 py-2 ${
    societaBloccata ? "cursor-not-allowed bg-gray-100 text-gray-500" : ""
  }`}
>
                <option value="">Seleziona soggetto responsabile</option>
                {societaOptions.map((societa) => (
                  <option key={societa.id} value={societa.id}>
                    {societa.Denominazione}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Operatore responsabile
              </label>
              <select
                value={operatoreResponsabileId}
                onChange={(e) => setOperatoreResponsabileId(e.target.value)}
                className="w-full rounded-md border px-3 py-2"
              >
                <option value="">Seleziona operatore</option>
                {operatori.map((op) => (
                  <option key={op.id} value={op.id}>
                    {getOperatoreLabel(op)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Data apertura pratica
              </label>
              <input
                type="date"
                value={dataApertura}
                onChange={(e) => setDataApertura(e.target.value)}
                className="w-full rounded-md border px-3 py-2"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleCreate}
                disabled={saving}
                className={`rounded px-4 py-2 text-white ${
                  saving
                    ? "cursor-not-allowed bg-blue-400"
                    : "bg-blue-600 hover:bg-blue-700"
                }`}
              >
                {saving ? "Creazione..." : "Crea pratica"}
              </button>

              <button
                type="button"
                onClick={() => router.push("/antiriciclaggio")}
                className="rounded border px-4 py-2 text-slate-700 hover:bg-slate-50"
              >
                Annulla
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
