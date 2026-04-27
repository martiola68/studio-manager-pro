import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Scadenza = {
  id: string;
  modulo: string;
  descrizione: string;
  data_scadenza: string;
  giorni_residui: number;
  stato: string;
  tbcontenzioso_processo?: {
    numero_atto?: string | null;
    anno_riferimento?: number | null;
    tbclienti?: { ragione_sociale?: string | null } | null;
    tbcontenzioso_tributi_constatazione?: { descrizione?: string | null } | null;
  } | null;
};

export default function ScadenzeContenzioso() {
  const [scadenze, setScadenze] = useState<Scadenza[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadScadenze();
  }, []);

  const loadScadenze = async () => {
    const supabase = getSupabaseClient();

    const { data } = await (supabase as any)
      .from("tbcontenzioso_scadenze_generate")
      .select(`
        *,
        tbcontenzioso_processo:processo_id(
          numero_atto,
          anno_riferimento,
          tbclienti:cliente_id(ragione_sociale),
          tbcontenzioso_tributi_constatazione:tributo_constatazione_id(descrizione)
        )
      `)
      .order("data_scadenza", { ascending: true });

    setScadenze(data || []);
    setLoading(false);
  };

  const getColor = (giorni: number) => {
    if (giorni <= 5) return "bg-red-600 text-white";
    if (giorni <= 10) return "bg-orange-500 text-white";
    return "bg-green-600 text-white";
  };

  const formatDateIT = (date?: string | null) => {
    if (!date) return "-";
    const [yyyy, mm, dd] = date.split("-");
    return `${dd}/${mm}/${yyyy}`;
  };

  if (loading) {
    return <div className="p-6">Caricamento scadenze...</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Scadenze contenzioso</CardTitle>
        </CardHeader>

        <CardContent className="space-y-3">
          {scadenze.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between border p-3 rounded-lg"
            >
              <div>
                <div className="font-semibold">{s.descrizione}</div>

                <div className="text-sm text-gray-700">
                  {s.tbcontenzioso_processo?.tbclienti?.ragione_sociale ||
                    "Cliente non indicato"}
                </div>

                <div className="text-sm text-gray-500">
                  Atto n. {s.tbcontenzioso_processo?.numero_atto || "-"} ·{" "}
                  Anno {s.tbcontenzioso_processo?.anno_riferimento || "-"} ·{" "}
                  {s.tbcontenzioso_processo?.tbcontenzioso_tributi_constatazione
                    ?.descrizione || "Tributo non indicato"}
                </div>

                <div className="text-xs text-gray-400">
                  {s.modulo} - {formatDateIT(s.data_scadenza)}
                </div>
              </div>

              <Badge className={getColor(s.giorni_residui)}>
                {s.giorni_residui} gg
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
