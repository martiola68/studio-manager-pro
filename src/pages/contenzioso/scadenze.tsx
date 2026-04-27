import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Scadenza = {
  id: string;
  modulo: string;
  descrizione: string;
  data_scadenza: string;
  giorni_residui: number;
  stato: string;
};

export default function ScadenzeContenzioso() {
  const [scadenze, setScadenze] = useState<Scadenza[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadScadenze();
  }, []);

  const loadScadenze = async () => {
    const supabase = getSupabaseClient();

    const { data } = await supabase
      .from("tbcontenzioso_scadenze_generate")
      .select("*")
      .order("data_scadenza", { ascending: true });

    setScadenze(data || []);
    setLoading(false);
  };

  const getColor = (giorni: number) => {
    if (giorni < 0) return "bg-red-500 text-white";
    if (giorni <= 15) return "bg-orange-500 text-white";
    return "bg-green-600 text-white";
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
                <div className="text-sm text-gray-500">
                  {s.modulo} - {s.data_scadenza}
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
