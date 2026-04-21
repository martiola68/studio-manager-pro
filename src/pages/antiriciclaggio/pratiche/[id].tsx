import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { getSupabaseClient } from "@/lib/supabaseClient";

type PraticaRow = {
  id: string;
  studio_id: string;
  cliente_id: string;
  societa_id?: string | null;
  numero_pratica?: number | null;
  data_apertura?: string | null;
  stato?: string | null;
  av4_id?: string | null;
  av2_id?: string | null;
  av1_id?: string | number | null;
  note?: string | null;
};

type ClienteRow = {
  id: string;
  ragione_sociale?: string | null;
  cod_cliente?: string | null;
  codice_fiscale?: string | null;
};

type SocietaRow = {
  id: string;
  Denominazione?: string | null;
  codice_fiscale?: string | null;
};

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("it-IT");
};

const statoBadge = (stato?: string | null) => {
  switch (stato) {
    case "aperta":
      return "bg-blue-100 text-blue-700";
    case "av4_inviato":
      return "bg-yellow-100 text-yellow-700";
    case "av4_ricevuto":
      return "bg-emerald-100 text-emerald-700";
    case "av2_compilato":
      return "bg-indigo-100 text-indigo-700";
    case "av1_compilato":
      return "bg-purple-100 text-purple-700";
    case "chiusa":
      return "bg-green-100 text-green-700";
    case "archiviata":
      return "bg-gray-100 text-gray-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
};

export default function PraticaAMLDetailPage() {
  const router = useRouter();
  const { id } = router.query;

  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);

  const [pratica, setPratica] = useState<PraticaRow | null>(null);
  const [cliente, setCliente] = useState<ClienteRow | null>(null);
  const [societa, setSocieta] = useState<SocietaRow | null>(null);

  const praticaId = useMemo(() => {
    return typeof id === "string" ? id : "";
  }, [id]);

  const loadPratica = async () => {
    if (!praticaId) return;

    try {
      setLoading(true);

      const supabase = getSupabaseClient();
      const supabaseAny = supabase as any;

      const { data: praticaData, error: praticaError } = await supabaseAny
        .from("tbPraticheAML")
        .select("*")
        .eq("id", praticaId)
        .single();

      if (praticaError) {
        throw new Error(praticaError.message || "Errore caricamento pratica.");
      }

      setPratica(praticaData || null);

      if (praticaData?.cliente_id) {
        const { data: clienteData } = await supabaseAny
          .from("tbclienti")
          .select("id, ragione_sociale, cod_cliente, codice_fiscale")
          .eq("id", praticaData.cliente_id)
          .single();

        setCliente(clienteData || null);
      } else {
        setCliente(null);
      }

      if (praticaData?.societa_id) {
        const { data: societaData } = await supabaseAny
          .from("tbRespAVSocieta")
          .select("id, Denominazione, codice_fiscale")
          .eq("id", praticaData.societa_id)
          .single();

        setSocieta(societaData || null);
      } else {
        setSocieta(null);
      }
    } catch (err: any) {
      console.error("Errore caricamento pratica AML:", err);
      alert(err?.message || "Errore caricamento pratica.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!praticaId) return;
    void loadPratica();
  }, [praticaId]);

  const handleApriAV4 = async () => {
    if (!pratica) return;

    try {
      setWorking("av4");

      const supabase = getSupabaseClient();
      const supabaseAny = supabase as any;

      if (pratica.av4_id) {
        router.push(
          `/antiriciclaggio/modello-av4?id=${pratica.av4_id}&pratica_id=${pratica.id}&cliente_id=${pratica.cliente_id || ""}&studio_id=${pratica.studio_id || ""}&societa_id=${pratica.societa_id || ""}`
        );
        return;
      }

      const { data: av4Data, error: av4Error } = await supabaseAny
        .from("tbAV4")
        .insert({
          pratica_id: pratica.id,
          studio_id: pratica.studio_id,
          cliente_id: pratica.cliente_id,
          societa_id: pratica.societa_id || null,
          stato: "bozza",
        })
        .select("id")
        .single();

      if (av4Error || !av4Data?.id) {
        throw new Error(av4Error?.message || "Errore creazione AV4.");
      }

      const { error: praticaUpdateError } = await supabaseAny
        .from("tbPraticheAML")
        .update({
          av4_id: av4Data.id,
          stato: "av4_inviato",
        })
        .eq("id", pratica.id);

      if (praticaUpdateError) {
        throw new Error(
          praticaUpdateError.message || "Errore aggiornamento pratica."
        );
      }

      router.push(
        `/antiriciclaggio/modello-av4?id=${av4Data.id}&pratica_id=${pratica.id}&cliente_id=${pratica.cliente_id || ""}&studio_id=${pratica.studio_id || ""}&societa_id=${pratica.societa_id || ""}`
      );
    } catch (err: any) {
      console.error("Errore apertura AV4:", err);
      alert(err?.message || "Errore apertura AV4.");
    } finally {
      setWorking(null);
    }
  };

  const handleApriAV2 = async () => {
    if (!pratica) return;

    try {
      setWorking("av2");

      const supabase = getSupabaseClient();
      const supabaseAny = supabase as any;

      if (pratica.av2_id) {
        router.push(
          `/antiriciclaggio/modello-av2?id=${pratica.av2_id}&pratica_id=${pratica.id}&cliente_id=${pratica.cliente_id || ""}&studio_id=${pratica.studio_id || ""}&societa_id=${pratica.societa_id || ""}`
        );
        return;
      }

      const { data: av2Data, error: av2Error } = await supabaseAny
        .from("tbAV2")
        .insert({
          pratica_id: pratica.id,
          studio_id: pratica.studio_id,
          cliente_id: pratica.cliente_id,
          societa_id: pratica.societa_id || null,
        })
        .select("id")
        .single();

      if (av2Error || !av2Data?.id) {
        throw new Error(av2Error?.message || "Errore creazione AV2.");
      }

      const { error: praticaUpdateError } = await supabaseAny
        .from("tbPraticheAML")
        .update({
          av2_id: av2Data.id,
        })
        .eq("id", pratica.id);

      if (praticaUpdateError) {
        throw new Error(
          praticaUpdateError.message || "Errore aggiornamento pratica."
        );
      }

      router.push(
        `/antiriciclaggio/modello-av2?id=${av2Data.id}&pratica_id=${pratica.id}&cliente_id=${pratica.cliente_id || ""}&studio_id=${pratica.studio_id || ""}&societa_id=${pratica.societa_id || ""}`
      );
    } catch (err: any) {
      console.error("Errore apertura AV2:", err);
      alert(err?.message || "Errore apertura AV2.");
    } finally {
      setWorking(null);
    }
  };

  const handleApriAV1 = async () => {
    if (!pratica) return;

    try {
      setWorking("av1");

      const supabase = getSupabaseClient();
      const supabaseAny = supabase as any;

      if (pratica.av1_id) {
        router.push(
          `/antiriciclaggio/modello-av1?id=${pratica.av1_id}&pratica_id=${pratica.id}&cliente_id=${pratica.cliente_id || ""}&studio_id=${pratica.studio_id || ""}&societa_id=${pratica.societa_id || ""}`
        );
        return;
      }

      const { data: av1Data, error: av1Error } = await supabaseAny
        .from("tbAV1")
        .insert({
          pratica_id: pratica.id,
          studio_id: pratica.studio_id,
          cliente_id: pratica.cliente_id,
          societa_id: pratica.societa_id || null,
          DataVerifica: null,
          ScadenzaVerifica: null,
          AV1Conferma: false,
          AV2Generato: false,
          AV4Generato: false,
        })
        .select("id")
        .single();

      if (av1Error || !av1Data?.id) {
        throw new Error(av1Error?.message || "Errore creazione AV1.");
      }

      const { error: praticaUpdateError } = await supabaseAny
        .from("tbPraticheAML")
        .update({
          av1_id: av1Data.id,
        })
        .eq("id", pratica.id);

      if (praticaUpdateError) {
        throw new Error(
          praticaUpdateError.message || "Errore aggiornamento pratica."
        );
      }

      router.push(
        `/antiriciclaggio/modello-av1?id=${av1Data.id}&pratica_id=${pratica.id}&cliente_id=${pratica.cliente_id || ""}&studio_id=${pratica.studio_id || ""}&societa_id=${pratica.societa_id || ""}`
      );
    } catch (err: any) {
      console.error("Errore apertura AV1:", err);
      alert(err?.message || "Errore apertura AV1.");
    } finally {
      setWorking(null);
    }
  };

  const handleApriDocumenti = () => {
    if (!pratica) return;

    router.push(
      `/antiriciclaggio/fascicolo-documenti?pratica_id=${pratica.id}&cliente_id=${pratica.cliente_id || ""}&studio_id=${pratica.studio_id || ""}&societa_id=${pratica.societa_id || ""}`
    );
  };

  if (loading) {
    return <div className="p-6">Caricamento pratica...</div>;
  }

  if (!pratica) {
    return (
      <div className="p-6">
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <h1 className="text-xl font-bold text-slate-900">
            Pratica non trovata
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            La pratica richiesta non esiste oppure non è accessibile.
          </p>
          <button
            type="button"
            onClick={() => router.push("/antiriciclaggio")}
            className="mt-4 rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Torna all'elenco
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                Pratica AML
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                Numero pratica:{" "}
                <span className="font-semibold">
                  {pratica.numero_pratica ?? "-"}
                </span>
              </p>
            </div>

            <span
              className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${statoBadge(
                pratica.stato
              )}`}
            >
              {pratica.stato || "aperta"}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg border bg-slate-50 p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Cliente
              </div>
              <div className="mt-1 text-sm font-semibold text-slate-900">
                {cliente?.ragione_sociale || cliente?.cod_cliente || "-"}
              </div>
              {cliente?.codice_fiscale ? (
                <div className="mt-1 text-xs text-slate-600">
                  CF: {cliente.codice_fiscale}
                </div>
              ) : null}
            </div>

            <div className="rounded-lg border bg-slate-50 p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Soggetto responsabile
              </div>
              <div className="mt-1 text-sm font-semibold text-slate-900">
                {societa?.Denominazione || "-"}
              </div>
              {societa?.codice_fiscale ? (
                <div className="mt-1 text-xs text-slate-600">
                  CF: {societa.codice_fiscale}
                </div>
              ) : null}
            </div>

            <div className="rounded-lg border bg-slate-50 p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Data apertura
              </div>
              <div className="mt-1 text-sm font-semibold text-slate-900">
                {formatDate(pratica.data_apertura)}
              </div>
            </div>

            <div className="rounded-lg border bg-slate-50 p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                ID pratica
              </div>
              <div className="mt-1 break-all text-xs text-slate-700">
                {pratica.id}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">
            Workflow pratica
          </h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg border p-4">
              <div className="mb-2 text-sm font-semibold text-slate-900">
                AV4 cliente
              </div>
              <div className="mb-4 text-xs text-slate-600">
                Invio al cliente, compilazione online e raccolta dati/documenti.
              </div>
              <button
                type="button"
                onClick={handleApriAV4}
                disabled={working === "av4"}
                className={`w-full rounded px-4 py-2 text-white ${
                  working === "av4"
                    ? "cursor-not-allowed bg-blue-400"
                    : "bg-blue-600 hover:bg-blue-700"
                }`}
              >
                {working === "av4"
                  ? "Apertura..."
                  : pratica.av4_id
                  ? "Apri AV4"
                  : "Crea / Apri AV4"}
              </button>
            </div>

            <div className="rounded-lg border p-4">
              <div className="mb-2 text-sm font-semibold text-slate-900">
                AV2
              </div>
              <div className="mb-4 text-xs text-slate-600">
                Check di controllo e salvataggio nella pratica AML.
              </div>
              <button
                type="button"
                onClick={handleApriAV2}
                disabled={working === "av2"}
                className={`w-full rounded px-4 py-2 text-white ${
                  working === "av2"
                    ? "cursor-not-allowed bg-indigo-400"
                    : "bg-indigo-600 hover:bg-indigo-700"
                }`}
              >
                {working === "av2"
                  ? "Apertura..."
                  : pratica.av2_id
                  ? "Apri AV2"
                  : "Crea / Apri AV2"}
              </button>
            </div>

            <div className="rounded-lg border p-4">
              <div className="mb-2 text-sm font-semibold text-slate-900">
                AV1
              </div>
              <div className="mb-4 text-xs text-slate-600">
                Valutazione finale del rischio e chiusura pratica.
              </div>
              <button
                type="button"
                onClick={handleApriAV1}
                disabled={working === "av1"}
                className={`w-full rounded px-4 py-2 text-white ${
                  working === "av1"
                    ? "cursor-not-allowed bg-purple-400"
                    : "bg-purple-600 hover:bg-purple-700"
                }`}
              >
                {working === "av1"
                  ? "Apertura..."
                  : pratica.av1_id
                  ? "Apri AV1"
                  : "Crea / Apri AV1"}
              </button>
            </div>

            <div className="rounded-lg border p-4">
              <div className="mb-2 text-sm font-semibold text-slate-900">
                Fascicolo documenti
              </div>
              <div className="mb-4 text-xs text-slate-600">
                Accesso ai documenti caricati e agli allegati della pratica.
              </div>
              <button
                type="button"
                onClick={handleApriDocumenti}
                className="w-full rounded bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700"
              >
                Apri fascicolo
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">
            Collegamenti pratica
          </h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-lg border bg-slate-50 p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                AV4 ID
              </div>
              <div className="mt-1 break-all text-xs text-slate-700">
                {pratica.av4_id || "-"}
              </div>
            </div>

            <div className="rounded-lg border bg-slate-50 p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                AV2 ID
              </div>
              <div className="mt-1 break-all text-xs text-slate-700">
                {pratica.av2_id || "-"}
              </div>
            </div>

            <div className="rounded-lg border bg-slate-50 p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                AV1 ID
              </div>
              <div className="mt-1 break-all text-xs text-slate-700">
                {pratica.av1_id || "-"}
              </div>
            </div>
          </div>

          {pratica.note ? (
            <div className="mt-4 rounded-lg border bg-amber-50 p-4 text-sm text-amber-900">
              <div className="mb-1 font-semibold">Note pratica</div>
              <div>{pratica.note}</div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
