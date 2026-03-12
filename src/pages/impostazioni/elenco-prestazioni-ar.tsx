import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type PrestazioneAR = {
  id: number;
  TipoPrestazioneAR: string;
  RischioTipoPrestAR: string;
  PunteggioPrestAR: number;
};

export default function ElencoPrestazioniARPage() {
  const [rows, setRows] = useState<PrestazioneAR[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    const { data, error } = await (supabase as any)
      .from("tbElencoPrestAR")
      .select("id, TipoPrestazioneAR, RischioTipoPrestAR, PunteggioPrestAR")
      .order("TipoPrestazioneAR", { ascending: true });

    if (error) {
      setError(error.message);
      setRows([]);
    } else {
      setRows((data || []) as PrestazioneAR[]);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Elenco Prestazioni AR</h1>
        <p className="text-gray-500 mt-1">
          Tabella prestazioni antiriciclaggio con rischio e punteggio
        </p>
      </div>

      {loading && <p>Caricamento...</p>}

      {error && <p className="text-red-600">Errore: {error}</p>}

      {!loading && !error && (
        <div className="overflow-x-auto bg-white rounded-lg border">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-3 text-left">Tipo Prestazione AR</th>
                <th className="border p-3 text-left">Rischio</th>
                <th className="border p-3 text-left">Punteggio</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="border p-3">{row.TipoPrestazioneAR}</td>
                  <td className="border p-3">{row.RischioTipoPrestAR}</td>
                  <td className="border p-3">{row.PunteggioPrestAR}</td>
                </tr>
              ))}

              {rows.length === 0 && (
                <tr>
                  <td className="border p-3" colSpan={3}>
                    Nessun dato presente
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
