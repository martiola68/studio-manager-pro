import { useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";

const studioId = "f9d3ca10-6134-4061-a2b4-0be74e8c7654";

const getColor = (stato: string) => {
  if (!stato) return "bg-gray-100 text-gray-600";

  if (
    ["INVIATO", "COMUNICATO", "DICHIARAZIONE PRESENTATA", "COMPLETO"].includes(
      stato
    )
  ) {
    return "bg-green-100 text-green-700";
  }

  if (stato === "DA FARE") {
    return "bg-red-100 text-red-700";
  }

  return "bg-yellow-100 text-yellow-700";
};

type RigaRiepilogo = {
  cliente_id: string;
  nominativo: string;
  utente_operatore_id?: string | null;
  stato_generale?: string | null;
  stato_iva?: string | null;
  stato_fiscali?: string | null;
  stato_bilanci?: string | null;
  stato_770?: string | null;
  stato_ccgg?: string | null;
  stato_cu?: string | null;
  stato_imu?: string | null;
};

type UtenteOption = {
  id: string;
  nome: string;
};

export default function ScadenzarioRiepilogo() {
  const [rows, setRows] = useState<RigaRiepilogo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statoFilter, setStatoFilter] = useState("TUTTI");
  const [operatore, setOperatore] = useState("TUTTI");
  const [utentiMap, setUtentiMap] = useState<Record<string, string>>({});

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);

      const supabase = getSupabaseClient();

      const { data, error } = await (supabase as any)
        .from("vw_scadenzario_dashboard_societa")
        .select("*")
        .eq("studio_id", studioId)
        .order("nominativo", { ascending: true });

      if (error) {
        console.error("Errore caricamento riepilogo:", error);
        setRows([]);
        return;
      }

      const loadedRows: RigaRiepilogo[] = data || [];
      setRows(loadedRows);

      const operatoreIds = [
        ...new Set(
          loadedRows
            .map((r) => r.utente_operatore_id)
            .filter((v): v is string => !!v)
        ),
      ];

      if (operatoreIds.length > 0) {
        const { data: utentiData, error: utentiError } = await (supabase as any)
          .from("tbutenti")
          .select("id, nome, cognome")
          .in("id", operatoreIds);

        if (utentiError) {
          console.error("Errore caricamento utenti:", utentiError);
        } else {
          const map: Record<string, string> = {};
          (utentiData || []).forEach((u: any) => {
            const fullName = [u.cognome, u.nome].filter(Boolean).join(" ").trim();
            map[u.id] = fullName || u.nome || u.cognome || u.id;
          });
          setUtentiMap(map);
        }
      } else {
        setUtentiMap({});
      }
    } catch (err) {
      console.error("Errore caricamento riepilogo:", err);
      setRows([]);
      setUtentiMap({});
    } finally {
      setLoading(false);
    }
  }

 const operatori = useMemo<UtenteOption[]>(() => {
  const ids = [
    ...new Set(
      rows
        .map((r) => r.utente_operatore_id)
        .filter((v): v is string => !!v)
    ),
  ];

  return ids
    .map((id) => ({
      id,
      nome: utentiMap[id] || id,
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "it", { sensitivity: "base" }));
}, [rows, utentiMap]);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      const matchesSearch = (r.nominativo || "")
        .toLowerCase()
        .includes(search.trim().toLowerCase());

      const matchesStato =
        statoFilter === "TUTTI" ||
        (r.stato_generale || "").toUpperCase() === statoFilter;

      const matchesOperatore =
        operatore === "TUTTI" || r.utente_operatore_id === operatore;

      return matchesSearch && matchesStato && matchesOperatore;
    });
  }, [rows, search, statoFilter, operatore]);

  return (
    <div className="p-4">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-xl font-bold">Scadenzario Riepilogativo</h1>
          <p className="text-sm text-gray-600 mt-1">
            Totale risultati: {filteredRows.length}
          </p>
        </div>

        <div className="flex flex-col gap-3 md:flex-row">
          <div className="flex flex-col">
            <label className="text-sm font-medium mb-1">Cerca nominativo</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Scrivi il nominativo..."
              className="border rounded px-3 py-2 text-sm min-w-[240px]"
            />
          </div>

          <div className="flex flex-col">
            <label className="text-sm font-medium mb-1">Stato generale</label>
            <select
              value={statoFilter}
              onChange={(e) => setStatoFilter(e.target.value)}
              className="border rounded px-3 py-2 text-sm min-w-[180px]"
            >
              <option value="TUTTI">Tutti</option>
              <option value="COMPLETO">Completo</option>
              <option value="IN CORSO">In corso</option>
              <option value="DA FARE">Da fare</option>
            </select>
          </div>

          <div className="flex flex-col">
            <label className="text-sm font-medium mb-1">Filtra Operatore</label>
            <select
              value={operatore}
              onChange={(e) => setOperatore(e.target.value)}
              className="border rounded px-3 py-2 text-sm min-w-[220px]"
            >
              <option value="TUTTI">Tutti</option>
              {operatori.map((op) => (
                <option key={op.id} value={op.id}>
                  {op.nome}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div>Caricamento...</div>
      ) : filteredRows.length === 0 ? (
        <div className="border rounded p-4 bg-white text-sm text-gray-600">
          Nessun risultato trovato.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border text-sm bg-white">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-2 text-left">Nominativo</th>
                <th className="p-2 text-left">Operatore</th>
                <th className="p-2">Stato</th>
                <th className="p-2">IVA</th>
                <th className="p-2">Fiscali</th>
                <th className="p-2">Bilanci</th>
                <th className="p-2">770</th>
                <th className="p-2">CCGG</th>
                <th className="p-2">CU</th>
                <th className="p-2">IMU</th>
              </tr>
            </thead>

            <tbody>
              {filteredRows.map((r) => (
                <tr key={r.cliente_id} className="border-t">
                  <td className="p-2">{r.nominativo}</td>

                  <td className="p-2">
                    {r.utente_operatore_id
                      ? utentiMap[r.utente_operatore_id] || r.utente_operatore_id
                      : ""}
                  </td>

                  <td
                    className={`p-2 text-center ${getColor(
                      r.stato_generale || ""
                    )}`}
                  >
                    {r.stato_generale || ""}
                  </td>

                  <td className={`p-2 text-center ${getColor(r.stato_iva || "")}`}>
                    {r.stato_iva || ""}
                  </td>

                  <td
                    className={`p-2 text-center ${getColor(
                      r.stato_fiscali || ""
                    )}`}
                  >
                    {r.stato_fiscali || ""}
                  </td>

                  <td
                    className={`p-2 text-center ${getColor(
                      r.stato_bilanci || ""
                    )}`}
                  >
                    {r.stato_bilanci || ""}
                  </td>

                  <td className={`p-2 text-center ${getColor(r.stato_770 || "")}`}>
                    {r.stato_770 || ""}
                  </td>

                  <td
                    className={`p-2 text-center ${getColor(
                      r.stato_ccgg || ""
                    )}`}
                  >
                    {r.stato_ccgg || ""}
                  </td>

                  <td className={`p-2 text-center ${getColor(r.stato_cu || "")}`}>
                    {r.stato_cu || ""}
                  </td>

                  <td className={`p-2 text-center ${getColor(r.stato_imu || "")}`}>
                    {r.stato_imu || ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
