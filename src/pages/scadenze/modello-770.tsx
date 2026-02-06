import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Search, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/lib/supabase/types";

type Scadenza770 = Database["public"]["Tables"]["tbscad770"]["Row"] & {
  cliente?: {
    settore_fiscale?: boolean | null;
    settore_lavoro?: boolean | null;
    settore_consulenza?: boolean | null;
  } | null;
};
type Utente = Database["public"]["Tables"]["tbutenti"]["Row"];

const TIPO_INVIO_OPTIONS = ["Ordinario", "Correttivo", "Integrativo"];

export default function Scadenze770Page() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [scadenze, setScadenze] = useState<Scadenza770[]>([]);
  const [utenti, setUtenti] = useState<Utente[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterSettore, setFilterSettore] = useState("__all__");

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

  const loadScadenze = async (): Promise<Scadenza770[]> => {
    const { data, error } = await supabase
      .from("tbscad770")
      .select(`
        *,
        cliente:tbclienti!tbscad770_id_fkey(
          settore_fiscale,
          settore_lavoro,
          settore_consulenza
        )
      `)
      .order("nominativo");
    
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
        .from("tbscad770")
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
        .from("tbscad770")
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
          .from("tbscad770")
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
        .from("tbscad770")
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
    const matchSearch = s.nominativo?.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Logica filtro settori basata sui nuovi campi boolean
    const hasFiscale = s.cliente?.settore_fiscale === true;
    const hasLavoro = s.cliente?.settore_lavoro === true;
    
    const matchSettore = filterSettore === "__all__" || 
      (filterSettore === "Fiscale" && hasFiscale) ||
      (filterSettore === "Lavoro" && hasLavoro);
      
    return matchSearch && matchSettore;
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Scadenzario 770</h1>
          <p className="text-gray-500 mt-1">Gestione Modello 770</p>
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

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filtri e Ricerca</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <Label>Settore</Label>
              <Select value={filterSettore} onValueChange={setFilterSettore}>
                <SelectTrigger>
                  <SelectValue placeholder="Tutti" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Tutti</SelectItem>
                  <SelectItem value="Fiscale">Fiscale</SelectItem>
                  <SelectItem value="Lavoro">Lavoro</SelectItem>
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
                      <TableHead className="min-w-[120px]">Settore</TableHead>
                      <TableHead className="min-w-[150px]">Prof. Fiscale</TableHead>
                      <TableHead className="min-w-[150px]">Oper. Fiscale</TableHead>
                      <TableHead className="min-w-[150px]">Prof. Payroll</TableHead>
                      <TableHead className="min-w-[150px]">Oper. Payroll</TableHead>
                      <TableHead className="min-w-[150px]">Tipo Invio</TableHead>
                      <TableHead className="min-w-[150px]">Modelli 770</TableHead>
                      <TableHead className="text-center min-w-[100px]">Compilato</TableHead>
                      <TableHead className="text-center min-w-[100px]">Definitivo</TableHead>
                      <TableHead className="text-center min-w-[100px]">Inviato</TableHead>
                      <TableHead className="text-center min-w-[140px]">Data Invio</TableHead>
                      <TableHead className="text-center min-w-[100px]">Ricevuta</TableHead>
                      <TableHead className="min-w-[200px]">Note</TableHead>
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
                        <TableCell colSpan={16} className="text-center py-8 text-gray-500">
                          Nessuna scadenza trovata
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredScadenze.map((scadenza) => {
                        const isRicevuta = scadenza.ricevuta || false;
                        const isConfermata = scadenza.conferma_riga || false;
                        
                        return (
                          <TableRow 
                            key={scadenza.id}
                            className={isRicevuta ? "bg-green-50" : ""}
                          >
                            <TableCell className="sticky left-0 z-10 bg-inherit border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] font-medium min-w-[200px]">
                              {scadenza.nominativo}
                            </TableCell>
                            <TableCell className="text-sm min-w-[120px]">
                              <div className="flex flex-col gap-1">
                                {scadenza.cliente?.settore_fiscale && <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">Fiscale</span>}
                                {scadenza.cliente?.settore_lavoro && <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">Lavoro</span>}
                                {scadenza.cliente?.settore_consulenza && <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded">Consulenza</span>}
                                {!scadenza.cliente?.settore_fiscale && !scadenza.cliente?.settore_lavoro && !scadenza.cliente?.settore_consulenza && <span className="text-xs text-gray-500">-</span>}
                              </div>
                            </TableCell>
                            <TableCell className="min-w-[150px]">
                              <Input
                                type="text"
                                value={scadenza.utente_professionista_id || ""}
                                disabled={true}
                                className="w-full text-xs bg-gray-50 cursor-not-allowed"
                              />
                            </TableCell>
                            <TableCell className="min-w-[150px]">
                              <Input
                                type="text"
                                value={scadenza.utente_operatore_id || ""}
                                disabled={true}
                                className="w-full text-xs bg-gray-50 cursor-not-allowed"
                              />
                            </TableCell>
                            <TableCell className="min-w-[150px]">
                              <Input
                                type="text"
                                value={scadenza.professionista_payroll_id || ""}
                                disabled={true}
                                className="w-full text-xs bg-gray-50 cursor-not-allowed"
                              />
                            </TableCell>
                            <TableCell className="min-w-[150px]">
                              <Input
                                type="text"
                                value={scadenza.utente_payroll_id || ""}
                                disabled={true}
                                className="w-full text-xs bg-gray-50 cursor-not-allowed"
                              />
                            </TableCell>
                            <TableCell className="min-w-[150px]">
                              <Select
                                value={scadenza.tipo_invio || "__none__"}
                                onValueChange={(value) => handleUpdateField(
                                  scadenza.id,
                                  "tipo_invio",
                                  value === "__none__" ? null : value
                                )}
                                disabled={isConfermata}
                              >
                                <SelectTrigger className="w-full text-xs">
                                  <SelectValue placeholder="Seleziona..." />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__">Nessuno</SelectItem>
                                  {TIPO_INVIO_OPTIONS.map((opt) => (
                                    <SelectItem key={opt} value={opt}>
                                      {opt}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="min-w-[150px]">
                              <Input
                                type="text"
                                value={scadenza.modelli_770 || ""}
                                onChange={(e) => handleUpdateField(scadenza.id, "modelli_770", e.target.value)}
                                className="w-full text-xs"
                                disabled={isConfermata}
                                placeholder="Es: 770 Semplificato"
                              />
                            </TableCell>
                            <TableCell className="text-center min-w-[100px]">
                              <input
                                type="checkbox"
                                checked={scadenza.mod_compilato || false}
                                onChange={() => handleToggleField(scadenza.id, "mod_compilato", scadenza.mod_compilato)}
                                className="rounded w-4 h-4 cursor-pointer"
                                disabled={isConfermata}
                              />
                            </TableCell>
                            <TableCell className="text-center min-w-[100px]">
                              <input
                                type="checkbox"
                                checked={scadenza.mod_definitivo || false}
                                onChange={() => handleToggleField(scadenza.id, "mod_definitivo", scadenza.mod_definitivo)}
                                className="rounded w-4 h-4 cursor-pointer"
                                disabled={isConfermata}
                              />
                            </TableCell>
                            <TableCell className="text-center min-w-[100px]">
                              <input
                                type="checkbox"
                                checked={scadenza.mod_inviato || false}
                                onChange={() => handleToggleField(scadenza.id, "mod_inviato", scadenza.mod_inviato)}
                                className="rounded w-4 h-4 cursor-pointer"
                                disabled={isConfermata}
                              />
                            </TableCell>
                            <TableCell className="text-center min-w-[140px]">
                              <Input
                                type="date"
                                value={scadenza.data_invio || ""}
                                onChange={(e) => handleUpdateField(scadenza.id, "data_invio", e.target.value)}
                                className="w-36 text-xs"
                                disabled={isConfermata}
                              />
                            </TableCell>
                            <TableCell className="text-center min-w-[100px]">
                              <input
                                type="checkbox"
                                checked={isRicevuta}
                                onChange={() => handleToggleField(scadenza.id, "ricevuta", scadenza.ricevuta)}
                                className="rounded w-4 h-4 cursor-pointer"
                                disabled={isConfermata}
                              />
                            </TableCell>
                            <TableCell className="min-w-[200px]">
                              <Textarea
                                value={localNotes[scadenza.id] ?? scadenza.note ?? ""}
                                onChange={(e) => handleNoteChange(scadenza.id, e.target.value)}
                                className="min-h-[60px] text-xs resize-none"
                                disabled={isConfermata}
                                placeholder="Note..."
                              />
                            </TableCell>
                            <TableCell className="text-center min-w-[120px]">
                              <input
                                type="checkbox"
                                checked={isConfermata}
                                onChange={() => handleToggleField(scadenza.id, "conferma_riga", scadenza.conferma_riga)}
                                className="rounded w-4 h-4 cursor-pointer"
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