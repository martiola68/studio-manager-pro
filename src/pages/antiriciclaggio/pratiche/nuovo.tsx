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

  const [clienti, setClienti] = useState<ClienteOption[]>([]);
  const [societaOptions, setSocietaOptions] = useState<SocietaOption[]>([]);
  const [operatori, setOperatori] = useState<OperatoreOption[]>([]);
  const [prestazioni, setPrestazioni] = useState<PrestazioneOption[]>([]);

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
  }, [router.query.societa_id]);

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
        throw new Error(
          duplicataError.message || "Errore controllo duplicato pratica."
        );
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

     const { data: praticaData, error: praticaError } = await supabaseAny
  .from("tbPraticheAML")
  .insert({
    studio_id: studioId,
    cliente_id: clienteId,
    societa_id: societaId || null,
    operatore_responsabile_id: operatoreResponsabileId || null,
    data_apertura: dataApertura,
    tipo_prestazione: tipoPrestazione,
    stato: "aperta",
  })
  .select("id")
  .single();

if (praticaError || !praticaData?.id) {
  throw new Error(praticaError?.message || "Errore creazione pratica.");
}

const praticaId = praticaData.id;

const { data: av1Data, error: av1Error } = await supabaseAny
  .from("tbAV1")
  .insert({
    studio_id: studioId,
    cliente_id: clienteId,
    societa_id: societaId || null,
    pratica_id: praticaId,
    incaricato_adeguata_verifica_id: null,
    DataVerifica: dataApertura,
    ScadenzaVerifica: null,
    AV1Conferma: false,
    AV2Generato: true,
    AV4Generato: true,
  })
  .select("id")
  .single();

if (av1Error || !av1Data?.id) {
  throw new Error(av1Error?.message || "Errore creazione AV1.");
}

const av1Id = av1Data.id;

const { data: av2Data, error: av2Error } = await supabaseAny
  .from("tbAV2")
  .insert({
    studio_id: studioId,
    cliente_id: clienteId,
    societa_id: societaId || null,
    pratica_id: praticaId,
    av1_id: av1Id,
  })
  .select("id")
  .single();

if (av2Error || !av2Data?.id) {
  throw new Error(av2Error?.message || "Errore creazione AV2.");
}

const { data: av4Data, error: av4Error } = await supabaseAny
  .from("tbAV4")
  .insert({
    studio_id: studioId,
    cliente_id: clienteId,
    societa_id: societaId || null,
    pratica_id: praticaId,
    av1_id: av1Id,
    stato: "bozza",
  })
  .select("id")
  .single();

if (av4Error || !av4Data?.id) {
  throw new Error(av4Error?.message || "Errore creazione AV4.");
}

const { error: updatePraticaError } = await supabaseAny
  .from("tbPraticheAML")
  .update({
    av1_id: av1Id,
    av2_id: av2Data.id,
    av4_id: av4Data.id,
    av4_corrente_id: av4Data.id,
  })
  .eq("id", praticaId);

if (updatePraticaError) {
  throw new Error(
    updatePraticaError.message || "Errore aggiornamento collegamenti pratica."
  );
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
