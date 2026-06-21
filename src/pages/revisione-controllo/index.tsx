import { useEffect, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { Plus, Trash2, Pencil, RefreshCw } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";

type Incarico = {
  id: string;
  studio_id: string;
  cliente_id: string;
  ragione_sociale: string;
  tipo_incarico: string;
  data_nomina: string | null;
  data_inizio: string | null;
  data_fine: string | null;
  periodicita: string | null;
  responsabile_id: string | null;
  responsabile_nome: string | null;
  responsabile_cognome: string | null;
  attivo: boolean;
  note: string | null;
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

export default function RevisioneControlloPage() {
  const router = useRouter();

  const [incarichi, setIncarichi] = useState<Incarico[]>([]);
  const [loading, setLoading] = useState(true);
  const [studioId, setStudioId] = useState<string | null>(null);
  const [filtroAttivo, setFiltroAttivo] = useState("true");
  const [error, setError] = useState<string | null>(null);

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

  async function loadIncarichi(studio?: string) {
    try {
      setLoading(true);
      setError(null);

      const sid = studio || studioId || (await loadCurrentUser());

      const params = new URLSearchParams();
      params.set("studio_id", sid);
      params.set("attivo", filtroAttivo);

      const res = await fetch(`/api/revisione-controllo?${params.toString()}`);
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || "Errore caricamento incarichi.");
      }

      setIncarichi(json.data || []);
    } catch (err: any) {
      setError(err?.message || "Errore caricamento incarichi.");
    } finally {
      setLoading(false);
    }
  }

  async function eliminaIncarico(id: string) {
    const ok = window.confirm(
      "Confermi l'eliminazione dell'incarico? Verranno eliminati anche soggetti, controlli e relazioni collegate."
    );

    if (!ok) return;

    try {
      setError(null);

      const res = await fetch(`/api/revisione-controllo/${id}`, {
        method: "DELETE",
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || "Errore eliminazione incarico.");
      }

      await loadIncarichi();
    } catch (err: any) {
      setError(err?.message || "Errore eliminazione incarico.");
    }
  }

  useEffect(() => {
    loadIncarichi();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroAttivo]);

  return (
    <>
      <Head>
        <title>Revisione e Controllo</title>
      </Head>

      <div className="mx-auto max-w-[1600px] p-6">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Revisione e Controllo</h1>
            <p className="text-sm text-gray-500">
              Archivio incarichi di revisione legale, sindaco unico, collegio sindacale e controlli trimestrali.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => loadIncarichi()}
              className="inline-flex items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm hover:bg-gray-50"
            >
              <RefreshCw size={16} />
              Aggiorna
            </button>

            <button
              onClick={() => router.push("/revisione-controllo/nuovo")}
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700"
            >
              <Plus size={16} />
              Nuovo incarico
            </button>
          </div>
        </div>

        <div className="mb-4 rounded-lg border bg-white p-4">
          <label className="mb-1 block text-xs font-medium text-gray-500">
            Stato incarico
          </label>
          <select
            value={filtroAttivo}
            onChange={(e) => setFiltroAttivo(e.target.value)}
            className="h-10 rounded-md border px-3 text-sm"
          >
            <option value="true">Attivi</option>
            <option value="false">Non attivi</option>
          </select>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="overflow-hidden rounded-lg border bg-white">
          {loading ? (
            <div className="p-8 text-center text-sm text-gray-500">
              Caricamento incarichi...
            </div>
          ) : incarichi.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-500">
              Nessun incarico trovato.
            </div>
          ) : (
            <div className="overflow-auto">
              <table className="w-full min-w-[1200px] text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-3 text-left">Società</th>
                    <th className="p-3 text-left">Tipo incarico</th>
                    <th className="p-3 text-center">Data nomina</th>
                    <th className="p-3 text-center">Inizio</th>
                    <th className="p-3 text-center">Fine</th>
                    <th className="p-3 text-left">Responsabile</th>
                    <th className="p-3 text-center">Stato</th>
                    <th className="p-3 text-center">Azioni</th>
                  </tr>
                </thead>

                <tbody>
                  {incarichi.map((item) => (
                    <tr key={item.id} className="border-t hover:bg-gray-50">
                      <td className="p-3 font-medium">{item.ragione_sociale}</td>

                      <td className="p-3">
                        {TIPI_LABEL[item.tipo_incarico] || item.tipo_incarico}
                      </td>

                      <td className="p-3 text-center">
                        {formatDateIT(item.data_nomina)}
                      </td>

                      <td className="p-3 text-center">
                        {formatDateIT(item.data_inizio)}
                      </td>

                      <td className="p-3 text-center">
                        {formatDateIT(item.data_fine)}
                      </td>

                      <td className="p-3">
                        {`${item.responsabile_cognome || ""} ${
                          item.responsabile_nome || ""
                        }`.trim() || "-"}
                      </td>

                      <td className="p-3 text-center">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-semibold ${
                            item.attivo
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {item.attivo ? "Attivo" : "Non attivo"}
                        </span>
                      </td>

                      <td className="p-3">
                        <div className="flex justify-center gap-2">
                          <button
                            title="Modifica"
                            onClick={() =>
                              router.push(`/revisione-controllo/nuovo?id=${item.id}`)
                            }
                            className="rounded-md border bg-white p-2 hover:bg-gray-50"
                          >
                            <Pencil size={16} />
                          </button>

                          <button
                            title="Elimina"
                            onClick={() => eliminaIncarico(item.id)}
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
    </>
  );
}
