import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Search, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/lib/supabase/types";

type ScadenzaBilancio = Database["public"]["Tables"]["tbscadbilanci"]["Row"];
type Utente = Database["public"]["Tables"]["tbutenti"]["Row"];

export default function ScadenzeBilanciPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [scadenze, setScadenze] = useState<ScadenzaBilancio[]>([]);
  const [utenti, setUtenti] = useState<Utente[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterOperatore, setFilterOperatore] = useState("__all__");
  const [filterProfessionista, setFilterProfessionista] = useState("__all__");
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
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }
      await loadData();
    } catch (error) {
      console.error("Errore:", error);
      router.push("/login");
    }
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

      const confermate = scadenzeData.filter(s => s.conferma_riga).length;
      setStats({
        totale: scadenzeData.length,
        confermate,
        nonConfermate: scadenzeData.length - confermate
      });
    } catch (error) {
      console.error("Errore caricamento:", error);
      toast({
        title: "Errore",
        description: "Impossibile caricare i dati",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadScadenze = async (): Promise<ScadenzaBilancio[]> => {
    const { data, error } = await supabase
      .from("tbscadbilanci")
      .select("*")
      .order("nominativo", { ascending: true });

    if (error) throw error;
    return data || [];
  };

  const loadUtenti = async (): Promise<Utente[]> => {
    const { data, error } = await supabase
      .from("tbutenti")
      .select("*")
      .order("cognome", { ascending: true });

    if (error) throw error;
    return data || [];
  };

  const addDaysToISODate = (isoDate: string, days: number): string => {
    // isoDate atteso: YYYY-MM-DD
    const [y, m, d] = isoDate.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() + days);
    const yyyy = dt.getUTCFullYear();
    const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(dt.getUTCDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const handleToggleField = async (scadenzaId: string, field: keyof ScadenzaBilancio, currentValue: any) => {
    try {
      const newValue = !currentValue;

      setScadenze(prev => prev.map(s =>
        s.id === scadenzaId ? { ...s, [field]: newValue } : s
      ));

      if (field === "conferma_riga") {
        setStats(prev => ({
          ...prev,
          confermate: newValue ? prev.confermate + 1 : prev.confermate - 1,
          nonConfermate: newValue ? prev.nonConfermate - 1 : prev.nonConfermate + 1
        }));
      }

      const updates: any = { [field]: newValue };
      const { error } = await supabase
        .from("tbscadbilanci")
        .update(updates)
        .eq("id", scadenzaId);

      if (error) throw error;
    } catch (error) {
      console.error("Errore aggiornamento:", error);
      toast({
        title: "Errore",
        description: "Impossibile aggiornare il campo",
        variant: "destructive"
      });
      await loadData();
    }
  };

  const handleUpdateField = async (scadenzaId: string, field: keyof ScadenzaBilancio, value: any) => {
    try {
      // Regola: data_scad_pres = data_approvazione + 30
      if (field === "data_approvazione") {
        const newDataScadPres = value ? addDaysToISODate(value, 30) : null;

        setScadenze(prev => prev.map(s =>
          s.id === scadenzaId
            ? { ...s, data_approvazione: value, data_scad_pres: newDataScadPres }
            : s
        ));

        const updates: any = {
          data_approvazione: value || null,
          data_scad_pres: newDataScadPres
        };

        const { error } = await supabase
          .from("tbscadbilanci")
          .update(updates)
          .eq("id", scadenzaId);

        if (error) throw error;
        return;
      }

      setScadenze(prev => prev.map(s =>
        s.id === scadenzaId ? { ...s, [field]: value } : s
      ));

      const updates: any = { [field]: value || null };

      const { error } = await supabase
        .from("tbscadbilanci")
        .update(updates)
        .eq("id", scadenzaId);

      if (error) throw error;
    } catch (error) {
      console.error("Errore aggiornamento:", error);
      toast({
        title: "Errore",
        description: "Impossibile aggiornare il campo",
        variant: "destructive"
      });
    }
  };

  const handleNoteChange = (scadenzaId: string, value: string) => {
    setLocalNotes(prev => ({ ...prev, [scadenzaId]: value }));

    if (noteTimers[scadenzaId]) {
      clearTimeout(noteTimers[scadenzaId]);
    }

    const timer = setTimeout(async () => {
      try {
        const { error } = await supabase
          .from("tbscadbilanci")
          .update({ note: value || null })
          .eq("id", scadenzaId);

        if (error) throw error;

        setScadenze(prev => prev.map(s =>
          s.id === scadenzaId ? { ...s, note: value } : s
        ));
      } catch (error) {
        console.error("Errore salvataggio nota:", error);
        toast({
          title: "Errore",
          description: "Impossibile salvare la nota",
          variant: "destructive"
        });
      }
    }, 1000);

    setNoteTimers(prev => ({ ...prev, [scadenzaId]: timer }));
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Sei sicuro di voler eliminare questo record?")) return;

    try {
      const { error } = await supabase
        .from("tbscadbilanci")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Successo",
        description: "Record eliminato"
      });
      await loadData();
    } catch (error) {
      console.error("Errore eliminazione:", error);
      toast({
        title: "Errore",
        description: "Impossibile eliminare il record",
        variant: "destructive"
      });
    }
  };

  const filteredScadenze = scadenze.filter(s => {
    const matchSearch = s.nominativo.toLowerCase().includes(searchQuery.toLowerCase());
    const matchOperatore = filterOperatore === "__all__" || s.utente_operatore_id === filterOperatore;
    const matchProfessionista = filterProfessionista === "__all__" || s.utente_professionista_id === filterProfessionista;
    const matchConferma = filterConferma === "__all__" ||
      (filterConferma === "true" ? s.conferma_riga : !s.conferma_riga);
    return matchSearch && matchOperatore && matchProfessionista && matchConferma;
  });

  const getUtenteNome = (utenteId: string | null): string => {
    if (!utenteId) return "-";
    const utente = utenti.find(u => u.id === utenteId);
    return utente ? `${utente.nome} ${utente.cognome}` : "-";
  };

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Scadenzario Bilanci</h1>
          <p className="text-gray-500 mt-1">Gestione bilanci annuali e documentazione contabile</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-gray-600 mb-1">Totale Bilanci</div>
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Cerca Nominativo</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Cerca..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Utente Operatore</label>
              <Select value={filterOperatore} onValueChange={setFilterOperatore}>
                <SelectTrigger>
                  <SelectValue placeholder="Tutti" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Tutti</SelectItem>
                  {utenti.map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.nome} {u.cognome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Utente Professionista</label>
              <Select value={filterProfessionista} onValueChange={setFilterProfessionista}>
                <SelectTrigger>
                  <SelectValue placeholder="Tutti" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Tutti</SelectItem>
                  {utenti.map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.nome} {u.cognome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                  <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] sticky-col-header border-r min-w-[200px]">Nominativo</th>
                  <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground min-w-[180px]">Professionista</th>
                  <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground min-w-[180px]">Operatore</th>
                  <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground text-center min-w-[120px]">Bilancio def</th>
                  <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground text-center min-w-[120px]">Verbale def</th>
                  <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground text-center min-w-[120px]">Rel. gestione</th>
                  <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground text-center min-w-[120px]">Rel. Sindaci</th>
                  <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground text-center min-w-[120px]">Rel. Revisore</th>
                  <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground min-w-[150px]">Data approvazione</th>
                  <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground min-w-[150px]">Data scadenza</th>
                  <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground text-center min-w-[120px]">Approvato</th>
                  <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground text-center min-w-[120px]">Inviato</th>
                  <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground min-w-[150px]">Data invio</th>
                  <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground text-center min-w-[120px]">Ricevuta</th>
                  <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground min-w-[300px]">Note</th>
                  <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground min-w-[120px] text-center">Conferma</th>
                  <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground min-w-[100px] text-center">Azioni</th>
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
                    <tr key={scadenza.id} className="border-b transition-colors hover:bg-green-50 data-[state=selected]:bg-muted">
                      <td className="p-2 align-middle sticky-col-cell border-r font-medium min-w-[200px]">
                        {scadenza.nominativo}
                      </td>
                      <td className="p-2 align-middle min-w-[180px]">{getUtenteNome(scadenza.utente_professionista_id)}</td>
                      <td className="p-2 align-middle min-w-[180px]">{getUtenteNome(scadenza.utente_operatore_id)}</td>

                      <td className="p-2 align-middle text-center min-w-[120px]">
                        <input
                          type="checkbox"
                          checked={scadenza.bilancio_def || false}
                          onChange={() => handleToggleField(scadenza.id, "bilancio_def", scadenza.bilancio_def)}
                          className="rounded w-4 h-4 cursor-pointer"
                        />
                      </td>
                      <td className="p-2 align-middle text-center min-w-[120px]">
                        <input
                          type="checkbox"
                          checked={scadenza.verbale_app || false}
                          onChange={() => handleToggleField(scadenza.id, "verbale_app", scadenza.verbale_app)}
                          className="rounded w-4 h-4 cursor-pointer"
                        />
                      </td>
                      <td className="p-2 align-middle text-center min-w-[120px]">
                        <input
                          type="checkbox"
                          checked={scadenza.relazione_gest || false}
                          onChange={() => handleToggleField(scadenza.id, "relazione_gest", scadenza.relazione_gest)}
                          className="rounded w-4 h-4 cursor-pointer"
                        />
                      </td>
                      <td className="p-2 align-middle text-center min-w-[120px]">
                        <input
                          type="checkbox"
                          checked={scadenza.relazione_sindaci || false}
                          onChange={() => handleToggleField(scadenza.id, "relazione_sindaci", scadenza.relazione_sindaci)}
                          className="rounded w-4 h-4 cursor-pointer"
                        />
                      </td>
                      <td className="p-2 align-middle text-center min-w-[120px]">
                        <input
                          type="checkbox"
                          checked={scadenza.relazione_revisore || false}
                          onChange={() => handleToggleField(scadenza.id, "relazione_revisore", scadenza.relazione_revisore)}
                          className="rounded w-4 h-4 cursor-pointer"
                        />
                      </td>

                      <td className="p-2 align-middle min-w-[150px]">
                        <Input
                          type="date"
                          value={scadenza.data_approvazione || ""}
                          onChange={(e) => handleUpdateField(scadenza.id, "data_approvazione", e.target.value)}
                          className="w-full"
                        />
                      </td>
                      <td className="p-2 align-middle min-w-[150px]">
                        <Input
                          type="date"
                          value={scadenza.data_scad_pres || ""}
                          onChange={(e) => handleUpdateField(scadenza.id, "data_scad_pres", e.target.value)}
                          className="w-full"
                        />
                      </td>

                      <td className="p-2 align-middle text-center min-w-[120px]">
                        <input
                          type="checkbox"
                          checked={scadenza.bil_approvato || false}
                          onChange={() => handleToggleField(scadenza.id, "bil_approvato", scadenza.bil_approvato)}
                          className="rounded w-4 h-4 cursor-pointer"
                        />
                      </td>
                      <td className="p-2 align-middle text-center min-w-[120px]">
                        <input
                          type="checkbox"
                          checked={scadenza.invio_bil || false}
                          onChange={() => handleToggleField(scadenza.id, "invio_bil", scadenza.invio_bil)}
                          className="rounded w-4 h-4 cursor-pointer"
                        />
                      </td>

                      <td className="p-2 align-middle min-w-[150px]">
                        <Input
                          type="date"
                          value={scadenza.data_invio || ""}
                          onChange={(e) => handleUpdateField(scadenza.id, "data_invio", e.target.value)}
                          className="w-full"
                        />
                      </td>
                      <td className="p-2 align-middle text-center min-w-[120px]">
                        <input
                          type="checkbox"
                          checked={scadenza.ricevuta || false}
                          onChange={() => handleToggleField(scadenza.id, "ricevuta", scadenza.ricevuta)}
                          className="rounded w-4 h-4 cursor-pointer"
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

                      <td className="p-2 align-middle text-center min-w-[120px]">
                        <input
                          type="checkbox"
                          checked={scadenza.conferma_riga || false}
                          onChange={() => handleToggleField(scadenza.id, "conferma_riga", scadenza.conferma_riga)}
                          className="rounded w-4 h-4 cursor-pointer"
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
