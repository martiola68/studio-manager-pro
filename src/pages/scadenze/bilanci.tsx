import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Search, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

type ScadenzaBilanci = Database["public"]["Tables"]["tbscadbilanci"]["Row"];
type Utente = Database["public"]["Tables"]["tbutenti"]["Row"];

export default function ScadenzeBilanciPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [scadenze, setScadenze] = useState<ScadenzaBilanci[]>([]);
  const [utenti, setUtenti] = useState<Utente[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterOperatore, setFilterOperatore] = useState("__all__");
  const [filterProfessionista, setFilterProfessionista] = useState("__all__");
  const [filterConferma, setFilterConferma] = useState("__all__");

  // Stats
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
      
      // Calculate stats
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

  const loadScadenze = async (): Promise<ScadenzaBilanci[]> => {
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

  const handleToggleField = async (scadenzaId: string, field: string, currentValue: boolean | null) => {
    try {
      const updates: any = {};
      updates[field] = !currentValue;
      
      const { error } = await supabase
        .from("tbscadbilanci")
        .update(updates)
        .eq("id", scadenzaId);

      if (error) throw error;

      await loadData();
      toast({
        title: "Successo",
        description: "Campo aggiornato"
      });
    } catch (error) {
      console.error("Errore aggiornamento:", error);
      toast({
        title: "Errore",
        description: "Impossibile aggiornare il campo",
        variant: "destructive"
      });
    }
  };

  const handleUpdateField = async (scadenzaId: string, field: string, value: any) => {
    try {
      const updates: any = {};
      updates[field] = value || null;
      
      const { error } = await supabase
        .from("tbscadbilanci")
        .update(updates)
        .eq("id", scadenzaId);

      if (error) throw error;

      await loadData();
    } catch (error) {
      console.error("Errore aggiornamento:", error);
      toast({
        title: "Errore",
        description: "Impossibile aggiornare il campo",
        variant: "destructive"
      });
    }
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

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return "-";
    try {
      return new Date(dateString).toLocaleDateString("it-IT");
    } catch {
      return "-";
    }
  };

  const getRowColor = (scadenza: ScadenzaBilanci): string => {
    // Priorità: Conferma Riga > Ricevuta > default
    if (scadenza.conferma_riga) return "bg-green-50";
    if (scadenza.ricevuta) return "bg-green-50";
    return "bg-white hover:bg-gray-50";
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
          <p className="text-gray-500 mt-1">Gestione deposito bilanci e pratiche camerali</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtri e Ricerca</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Cerca Nominativo</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Cerca..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Utente Operatore</Label>
              <Select value={filterOperatore} onValueChange={setFilterOperatore}>
                <SelectTrigger>
                  <SelectValue placeholder="Tutti" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Tutti</SelectItem>
                  {utenti.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.nome} {u.cognome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Utente Professionista</Label>
              <Select value={filterProfessionista} onValueChange={setFilterProfessionista}>
                <SelectTrigger>
                  <SelectValue placeholder="Tutti" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Tutti</SelectItem>
                  {utenti.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.nome} {u.cognome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Stato Conferma</Label>
              <Select value={filterConferma} onValueChange={setFilterConferma}>
                <SelectTrigger>
                  <SelectValue placeholder="Tutti" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Tutti</SelectItem>
                  <SelectItem value="true">Solo Confermate</SelectItem>
                  <SelectItem value="false">Solo Non Confermate</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto overflow-y-auto max-h-[600px] border rounded-lg">
            <Table>
              <TableHeader className="sticky top-0 bg-white z-10 shadow-sm">
                <TableRow>
                  <TableHead className="sticky left-0 bg-white z-20 min-w-[200px] border-r">Nominativo</TableHead>
                  <TableHead className="min-w-[150px]">Professionista</TableHead>
                  <TableHead className="min-w-[150px]">Operatore</TableHead>
                  <TableHead className="text-center min-w-[120px]">Bilancio Def</TableHead>
                  <TableHead className="text-center min-w-[120px]">Verbale App</TableHead>
                  <TableHead className="text-center min-w-[120px]">Rel. Gest</TableHead>
                  <TableHead className="text-center min-w-[130px]">Rel. Sindaci</TableHead>
                  <TableHead className="text-center min-w-[130px]">Rel. Revisore</TableHead>
                  <TableHead className="text-center min-w-[150px]">Data Approv.</TableHead>
                  <TableHead className="text-center min-w-[150px]">Data Scad Pres</TableHead>
                  <TableHead className="text-center min-w-[120px]">Bil Approv.</TableHead>
                  <TableHead className="text-center min-w-[120px]">Invio Bil</TableHead>
                  <TableHead className="text-center min-w-[150px]">Data Invio</TableHead>
                  <TableHead className="text-center min-w-[100px]">Ricevuta</TableHead>
                  <TableHead className="min-w-[200px]">Note</TableHead>
                  <TableHead className="text-center min-w-[120px]">Conf. Riga</TableHead>
                  <TableHead className="text-center min-w-[100px]">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredScadenze.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={17} className="text-center py-8 text-gray-500">
                      Nessuna scadenza trovata
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredScadenze.map((scadenza) => {
                    const isConfermata = scadenza.conferma_riga || false;
                    const hasInvioBil = scadenza.invio_bil || false;
                    
                    return (
                      <TableRow 
                        key={scadenza.id}
                        className={getRowColor(scadenza)}
                      >
                        <TableCell className="font-medium sticky left-0 bg-inherit z-10 border-r">
                          {scadenza.nominativo}
                        </TableCell>
                        <TableCell className="text-sm">
                          {getUtenteNome(scadenza.utente_professionista_id)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {getUtenteNome(scadenza.utente_operatore_id)}
                        </TableCell>
                        
                        {/* Sezione Documenti */}
                        <TableCell className="text-center">
                          <input
                            type="checkbox"
                            checked={scadenza.bilancio_def || false}
                            onChange={() => handleToggleField(scadenza.id, "bilancio_def", scadenza.bilancio_def)}
                            className="rounded w-4 h-4 cursor-pointer"
                            disabled={isConfermata}
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <input
                            type="checkbox"
                            checked={scadenza.verbale_app || false}
                            onChange={() => handleToggleField(scadenza.id, "verbale_app", scadenza.verbale_app)}
                            className="rounded w-4 h-4 cursor-pointer"
                            disabled={isConfermata}
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <input
                            type="checkbox"
                            checked={scadenza.relazione_gest || false}
                            onChange={() => handleToggleField(scadenza.id, "relazione_gest", scadenza.relazione_gest)}
                            className="rounded w-4 h-4 cursor-pointer"
                            disabled={isConfermata}
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <input
                            type="checkbox"
                            checked={scadenza.relazione_sindaci || false}
                            onChange={() => handleToggleField(scadenza.id, "relazione_sindaci", scadenza.relazione_sindaci)}
                            className="rounded w-4 h-4 cursor-pointer"
                            disabled={isConfermata}
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <input
                            type="checkbox"
                            checked={scadenza.relazione_revisore || false}
                            onChange={() => handleToggleField(scadenza.id, "relazione_revisore", scadenza.relazione_revisore)}
                            className="rounded w-4 h-4 cursor-pointer"
                            disabled={isConfermata}
                          />
                        </TableCell>

                        {/* Sezione Date */}
                        <TableCell className="text-center">
                          <Input
                            type="date"
                            value={scadenza.data_approvazione || ""}
                            onChange={(e) => handleUpdateField(scadenza.id, "data_approvazione", e.target.value)}
                            className="w-36 text-xs"
                            disabled={isConfermata}
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="text-xs bg-gray-100 px-2 py-1 rounded">
                            {formatDate(scadenza.data_scad_pres)}
                          </div>
                        </TableCell>

                        {/* Sezione Invio */}
                        <TableCell className="text-center">
                          <input
                            type="checkbox"
                            checked={scadenza.bil_approvato || false}
                            onChange={() => handleToggleField(scadenza.id, "bil_approvato", scadenza.bil_approvato)}
                            className="rounded w-4 h-4 cursor-pointer"
                            disabled={isConfermata}
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <input
                            type="checkbox"
                            checked={hasInvioBil}
                            onChange={() => handleToggleField(scadenza.id, "invio_bil", scadenza.invio_bil)}
                            className="rounded w-4 h-4 cursor-pointer"
                            disabled={isConfermata}
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Input
                            type="date"
                            value={scadenza.data_invio || ""}
                            onChange={(e) => handleUpdateField(scadenza.id, "data_invio", e.target.value)}
                            className="w-36 text-xs"
                            disabled={!hasInvioBil || isConfermata}
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <input
                            type="checkbox"
                            checked={scadenza.ricevuta || false}
                            onChange={() => handleToggleField(scadenza.id, "ricevuta", scadenza.ricevuta)}
                            className="rounded w-4 h-4 cursor-pointer"
                            disabled={isConfermata}
                          />
                        </TableCell>

                        {/* Note */}
                        <TableCell>
                          <Textarea
                            value={scadenza.note || ""}
                            onChange={(e) => handleUpdateField(scadenza.id, "note", e.target.value)}
                            className="min-h-[60px] text-xs"
                            disabled={isConfermata}
                            placeholder="Note..."
                          />
                        </TableCell>

                        {/* Conferma Riga */}
                        <TableCell className="text-center">
                          <Button
                            variant={isConfermata ? "default" : "outline"}
                            size="sm"
                            onClick={() => handleToggleField(scadenza.id, "conferma_riga", scadenza.conferma_riga)}
                            className="w-full"
                          >
                            {isConfermata ? "✓ Chiusa" : "○ Aperta"}
                          </Button>
                        </TableCell>

                        {/* Azioni */}
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(scadenza.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Legenda */}
      <Card className="mt-4">
        <CardContent className="py-4">
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-green-50 border border-green-200 rounded"></div>
              <span>Conferma Riga = True o Ricevuta = True (Verde)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-white border border-gray-200 rounded"></div>
              <span>Default (Bianco)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-gray-100 border border-gray-300 rounded"></div>
              <span>Data Scad Pres = Calcolata automaticamente (Readonly)</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}