import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/lib/supabase/types";

type ScadenzaIva = Database["public"]["Tables"]["tbscadiva"]["Row"];
type Utente = Database["public"]["Tables"]["tbutenti"]["Row"];

export default function ScadenzeIvaPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [scadenze, setScadenze] = useState<ScadenzaIva[]>([]);
  const [utenti, setUtenti] = useState<Utente[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterOperatore, setFilterOperatore] = useState("__all__");
  const [filterProfessionista, setFilterProfessionista] = useState("__all__");
  const [filterConferma, setFilterConferma] = useState("__all__");
  
  const [localNotes, setLocalNotes] = useState<Record<string, string>>({});
  const [noteTimers, setNoteTimers] = useState<Record<string, NodeJS.Timeout>>({});
  
  const [localImporti, setLocalImporti] = useState<Record<string, string>>({});
  const [importoTimers, setImportoTimers] = useState<Record<string, NodeJS.Timeout>>({});

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

  const loadScadenze = async (): Promise<ScadenzaIva[]> => {
    const { data, error } = await supabase
      .from("tbscadiva")
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

  const handleToggleField = async (scadenzaId: string, field: keyof ScadenzaIva, currentValue: boolean | null) => {
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
      
      const { error } = await supabase
        .from("tbscadiva")
        .update({ [field]: newValue })
        .eq("id", scadenzaId);

      if (error) throw error;
    } catch (error: any) {
      toast({
        title: "Errore aggiornamento",
        description: error.message,
        variant: "destructive"
      });
      await loadData();
    }
  };

  const handleUpdateField = async (scadenzaId: string, field: keyof ScadenzaIva, value: any) => {
    try {
      const { error } = await supabase
        .from("tbscadiva")
        .update({ [field]: value || null })
        .eq("id", scadenzaId);
      
      if (error) throw error;
      
      setScadenze(prev => prev.map(s => 
        s.id === scadenzaId ? { ...s, [field]: value } : s
      ));
    } catch (error: any) {
      toast({
        title: "Errore aggiornamento",
        description: error.message,
        variant: "destructive"
      });
    }
  };
  
  const handleImportoChange = (scadenzaId: string, value: string) => {
    setLocalImporti(prev => ({ ...prev, [scadenzaId]: value }));
    
    if (importoTimers[scadenzaId]) {
      clearTimeout(importoTimers[scadenzaId]);
    }
    
    const timer = setTimeout(async () => {
      try {
        const numericValue = value ? parseFloat(value) : null;
        
        const { error } = await supabase
          .from("tbscadiva")
          .update({ importo_credito: numericValue })
          .eq("id", scadenzaId);

        if (error) throw error;
        
        setScadenze(prev => prev.map(s => 
          s.id === scadenzaId ? { ...s, importo_credito: numericValue } : s
        ));
      } catch (error) {
        console.error("Errore salvataggio importo:", error);
        toast({
          title: "Errore",
          description: "Impossibile salvare l'importo",
          variant: "destructive"
        });
      }
    }, 1000);
    
    setImportoTimers(prev => ({ ...prev, [scadenzaId]: timer }));
  };
  
  const handleNoteChange = (scadenzaId: string, value: string) => {
    setLocalNotes(prev => ({ ...prev, [scadenzaId]: value }));
    
    if (noteTimers[scadenzaId]) {
      clearTimeout(noteTimers[scadenzaId]);
    }
    
    const timer = setTimeout(async () => {
      try {
        const { error } = await supabase
          .from("tbscadiva")
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
        .from("tbscadiva")
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
          <h1 className="text-3xl font-bold text-gray-900">Scadenzario IVA</h1>
          <p className="text-gray-500 mt-1">Gestione liquidazioni periodiche e versamenti IVA</p>
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Cerca Nominativo</label>
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

            <div>
              <label className="text-sm font-medium mb-2 block">Utente Operatore</label>
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

            <div>
              <label className="text-sm font-medium mb-2 block">Utente Professionista</label>
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

            <div>
              <label className="text-sm font-medium mb-2 block">Stato Conferma</label>
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
          <div className="overflow-x-auto">
            <div className="inline-block min-w-full align-middle">
              <div className="sticky top-0 z-20 bg-white border-b">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky-nominativo-header border-r min-w-[200px]">Nominativo</TableHead>
                      <TableHead className="min-w-[150px]">Professionista</TableHead>
                      <TableHead className="min-w-[150px]">Operatore</TableHead>
                      <TableHead className="text-center min-w-[120px]">Mod. Predisposto</TableHead>
                      <TableHead className="text-center min-w-[120px]">Mod. Definitivo</TableHead>
                      <TableHead className="text-center min-w-[120px]">Asseverazione</TableHead>
                      <TableHead className="text-center min-w-[140px]">Importo Credito</TableHead>
                      <TableHead className="text-center min-w-[120px]">Mod. Inviato</TableHead>
                      <TableHead className="text-center min-w-[140px]">Data Invio</TableHead>
                      <TableHead className="text-center min-w-[100px]">Ricevuta</TableHead>
                      <TableHead className="min-w-[300px]">Note</TableHead>
                      <TableHead className="text-center min-w-[120px]">Conferma</TableHead>
                      <TableHead className="text-center min-w-[100px]">Azioni</TableHead>
                    </TableRow>
                  </TableHeader>
                </Table>
              </div>

              <div className="max-h-[600px] overflow-y-auto">
                <Table>
                  <TableBody>
                    {filteredScadenze.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={13} className="text-center py-8 text-gray-500">
                          Nessuna scadenza trovata
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredScadenze.map((scadenza) => {
                        const isRicevuta = scadenza.ricevuta || false;
                        const isConfermata = scadenza.conferma_riga || false;
                        const isModInviato = scadenza.mod_inviato || false;
                        
                        return (
                          <TableRow 
                            key={scadenza.id}
                            className={isRicevuta ? "bg-green-50" : ""}
                          >
                            <TableCell className="sticky-nominativo-cell border-r font-medium min-w-[200px]">
                              {scadenza.nominativo}
                            </TableCell>
                            <TableCell className="min-w-[150px]">
                              {getUtenteNome(scadenza.utente_professionista_id)}
                            </TableCell>
                            <TableCell className="min-w-[150px]">
                              {getUtenteNome(scadenza.utente_operatore_id)}
                            </TableCell>
                            <TableCell className="text-center min-w-[120px]">
                              <Checkbox
                                checked={scadenza.mod_predisposto || false}
                                onCheckedChange={() => handleToggleField(scadenza.id, "mod_predisposto", scadenza.mod_predisposto)}
                                disabled={isConfermata}
                              />
                            </TableCell>
                            <TableCell className="text-center min-w-[120px]">
                              <Checkbox
                                checked={scadenza.mod_definitivo || false}
                                onCheckedChange={() => handleToggleField(scadenza.id, "mod_definitivo", scadenza.mod_definitivo)}
                                disabled={isConfermata}
                              />
                            </TableCell>
                            <TableCell className="text-center min-w-[120px]">
                              <Checkbox
                                checked={scadenza.asseverazione || false}
                                onCheckedChange={() => handleToggleField(scadenza.id, "asseverazione", scadenza.asseverazione)}
                                disabled={isConfermata}
                              />
                            </TableCell>
                            <TableCell className="text-center min-w-[140px]">
                              <Input
                                type="number"
                                step="0.01"
                                value={localImporti[scadenza.id] !== undefined ? localImporti[scadenza.id] : (scadenza.importo_credito || "")}
                                onChange={(e) => handleImportoChange(scadenza.id, e.target.value)}
                                className="w-32"
                                disabled={!scadenza.asseverazione || isConfermata}
                                placeholder="€ 0.00"
                              />
                            </TableCell>
                            <TableCell className="text-center min-w-[120px]">
                              <Checkbox
                                checked={isModInviato}
                                onCheckedChange={() => handleToggleField(scadenza.id, "mod_inviato", scadenza.mod_inviato)}
                                disabled={isConfermata}
                              />
                            </TableCell>
                            <TableCell className="text-center min-w-[140px]">
                              <Input
                                type="date"
                                value={scadenza.data_invio || ""}
                                onChange={(e) => handleUpdateField(scadenza.id, "data_invio", e.target.value)}
                                className="w-full"
                                disabled={!isModInviato || isConfermata}
                              />
                            </TableCell>
                            <TableCell className="text-center min-w-[100px]">
                              <Checkbox
                                checked={isRicevuta}
                                onCheckedChange={() => handleToggleField(scadenza.id, "ricevuta", scadenza.ricevuta)}
                                disabled={isConfermata}
                              />
                            </TableCell>
                            <TableCell className="min-w-[300px]">
                              <Textarea
                                value={localNotes[scadenza.id] ?? scadenza.note ?? ""}
                                onChange={(e) => handleNoteChange(scadenza.id, e.target.value)}
                                placeholder="Aggiungi note..."
                                className="min-h-[60px] resize-none"
                                disabled={isConfermata}
                              />
                            </TableCell>
                            <TableCell className="text-center min-w-[120px]">
                              <Checkbox
                                checked={isConfermata}
                                onCheckedChange={() => handleToggleField(scadenza.id, "conferma_riga", scadenza.conferma_riga)}
                              />
                            </TableCell>
                            <TableCell className="text-center min-w-[100px]">
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
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}