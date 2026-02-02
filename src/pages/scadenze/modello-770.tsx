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
    settore?: string | null;
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

  const loadScadenze = async (): Promise<Scadenza770[]> => {
    const { data, error } = await supabase
      .from("tbscad770")
      .select(`
        *,
        cliente:tbclienti!id(settore)
      `)
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
        .from("tbscad770")
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
        .from("tbscad770")
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
    const settore = s.cliente?.settore || "";
    const matchSettore = filterSettore === "__all__" || 
      (filterSettore === "Fiscale" && (settore === "Fiscale" || settore === "Fiscale & Lavoro")) ||
      (filterSettore === "Lavoro" && (settore === "Lavoro" || settore === "Fiscale & Lavoro"));
    return matchSearch && matchSettore;
  });

  const getUtenteNome = (utenteId: string | null | undefined): string => {
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
          <h1 className="text-3xl font-bold text-gray-900">Scadenzario 770</h1>
          <p className="text-gray-500 mt-1">Gestione Modello 770</p>
        </div>
      </div>

      {/* STATISTICHE */}
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
          <div className="h-[600px] overflow-x-auto overflow-y-auto border rounded-lg">
            <Table>
              <TableHeader className="sticky top-0 bg-white z-10 shadow-sm">
                <TableRow>
                  <TableHead className="sticky left-0 bg-white z-20 min-w-[200px] border-r">Nominativo</TableHead>
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
                        className={isRicevuta ? "bg-green-50" : "bg-white hover:bg-gray-50"}
                      >
                        <TableCell className="font-medium sticky left-0 bg-inherit z-10 border-r">
                          {scadenza.nominativo}
                        </TableCell>
                        <TableCell className="text-sm">
                          {scadenza.cliente?.settore || "-"}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={scadenza.utente_professionista_id || "__none__"}
                            onValueChange={(value) => handleUpdateField(
                              scadenza.id,
                              "utente_professionista_id",
                              value === "__none__" ? null : value
                            )}
                            disabled={true}
                          >
                            <SelectTrigger className="w-full text-xs">
                              <SelectValue placeholder="Seleziona..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">Nessuno</SelectItem>
                              {utenti.map((u) => (
                                <SelectItem key={u.id} value={u.id}>
                                  {u.nome} {u.cognome}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={scadenza.utente_operatore_id || "__none__"}
                            onValueChange={(value) => handleUpdateField(
                              scadenza.id,
                              "utente_operatore_id",
                              value === "__none__" ? null : value
                            )}
                            disabled={true}
                          >
                            <SelectTrigger className="w-full text-xs">
                              <SelectValue placeholder="Seleziona..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">Nessuno</SelectItem>
                              {utenti.map((u) => (
                                <SelectItem key={u.id} value={u.id}>
                                  {u.nome} {u.cognome}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={scadenza.professionista_payroll_id || "__none__"}
                            onValueChange={(value) => handleUpdateField(
                              scadenza.id,
                              "professionista_payroll_id",
                              value === "__none__" ? null : value
                            )}
                            disabled={true}
                          >
                            <SelectTrigger className="w-full text-xs">
                              <SelectValue placeholder="Seleziona..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">Nessuno</SelectItem>
                              {utenti.map((u) => (
                                <SelectItem key={u.id} value={u.id}>
                                  {u.nome} {u.cognome}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={scadenza.utente_payroll_id || "__none__"}
                            onValueChange={(value) => handleUpdateField(
                              scadenza.id,
                              "utente_payroll_id",
                              value === "__none__" ? null : value
                            )}
                            disabled={true}
                          >
                            <SelectTrigger className="w-full text-xs">
                              <SelectValue placeholder="Seleziona..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">Nessuno</SelectItem>
                              {utenti.map((u) => (
                                <SelectItem key={u.id} value={u.id}>
                                  {u.nome} {u.cognome}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
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
                        <TableCell>
                          <Input
                            type="text"
                            value={scadenza.modelli_770 || ""}
                            onChange={(e) => handleUpdateField(scadenza.id, "modelli_770", e.target.value)}
                            className="w-full text-xs"
                            disabled={isConfermata}
                            placeholder="Es: 770 Semplificato"
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <input
                            type="checkbox"
                            checked={scadenza.mod_compilato || false}
                            onChange={() => handleToggleField(scadenza.id, "mod_compilato", scadenza.mod_compilato)}
                            className="rounded w-4 h-4 cursor-pointer"
                            disabled={isConfermata}
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <input
                            type="checkbox"
                            checked={scadenza.mod_definitivo || false}
                            onChange={() => handleToggleField(scadenza.id, "mod_definitivo", scadenza.mod_definitivo)}
                            className="rounded w-4 h-4 cursor-pointer"
                            disabled={isConfermata}
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <input
                            type="checkbox"
                            checked={scadenza.mod_inviato || false}
                            onChange={() => handleToggleField(scadenza.id, "mod_inviato", scadenza.mod_inviato)}
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
                            disabled={isConfermata}
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <input
                            type="checkbox"
                            checked={isRicevuta}
                            onChange={() => handleToggleField(scadenza.id, "ricevuta", scadenza.ricevuta)}
                            className="rounded w-4 h-4 cursor-pointer"
                            disabled={isConfermata}
                          />
                        </TableCell>
                        <TableCell>
                          <Textarea
                            value={scadenza.note || ""}
                            onChange={(e) => handleUpdateField(scadenza.id, "note", e.target.value)}
                            className="min-h-[60px] text-xs"
                            disabled={isConfermata}
                            placeholder="Note..."
                          />
                        </TableCell>
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
    </div>
  );
}