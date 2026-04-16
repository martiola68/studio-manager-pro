import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { getSupabaseClient } from "@/lib/supabaseClient";

type ContrattoAffitto = {
  id: string;
  studio_id: string;
  cliente_id: string;
  utente_operatore_id: string | null;
  nominativo: string;
  descrizione_immobile_locato: string | null;
  data_registrazione_atto: string;
  durata_contratto_anni: number;
  codice_identificativo_registrazione: string | null;
  importo_registrazione: number | null;
  contatore_anni: number;
  data_prossima_scadenza: string;
  alert1_inviato: boolean;
  alert1_inviato_at: string | null;
  alert2_inviato: boolean;
  alert2_inviato_at: string | null;
  alert3_inviato: boolean;
  alert3_inviato_at: string | null;
  attivo: boolean;
  contratto_concluso: boolean;
  created_at: string;
  updated_at: string;
};

function formatDate(value?: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("it-IT");
}

function getAlertProgress(row: ContrattoAffitto) {
  let count = 0;
  if (row.alert1_inviato) count += 1;
  if (row.alert2_inviato) count += 1;
  if (row.alert3_inviato) count += 1;
  return `${count}/3`;
}

function getStato(row: ContrattoAffitto) {
  if (row.contratto_concluso || !row.attivo) return "CHIUSO";
  return "ATTIVO";
}

export default function ScadenzarioAffittiIndex() {
  const router = useRouter();
  const [contratti, setContratti] = useState<ContrattoAffitto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadContratti();
  }, []);

  const loadContratti = async () => {
    setLoading(true);
    try {
      const supabase = getSupabaseClient();

      const { data, error } = await supabase
        .from("tbscadaffitti")
        .select("*")
        .order("data_prossima_scadenza", { ascending: true });

      if (error) {
        console.error("Errore caricamento contratti affitto:", error);
        setContratti([]);
        return;
      }

      setContratti((data as ContrattoAffitto[]) || []);
    } catch (err) {
      console.error("Errore inatteso caricamento contratti affitto:", err);
      setContratti([]);
    } finally {
      setLoading(false);
    }
  };

  const contrattiFiltrati = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return contratti;

    return contratti.filter((row) => {
      const searchable = [
        row.nominativo,
        row.descrizione_immobile_locato ?? "",
        row.codice_identificativo_registrazione ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return searchable.includes(q);
    });
  }, [contratti, search]);

  const handleNuovo = () => {
    router.push("/scadenze/affitti/nuovo");
  };

  const handleApri = (id: string) => {
    router.push(`/scadenze/affitti/nuovo?id=${id}`);
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Contratti di affitto</h1>

        <button
          type="button"
          onClick={handleNuovo}
          className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          Nuovo contratto
        </button>
      </div>

      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cerca per nominativo, immobile o codice registrazione..."
          className="w-full rounded border px-3 py-2"
        />
      </div>

      <div className="overflow-x-auto rounded border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-3 text-left">Nominativo</th>
              <th className="p-3 text-left">Immobile locato</th>
              <th className="p-3 text-left">Data registrazione</th>
              <th className="p-3 text-left">Prossima scadenza</th>
              <th className="p-3 text-left">Anno</th>
              <th className="p-3 text-left">Alert</th>
              <th className="p-3 text-left">Stato</th>
              <th className="p-3 text-left">Azioni</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="p-4 text-center">
                  Caricamento...
                </td>
              </tr>
            ) : contrattiFiltrati.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-4 text-center">
                  Nessun contratto trovato
                </td>
              </tr>
            ) : (
              contrattiFiltrati.map((row) => {
                const stato = getStato(row);

                return (
                  <tr key={row.id} className="border-t">
                    <td className="p-3">{row.nominativo}</td>
                    <td className="p-3">{row.descrizione_immobile_locato || "-"}</td>
                    <td className="p-3">{formatDate(row.data_registrazione_atto)}</td>
                    <td className="p-3">{formatDate(row.data_prossima_scadenza)}</td>
                    <td className="p-3">
                      {row.contatore_anni}/{row.durata_contratto_anni}
                    </td>
                    <td className="p-3">{getAlertProgress(row)}</td>
                    <td className="p-3">
                      <span
                        className={`rounded px-2 py-1 text-xs font-medium ${
                          stato === "ATTIVO"
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-200 text-gray-700"
                        }`}
                      >
                        {stato}
                      </span>
                    </td>
                    <td className="p-3">
                      <button
                        type="button"
                        onClick={() => handleApri(row.id)}
                        className="text-blue-600 underline hover:text-blue-800"
                      >
                        Apri
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
