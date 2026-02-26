import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

type ScadenzaFiscaliRow =
  Database["public"]["Tables"]["tbscadfiscali"]["Row"];
type Utente = Database["public"]["Tables"]["tbutenti"]["Row"];

type ScadenzaFiscali = ScadenzaFiscaliRow & {
  professionista?: string;
  operatore?: string;
};

export default function ScadenzeFiscaliPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [scadenze, setScadenze] = useState<ScadenzaFiscali[]>([]);
  const [utenti, setUtenti] = useState<Utente[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterOperatore, setFilterOperatore] = useState("__all__");
  const [filterProfessionista, setFilterProfessionista] = useState("__all__");

  const [localNotes, setLocalNotes] = useState<Record<string, string>>({});
  const [noteTimers, setNoteTimers] = useState<
    Record<string, NodeJS.Timeout>
  >({});

  const [stats, setStats] = useState({
    totale: 0,
    confermate: 0,
    nonConfermate: 0
  });

  useEffect(() => {
    checkAuthAndLoad();
  }, []);

  const checkAuthAndLoad = async () => {
    const {
      data: { session }
    } = await supabase.auth.getSession();

    if (!session) {
      router.push("/login");
      return;
    }
    await loadData();
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [scadenzeData, utentiData] = await Promise.all([
        loadScadenze(),
        loadUtenti()
      ]);

      setScadenze(scadenzeData);
      setUtenti(utentiData);

      const confermate = scadenzeData.filter(
        s => s.conferma_riga
      ).length;

      setStats({
        totale: scadenzeData.length,
        confermate,
        nonConfermate: scadenzeData.length - confermate
      });
    } catch {
      toast({
        title: "Errore",
        description: "Impossibile caricare i dati",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadScadenze = async (): Promise<ScadenzaFiscali[]> => {
    const { data, error } = await supabase
      .from("tbscadfiscali")
      .select(
        `*,
         professionista:tbutenti!tbscadfiscali_utente_professionista_id_fkey(nome,cognome),
         operatore:tbutenti!tbscadfiscali_utente_operatore_id_fkey(nome,cognome)`
      )
      .order("nominativo");

    if (error) throw error;

    return (data || []).map(r => ({
      ...r,
      professionista: r.professionista
        ? `${r.professionista.nome} ${r.professionista.cognome}`
        : "-",
      operatore: r.operatore
        ? `${r.operatore.nome} ${r.operatore.cognome}`
        : "-"
    }));
  };

  const loadUtenti = async () => {
    const { data } = await supabase
      .from("tbutenti")
      .select("*")
      .order("cognome");

    return data || [];
  };

  const handleToggleField = async (
    id: string,
    field: keyof ScadenzaFiscali,
    value: any
  ) => {
    const newValue = !value;

    setScadenze(prev =>
      prev.map(s =>
        s.id === id ? { ...s, [field]: newValue } : s
      )
    );

    await supabase
      .from("tbscadfiscali")
      .update({ [field]: newValue })
      .eq("id", id);
  };

  const handleUpdateField = async (
    id: string,
    field: keyof ScadenzaFiscali,
    value: any
  ) => {
    await supabase
      .from("tbscadfiscali")
      .update({ [field]: value || null })
      .eq("id", id);

    setScadenze(prev =>
      prev.map(s =>
        s.id === id ? { ...s, [field]: value } : s
      )
    );
  };

  const handleNoteChange = (id: string, value: string) => {
    setLocalNotes(p => ({ ...p, [id]: value }));

    if (noteTimers[id]) clearTimeout(noteTimers[id]);

    const timer = setTimeout(async () => {
      await supabase
        .from("tbscadfiscali")
        .update({ note: value || null })
        .eq("id", id);
    }, 1000);

    setNoteTimers(p => ({ ...p, [id]: timer }));
  };

  const filteredScadenze = scadenze.filter(s =>
    s.nominativo?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) return null;

  return (
    <Card>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <tbody>
            {filteredScadenze.map(scadenza => (
              <tr
                key={scadenza.id}
                className={`border-b transition-colors
                  ${
                    scadenza.conferma_invii
                      ? "bg-red-100 hover:bg-red-200"
                      : "hover:bg-green-50"
                  }
                `}
              >
                <td className="p-2 font-medium">
                  {scadenza.nominativo}
                </td>

                <td className="p-2 text-center">
                  <Checkbox
                    checked={scadenza.conferma_invii || false}
                    onCheckedChange={() =>
                      handleToggleField(
                        scadenza.id,
                        "conferma_invii",
                        scadenza.conferma_invii
                      )
                    }
                  />
                </td>

                <td className="p-2">
                  <Textarea
                    value={
                      localNotes[scadenza.id] ??
                      scadenza.note ??
                      ""
                    }
                    onChange={e =>
                      handleNoteChange(
                        scadenza.id,
                        e.target.value
                      )
                    }
                  />
                </td>

                <td className="p-2 text-center">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(scadenza.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
