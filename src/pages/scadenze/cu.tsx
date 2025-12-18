import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

type ScadenzaCU = Database["public"]["Tables"]["tbscadcu"]["Row"];
type Utente = Database["public"]["Tables"]["tbutenti"]["Row"];

export default function ScadenzeCUPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [scadenze, setScadenze] = useState<ScadenzaCU[]>([]);
  const [utenti, setUtenti] = useState<Utente[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterOperatore, setFilterOperatore] = useState("__all__");
  const [filterProfessionista, setFilterProfessionista] = useState("__all__");

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

  const loadScadenze = async (): Promise<ScadenzaCU[]> => {
    const { data, error } = await supabase
      .from("tbscadcu")
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

  const handleToggleInvio = async (scadenzaId: string, currentValue: boolean | null) => {
    try {
      const { error } = await supabase
        .from("tbscadcu")
        .update({ invio: !currentValue })
        .eq("id", scadenzaId);

      if (error) throw error;

      await loadData();
      toast({
        title: "Successo",
        description: "Stato invio aggiornato"
      });
    } catch (error) {
      console.error("Errore aggiornamento:", error);
      toast({
        title: "Errore",
        description: "Impossibile aggiornare lo stato",
        variant: "destructive"
      });
    }
  };

  const handleSetDataInvio = async (scadenzaId: string, data: string) => {
    try {
      const { error } = await supabase
        .from("tbscadcu")
        .update({ invio_data: data })
        .eq("id", scadenzaId);

      if (error) throw error;

      await loadData();
    } catch (error) {
      console.error("Errore aggiornamento data:", error);
      toast({
        title: "Errore",
        description: "Impossibile aggiornare la data",
        variant: "destructive"
      });
    }
  };

  const handleToggleConferma = async (scadenzaId: string, currentValue: boolean | null) => {
    try {
      const { error } = await supabase
        .from("tbscadcu")
        .update({ conferma_riga: !currentValue })
        .eq("id", scadenzaId);

      if (error) throw error;

      await loadData();
      toast({
        title: "Successo",
        description: currentValue ? "Riga riaperta per modifiche" : "Riga chiusa e confermata"
      });
    } catch (error) {
      console.error("Errore conferma:", error);
      toast({
        title: "Errore",
        description: "Impossibile aggiornare la conferma",
        variant: "destructive"
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Sei sicuro di voler eliminare questo record?")) return;

    try {
      const { error } = await supabase
        .from("tbscadcu")
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
    return matchSearch && matchOperatore && matchProfessionista;
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
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-8">
          <div className="max-w-full mx-auto">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900">Scadenzario CU</h1>
              <p className="text-gray-500 mt-1">Gestione Certificazioni Uniche</p>
            </div>

            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Filtri e Ricerca</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto overflow-y-auto max-h-[600px] border rounded-lg">
                  <Table>
                    <TableHeader className="sticky top-0 bg-white z-10 shadow-sm">
                      <TableRow>
                        <TableHead className="sticky left-0 bg-white z-20 min-w-[250px] border-r">Nominativo</TableHead>
                        <TableHead className="text-center min-w-[120px]">Conferma</TableHead>
                        <TableHead className="text-center min-w-[100px]">Invio</TableHead>
                        <TableHead className="text-center min-w-[150px]">Data Invio</TableHead>
                        <TableHead className="text-center min-w-[100px]">Azioni</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredScadenze.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                            Nessuna scadenza trovata
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredScadenze.map((scadenza) => (
                          <TableRow 
                            key={scadenza.id}
                            className={scadenza.conferma_riga ? "bg-green-50" : "bg-white hover:bg-gray-50"}
                          >
                            <TableCell className="font-medium sticky left-0 bg-inherit z-10 border-r">
                              {scadenza.nominativo}
                            </TableCell>
                            <TableCell className="text-center">
                              <Button
                                variant={scadenza.conferma_riga ? "default" : "outline"}
                                size="sm"
                                onClick={() => handleToggleConferma(scadenza.id, scadenza.conferma_riga)}
                                className="w-full"
                              >
                                {scadenza.conferma_riga ? "✓ Chiusa" : "○ Aperta"}
                              </Button>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={scadenza.invio || false}
                                  onChange={() => handleToggleInvio(scadenza.id, scadenza.invio)}
                                  className="rounded w-4 h-4 cursor-pointer"
                                  disabled={scadenza.conferma_riga}
                                  title={scadenza.conferma_riga ? "Riga chiusa - non modificabile" : "Attiva/Disattiva invio"}
                                />
                                <span className="text-xs text-gray-500">
                                  {scadenza.invio ? "Inviato" : "Da inviare"}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              {scadenza.invio && (
                                <Input
                                  type="date"
                                  value={scadenza.invio_data || ""}
                                  onChange={(e) => handleSetDataInvio(scadenza.id, e.target.value)}
                                  className="w-40 mx-auto"
                                  disabled={scadenza.conferma_riga}
                                />
                              )}
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
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}