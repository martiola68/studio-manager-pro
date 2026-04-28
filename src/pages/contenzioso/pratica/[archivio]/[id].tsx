import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { getSupabaseClient } from "@/lib/supabaseClient";

type Pratica = any;

export default function RiepilogoPraticaContenzioso() {
  const router = useRouter();
  const { archivio, id } = router.query;

  const [loading, setLoading] = useState(true);
  const [errore, setErrore] = useState("");
  const [pratica, setPratica] = useState<Pratica | null>(null);
  const [scadenze, setScadenze] = useState<any[]>([]);

  useEffect(() => {
    if (archivio && id) {
      loadPratica(String(archivio), String(id));
    }
  }, [archivio, id]);

  const getTabella = (archivio: string) => {
    if (archivio === "avvisi") return "tbcontenzioso_avvisi_bonari";
    if (archivio === "cartelle") return "tbcontenzioso_cartelle";
    return "tbcontenzioso_processo";
  };

  const getNumero = (p: any) => {
    return p?.numero_cartella || p?.numero_atto || "-";
  };

  const formatDateIT = (date?: string | null) => {
    if (!date) return "-";
    const [yyyy, mm, dd] = date.split("-");
    return `${dd}/${mm}/${yyyy}`;
  };

  const loadPratica = async (archivioVal: string, praticaId: string) => {
    const supabase = getSupabaseClient();

    setLoading(true);
    setErrore("");

    const tabella = getTabella(archivioVal);

    const { data, error } = await (supabase as any)
      .from(tabella)
      .select(`
        *,
        tbclienti:cliente_id(id, ragione_sociale),
        tbcontenzioso_tipi_atto:tipo_atto_id(id, descrizione, giorni_scadenza),
        tbcontenzioso_tributi_constatazione:tributo_constatazione_id(id, descrizione)
      `)
      .eq("id", praticaId)
      .maybeSingle();

    if (error) {
      console.error(error);
      setErrore("Errore durante il caricamento della pratica.");
      setLoading(false);
      return;
    }

    setPratica(data);

    if (archivioVal === "processo") {
      const { data: scadenzeData } = await (supabase as any)
        .from("tbcontenzioso_scadenze_generate")
        .select("*")
        .eq("processo_id", praticaId)
        .order("data_scadenza", { ascending: true });

      setScadenze(scadenzeData || []);
    } else {
      setScadenze([
        {
          descrizione:
            archivioVal === "avvisi"
              ? "Scadenza avviso bonario"
              : "Scadenza cartella esattoriale",
          data_scadenza: data?.data_scadenza,
          giorni_residui: data?.giorni_residui,
          stato: data?.pratica_chiusa ? "Chiusa" : "Aperta",
        },
      ]);
    }

    setLoading(false);
  };

  const getAllegati = () => {
    if (!pratica) return [];

    if (archivio === "avvisi") {
      return [
        ["Allegato atto", pratica.allegato_atto],
        ["Allegato CIVIS", pratica.allegato_civis],
        ["Allegato responso", pratica.allegato_responso],
      ];
    }

    if (archivio === "cartelle") {
      return [
        ["Allegato cartella", pratica.allegato_cartella],
        ["Allegato autotutela", pratica.allegato_autotutela],
        ["Allegato esito", pratica.allegato_esito],
      ];
    }

    return [];
  };

  const openPdf = (path: string) => {
    if (!path) return;

    const supabase = getSupabaseClient();
    const { data } = supabase.storage
      .from("messaggi-allegati")
      .getPublicUrl(path);

    if (data?.publicUrl) {
      window.open(data.publicUrl, "_blank");
    }
  };

  if (loading) {
    return <div className="p-6">Caricamento riepilogo pratica...</div>;
  }

  if (errore) {
    return <div className="p-6 text-red-600">{errore}</div>;
  }

  if (!pratica) {
    return <div className="p-6">Pratica non trovata.</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-7xl rounded-2xl bg-white p-6 shadow">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Riepilogo pratica contenzioso
            </h1>
            <p className="text-sm text-gray-500">
              Stato pratica, scadenze, adempimenti e allegati
            </p>
          </div>

          <button
            type="button"
            onClick={() => router.push("/contenzioso")}
            className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-100"
          >
            Indietro
          </button>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="rounded-xl border p-4">
            <div className="text-xs text-gray-500">Cliente</div>
            <div className="font-semibold">
              {pratica.tbclienti?.ragione_sociale || "-"}
            </div>
          </div>

          <div className="rounded-xl border p-4">
            <div className="text-xs text-gray-500">Tipo atto</div>
            <div className="font-semibold">
              {pratica.tbcontenzioso_tipi_atto?.descrizione || "-"}
            </div>
          </div>

          <div className="rounded-xl border p-4">
            <div className="text-xs text-gray-500">Numero</div>
            <div className="font-semibold">{getNumero(pratica)}</div>
          </div>

          <div className="rounded-xl border p-4">
            <div className="text-xs text-gray-500">Stato</div>
            <div className="font-semibold">
              {pratica.pratica_chiusa ? "Chiusa" : "Aperta"}
            </div>
          </div>
        </div>

        <div className="mb-6 rounded-xl border p-4">
          <h2 className="mb-3 text-lg font-semibold">Dati principali</h2>

          <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
            <div>
              <span className="text-gray-500">Anno: </span>
              {pratica.anno_riferimento || "-"}
            </div>
            <div>
              <span className="text-gray-500">Tributo: </span>
              {pratica.tbcontenzioso_tributi_constatazione?.descrizione || "-"}
            </div>
            <div>
              <span className="text-gray-500">Data ricezione: </span>
              {formatDateIT(pratica.data_ricezione)}
            </div>
            <div>
              <span className="text-gray-500">Scadenza: </span>
              {formatDateIT(pratica.data_scadenza)}
            </div>
            <div>
              <span className="text-gray-500">Giorni residui: </span>
              {pratica.giorni_residui ?? "-"}
            </div>
            <div>
              <span className="text-gray-500">Importo dovuto: </span>
              {pratica.importo_dovuto ?? pratica.valore_pratica ?? "-"}
            </div>
          </div>
        </div>

        <div className="mb-6 rounded-xl border p-4">
          <h2 className="mb-3 text-lg font-semibold">Scadenze / adempimenti</h2>

          {scadenze.length === 0 ? (
            <div className="text-sm text-gray-500">
              Nessuna scadenza collegata.
            </div>
          ) : (
            <div className="space-y-2">
              {scadenze.map((s, index) => (
                <div
                  key={s.id || index}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <div className="font-medium">{s.descrizione}</div>
                    <div className="text-sm text-gray-500">
                      Scadenza: {formatDateIT(s.data_scadenza)}
                    </div>
                  </div>

                  <div className="text-sm font-semibold">
                    {s.stato || "Aperta"} · {s.giorni_residui ?? "-"} gg
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border p-4">
          <h2 className="mb-3 text-lg font-semibold">Allegati</h2>

          {getAllegati().length === 0 ? (
            <div className="text-sm text-gray-500">
              Nessun allegato previsto per questa pratica.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {getAllegati().map(([label, path]) => (
                <div key={label} className="rounded-lg border p-3">
                  <div className="mb-2 font-medium">{label}</div>

                  {path ? (
                    <button
                      type="button"
                      onClick={() => openPdf(String(path))}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
                    >
                      Apri allegato
                    </button>
                  ) : (
                    <div className="text-sm text-gray-500">
                      Non caricato
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
