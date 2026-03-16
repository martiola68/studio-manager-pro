import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getSupabaseClient } from "@/lib/supabaseClient";

type Cliente = {
  id: string;
  ragione_sociale?: string | null;
  cognome_nome?: string | null;
  codice_fiscale?: string | null;
};

type AV1Row = {
  id: string;
  studio_id?: string | null;
  cliente_id?: string | null;
  DataVerifica?: string | null;
  ScadenzaVerifica?: string | null;
  AV4Generato?: boolean | null;
  AV1Conferma?: boolean | null;
  tbclienti?: Cliente | Cliente[] | null;
};

export default function AntiriciclaggioPage() {
  const supabase = getSupabaseClient();
  const navigate = useNavigate();

  const [rows, setRows] = useState<AV1Row[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRows = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("tbAV1")
      .select(`
        id,
        studio_id,
        cliente_id,
        DataVerifica,
        ScadenzaVerifica,
        AV4Generato,
        AV1Conferma,
        tbclienti (
          id,
          ragione_sociale,
          cognome_nome,
          codice_fiscale
        )
      `)
      .order("DataVerifica", { ascending: false });

    if (error) {
      console.error("Errore caricamento tbAV1:", error);
      setRows([]);
    } else {
      setRows((data as AV1Row[]) || []);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadRows();
  }, []);

  const getCliente = (row: AV1Row): Cliente | null => {
    if (!row.tbclienti) return null;
    return Array.isArray(row.tbclienti) ? row.tbclienti[0] : row.tbclienti;
  };

  const handleModificaAV1 = (id: string) => {
    navigate(`/antiriciclaggio/modello-av1?id=${id}`);
  };

  const handleModificaAV4 = async (av1Id: string) => {
    const { data, error } = await supabase
      .from("tbAV4")
      .select("id")
      .eq("av1_id", av1Id)
      .maybeSingle();

    if (error) {
      console.error("Errore ricerca AV4:", error);
      alert("Errore durante la ricerca del modello AV4.");
      return;
    }

    if (data?.id) {
      navigate(`/antiriciclaggio/modello-av4?id=${data.id}&av1_id=${av1Id}`);
    } else {
      navigate(`/antiriciclaggio/modello-av4?av1_id=${av1Id}`);
    }
  };

  const handleEliminaCompleto = async (av1Id: string) => {
    const conferma = window.confirm(
      "Vuoi eliminare AV1 e l'eventuale AV4 collegato?"
    );
    if (!conferma) return;

    try {
      const { data: av4Rows, error: av4Error } = await supabase
        .from("tbAV4")
        .select("id")
        .eq("av1_id", av1Id);

      if (av4Error) throw av4Error;

      const av4Ids = (av4Rows || []).map((r) => r.id);

      if (av4Ids.length > 0) {
        const { error: titolariError } = await supabase
          .from("tbAV4_titolari")
          .delete()
          .in("av4_id", av4Ids);

        if (titolariError) throw titolariError;

        const { error: deleteAV4Error } = await supabase
          .from("tbAV4")
          .delete()
          .in("id", av4Ids);

        if (deleteAV4Error) throw deleteAV4Error;
      }

      const { error: deleteAV1Error } = await supabase
        .from("tbAV1")
        .delete()
        .eq("id", av1Id);

      if (deleteAV1Error) throw deleteAV1Error;

      await loadRows();
    } catch (err) {
      console.error("Errore eliminazione completa:", err);
      alert("Errore durante l'eliminazione del record.");
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Antiriciclaggio</h1>

        <button
          type="button"
          onClick={() => navigate("/antiriciclaggio/modello-av1")}
          className="px-4 py-2 rounded bg-blue-600 text-white"
        >
          Nuovo AV1
        </button>
      </div>

      {loading ? (
        <div>Caricamento...</div>
      ) : (
        <div className="overflow-x-auto border rounded-lg bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-3 text-left">Cliente</th>
                <th className="p-3 text-left">Codice fiscale</th>
                <th className="p-3 text-left">Data verifica</th>
                <th className="p-3 text-left">Scadenza verifica</th>
                <th className="p-3 text-center">AV1 conferma</th>
                <th className="p-3 text-center">AV4 generato</th>
                <th className="p-3 text-center">Azioni</th>
              </tr>
            </thead>

            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-4 text-center">
                    Nessun AV1 inserito
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const cliente = getCliente(row);
                  const nomeCliente =
                    cliente?.ragione_sociale ||
                    cliente?.cognome_nome ||
                    "-";

                  return (
                    <tr key={row.id} className="border-t">
                      <td className="p-3">{nomeCliente}</td>
                      <td className="p-3">{cliente?.codice_fiscale || "-"}</td>
                      <td className="p-3">{row.DataVerifica || "-"}</td>
                      <td className="p-3">{row.ScadenzaVerifica || "-"}</td>
                      <td className="p-3 text-center">
                        {row.AV1Conferma ? "Sì" : "No"}
                      </td>
                      <td className="p-3 text-center">
                        {row.AV4Generato ? "Sì" : "No"}
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleModificaAV1(row.id)}
                            className="px-3 py-1 rounded bg-amber-500 text-white"
                          >
                            Modifica AV1
                          </button>

                          <button
                            type="button"
                            onClick={() => handleModificaAV4(row.id)}
                            disabled={!row.AV1Conferma}
                            className={`px-3 py-1 rounded text-white ${
                              row.AV1Conferma
                                ? "bg-green-600"
                                : "bg-gray-400 cursor-not-allowed"
                            }`}
                          >
                            Modifica AV4
                          </button>

                          <button
                            type="button"
                            onClick={() => handleEliminaCompleto(row.id)}
                            className="px-3 py-1 rounded bg-red-600 text-white"
                          >
                            Elimina record completo
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
      )}
    </div>
  );
}
