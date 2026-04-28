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
  const [saving, setSaving] = useState(false);
  const [errore, setErrore] = useState("");
const [messaggio, setMessaggio] = useState("");

const [moduliAttivi, setModuliAttivi] = useState({
  pvc: false,
  schemaAtto: false,
  adesione: false,
  interpello: false,
  primoGrado: false,
  secondoGrado: false,
  cassazione: false,
});
  
  const [form, setForm] = useState({
    numero_atto: "",
    anno_riferimento: "",
    data_ricezione: "",
    data_scadenza: "",
    descrizione: "",
    valore_pratica: "",
    esito: "",
  });

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

  const getModuloButtonColor = (attivo: boolean) => {
  return attivo
    ? "bg-green-600 text-white hover:bg-green-700 border-green-600"
    : "bg-red-600 text-white hover:bg-red-700 border-red-600";
};

  const loadData = async (processoId: string) => {
    const supabase = getSupabaseClient();

    setLoading(true);
    setErrore("");
    setMessaggio("");

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

    const processo = processoData as Processo;

    setProcesso(processo);
    setForm({
      numero_atto: processo.numero_atto || "",
      anno_riferimento: processo.anno_riferimento
        ? String(processo.anno_riferimento)
        : "",
      data_ricezione: processo.data_ricezione || "",
      data_scadenza: processo.data_scadenza || "",
      descrizione: processo.descrizione || "",
      valore_pratica:
        processo.valore_pratica !== null && processo.valore_pratica !== undefined
          ? String(processo.valore_pratica)
          : "",
      esito: processo.esito || "",
    });

    const { data: scadenzeData, error: scadenzeError } = await (supabase as any)
      .from("tbcontenzioso_scadenze_generate")
      .select("*")
      .eq("processo_id", processoId)
      .order("data_scadenza", { ascending: true });

    if (scadenzeError) {
      console.error(scadenzeError);
    }

 const { data: pvcData } = await (supabase as any)
  .from("tbcontenzioso_pvc")
  .select("id")
  .eq("processo_id", processoId)
  .maybeSingle();

setModuliAttivi((prev) => ({
  ...prev,
  pvc: !!pvcData,
}));

setScadenze((scadenzeData || []) as Scadenza[]);
setLoading(false);
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSave = async () => {
    if (!processo) return;

    const supabase = getSupabaseClient();

    setSaving(true);
    setErrore("");
    setMessaggio("");

    const payload = {
      numero_atto: form.numero_atto || null,
      anno_riferimento: form.anno_riferimento
        ? Number(form.anno_riferimento)
        : null,
      data_ricezione: form.data_ricezione || null,
      data_scadenza: form.data_scadenza || null,
      descrizione: form.descrizione || null,
      valore_pratica: form.valore_pratica ? Number(form.valore_pratica) : null,
      esito: form.esito || null,
    };

    const { error } = await (supabase as any)
      .from("tbcontenzioso_processo")
      .update(payload)
      .eq("id", processo.id);

    if (error) {
      console.error(error);
      setErrore("Errore durante il salvataggio dell'atto.");
      setSaving(false);
      return;
    }

    setMessaggio("Atto salvato correttamente.");
    await loadData(processo.id);
    setSaving(false);
  };

  if (loading) {
    return <div className="p-6">Caricamento pratica...</div>;
  }

  if (errore && !processo) {
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
              Modifica atto
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

        {errore && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {errore}
          </div>
        )}

        {messaggio && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">
            {messaggio}
          </div>
        )}

        <div className="rounded-2xl bg-white p-6 shadow">
          <h2 className="mb-4 text-lg font-semibold">Dati pratica</h2>

          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <div className="text-xs text-gray-500">Cliente</div>
              <div className="font-medium">
                {processo.tbclienti?.ragione_sociale || "-"}
              </div>
            </div>

            <div>
              <div className="text-xs text-gray-500">Tipo atto</div>
              <div className="font-medium">
                {processo.tbcontenzioso_tipi_atto?.descrizione || "-"}
              </div>
            </div>

            <div>
              <div className="text-xs text-gray-500">Tributo</div>
              <div className="font-medium">
                {processo.tbcontenzioso_tributi_constatazione?.descrizione ||
                  "-"}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div>
              <label className="text-xs text-gray-500">Numero atto</label>
              <input
                name="numero_atto"
                value={form.numero_atto}
                onChange={handleChange}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="text-xs text-gray-500">Anno</label>
              <input
                name="anno_riferimento"
                type="number"
                value={form.anno_riferimento}
                onChange={handleChange}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="text-xs text-gray-500">Data ricezione</label>
              <input
                name="data_ricezione"
                type="date"
                value={form.data_ricezione}
                onChange={handleChange}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="text-xs text-gray-500">Data scadenza</label>
              <input
                name="data_scadenza"
                type="date"
                value={form.data_scadenza}
                onChange={handleChange}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="text-xs text-gray-500">Valore pratica</label>
              <input
                name="valore_pratica"
                type="number"
                step="0.01"
                value={form.valore_pratica}
                onChange={handleChange}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="text-xs text-gray-500">Esito</label>
              <select
                name="esito"
                value={form.esito}
                onChange={handleChange}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              >
               <option value="">---</option>
              <option value="aperto">Aperto</option>
              <option value="in_lavorazione">In lavorazione</option>
              <option value="chiuso">Chiuso</option>
<option value="annullato">Annullato</option>
              </select>
            </div>
          </div>

          <div className="mt-4">
            <label className="text-xs text-gray-500">Descrizione</label>
            <textarea
              name="descrizione"
              value={form.descrizione}
              onChange={handleChange}
              rows={4}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            />
          </div>

          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? "Salvataggio..." : "Salva modifiche"}
            </button>
          </div>
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
  <button
    className={`w-full rounded-lg border px-4 py-3 text-left font-semibold ${getModuloButtonColor(
      moduliAttivi.pvc
    )}`}
  >
    PVC {moduliAttivi.pvc ? "✓" : "✕"}
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
