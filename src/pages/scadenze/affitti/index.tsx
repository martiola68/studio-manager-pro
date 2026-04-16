import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { getSupabaseClient } from "@/lib/supabaseClient";

type ContrattoAffitto = {
  id: string;
  studio_id: string;
  cliente_id: string;
  descrizione: string;
  data_inizio: string;
  data_fine: string | null;
  data_prossima_scadenza: string;
  contatore_anni: number;
  durata_anni: number;
  stato: "ATTIVO" | "CHIUSO";
  alert_inviati: number; // 0 - 3
};

export default function AffittiIndex() {
  const router = useRouter();
  const supabase = getSupabaseClient();

  const [contratti, setContratti] = useState<ContrattoAffitto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // ===============================
  // LOAD DATI
  // ===============================
  useEffect(() => {
    loadContratti();
  }, []);

  const loadContratti = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("tb_affitti")
      .select("*")
      .order("data_prossima_scadenza", { ascending: true });

    if (error) {
      console.error("Errore caricamento contratti:", error);
    } else {
      setContratti(data || []);
    }

    setLoading(false);
  };

  // =================
  // ===============================
  // FILTRO RICERCA
  // ===============================
  const contrattiFiltrati = contratti.filter((c) => {
    const testo = `${c.descrizione}`.toLowerCase();
    return testo.includes(search.toLowerCase());
  });

  // ===============================
  // NAVIGAZIONE
  // ===============================
  const handleNuovo = () => {
    router.push("/scadenze/affitti/nuovo");
  };

  const handleApri = (id: string) => {
    router.push(`/scadenze/affitti/nuovo?id=${id}`);
  };

  // ===============================
  // BADGE ALERT
  // ===============================
  const renderAlert = (num: number) => {
    if (num === 0) return "0/3";
    if (num === 1) return "1/3";
    if (num === 2) return "2/3";
    if (num >= 3) return "3/3";
    return "-";
  };

  // ===============================
  // UI
  // ===============================
  return (
    <div className="p-6">
      {/* HEADER */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold">Contratti di affitto</h1>

        <button
          onClick={handleNuovo}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          Nuovo contratto
        </button>
      </div>

      {/* RICERCA */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Cerca..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border px-3 py-2 rounded w-full"
        />
      </div>

      {/* TABELLA */}
      <div className="border rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="text-left p-3">Descrizione</th>
              <th className="text-left p-3">Inizio</th>
              <th className="text-left p-3">Fine</th>
              <th className="text-left p-3">Prossima scadenza</th>
              <th className="text-left p-3">Anno</th>
              <th className="text-left p-3">Alert</th>
              <th className="text-left p-3">Stato</th>
              <th className="text-left p-3"></th>
            </tr>
          </thead>

          <tbody>
            {loading && (
              <tr>
                <td colSpan={8} className="p-4 text-center">
                  Caricamento...
                </td>
              </tr>
            )}

            {!loading && contrattiFiltrati.length === 0 && (
              <tr>
                <td colSpan={8} className="p-4 text-center">
                  Nessun contratto trovato
                </td>
              </tr>
            )}

            {!loading &&
              contrattiFiltrati.map((c) => (
                <tr key={c.id} className="border-top">
                  <td className="p-3">{c.descrizione}</td>

                  <td className="p-3">
                    {c.data_inizio
                      ? new Date(c.data_inizio).toLocaleDateString()
                      : "-"}
                  </td>

                  <td className="p-3">
                    {c.data_fine
                      ? new Date(c.data_fine).toLocaleDateString()
                      : "-"}
                  </td>

                  <td className="p-3">
                    {c.data_prossima_scadenza
                      ? new Date(
                          c.data_prossima_scadenza
                        ).toLocaleDateString()
                      : "-"}
                  </td>

                  <td className="p-3">
                    {c.contatore_anni}/{c.durata_anni}
                  </td>

                  <td className="p-3">{renderAlert(c.alert_inviati)}</td>

                  <td className="p-3">
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        c.stato === "ATTIVO"
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-200 text-gray-600"
                      }`}
                    >
                      {c.stato}
                    </span>
                  </td>

                  <td className="p-3">
                    <button
                      onClick={() => handleApri(c.id)}
                      className="text-blue-600 underline"
                    >
                      Apri
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
