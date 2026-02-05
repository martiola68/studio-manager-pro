import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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

  const handleToggleField = async (scadenzaId: string, field: string, currentValue: boolean | null) => {
    try {
      const newValue = !currentValue;
      
      // Aggiorna lo stato locale IMMEDIATAMENTE senza refresh
      setScadenze(prev => prev.map(s => 
        s.id === scadenzaId ? { ...s, [field]: newValue } : s
      ));
      
      // Aggiorna le stats se è conferma_riga
      if (field === "conferma_riga") {
        setStats(prev => ({
          ...prev,
          confermate: prev.confermate + (newValue ? 1 : -1),
          nonConfermate: prev.nonConfermate + (newValue ? -1 : 1)
        }));
      }
      
      // Salva in background
      const updates: any = {};
      updates[field] = newValue;
      
      const { error } = await supabase
        .from("tbscadiva")
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
      // Ripristina lo stato precedente in caso di errore
      await loadData();
    }
  };

  const handleUpdateField = async (scadenzaId: string, field: string, value: any) => {
    try {
      // Aggiorna lo stato locale IMMEDIATAMENTE
      setScadenze(prev => prev.map(s => 
        s.id === scadenzaId ? { ...s, [field]: value || null } : s
      ));
      
      const updates: any = {};
      updates[field] = value || null;
      
      const { error } = await supabase
        .from("tbscadiva")
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
  
  const handleImportoChange = (scadenzaId: string, value: string) => {
    // Aggiorna lo stato locale immediatamente
    setLocalImporti(prev => ({
      ...prev,
      [scadenzaId]: value
    }));
    
    // Cancella il timer esistente
    if (importoTimers[scadenzaId]) {
      clearTimeout(importoTimers[scadenzaId]);
    }
    
    // Imposta un nuovo timer per salvare dopo 1 secondo
    const timer = setTimeout(async () => {
      try {
        const numericValue = value ? parseFloat(value) : null;
        
        const { error } = await supabase
          .from("tbscadiva")
          .update({ importo_credito: numericValue })
          .eq("id", scadenzaId);

        if (error) throw error;
        
        // Aggiorna lo stato delle scadenze senza refresh
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
    
    setImportoTimers(prev => ({
      ...prev,
      [scadenzaId]: timer
    }));
  };
  
  const handleNoteChange = (scadenzaId: string, value: string) => {
    setLocalNotes(prev => ({
      ...prev,
      [scadenzaId]: value
    }));
    
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
    
    setNoteTimers(prev => ({
      ...prev,
      [scadenzaId]: timer
    }));
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
          <div className="overflow-x-auto">
            {/* Header fisso separato */}
            <div className="sticky top-0 z-10 bg-white border-b">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="sticky left-0 z-20 bg-gray-50 px-4 py-3 text-left text-sm font-semibold text-gray-900 min-w-[200px] border-r shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">
                      Nominativo
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 min-w-[150px]">Professionista</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 min-w-[150px]">Operatore</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900 min-w-[120px]">Mod. Predisposto</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900 min-w-[120px]">Mod. Definitivo</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900 min-w-[120px]">Asseverazione</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900 min-w-[140px]">Importo Credito</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900 min-w-[120px]">Mod. Inviato</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900 min-w-[140px]">Data Invio</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900 min-w-[100px]">Ricevuta</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 min-w-[200px]">Note</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900 min-w-[120px]">Conferma</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900 min-w-[100px]">Azioni</th>
                  </tr>
                </thead>
              </table>
            </div>

            {/* Body scrollabile */}
            <div className="max-h-[600px] overflow-y-auto">
              <table className="w-full">
                <tbody>
                  {filteredScadenze.length === 0 ? (
                    <tr>
                      <td colSpan={13} className="text-center py-8 text-gray-500">
                        Nessuna scadenza trovata
                      </td>
                    </tr>
                  ) : (
                    filteredScadenze.map((scadenza) => {
                      const isRicevuta = scadenza.ricevuta || false;
                      const isConfermata = scadenza.conferma_riga || false;
                      const isModInviato = scadenza.mod_inviato || false;
                      
                      return (
                        <tr 
                          key={scadenza.id}
                          className={`border-b ${isRicevuta ? "bg-green-50" : "bg-white hover:bg-gray-50"}`}
                        >
                          <td className="sticky left-0 z-10 bg-inherit px-4 py-3 font-medium text-sm min-w-[200px] border-r shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">
                            {scadenza.nominativo}
                          </td>
                          <td className="px-4 py-3 text-sm min-w-[150px]">
                            {getUtenteNome(scadenza.utente_professionista_id)}
                          </td>
                          <td className="px-4 py-3 text-sm min-w-[150px]">
                            {getUtenteNome(scadenza.utente_operatore_id)}
                          </td>
                          <td className="px-4 py-3 text-center min-w-[120px]">
                            <input
                              type="checkbox"
                              checked={scadenza.mod_predisposto || false}
                              onChange={() => handleToggleField(scadenza.id, "mod_predisposto", scadenza.mod_predisposto)}
                              className="rounded w-4 h-4 cursor-pointer"
                              disabled={isConfermata}
                            />
                          </td>
                          <td className="px-4 py-3 text-center min-w-[120px]">
                            <input
                              type="checkbox"
                              checked={scadenza.mod_definitivo || false}
                              onChange={() => handleToggleField(scadenza.id, "mod_definitivo", scadenza.mod_definitivo)}
                              className="rounded w-4 h-4 cursor-pointer"
                              disabled={isConfermata}
                            />
                          </td>
                          <td className="px-4 py-3 text-center min-w-[120px]">
                            <input
                              type="checkbox"
                              checked={scadenza.asseverazione || false}
                              onChange={() => handleToggleField(scadenza.id, "asseverazione", scadenza.asseverazione)}
                              className="rounded w-4 h-4 cursor-pointer"
                              disabled={isConfermata}
                            />
                          </td>
                          <td className="px-4 py-3 text-center min-w-[140px]">
                            <Input
                              type="number"
                              step="0.01"
                              value={localImporti[scadenza.id] !== undefined ? localImporti[scadenza.id] : (scadenza.importo_credito || "")}
                              onChange={(e) => handleImportoChange(scadenza.id, e.target.value)}
                              className="w-32 text-xs"
                              disabled={!scadenza.asseverazione || isConfermata}
                              placeholder="€ 0.00"
                            />
                          </td>
                          <td className="px-4 py-3 text-center min-w-[120px]">
                            <input
                              type="checkbox"
                              checked={isModInviato}
                              onChange={() => handleToggleField(scadenza.id, "mod_inviato", scadenza.mod_inviato)}
                              className="rounded w-4 h-4 cursor-pointer"
                              disabled={isConfermata}
                            />
                          </td>
                          <td className="px-4 py-3 text-center min-w-[140px]">
                            <Input
                              type="date"
                              value={scadenza.data_invio || ""}
                              onChange={(e) => handleUpdateField(scadenza.id, "data_invio", e.target.value)}
                              className="w-36 text-xs"
                              disabled={!isModInviato || isConfermata}
                            />
                          </td>
                          <td className="px-4 py-3 text-center min-w-[100px]">
                            <input
                              type="checkbox"
                              checked={isRicevuta}
                              onChange={() => handleToggleField(scadenza.id, "ricevuta", scadenza.ricevuta)}
                              className="rounded w-4 h-4 cursor-pointer"
                              disabled={isConfermata}
                            />
                          </td>
                          <td className="px-4 py-3 min-w-[200px]">
                            <Textarea
                              value={localNotes[scadenza.id] !== undefined ? localNotes[scadenza.id] : (scadenza.note || "")}
                              onChange={(e) => handleNoteChange(scadenza.id, e.target.value)}
                              className="min-h-[60px] text-xs"
                              disabled={isConfermata}
                              placeholder="Note..."
                            />
                          </td>
                          <td className="px-4 py-3 text-center min-w-[120px]">
                            <Button
                              variant={isConfermata ? "default" : "outline"}
                              size="sm"
                              onClick={() => handleToggleField(scadenza.id, "conferma_riga", scadenza.conferma_riga)}
                              className="w-full"
                            >
                              {isConfermata ? "✓ Chiusa" : "○ Aperta"}
                            </Button>
                          </td>
                          <td className="px-4 py-3 text-center min-w-[100px]">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(scadenza.id)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}