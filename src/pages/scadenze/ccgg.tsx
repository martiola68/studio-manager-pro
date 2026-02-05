import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Search, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/lib/supabase/types";

type ScadenzaCCGG = Database["public"]["Tables"]["tbscadccgg"]["Row"];
type Utente = Database["public"]["Tables"]["tbutenti"]["Row"];

export default function ScadenzeCCGGPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [scadenze, setScadenze] = useState<ScadenzaCCGG[]>([]);
  const [utenti, setUtenti] = useState<Utente[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterOperatore, setFilterOperatore] = useState("__all__");
  const [filterProfessionista, setFilterProfessionista] = useState("__all__");
  const [filterConferma, setFilterConferma] = useState("__all__");
  
  const [localNotes, setLocalNotes] = useState<Record<string, string>>({]);
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

  const loadScadenze = async (): Promise<ScadenzaCCGG[]> => {
    const { data, error } = await supabase
      .from("tbscadccgg")
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
        .from("tbscadccgg")
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

  const handleUpdateField = async (scadenzaId: string, field: string, value: any) => {
    try {
      const updates: any = { [field]: value || null };
      
      const { error } = await supabase
        .from("tbscadccgg")
        .update(updates)
        .eq("id", scadenzaId);

      if (error) throw error;

      setScadenze(prev => prev.map(s => 
        s.id === scadenzaId ? { ...s, [field]: value } : s
      ));
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
          .from("tbscadccgg")
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
        .from("tbscadccgg")
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
          <h1 className="text-3xl font-bold text-gray-900">Scadenzario CCGG</h1>
          <p className="text-gray-500 mt-1">Gestione comunicazione compensazioni IVA</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-gray-600 mb-1">Totale Comunicazioni</div>
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
          <div className="overflow-x-auto">
            <div className="inline-block min-w-full align-middle">
              <div className="sticky top-0 z-20 bg-white border-b">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 z-30 bg-white border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] min-w-[200px]">Nominativo</TableHead>
                      <TableHead className="min-w-[180px]">Professionista</TableHead>
                      <TableHead className="min-w-[180px]">Operatore</TableHead>
                      <TableHead className="min-w-[120px] text-center">Mod. Predisposto</TableHead>
                      <TableHead className="min-w-[120px] text-center">Mod. Definitivo</TableHead>
                      <TableHead className="min-w-[150px]">Data Invio</TableHead>
                      <TableHead className="min-w-[120px] text-center">Mod. Inviato</TableHead>
                      <TableHead className="min-w-[300px]">Note</TableHead>
                      <TableHead className="min-w-[120px] text-center">Conferma</TableHead>
                      <TableHead className="min-w-[100px] text-center">Azioni</TableHead>
                    </TableRow>
                  </TableHeader>
                </Table>
              </div>

              <div className="max-h-[600px] overflow-y-auto">
                <Table>
                  <TableBody>
                    {filteredScadenze.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center py-8 text-gray-500">
                          Nessun record trovato
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredScadenze.map((scadenza) => (
                        <TableRow key={scadenza.id}>
                          <TableCell className="sticky left-0 z-10 bg-inherit border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] font-medium min-w-[200px]">
                            {scadenza.nominativo}
                          </TableCell>
                          <TableCell className="min-w-[180px]">{getUtenteNome(scadenza.utente_professionista_id)}</TableCell>
                          <TableCell className="min-w-[180px]">{getUtenteNome(scadenza.utente_operatore_id)}</TableCell>
                          <TableCell className="text-center min-w-[120px]">
                            <Checkbox
                              checked={scadenza.modello_predisposto || false}
                              onCheckedChange={() => handleToggleField(scadenza.id, "modello_predisposto", scadenza.modello_predisposto)}
                            />
                          </TableCell>
                          <TableCell className="text-center min-w-[120px]">
                            <Checkbox
                              checked={scadenza.modello_definitivo || false}
                              onCheckedChange={() => handleToggleField(scadenza.id, "modello_definitivo", scadenza.modello_definitivo)}
                            />
                          </TableCell>
                          <TableCell className="min-w-[150px]">
                            <Input
                              type="date"
                              value={scadenza.data_invio || ""}
                              onChange={(e) => handleUpdateField(scadenza.id, "data_invio", e.target.value)}
                              className="w-full"
                            />
                          </TableCell>
                          <TableCell className="text-center min-w-[120px]">
                            <Checkbox
                              checked={scadenza.modello_inviato || false}
                              onCheckedChange={() => handleToggleField(scadenza.id, "modello_inviato", scadenza.modello_inviato)}
                            />
                          </TableCell>
                          <TableCell className="min-w-[300px]">
                            <Textarea
                              value={localNotes[scadenza.id] ?? scadenza.note ?? ""}
                              onChange={(e) => handleNoteChange(scadenza.id, e.target.value)}
                              placeholder="Aggiungi note..."
                              className="min-h-[60px] resize-none"
                            />
                          </TableCell>
                          <TableCell className="text-center min-w-[120px]">
                            <Checkbox
                              checked={scadenza.conferma_riga || false}
                              onCheckedChange={() => handleToggleField(scadenza.id, "conferma_riga", scadenza.conferma_riga)}
                            />
                          </TableCell>
                          <TableCell className="text-center min-w-[100px]">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(scadenza.id)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}