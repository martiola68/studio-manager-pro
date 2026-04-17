import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { Eye, Trash2 } from "lucide-react";

type ContrattoAffittoRow = {
  id: string;
  studio_id: string;
  cliente_id: string;
  utente_operatore_id: string | null;
  conduttore: string | null;
  descrizione_immobile_locato: string | null;
  data_registrazione_atto: string;
  durata_contratto_anni: number;
  codice_identificativo_registrazione: string | null;
  importo_registrazione: number | null;
  contatore_anni: number;
  data_prossima_scadenza: string;
  emailperalert: string | null;
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

type ClienteLite = {
  id: string;
  ragione_sociale: string | null;
};

type UtenteLite = {
  id: string;
  nome: string | null;
  cognome: string | null;
  email: string | null;
};

type ContrattoAffittoView = ContrattoAffittoRow & {
  locatore_label: string;
  operatore_label: string;
};

function formatDate(value?: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("it-IT");
}

function getAlertProgress(row: ContrattoAffittoRow) {
  let count = 0;
  if (row.alert1_inviato) count += 1;
  if (row.alert2_inviato) count += 1;
  if (row.alert3_inviato) count += 1;
  return `${count}/3`;
}

function getStato(row: ContrattoAffittoRow) {
  if (row.contratto_concluso || !row.attivo) return "CHIUSO";
  return "ATTIVO";
}

function getOperatoreLabel(utente?: UtenteLite) {
  if (!utente) return "-";

  const fullName = `${utente.cognome || ""} ${utente.nome || ""}`.trim();
  if (fullName) return fullName;
  return utente.email || "-";
}

export default function ScadenzarioAffittiIndex() {
  const router = useRouter();
  const [contratti, setContratti] = useState<ContrattoAffittoView[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadContratti();
  }, []);

  const loadContratti = async () => {
    setLoading(true);

    try {
      const supabase = getSupabaseClient();
      const supabaseAny = supabase as any;

      const { data, error } = await supabaseAny
        .from("tbscadaffitti")
        .select("*")
        .order("data_prossima_scadenza", { ascending: true });

      if (error) {
        console.error("Errore caricamento contratti affitto:", error);
        setContratti([]);
        return;
      }

      const contrattiRows = ((data as unknown) as ContrattoAffittoRow[]) || [];

      const clienteIds = Array.from(
        new Set(contrattiRows.map((r) => r.cliente_id).filter(Boolean))
      ) as string[];

      const utenteIds = Array.from(
        new Set(
          contrattiRows
            .map((r) => r.utente_operatore_id)
            .filter((v): v is string => !!v)
        )
      );

      let clientiMap = new Map<string, ClienteLite>();
      let utentiMap = new Map<string, UtenteLite>();

      if (clienteIds.length > 0) {
        const { data: clientiData, error: clientiError } = await supabase
          .from("tbclienti")
          .select("id, ragione_sociale")
          .in("id", clienteIds);

        if (clientiError) {
          console.error("Errore caricamento locatori:", clientiError);
        } else {
          const clienti = ((clientiData as unknown) as ClienteLite[]) || [];
          clientiMap = new Map(clienti.map((c) => [c.id, c]));
        }
      }

      if (utenteIds.length > 0) {
        const { data: utentiData, error: utentiError } = await supabase
          .from("tbutenti")
          .select("id, nome, cognome, email")
          .in("id", utenteIds);

        if (utentiError) {
          console.error("Errore caricamento utenti:", utentiError);
        } else {
          const utenti = ((utentiData as unknown) as UtenteLite[]) || [];
          utentiMap = new Map(utenti.map((u) => [u.id, u]));
        }
      }

      const merged: ContrattoAffittoView[] = contrattiRows.map((row) => ({
        ...row,
        locatore_label:
          clientiMap.get(row.cliente_id)?.ragione_sociale?.trim() || "-",
        operatore_label: row.utente_operatore_id
          ? getOperatoreLabel(utentiMap.get(row.utente_operatore_id))
          : "-",
      }));

      merged.sort((a, b) => {
        const dateCompare =
          new Date(a.data_prossima_scadenza).getTime() -
          new Date(b.data_prossima_scadenza).getTime();

        if (dateCompare !== 0) return dateCompare;

        return a.locatore_label.localeCompare(b.locatore_label, "it", {
          sensitivity: "base",
        });
      });

      setContratti(merged);
    } catch (err) {
      console.error("Errore inatteso caricamento contratti:", err);
      setContratti([]);
    } finally {
      setLoading(false);
    }
  };

  const contrattiFiltrati = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return contratti;

    return contratti.filter((row) => {
      const testo = [
        row.locatore_label,
        row.conduttore || "",
        row.descrizione_immobile_locato || "",
        row.codice_identificativo_registrazione || "",
        row.operatore_label || "",
        row.emailperalert || "",
      ]
        .join(" ")
        .toLowerCase();

      return testo.includes(q);
    });
  }, [contratti, search]);

  const handleNuovo = () => {
    router.push("/scadenze/affitti/nuovo");
  };

  const handleApri = (id: string) => {
    router.push(`/scadenze/affitti/nuovo?id=${id}`);
  };

  const handleDelete = async (id: string) => {
    const conferma = window.confirm(
      "Vuoi eliminare definitivamente questo contratto?"
    );
    if (!conferma) return;

    try {
      const supabase = getSupabaseClient();
      const supabaseAny = supabase as any;

      const { error } = await supabaseAny.from("tbscadaffitti").delete().eq("id", id);

      if (error) {
        console.error("Errore eliminazione contratto:", error);
        alert("Errore durante l'eliminazione del contratto.");
        return;
      }

      await loadContratti();
    } catch (err) {
      console.error("Errore inatteso eliminazione contratto:", err);
      alert("Errore inatteso durante l'eliminazione.");
    }
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
          placeholder="Cerca per locatore, conduttore, immobile, email o codice registrazione..."
          className="w-full rounded border px-3 py-2"
        />
      </div>

      <div className="overflow-x-auto rounded border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-3 text-left">Locatore</th>
              <th className="p-3 text-left">Conduttore</th>
              <th className="p-3 text-left">Immobile locato</th>
              <th className="p-3 text-left">Codice identificativo</th>
              <th className="p-3 text-left">Registrazione</th>
              <th className="p-3 text-left">Prossima scadenza</th>
              <th className="p-3 text-left">Annualità</th>
              <th className="p-3 text-left">Alert</th>
              <th className="p-3 text-left">Operatore</th>
              <th className="p-3 text-left">Email alert</th>
              <th className="p-3 text-left">Stato</th>
              <th className="p-3 text-left">Azioni</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={12} className="p-4 text-center">
                  Caricamento...
                </td>
              </tr>
            ) : contrattiFiltrati.length === 0 ? (
              <tr>
                <td colSpan={12} className="p-4 text-center">
                  Nessun contratto trovato
                </td>
              </tr>
            ) : (
              contrattiFiltrati.map((row) => {
                const stato = getStato(row);

                return (
                  <tr key={row.id} className="border-t">
                    <td className="p-3">{row.locatore_label}</td>
                    <td className="p-3">{row.conduttore || "-"}</td>
                    <td className="p-3">{row.descrizione_immobile_locato || "-"}</td>
                    <td className="p-3">
                      {row.codice_identificativo_registrazione || "-"}
                    </td>
                    <td className="p-3">{formatDate(row.data_registrazione_atto)}</td>
                    <td className="p-3">{formatDate(row.data_prossima_scadenza)}</td>
                    <td className="p-3">
                      {row.contatore_anni}/{row.durata_contratto_anni}
                    </td>
                    <td className="p-3">{getAlertProgress(row)}</td>
                    <td className="p-3">{row.operatore_label}</td>
                    <td className="p-3">{row.emailperalert || "-"}</td>
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
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => handleApri(row.id)}
                          className="text-blue-600 hover:text-blue-800"
                          title="Apri"
                        >
                          <Eye size={18} />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDelete(row.id)}
                          className="text-red-600 hover:text-red-800"
                          title="Elimina"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
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
