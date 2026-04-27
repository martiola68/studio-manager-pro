import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabaseClient";

type Processo = {
  id: string;
  numero_atto: string | null;
  anno_riferimento: number | null;
  data_ricezione: string | null;
  data_scadenza: string | null;
  descrizione: string | null;
  valore_pratica: number | null;
  esito: string | null;
  tbclienti?: { ragione_sociale: string | null } | null;
  tbcontenzioso_tipi_atto?: { descrizione: string | null } | null;
  tbcontenzioso_tributi_constatazione?: { descrizione: string | null } | null;
};

type Scadenza = {
  id: string;
  modulo: string;
  descrizione: string;
  data_scadenza: string;
  giorni_residui: number;
  stato: string;
};

export default function DettaglioAtto() {
  const router = useRouter();
  const { id } = router.query;

  const [processo, setProcesso] = useState<Processo | null>(null);
  const [scadenze, setScadenze] = useState<Scadenza[]>([]);
  const [loading, setLoading] = useState(true);
  const [errore, setErrore] = useState("");

  useEffect(() => {
    if (id) {
      loadData(String(id));
    }
  }, [id]);

  const formatDateIT = (date?: string | null) => {
    if (!date) return "-";
    const [yyyy, mm, dd] = date.split("-");
    return `${dd}/${mm}/${yyyy}`;
  };

  const getColor = (giorni: number) => {
    if (giorni <= 5) return "bg-red-600 text-white";
    if (giorni <= 10) return "bg-orange-500 text-white";
    return "bg-green-600 text-white";
  };

  const loadData = async (processoId: string) => {
    const supabase = getSupabaseClient();

    setLoading(true);
    setErrore("");

    const { data: processoData, error: processoError } = await (supabase as any)
      .from("tbcontenzioso_processo")
      .select(`
        *,
        tbclienti:cliente_id(ragione_sociale),
        tbcontenzioso_tipi_atto:tipo_atto_id(descrizione),
        tbcontenzioso_tributi_constatazione:tributo_constatazione_id(descrizione)
      `)
      .eq("id", processoId)
      .single();

    if (processoError) {
      console.error(processoError);
      setErrore("Errore nel caricamento dell'atto.");
      setLoading(false);
      return;
    }

    const { data: scadenzeData, error: scadenzeError } = await (supabase as any)
      .from("tbcontenzioso_scadenze_generate")
      .select("*")
      .eq("processo_id", processoId)
      .order("data_scadenza", { ascending: true });

    if (scadenzeError) {
      console.error(scadenzeError);
    }

    setProcesso(processoData as Processo);
    setScadenze((scadenzeData || []) as Scadenza[]);
    setLoading(false);
  };

  if (loading) {
    return <div className="p-6">Caricamento pratica...</div>;
  }

  if (errore) {
    return <div className="p-6 text-red-600">{errore}</div>;
  }

  if (!processo) {
    return <div className="p-6">Pratica non trovata.</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center justify-between rounded-2xl bg-white p-6 shadow">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Dettaglio atto
            </h1>
            <p className="text-sm text-gray-500">
              {processo.tbclienti?.ragione_sociale || "Cliente non indicato"}
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

        <div className="rounded-2xl bg-white p-6 shadow">
          <h2 className="mb-4 text-lg font-semibold">Dati pratica</h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div>
              <div className="text-xs text-gray-500">Tipo atto</div>
              <div className="font-medium">
                {processo.tbcontenzioso_tipi_atto?.descrizione || "-"}
              </div>
            </div>

            <div>
              <div className="text-xs text-gray-500">Numero atto</div>
              <div className="font-medium">{processo.numero_atto || "-"}</div>
            </div>

            <div>
              <div className="text-xs text-gray-500">Anno</div>
              <div className="font-medium">
                {processo.anno_riferimento || "-"}
              </div>
            </div>

            <div>
              <div className="text-xs text-gray-500">Tributo</div>
              <div className="font-medium">
                {processo.tbcontenzioso_tributi_constatazione?.descrizione ||
                  "-"}
              </div>
            </div>

            <div>
              <div className="text-xs text-gray-500">Data ricezione</div>
              <div className="font-medium">
                {formatDateIT(processo.data_ricezione)}
              </div>
            </div>

            <div>
              <div className="text-xs text-gray-500">Data scadenza</div>
              <div className="font-medium">
                {formatDateIT(processo.data_scadenza)}
              </div>
            </div>

            <div>
              <div className="text-xs text-gray-500">Valore pratica</div>
              <div className="font-medium">
                {processo.valore_pratica ?? "-"}
              </div>
            </div>

            <div>
              <div className="text-xs text-gray-500">Esito</div>
              <div className="font-medium">{processo.esito || "-"}</div>
            </div>
          </div>

          {processo.descrizione && (
            <div className="mt-4">
              <div className="text-xs text-gray-500">Descrizione</div>
              <div className="rounded-lg border bg-gray-50 p-3 text-sm">
                {processo.descrizione}
              </div>
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-white p-6 shadow">
          <h2 className="mb-4 text-lg font-semibold">Scadenze collegate</h2>

          {scadenze.length === 0 ? (
            <div className="rounded-lg bg-gray-50 p-4 text-sm text-gray-500">
              Nessuna scadenza automatica collegata.
            </div>
          ) : (
            <div className="space-y-3">
              {scadenze.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <div className="font-semibold">{s.descrizione}</div>
                    <div className="text-sm text-gray-500">
                      {s.modulo} · {formatDateIT(s.data_scadenza)}
                    </div>
                  </div>

                  <div
                    className={`rounded-lg px-3 py-2 text-sm font-semibold ${getColor(
                      s.giorni_residui
                    )}`}
                  >
                    {s.giorni_residui} gg
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-white p-6 shadow">
          <h2 className="mb-4 text-lg font-semibold">Moduli operativi</h2>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Link href={`/contenzioso/atti/${processo.id}/pvc`}>
              <button className="w-full rounded-lg border px-4 py-3 text-left hover:bg-gray-50">
                PVC
              </button>
            </Link>

            <Link href={`/contenzioso/atti/${processo.id}/schema-atto`}>
              <button className="w-full rounded-lg border px-4 py-3 text-left hover:bg-gray-50">
                Schema d’atto
              </button>
            </Link>

            <Link href={`/contenzioso/atti/${processo.id}/adesione`}>
              <button className="w-full rounded-lg border px-4 py-3 text-left hover:bg-gray-50">
                Accertamento con adesione
              </button>
            </Link>

            <Link href={`/contenzioso/atti/${processo.id}/interpello`}>
              <button className="w-full rounded-lg border px-4 py-3 text-left hover:bg-gray-50">
                Interpello
              </button>
            </Link>

            <Link href={`/contenzioso/atti/${processo.id}/primo-grado`}>
              <button className="w-full rounded-lg border px-4 py-3 text-left hover:bg-gray-50">
                Ricorso 1° grado
              </button>
            </Link>

            <Link href={`/contenzioso/atti/${processo.id}/secondo-grado`}>
              <button className="w-full rounded-lg border px-4 py-3 text-left hover:bg-gray-50">
                Ricorso 2° grado
              </button>
            </Link>

            <Link href={`/contenzioso/atti/${processo.id}/cassazione`}>
              <button className="w-full rounded-lg border px-4 py-3 text-left hover:bg-gray-50">
                Cassazione
              </button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
