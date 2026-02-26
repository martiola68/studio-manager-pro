import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type ScadenzaImu = Database["public"]["Tables"]["tbscadimu"]["Row"];

export default function ImuPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [scadenze, setScadenze] = useState<ScadenzaImu[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterConferma, setFilterConferma] = useState("__all__");

  const [localNotes, setLocalNotes] = useState<Record<string, string>>({});
  const [noteTimers, setNoteTimers] = useState<Record<string, NodeJS.Timeout>>({});

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
    await loadScadenze();
  };

  const loadScadenze = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from("tbscadimu").select("*").order("nominativo", { ascending: true });

      if (error) throw error;

      const scadenzeData = data || [];
      setScadenze(scadenzeData);

      setStats({
        totale: scadenzeData.length,
        confermate: scadenzeData.filter((s) => s.conferma_riga).length,
        nonConfermate: scadenzeData.filter((s) => !s.conferma_riga).length
      });
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleField = async (id: string, field: keyof ScadenzaImu, currentValue: boolean | null) => {
    try {
      const newValue = !currentValue;

      setScadenze((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: newValue } : s)));

      if (field === "conferma_riga") {
        setStats((prev) => ({
          ...prev,
          confermate: newValue ? prev.confermate + 1 : prev.confermate - 1,
          nonConfermate: newValue ? prev.nonConfermate - 1 : prev.nonConfermate + 1
        }));
      }

      const { error } = await supabase.from("tbscadimu").update({ [field]: newValue }).eq("id", id);

      if (error) throw error;
    } catch (error: any) {
      toast({
        title: "Errore aggiornamento",
        description: error.message,
        variant: "destructive"
      });
      await loadScadenze();
    }
  };

  const handleUpdateField = async (id: string, field: keyof ScadenzaImu, value: any) => {
    try {
      const { error } = await supabase.from("tbscadimu").update({ [field]: value || null }).eq("id", id);

      if (error) throw error;

      setScadenze((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
    } catch (error: any) {
      toast({
        title: "Errore aggiornamento",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleNoteChange = (scadenzaId: string, value: string) => {
    setLocalNotes((prev) => ({ ...prev, [scadenzaId]: value }));

    if (noteTimers[scadenzaId]) {
      clearTimeout(noteTimers[scadenzaId]);
    }

    const timer = setTimeout(async () => {
      try {
        const { error } = await supabase.from("tbscadimu").update({ note: value || null }).eq("id", scadenzaId);

        if (error) throw error;

        setScadenze((prev) => prev.map((s) => (s.id === scadenzaId ? { ...s, note: value } : s)));
      } catch (error) {
        console.error("Errore salvataggio nota:", error);
        toast({
          title: "Errore",
          description: "Impossibile salvare la nota",
          variant: "destructive"
        });
      }
    }, 1000);

    setNoteTimers((prev) => ({ ...prev, [scadenzaId]: timer }));
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Sei sicuro di voler eliminare questo record?")) return;

    try {
      const { error } = await supabase.from("tbscadimu").delete().eq("id", id);

      if (error) throw error;

      toast({
        title: "Successo",
        description: "Record eliminato"
      });
      await loadScadenze();
    } catch (error: any) {
      console.error("Errore eliminazione:", error);
      toast({
        title: "Errore",
        description: "Impossibile eliminare il record",
        variant: "destructive"
      });
    }
  };

  const filteredScadenze = scadenze.filter((s) => {
    const matchSearch =
      !searchQuery ||
      s.nominativo?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.professionista?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.operatore?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchConferma =
      filterConferma === "__all__" || (filterConferma === "true" ? s.conferma_riga : !s.conferma_riga);

    return matchSearch && matchConferma;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="inline-block h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-gray-600">Caricamento...</p>
        </div>
      </div>
    );
  }

  const dateInputClass = (value?: string | null) =>
    ["w-full", !value ? "text-transparent caret-transparent" : "", "focus:text-gray-900 focus:caret-auto"]
      .filter(Boolean)
      .join(" ");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Scadenzario IMU</h1>
          <p className="text-gray-500 mt-1">Gestione dichiarazioni e versamenti IMU</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-gray-600 mb-1">Totale Dichiarazioni</div>
            <div className="text-3xl font-bold text-gray-900">{stats.totale}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-gray-600 mb-1">Confermate</div>
            <div className="text-3xl font-bold text-green-600">{stats.confermate}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-gray-600 mb-1">Non Confermate</div>
            <div className="text-3xl font-bold text-orange-600">{stats.nonConfermate}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtri e Ricerca</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Cerca</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Cerca per nominativo, professionista, operatore..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Stato Conferma</label>
              <Select value={filterConferma} onValueChange={setFilterConferma}>
                <SelectTrigger>
                  <SelectValue placeholder="Tutti" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Tutti</SelectItem>
                  <SelectItem value="true">Confermate</SelectItem>
                  <SelectItem value="false">Non Confermate</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="relative w-full overflow-auto max-h-[600px]">
            <table className="w-full caption-bottom text-sm">
              <thead className="[&_tr]:border-b sticky top-0 z-30 bg-white shadow-sm">
                <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                  <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground sticky-col-header border-r min-w-[200px]">
                    Nominativo
                  </th>
                  <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground min-w-[150px]">
                    Professionista
                  </th>
                  <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground min-w-[150px]">
                    Operatore
                  </th>

                  <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground text-center min-w-[120px]">
                    Acconto Imu
                  </th>
                  <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground text-center min-w-[120px]">
                    Dovuto
                  </th>
                  <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground text-center min-w-[120px]">
                    Cominicato
                  </th>
                  <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground min-w-[160px]">
                    Data comunicazione
                  </th>

                  <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground text-center min-w-[120px]">
                    Saldo Imu
                  </th>
                  <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground text-center min-w-[120px]">
                    Dovuto
                  </th>
                  <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground text-center min-w-[120px]">
                    Comunicato
                  </th>
                  <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground min-w-[160px]">
                    Data comunicazione
                  </th>

                  <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground text-center min-w-[140px]">
                    Con dic. Imu
                  </th>
                  <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground min-w-[170px]">
                    Data scadenza dic.
                  </th>
                  <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground text-center min-w-[140px]">
                    Dic. presentata
                  </th>

                  <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground min-w-[300px]">
                    Note
                  </th>
                  <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground min-w-[140px] text-center">
                    Conferma dati
                  </th>
                  <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground min-w-[100px] text-center">
                    Azioni
                  </th>
                </tr>
              </thead>

              <tbody className="[&_tr:last-child]:border-0">
                {filteredScadenze.length === 0 ? (
                  <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                    <td colSpan={17} className="p-2 align-middle text-center py-8 text-gray-500">
                      Nessun record trovato
                    </td>
                  </tr>
                ) : (
                  filteredScadenze.map((scadenza) => (
                    <tr
                      key={scadenza.id}
                      className={[
                        "border-b transition-colors",
                        scadenza.conferma_riga ? "bg-red-50 hover:bg-red-50" : "hover:bg-green-50"
                      ].join(" ")}
                    >
                      <td className="p-2 align-middle sticky-col-cell border-r font-medium min-w-[200px]">
                        {scadenza.nominativo}
                      </td>
                      <td className="p-2 align-middle min-w-[150px]">{scadenza.professionista || "-"}</td>
                      <td className="p-2 align-middle min-w-[150px]">{scadenza.operatore || "-"}</td>

                      <td className="p-2 align-middle text-center min-w-[120px]">
                        <Checkbox
                          checked={scadenza.acconto_imu || false}
                          onCheckedChange={() => handleToggleField(scadenza.id, "acconto_imu", scadenza.acconto_imu)}
                        />
                      </td>
                      <td className="p-2 align-middle text-center min-w-[120px]">
                        <Checkbox
                          checked={scadenza.acconto_dovuto || false}
                          onCheckedChange={() =>
                            handleToggleField(scadenza.id, "acconto_dovuto", scadenza.acconto_dovuto)
                          }
                        />
                      </td>
                      <td className="p-2 align-middle text-center min-w-[120px]">
                        <Checkbox
                          checked={scadenza.acconto_comunicato || false}
                          onCheckedChange={() =>
                            handleToggleField(scadenza.id, "acconto_comunicato", scadenza.acconto_comunicato)
                          }
                        />
                      </td>
                      <td className="p-2 align-middle min-w-[160px]">
                        <Input
                          type="date"
                          value={scadenza.data_com_acconto || ""}
                          onChange={(e) => handleUpdateField(scadenza.id, "data_com_acconto", e.target.value)}
                          className={dateInputClass(scadenza.data_com_acconto)}
                        />
                      </td>

                      <td className="p-2 align-middle text-center min-w-[120px]">
                        <Checkbox
                          checked={scadenza.saldo_imu || false}
                          onCheckedChange={() => handleToggleField(scadenza.id, "saldo_imu", scadenza.saldo_imu)}
                        />
                      </td>
                      <td className="p-2 align-middle text-center min-w-[120px]">
                        <Checkbox
                          checked={scadenza.saldo_dovuto || false}
                          onCheckedChange={() => handleToggleField(scadenza.id, "saldo_dovuto", scadenza.saldo_dovuto)}
                        />
                      </td>
                      <td className="p-2 align-middle text-center min-w-[120px]">
                        <Checkbox
                          checked={scadenza.saldo_comunicato || false}
                          onCheckedChange={() =>
                            handleToggleField(scadenza.id, "saldo_comunicato", scadenza.saldo_comunicato)
                          }
                        />
                      </td>
                      <td className="p-2 align-middle min-w-[160px]">
                        <Input
                          type="date"
                          value={scadenza.data_com_saldo || ""}
                          onChange={(e) => handleUpdateField(scadenza.id, "data_com_saldo", e.target.value)}
                          className={dateInputClass(scadenza.data_com_saldo)}
                        />
                      </td>

                      <td className="p-2 align-middle text-center min-w-[140px]">
                        <Checkbox
                          checked={scadenza.dichiarazione_imu || false}
                          onCheckedChange={() =>
                            handleToggleField(scadenza.id, "dichiarazione_imu", scadenza.dichiarazione_imu)
                          }
                        />
                      </td>
                      <td className="p-2 align-middle min-w-[170px]">
                        <Input
                          type="date"
                          value={scadenza.data_scad_dichiarazione || ""}
                          onChange={(e) => handleUpdateField(scadenza.id, "data_scad_dichiarazione", e.target.value)}
                          className={dateInputClass(scadenza.data_scad_dichiarazione)}
                        />
                      </td>
                      <td className="p-2 align-middle text-center min-w-[140px]">
                        <Checkbox
                          checked={scadenza.dichiarazione_presentata || false}
                          onCheckedChange={() =>
                            handleToggleField(
                              scadenza.id,
                              "dichiarazione_presentata",
                              scadenza.dichiarazione_presentata
                            )
                          }
                        />
                      </td>

                      <td className="p-2 align-middle min-w-[300px]">
                        <Textarea
                          value={localNotes[scadenza.id] ?? scadenza.note ?? ""}
                          onChange={(e) => handleNoteChange(scadenza.id, e.target.value)}
                          placeholder="Aggiungi note..."
                          className="min-h-[60px] resize-none"
                        />
                      </td>

                      <td className="p-2 align-middle text-center min-w-[140px]">
                        <Checkbox
                          checked={scadenza.conferma_riga || false}
                          onCheckedChange={() => handleToggleField(scadenza.id, "conferma_riga", scadenza.conferma_riga)}
                        />
                      </td>

                      <td className="p-2 align-middle text-center min-w-[100px]">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(scadenza.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
