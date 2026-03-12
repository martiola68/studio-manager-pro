import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CalendarClock, Clock3 } from "lucide-react";
import { format, differenceInCalendarDays, startOfDay } from "date-fns";
import { it } from "date-fns/locale";

type PromemoriaItem = {
  id: string;
  titolo: string | null;
  descrizione: string | null;
  data_scadenza: string;
  priorita: string | null;
  working_progress: string | null;
  settore: string | null;
  destinatario_id: string | null;
  studio_id?: string | null;
};

type UtenteLite = {
  id: string;
  nome: string;
  cognome: string;
};

type Props = {
  onOpenPromemoriaPage?: () => void;
};

export default function PromemoriaImminentiCard({ onOpenPromemoriaPage }: Props) {
  const [items, setItems] = useState<PromemoriaItem[]>([]);
  const [utentiMap, setUtentiMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);

        const { data: authData } = await supabase.auth.getUser();
        const authUser = authData.user;
        if (!authUser) return;

        const { data: currentUser } = await supabase
          .from("tbutenti")
          .select("id, settore, responsabile, studio_id")
          .eq("id", authUser.id)
          .single();

        if (!currentUser?.studio_id) return;

        const { data: promemoriaData, error } = await supabase
          .from("tbpromemoria")
          .select(`
            id,
            titolo,
            descrizione,
            data_scadenza,
            priorita,
            working_progress,
            settore,
            destinatario_id,
            studio_id
          `)
          .eq("studio_id", currentUser.studio_id)
          .not("data_scadenza", "is", null)
          .neq("working_progress", "Completato")
          .neq("working_progress", "Annullata")
          .order("data_scadenza", { ascending: true });

        if (error) throw error;

        const today = startOfDay(new Date());

        const filtered = (promemoriaData || []).filter((p) => {
          const scadenza = startOfDay(new Date(p.data_scadenza));
          const diff = differenceInCalendarDays(scadenza, today);

          const canView =
            currentUser.responsabile === true
              ? !currentUser.settore || p.settore === currentUser.settore || p.destinatario_id === currentUser.id
              : p.destinatario_id === currentUser.id || p.settore === currentUser.settore;

          return canView && diff <= 7;
        });

        setItems(filtered);

        const ids = [...new Set(filtered.map((p) => p.destinatario_id).filter(Boolean))] as string[];
        if (ids.length > 0) {
          const { data: utenti } = await supabase
            .from("tbutenti")
            .select("id, nome, cognome")
            .in("id", ids);

          const map: Record<string, string> = {};
          (utenti || []).forEach((u: UtenteLite) => {
            map[u.id] = `${u.nome} ${u.cognome}`.trim();
          });
          setUtentiMap(map);
        }
      } catch (err) {
        console.error("Errore caricamento promemoria imminenti:", err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const grouped = useMemo(() => {
    const today = startOfDay(new Date());

    return items.map((item) => {
      const scadenza = startOfDay(new Date(item.data_scadenza));
      const diff = differenceInCalendarDays(scadenza, today);

      let bucket: "scaduti" | "oggi" | "entro2" | "entro7" = "entro7";
      if (diff < 0) bucket = "scaduti";
      else if (diff === 0) bucket = "oggi";
      else if (diff <= 2) bucket = "entro2";
      else bucket = "entro7";

      return { ...item, diff, bucket };
    });
  }, [items]);

  const getBadge = (diff: number) => {
    if (diff < 0) return <Badge variant="destructive">Scaduto</Badge>;
    if (diff === 0) return <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">Oggi</Badge>;
    if (diff <= 2) return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Entro 2 giorni</Badge>;
    return <Badge variant="outline">Entro 7 giorni</Badge>;
  };

  const getPriorityClass = (priorita?: string | null) => {
    if (priorita === "Alta") return "text-red-600";
    if (priorita === "Media") return "text-yellow-700";
    if (priorita === "Bassa") return "text-green-700";
    return "text-gray-600";
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarClock className="h-4 w-4" />
          Promemoria imminenti
        </CardTitle>
        {onOpenPromemoriaPage && (
          <Button size="sm" variant="outline" onClick={onOpenPromemoriaPage}>
            Apri
          </Button>
        )}
      </CardHeader>

      <CardContent>
        {loading ? (
          <p className="text-sm text-gray-500">Caricamento...</p>
        ) : grouped.length === 0 ? (
          <p className="text-sm text-gray-500">Nessun promemoria imminente.</p>
        ) : (
          <div className="space-y-3">
            {grouped.slice(0, 8).map((item) => (
              <div
                key={item.id}
                className={`rounded-lg border p-3 ${
                  item.diff < 0 ? "border-red-200 bg-red-50" : "bg-white"
                }`}
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {item.diff < 0 ? (
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                      ) : (
                        <Clock3 className="h-4 w-4 text-gray-500" />
                      )}
                     <p className="truncate font-medium">{item.titolo || "Senza titolo"}</p>
                    </div>
                    {item.descrizione && (
                      <p className="mt-1 line-clamp-2 text-sm text-gray-600">{item.descrizione}</p>
                    )}
                  </div>
                  {getBadge(item.diff)}
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
                  <span>
                    Scadenza:{" "}
                    <strong>{format(new Date(item.data_scadenza), "dd/MM/yyyy", { locale: it })}</strong>
                  </span>
                  <span className={getPriorityClass(item.priorita)}>
                    Priorità: <strong>{item.priorita || "-"}</strong>
                  </span>
                  <span>
                    Destinatario: <strong>{item.destinatario_id ? utentiMap[item.destinatario_id] || "-" : "-"}</strong>
                  </span>
                  <span>
                    Settore: <strong>{item.settore || "-"}</strong>
                  </span>
                </div>
              </div>
            ))}

            {grouped.length > 8 && (
              <p className="text-xs text-gray-500">
                Mostrati 8 di {grouped.length} promemoria imminenti.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
