import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabaseClient";

const studioId = "f9d3ca10-6134-4061-a2b4-0be74e8c7654";

type ContrattoAffitto = {
  id: string;
  studio_id: string;
  cliente_id: string;
  utente_operatore_id?: string | null;
  nominativo: string;
  descrizione_immobile_locato?: string | null;
  data_registrazione_atto: string;
  durata_contratto_anni: number;
  codice_identificativo_registrazione?: string | null;
  importo_registrazione?: number | null;
  contatore_anni: number;
  data_prossima_scadenza: string;
  alert1_inviato: boolean;
  alert2_inviato: boolean;
  alert3_inviato: boolean;
  attivo: boolean;
  contratto_concluso: boolean;
  created_at?: string;
  updated_at?: string;
};

type UtenteOption = {
  id: string;
  nome: string;
  cognome: string;
};

export default function ScadenzarioAffittiIndexPage() {
  const [loading, setLoading] = useState(true);
  const [contratti, setContratti] = useState<ContrattoAffitto[]>([]);
  const [utentiMap, setUtentiMap] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const supabase = getSupabaseClient();

      const { data, error } = await (supabase as any)
        .from("tbscadaffitti")
        .select("*")
        .eq("studio_id", studioId)
        .order("nominativo", { ascending: true });

      if (error) throw error;

      const loadedRows: ContrattoAffitto[] = data || [];
      setContratti(loadedRows);

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

        if (utentiError) throw utentiError;

        const map: Record<string, string> = {};
        (utentiData || []).forEach((u: UtenteOption) => {
          map[u.id] = [u.cognome, u.nome].filter(Boolean).join(" ").trim();
        });
        setUtentiMap(map);
      } else {
        setUtentiMap({});
      }
    } catch (error) {
      console.error("Errore caricamento contratti affitto:", error);
      setContratti([]);
      setUtentiMap({});
    } finally {
      setLoading(false);
    }
  }

  const filteredContratti = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return contratti;

    return contratti.filter((c) => {
      return (
        (c.nominativo || "").toLowerCase().includes(q) ||
        (c.descrizione_immobile_locato || "").toLowerCase().includes(q) ||
        (c.codice_identificativo_registrazione || "").toLowerCase().includes(q)
      );
    });
  }, [contratti, search]);

  async function handleToggleAttivo(record: ContrattoAffitto) {
    try {
      const supabase = getSupabaseClient();

      const { error } = await (supabase as any)
        .from("tbscadaffitti")
        .update({
          attivo: !record.attivo,
          contratto_concluso: record.attivo ? true : false,
        })
        .eq("id", record.id);

      if (error) throw error;

      await loadData();
    } catch (error) {
      console.error("Errore aggiornamento contratto:", error);
      alert("Errore aggiornamento contratto");
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div>Caricamento contratti di affitto...</div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Scadenzario Contratti di Affitto</h1>
          <p className="text-sm text-gray-600 mt-1">
            Totale risultati: {filteredContratti.length}
          </p>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <div className="flex flex-col">
            <label className="text-sm font-medium mb-1">Cerca</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border rounded px-3 py-2 min-w-[280px]"
              placeholder="Cliente, immobile o codice registrazione..."
            />
          </div>

          <Link
            href="/scadenze/affitti/nuovo"
            className="inline-flex items-center justify-center rounded bg-black px-4 py-2 text-white hover:bg-neutral-800"
          >
            Nuovo contratto
          </Link>
        </div>
      </div>

      <div className="border rounded bg-white p-4">
        {filteredContratti.length === 0 ? (
          <div className="text-sm text-gray-600">Nessun contratto trovato.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border text-sm">
              <thead>
                <tr className="bg-gray-100">
                  <th className="p-2 text-left">Cliente</th>
                  <th className="p-2 text-left">Operatore</th>
                  <th className="p-2 text-left">Immobile</th>
                  <th className="p-2 text-center">Data registrazione</th>
                  <th className="p-2 text-center">Durata</th>
                  <th className="p-2 text-center">Anno attuale</th>
                  <th className="p-2 text-center">Prossima scadenza</th>
                  <th className="p-2 text-left">Codice registrazione</th>
                  <th className="p-2 text-right">Importo</th>
                  <th className="p-2 text-center">Alert</th>
                  <th className="p-2 text-center">Stato</th>
                  <th className="p-2 text-center">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {filteredContratti.map((c) => (
                  <tr key={c.id} className="border-t">
                    <td className="p-2">{c.nominativo}</td>

                    <td className="p-2">
                      {c.utente_operatore_id
                        ? utentiMap[c.utente_operatore_id] || c.utente_operatore_id
                        : ""}
                    </td>

                    <td className="p-2">{c.descrizione_immobile_locato || ""}</td>

                    <td className="p-2 text-center">{c.data_registrazione_atto || ""}</td>

                    <td className="p-2 text-center">{c.durata_contratto_anni}</td>

                    <td className="p-2 text-center">{c.contatore_anni}</td>

                    <td className="p-2 text-center">{c.data_prossima_scadenza}</td>

                    <td className="p-2">
                      {c.codice_identificativo_registrazione || ""}
                    </td>

                    <td className="p-2 text-right">
                      {c.importo_registrazione !== null &&
                      c.importo_registrazione !== undefined
                        ? Number(c.importo_registrazione).toFixed(2)
                        : ""}
                    </td>

                    <td className="p-2 text-center">
                      <span className="text-xs">
                        {c.alert3_inviato
                          ? "3/3"
                          : c.alert2_inviato
                            ? "2/3"
                            : c.alert1_inviato
                              ? "1/3"
                              : "0/3"}
                      </span>
                    </td>

                    <td className="p-2 text-center">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          c.attivo
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {c.attivo ? "Attivo" : "Chiuso"}
                      </span>
                    </td>

                    <td className="p-2 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Link
                          href={`/scadenze/affitti/nuovo?id=${c.id}`}
                          className="text-sm border rounded px-3 py-1 hover:bg-gray-50"
                        >
                          Apri
                        </Link>

                        <button
                          type="button"
                          onClick={() => handleToggleAttivo(c)}
                          className="text-sm border rounded px-3 py-1 hover:bg-gray-50"
                        >
                          {c.attivo ? "Chiudi" : "Riattiva"}
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
  );
}
