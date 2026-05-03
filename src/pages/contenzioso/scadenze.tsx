import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  calcolaGiorniResidui,
  getClasseGiorniResidui,
} from "@/utils/contenziosoScadenze";

type Scadenza = {
  id: string;
  modulo: string;
  descrizione: string;
  data_scadenza: string;
  giorni_restanti: number;
  cliente?: string | null;
  numero_atto?: string | null;
  anno_riferimento?: number | null;
  tributo?: string | null;
};

export default function ScadenzeContenzioso() {
   const router = useRouter();
  const [scadenze, setScadenze] = useState<Scadenza[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadScadenze();
  }, []);

   const loadScadenze = async () => {
    const supabase = getSupabaseClient();

    setLoading(true);

    const [processoRes, avvisiRes, cartelleRes] = await Promise.all([
      (supabase as any)
        .from("tbcontenzioso_scadenze_generate")
        .select(`
          *,
          tbcontenzioso_processo:processo_id(
            numero_atto,
            anno_riferimento,
            tbclienti:cliente_id(ragione_sociale),
            tbcontenzioso_codici_tributo:tributo_constatazione_id(descrizione)
          )
        `),

      (supabase as any)
        .from("tbcontenzioso_avvisi_bonari")
        .select(`
          id,
          numero_atto,
          anno_riferimento,
          data_scadenza,
          giorni_restanti,
          tbclienti:cliente_id(ragione_sociale),
          tbcontenzioso_codici_tributo:tributo_constatazione_id(descrizione)
        `),

      (supabase as any)
        .from("tbcontenzioso_cartelle")
        .select(`
          id,
          numero_cartella,
          anno_riferimento,
          data_scadenza,
          giorni_restanti,
          tbclienti:cliente_id(ragione_sociale),
          tbcontenzioso_codici_tributo:tributo_constatazione_id(descrizione)
        `),
    ]);

  const processo: Scadenza[] = (processoRes.data || []).map((s: any) => ({
  id: `processo-${s.id}`,
  modulo: s.modulo || "Processo tributario",
  descrizione: s.descrizione || "Scadenza processo tributario",
  data_scadenza: s.data_scadenza,
  giorni_restanti: calcolaGiorniResidui(s.data_scadenza) ?? 0,
  cliente:
    s.tbcontenzioso_processo?.tbclienti?.ragione_sociale ||
    "Cliente non indicato",
  numero_atto: s.tbcontenzioso_processo?.numero_atto || "-",
  anno_riferimento: s.tbcontenzioso_processo?.anno_riferimento || null,
  tributo:
    s.tbcontenzioso_processo?.tbcontenzioso_codici_tributo?.descrizione ||
    "Tributo non indicato",
}));

const avvisi: Scadenza[] = (avvisiRes.data || []).map((s: any) => ({
  id: `avviso-${s.id}`,
  modulo: "Avviso bonario",
  descrizione: "Scadenza avviso bonario",
  data_scadenza: s.data_scadenza,
  giorni_restanti: calcolaGiorniResidui(s.data_scadenza) ?? 0,
  cliente: s.tbclienti?.ragione_sociale || "Cliente non indicato",
  numero_atto: s.numero_atto || "-",
  anno_riferimento: s.anno_riferimento || null,
  tributo:
    s.tbcontenzioso_codici_tributo?.descrizione ||
    "Tributo non indicato",
}));
    
const cartelle: Scadenza[] = (cartelleRes.data || []).map((s: any) => ({
  id: `cartella-${s.id}`,
  modulo: "Cartella esattoriale",
  descrizione: "Scadenza cartella esattoriale",
  data_scadenza: s.data_scadenza,
  giorni_restanti: calcolaGiorniResidui(s.data_scadenza) ?? 0,
  cliente: s.tbclienti?.ragione_sociale || "Cliente non indicato",
  numero_atto: s.numero_cartella || "-",
  anno_riferimento: s.anno_riferimento || null,
  tributo:
    s.tbcontenzioso_codici_tributo?.descrizione ||
    "Tributo non indicato",
}));

    const tutte = [...processo, ...avvisi, ...cartelle]
      .filter((s) => !!s.data_scadenza)
      .sort((a, b) => a.data_scadenza.localeCompare(b.data_scadenza));

    setScadenze(tutte);
    setLoading(false);
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
  <div className="flex items-center justify-between">
    <CardTitle>Scadenze contenzioso</CardTitle>

    <button
      type="button"
      onClick={() => router.push("/contenzioso")}
      className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-100"
    >
      Indietro
    </button>
  </div>
</CardHeader>

        <CardContent className="space-y-3">
          {scadenze.length === 0 ? (
            <div className="py-8 text-center text-gray-500">
              Nessuna scadenza trovata.
            </div>
          ) : (
            scadenze.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between border p-3 rounded-lg"
              >
                <div>
                  <div className="font-semibold">{s.descrizione}</div>

                  <div className="text-sm text-gray-700">
                    {s.cliente || "Cliente non indicato"}
                  </div>

                  <div className="text-sm text-gray-500">
                    Atto n. {s.numero_atto || "-"} · Anno{" "}
                    {s.anno_riferimento || "-"} ·{" "}
                    {s.tributo || "Tributo non indicato"}
                  </div>

                  <div className="text-xs text-gray-400">
                    {s.modulo} - {formatDateIT(s.data_scadenza)}
                  </div>
                </div>

                <Badge className={getClasseGiorniResidui(s.giorni_restanti)}>
  {s.giorni_restanti} gg
</Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
