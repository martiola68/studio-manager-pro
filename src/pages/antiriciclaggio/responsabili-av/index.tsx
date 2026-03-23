import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { getSupabaseClient } from "@/lib/supabaseClient";

type RespAVRow = {
  id: string;
  studio_id: string;
  cognome_nome: string;
  codice_fiscale: string;
  TipoSoggetto: string;
  created_at?: string;
  updated_at?: string;
};

export default function ResponsabiliAVPage() {
  const router = useRouter();

  const [rows, setRows] = useState<RespAVRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  async function getStudioId() {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("studio_id");
  }

  async function loadRows() {
    setLoading(true);
    try {
      const studioId = await getStudioId();
      if (!studioId) {
        setRows([]);
        return;
      }

      const supabase = getSupabaseClient();

      const { data, error } = await supabase
        .from("tbRespAV")
        .select("*")
        .eq("studio_id", studioId)
        .order("cognome_nome", { ascending: true });

      if (error) throw error;
      setRows((data || []) as RespAVRow[]);
    } catch (err) {
      console.error("Errore caricamento responsabili AV:", err);
      alert("Errore durante il caricamento dei responsabili adeguata verifica.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    const ok = window.confirm("Vuoi eliminare questo responsabile?");
    if (!ok) return;

    setDeletingId(id);
    try {
      const supabase = getSupabaseClient();

      const { error } = await supabase.from("tbRespAV").delete().eq("id", id);
      if (error) throw error;

      await loadRows();
    } catch (err) {
      console.error("Errore eliminazione responsabile:", err);
      alert("Errore durante l'eliminazione del responsabile.");
    } finally {
      setDeletingId(null);
    }
  }

  useEffect(() => {
    loadRows();
  }, []);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;

    return rows.filter((r) =>
      [r.cognome_nome, r.codice_fiscale, r.TipoSoggetto]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [rows, search]);

  return (
    <div className="p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Responsabili adeguata verifica</h1>
          <p className="text-sm text-gray-500">
            Elenco dei soggetti incaricati dell’adeguata verifica.
          </p>
        </div>

        <Link
          href="/antiriciclaggio/responsabili-av/nuovo"
          className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          Nuovo responsabile
        </Link>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Cerca per nome, codice fiscale o tipo soggetto..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="min-w-full border-collapse">
          <thead className="bg-gray-50">
            <tr className="text-left text-sm">
              <th className="px-4 py-3 font-semibold">Cognome e nome</th>
              <th className="px-4 py-3 font-semibold">Codice fiscale</th>
              <th className="px-4 py-3 font-semibold">Tipo soggetto</th>
              <th className="px-4 py-3 font-semibold text-right">Azioni</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-500">
                  Caricamento in corso...
                </td>
              </tr>
            ) : filteredRows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-500">
                  Nessun responsabile trovato.
                </td>
              </tr>
            ) : (
              filteredRows.map((row) => (
                <tr key={row.id} className="border-t border-gray-200 text-sm">
                  <td className="px-4 py-3">{row.cognome_nome}</td>
                  <td className="px-4 py-3">{row.codice_fiscale}</td>
                  <td className="px-4 py-3">{row.TipoSoggetto}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() =>
                          router.push(`/antiriciclaggio/responsabili-av/nuovo?id=${row.id}`)
                        }
                        className="rounded-md border border-gray-300 px-3 py-1.5 hover:bg-gray-50"
                      >
                        Modifica
                      </button>

                      <button
                        onClick={() => handleDelete(row.id)}
                        disabled={deletingId === row.id}
                        className="rounded-md border border-red-300 px-3 py-1.5 text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        {deletingId === row.id ? "Eliminazione..." : "Elimina"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
