import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search, Calendar, User, Save, RefreshCw, Filter } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Tipi
type Scadenza770 = {
  id: string;
  cliente_id: string;
  anno: number;
  stato: string;
  note?: string;
  created_at: string | null; // Aggiunto per matchare DB
  cliente?: {
    ragione_sociale: string;
    settore?: string;
  };
  utente_payroll?: {
    nome: string;
    cognome: string;
  };
  utente_payroll_id?: string | null; // Aggiunto
};

export default function Modello770Page() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [scadenze, setScadenze] = useState<Scadenza770[]>([]);
  const [filteredScadenze, setFilteredScadenze] = useState<Scadenza770[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAnno, setSelectedAnno] = useState<number>(new Date().getFullYear());
  const [activeTab, setActiveTab] = useState("fiscale"); // 'fiscale' | 'lavoro'

  useEffect(() => {
    loadData();
  }, [selectedAnno]);

  useEffect(() => {
    filterData();
  }, [scadenze, searchTerm, activeTab]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Query base
      const query = supabase
        .from("tbscad770")
        .select(`
          *,
          cliente:tbclienti!cliente_id (
            ragione_sociale,
            settore
          ),
          utente_payroll:tbutenti!utente_payroll_id (
            nome,
            cognome
          )
        `)
        .eq("anno", selectedAnno);

      // Filtro per settore (lato server se possibile, altrimenti client)
      // Nota: tbscad770 non ha il settore diretto, lo prendiamo dal cliente
      
      const { data, error } = await query
        .from("tbscad770")
        .select(`
          *,
        `);

      if (error) throw error;
      
      // Filtraggio client-side per settore (più sicuro se la relazione è complessa)
      const filteredData = (data as any[]).filter(item => {
        if (!activeTab || activeTab === "all") return true;
        
        const settoreCliente = item.cliente?.settore;
        
        if (activeTab === "lavoro") {
          return settoreCliente === "Lavoro" || settoreCliente === "Fiscale & Lavoro";
        }
        if (activeTab === "fiscale") {
          return settoreCliente === "Fiscale" || settoreCliente === "Fiscale & Lavoro";
        }
        return true;
      });

      setScadenze(filteredData as Scadenza770[]);
    } catch (error) {
      console.error("Errore caricamento 770:", error);
      toast({
        title: "Errore",
        description: "Impossibile caricare i dati",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const filterData = () => {
    let filtered = scadenze;

    // Filtro per Tab (Settore)
    if (activeTab === "fiscale") {
      // 770 Rep Fiscale: Solo settore Fiscale o Fiscale & lavoro
      filtered = filtered.filter(s => 
        s.cliente?.settore === "Fiscale" || s.cliente?.settore === "Fiscale & Lavoro" || !s.cliente?.settore
      );
    } else {
      // 770 Rep Lavoro: Solo settore Lavoro o Fiscale & lavoro
      filtered = filtered.filter(s => 
        s.cliente?.settore === "Lavoro" || s.cliente?.settore === "Fiscale & Lavoro"
      );
    }

    // Filtro ricerca
    if (searchTerm) {
      filtered = filtered.filter(s => 
        s.cliente?.ragione_sociale.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredScadenze(filtered);
  };

  const handleSyncClienti = async () => {
    try {
      setLoading(true);
      
      // 1. Trova tutti i clienti che hanno il flag_770 = true
      const { data: clienti, error: clientiError } = await supabase
        .from("tbclienti")
        .select("id, ragione_sociale")
        .eq("flag_770", true)
        .eq("attivo", true);

      if (clientiError) throw clientiError;

      if (!clienti || clienti.length === 0) {
        toast({
          title: "Nessun cliente trovato",
          description: "Nessun cliente attivo ha il flag 770 abilitato.",
        });
        return;
      }

      let insertedCount = 0;

      // 2. Per ogni cliente, controlla se esiste già il record per l'anno corrente
      for (const cliente of clienti) {
        const exists = scadenze.some(s => s.cliente_id === cliente.id && s.anno === selectedAnno);
        
        if (!exists) {
          // Inserisci nuovo record
          const { error: insertError } = await supabase
            .from("tbscad770")
            .insert({
              cliente_id: cliente.id,
              anno: selectedAnno,
              stato: "Da elaborare"
            } as any);

          if (insertError) {
            console.error(`Errore inserimento per ${cliente.ragione_sociale}:`, insertError);
          } else {
            insertedCount++;
          }
        }
      }

      if (insertedCount > 0) {
        toast({
          title: "Sincronizzazione completata",
          description: `Inseriti ${insertedCount} nuovi clienti nello scadenzario ${selectedAnno}.`,
        });
        await loadData();
      } else {
        toast({
          title: "Sincronizzazione completata",
          description: "Tutti i clienti con flag 770 sono già presenti nello scadenzario.",
        });
      }

    } catch (error) {
      console.error("Errore sincronizzazione:", error);
      toast({
        title: "Errore",
        description: "Errore durante la sincronizzazione clienti",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Scadenzario 770</h1>
          <p className="text-gray-500">Gestione Modello 770</p>
        </div>
        <div className="flex gap-4 items-center">
          <div className="flex items-center gap-2 bg-white p-2 rounded-md border">
            <span className="text-sm font-medium">Anno:</span>
            <Select 
              value={selectedAnno.toString()} 
              onValueChange={(val) => setSelectedAnno(parseInt(val))}
            >
              <SelectTrigger className="w-24 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2024">2024</SelectItem>
                <SelectItem value="2025">2025</SelectItem>
                <SelectItem value="2026">2026</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <Button onClick={handleSyncClienti} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Sincronizza Clienti
          </Button>
        </div>
      </div>

      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Cerca cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="fiscale">770 Rep Fiscale</TabsTrigger>
          <TabsTrigger value="lavoro">770 Rep Lavoro</TabsTrigger>
        </TabsList>

        <TabsContent value="fiscale" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Reparto Fiscale (Settore: Fiscale, Fiscale & Lavoro)</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Settore</TableHead>
                    <TableHead>Stato</TableHead>
                    <TableHead>Note</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredScadenze.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                        Nessuna scadenza trovata
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredScadenze.map((scadenza) => (
                      <TableRow key={scadenza.id}>
                        <TableCell className="font-medium">{scadenza.cliente?.ragione_sociale}</TableCell>
                        <TableCell>{scadenza.cliente?.settore || "-"}</TableCell>
                        <TableCell>{scadenza.stato}</TableCell>
                        <TableCell>{scadenza.note}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="lavoro" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Reparto Lavoro (Settore: Lavoro, Fiscale & Lavoro)</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Settore</TableHead>
                    <TableHead>Utente Payroll</TableHead>
                    <TableHead>Stato</TableHead>
                    <TableHead>Note</TableHead>
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
                      <TableRow key={scadenza.id}>
                        <TableCell className="font-medium">{scadenza.cliente?.ragione_sociale}</TableCell>
                        <TableCell>{scadenza.cliente?.settore || "-"}</TableCell>
                        <TableCell>
                          {scadenza.utente_payroll 
                            ? `${scadenza.utente_payroll.nome} ${scadenza.utente_payroll.cognome}`
                            : "-"
                          }
                        </TableCell>
                        <TableCell>{scadenza.stato}</TableCell>
                        <TableCell>{scadenza.note}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}