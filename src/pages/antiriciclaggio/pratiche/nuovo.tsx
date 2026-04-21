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

type PrestazioneOption = {
  id: string;
  Descrizione?: string | null;
  descrizione?: string | null;
  Prestazione?: string | null;
  prestazione?: string | null;
  valore_rischio_inerente?: string | number | null;
  ValoreRischioInerente?: string | number | null;
};

export default function NuovaPraticaAMLPage() {
  const router = useRouter();

  const [clienti, setClienti] = useState<ClienteOption[]>([]);
  const [societaOptions, setSocietaOptions] = useState<SocietaOption[]>([]);

  const [prestazioni, setPrestazioni] = useState<PrestazioneOption[]>([]);
const [tipoPrestazione, setTipoPrestazione] = useState("");

  const [clienteId, setClienteId] = useState("");
  const [societaId, setSocietaId] = useState("");
  const [dataApertura, setDataApertura] = useState(
    new Date().toISOString().slice(0, 10)
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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

      const { data: prestazioniData, error: prestazioniError } = await supabaseAny
          .from("tbElencoPrestAR")
          .select("*")
          .order("Descrizione", { ascending: true });

        if (prestazioniError) {
          throw new Error(prestazioniError.message || "Errore caricamento prestazioni.");
        }

        setClienti((clientiData || []) as ClienteOption[]);
        setSocietaOptions((societaData || []) as SocietaOption[]);
        setPrestazioni((prestazioniData || []) as PrestazioneOption[]);

        
      } catch (err: any) {
        console.error("Errore inizializzazione nuova pratica AML:", err);
        alert(err?.message || "Errore caricamento dati.");
      } finally {
        setLoading(false);
      }
    };

    void init();
  }, [router.query.societa_id]);

  // 👇 INSERISCI QUI
const getPrestazioneLabel = (prestazione: PrestazioneOption) => {
  return (
    prestazione.Descrizione ||
    prestazione.descrizione ||
    prestazione.Prestazione ||
    prestazione.prestazione ||
    prestazione.id
  );
};

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
      const supabaseAny = supabase as any;
      const studioId = await getStudioId();

      if (!studioId) {
        alert("Studio non trovato.");
        return;
      }

      const { data: duplicata, error: duplicataError } = await supabaseAny
        .from("tbPraticheAML")
        .select("id")
        .eq("studio_id", studioId)
        .eq("cliente_id", clienteId)
        .eq("tipo_prestazione", tipoPrestazione)
        .eq("data_apertura", dataApertura)
        .limit(1)
        .maybeSingle();

      if (duplicataError) {
        throw new Error(duplicataError.message || "Errore controllo duplicato pratica.");
      }

      if (duplicata) {
        const conferma = window.confirm(
          "Esiste già una pratica con lo stesso cliente, la stessa prestazione e la stessa data di apertura. Vuoi proseguire comunque?"
        );

        if (!conferma) {
          setSaving(false);
          return;
        }
      }

      const { data, error } = await supabaseAny
        .from("tbPraticheAML")
        .insert({
          studio_id: studioId,
          cliente_id: clienteId,
          societa_id: societaId || null,
          data_apertura: dataApertura,
          tipo_prestazione: tipoPrestazione,
          stato: "aperta",
        })
        .select("id")
        .single();

      if (error) {
        throw new Error(error.message || "Errore creazione pratica.");
      }

      router.push("/antiriciclaggio");
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
        <h1 className="mb-6 text-2xl font-bold text-slate-900">
          Nuova pratica AML
        </h1>

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
                className="w-full rounded-md border px-3 py-2"
              >
                <option value="">Seleziona cliente</option>
                {clienti.map((cliente) => (
                  <option key={cliente.id} value={cliente.id}>
                    {cliente.ragione_sociale || cliente.cod_cliente || cliente.id}
                  </option>
                ))}
              </select>
            </div>

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
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Soggetto responsabile / tenant AML
              </label>
              <select
                value={societaId}
                onChange={(e) => setSocietaId(e.target.value)}
                className="w-full rounded-md border px-3 py-2"
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
