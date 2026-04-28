import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { getSupabaseClient } from "@/lib/supabaseClient";

type RegolaScadenza = {
  id: string;
  modulo: string;
  codice: string;
  descrizione: string;
  campo_data_base: string;
  direzione: "+" | "-";
  giorni: number;
  applica_sospensione_feriale: boolean;
  attivo: boolean;
  ordine: number;
};

export default function RegoleScadenzePage() {
  const router = useRouter();

  const [regole, setRegole] = useState<RegolaScadenza[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [errore, setErrore] = useState("");
  const [successo, setSuccesso] = useState("");

  useEffect(() => {
    loadRegole();
  }, []);

  const loadRegole = async () => {
    const supabase = getSupabaseClient();

    setLoading(true);
    setErrore("");

    const { data, error } = await (supabase as any)
      .from("tbcontenzioso_regole_scadenze")
      .select("*")
      .order("ordine", { ascending: true });

    if (error) {
      console.error(error);
      setErrore("Errore durante il caricamento delle regole scadenze.");
      setLoading(false);
      return;
    }

    setRegole((data || []) as RegolaScadenza[]);
    setLoading(false);
  };

  const updateRegola = (
    id: string,
    field: keyof RegolaScadenza,
    value: string | number | boolean
  ) => {
    setRegole((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              [field]: value,
            }
          : r
      )
    );
  };

  const salvaRegola = async (regola: RegolaScadenza) => {
    const supabase = getSupabaseClient();

    setSavingId(regola.id);
    setErrore("");
    setSuccesso("");

    const payload = {
      modulo: regola.modulo,
      codice: regola.codice,
      descrizione: regola.descrizione,
      campo_data_base: regola.campo_data_base,
      direzione: regola.direzione,
      giorni: Number(regola.giorni) || 0,
      applica_sospensione_feriale: regola.applica_sospensione_feriale,
      attivo: regola.attivo,
      ordine: Number(regola.ordine) || 0,
    };

    const { error } = await (supabase as any)
      .from("tbcontenzioso_regole_scadenze")
      .update(payload)
      .eq("id", regola.id);

    setSavingId(null);

    if (error) {
      console.error(error);
      setErrore("Errore durante il salvataggio della regola.");
      return;
    }

    setSuccesso("Regola salvata correttamente.");
    await loadRegole();
  };

  const getModuloLabel = (modulo: string) => {
    const labels: Record<string, string> = {
      PVC: "PVC",
      SCHEMA_ATTO: "Schema d'atto",
      ADESIONE: "Accertamento con adesione",
      RICORSO_PRIMO_GRADO: "Ricorso 1° grado",
      RICORSO_SECONDO_GRADO: "Ricorso 2° grado",
      CASSAZIONE: "Cassazione",
    };

    return labels[modulo] || modulo;
  };

  if (loading) {
    return <div className="p-6">Caricamento regole scadenze...</div>;
  }

  const rigeneraScadenze = async () => {
  const supabase = getSupabaseClient();

  setErrore("");
  setSuccesso("");

  const { error } = await (supabase as any).rpc(
    "rigenera_scadenze_contenzioso_base"
  );

  if (error) {
    console.error(error);
    setErrore("Errore durante la rigenerazione delle scadenze.");
    return;
  }

  setSuccesso("Scadenze rigenerate correttamente.");
};
  
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-7xl rounded-2xl bg-white p-6 shadow">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Regole scadenze contenzioso
            </h1>
            <p className="text-sm text-gray-500">
              Gestione giorni, sospensione feriale e attivazione delle scadenze
            </p>
          </div>

          <div className="flex gap-2">
  <button
    type="button"
    onClick={rigeneraScadenze}
    className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700"
  >
    Rigenera scadenze
  </button>
            
          <button
            type="button"
            onClick={() => router.push("/contenzioso")}
            className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-100"
          >
            Indietro
          </button>
        </div>

        {errore && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {errore}
          </div>
        )}

        {successo && (
          <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
            {successo}
          </div>
        )}

        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[1100px] text-sm">
            <thead className="bg-gray-100 text-left">
              <tr>
                <th className="p-3">Modulo</th>
                <th className="p-3">Descrizione</th>
                <th className="p-3">Campo base</th>
                <th className="p-3">Direzione</th>
                <th className="p-3">Giorni</th>
                <th className="p-3">Sosp. feriale</th>
                <th className="p-3">Attivo</th>
                <th className="p-3">Ordine</th>
                <th className="p-3 text-right">Azioni</th>
              </tr>
            </thead>

            <tbody>
              {regole.map((regola) => (
                <tr key={regola.id} className="border-t">
                  <td className="p-3 font-medium">
                    {getModuloLabel(regola.modulo)}
                    <div className="text-xs text-gray-400">
                      {regola.codice}
                    </div>
                  </td>

                  <td className="p-3">
                    <input
                      value={regola.descrizione}
                      onChange={(e) =>
                        updateRegola(regola.id, "descrizione", e.target.value)
                      }
                      className="w-full rounded-lg border p-2"
                    />
                  </td>

                  <td className="p-3">
                    <input
                      value={regola.campo_data_base}
                      onChange={(e) =>
                        updateRegola(
                          regola.id,
                          "campo_data_base",
                          e.target.value
                        )
                      }
                      className="w-full rounded-lg border p-2"
                    />
                  </td>

                  <td className="p-3">
                    <select
                      value={regola.direzione}
                      onChange={(e) =>
                        updateRegola(
                          regola.id,
                          "direzione",
                          e.target.value as "+" | "-"
                        )
                      }
                      className="w-full rounded-lg border p-2"
                    >
                      <option value="+">+</option>
                      <option value="-">-</option>
                    </select>
                  </td>

                  <td className="p-3">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={regola.giorni}
                      onChange={(e) =>
                        updateRegola(
                          regola.id,
                          "giorni",
                          Number(e.target.value.replace(/\D/g, "")) || 0
                        )
                      }
                      className="w-24 rounded-lg border p-2"
                    />
                  </td>

                  <td className="p-3">
                    <select
                      value={
                        regola.applica_sospensione_feriale ? "Si" : "No"
                      }
                      onChange={(e) =>
                        updateRegola(
                          regola.id,
                          "applica_sospensione_feriale",
                          e.target.value === "Si"
                        )
                      }
                      className="w-full rounded-lg border p-2"
                    >
                      <option value="Si">Sì</option>
                      <option value="No">No</option>
                    </select>
                  </td>

                  <td className="p-3">
                    <select
                      value={regola.attivo ? "Si" : "No"}
                      onChange={(e) =>
                        updateRegola(
                          regola.id,
                          "attivo",
                          e.target.value === "Si"
                        )
                      }
                      className="w-full rounded-lg border p-2"
                    >
                      <option value="Si">Sì</option>
                      <option value="No">No</option>
                    </select>
                  </td>

                  <td className="p-3">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={regola.ordine}
                      onChange={(e) =>
                        updateRegola(
                          regola.id,
                          "ordine",
                          Number(e.target.value.replace(/\D/g, "")) || 0
                        )
                      }
                      className="w-24 rounded-lg border p-2"
                    />
                  </td>

                  <td className="p-3 text-right">
                    <button
                      type="button"
                      onClick={() => salvaRegola(regola)}
                      disabled={savingId === regola.id}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {savingId === regola.id ? "Salvo..." : "Salva"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {regole.length === 0 && (
          <div className="py-10 text-center text-sm text-gray-500">
            Nessuna regola scadenza trovata.
          </div>
        )}
      </div>
    </div>
  );
}
