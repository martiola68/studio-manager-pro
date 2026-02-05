import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Search } from "lucide-react";
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
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push("/login");
      return;
    }
    await loadScadenze();
  };

  const loadScadenze = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("tbscadimu")
        .select("*")
        .order("nominativo", { ascending: true });
      
      if (error) throw error;
      
      const scadenzeData = data || [];
      setScadenze(scadenzeData);
      
      setStats({
        totale: scadenzeData.length,
        confermate: scadenzeData.filter(s => s.conferma_riga).length,
        nonConfermate: scadenzeData.filter(s => !s.conferma_riga).length
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
      
      setScadenze(prev => prev.map(s => 
        s.id === id ? { ...s, [field]: newValue } : s
      ));
      
      if (field === "conferma_riga") {
        setStats(prev => ({
          ...prev,
          confermate: newValue ? prev.confermate + 1 : prev.confermate - 1,
          nonConfermate: newValue ? prev.nonConfermate - 1 : prev.nonConfermate + 1
        }));
      }
      
      const { error } = await supabase
        .from("tbscadimu")
        .update({ [field]: newValue })
        .eq("id", id);
      
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
      const { error } = await supabase
        .from("tbscadimu")
        .update({ [field]: value || null })
        .eq("id", id);
      
      if (error) throw error;
      
      setScadenze(prev => prev.map(s => 
        s.id === id ? { ...s, [field]: value } : s
      ));
    } catch (error: any) {
      toast({
        title: "Errore aggiornamento",
        description: error.message,
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
          .from("tbscadimu")
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

  const filteredScadenze = scadenze.filter(s => {
    const matchSearch = !searchQuery || 
      s.nominativo?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.professionista?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.operatore?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchConferma = filterConferma === "__all__" ||
      (filterConferma === "true" ? s.conferma_riga : !s.conferma_riga);
    
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
          <div className="overflow-x-auto">
            <div className="inline-block min-w-full align-middle">
              <div className="sticky top-0 z-20 bg-white border-b">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 z-30 bg-white border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] min-w-[200px]">Nominativo</TableHead>
                      <TableHead className="min-w-[150px]">Professionista</TableHead>
                      <TableHead className="min-w-[150px]">Operatore</TableHead>
                      <TableHead className="text-center min-w-[120px]">Acconto IMU</TableHead>
                      <TableHead className="text-center min-w-[120px]">Acconto Dovuto</TableHead>
                      <TableHead className="text-center min-w-[120px]">Acconto Comunicato</TableHead>
                      <TableHead className="min-w-[150px]">Data Com. Acconto</TableHead>
                      <TableHead className="text-center min-w-[120px]">Saldo IMU</TableHead>
                      <TableHead className="text-center min-w-[120px]">Saldo Dovuto</TableHead>
                      <TableHead className="text-center min-w-[120px]">Saldo Comunicato</TableHead>
                      <TableHead className="min-w-[150px]">Data Com. Saldo</TableHead>
                      <TableHead className="text-center min-w-[120px]">Dichiarazione IMU</TableHead>
                      <TableHead className="min-w-[150px]">Data Scad. Dich.</TableHead>
                      <TableHead className="text-center min-w-[120px]">Dich. Presentata</TableHead>
                      <TableHead className="min-w-[150px]">Data Presentazione</TableHead>
                      <TableHead className="min-w-[300px]">Note</TableHead>
                      <TableHead className="text-center min-w-[120px]">Conferma</TableHead>
                    </TableRow>
                  </TableHeader>
                </Table>
              </div>

              <div className="max-h-[600px] overflow-y-auto">
                <Table>
                  <TableBody>
                    {filteredScadenze.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={17} className="text-center py-8 text-gray-500">
                          Nessuna dichiarazione IMU trovata
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredScadenze.map((scadenza) => (
                        <TableRow key={scadenza.id}>
                          <TableCell className="sticky left-0 z-10 bg-inherit border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] font-medium min-w-[200px]">
                            {scadenza.nominativo}
                          </TableCell>
                          <TableCell className="min-w-[150px]">{scadenza.professionista || "-"}</TableCell>
                          <TableCell className="min-w-[150px]">{scadenza.operatore || "-"}</TableCell>
                          <TableCell className="text-center min-w-[120px]">
                            <Checkbox
                              checked={scadenza.acconto_imu || false}
                              onCheckedChange={() => handleToggleField(scadenza.id, "acconto_imu", scadenza.acconto_imu)}
                            />
                          </TableCell>
                          <TableCell className="text-center min-w-[120px]">
                            <Checkbox
                              checked={scadenza.acconto_dovuto || false}
                              onCheckedChange={() => handleToggleField(scadenza.id, "acconto_dovuto", scadenza.acconto_dovuto)}
                            />
                          </TableCell>
                          <TableCell className="text-center min-w-[120px]">
                            <Checkbox
                              checked={scadenza.acconto_comunicato || false}
                              onCheckedChange={() => handleToggleField(scadenza.id, "acconto_comunicato", scadenza.acconto_comunicato)}
                            />
                          </TableCell>
                          <TableCell className="min-w-[150px]">
                            <Input
                              type="date"
                              value={scadenza.data_com_acconto || ""}
                              onChange={(e) => handleUpdateField(scadenza.id, "data_com_acconto", e.target.value)}
                              className="w-full"
                            />
                          </TableCell>
                          <TableCell className="text-center min-w-[120px]">
                            <Checkbox
                              checked={scadenza.saldo_imu || false}
                              onCheckedChange={() => handleToggleField(scadenza.id, "saldo_imu", scadenza.saldo_imu)}
                            />
                          </TableCell>
                          <TableCell className="text-center min-w-[120px]">
                            <Checkbox
                              checked={scadenza.saldo_dovuto || false}
                              onCheckedChange={() => handleToggleField(scadenza.id, "saldo_dovuto", scadenza.saldo_dovuto)}
                            />
                          </TableCell>
                          <TableCell className="text-center min-w-[120px]">
                            <Checkbox
                              checked={scadenza.saldo_comunicato || false}
                              onCheckedChange={() => handleToggleField(scadenza.id, "saldo_comunicato", scadenza.saldo_comunicato)}
                            />
                          </TableCell>
                          <TableCell className="min-w-[150px]">
                            <Input
                              type="date"
                              value={scadenza.data_com_saldo || ""}
                              onChange={(e) => handleUpdateField(scadenza.id, "data_com_saldo", e.target.value)}
                              className="w-full"
                            />
                          </TableCell>
                          <TableCell className="text-center min-w-[120px]">
                            <Checkbox
                              checked={scadenza.dichiarazione_imu || false}
                              onCheckedChange={() => handleToggleField(scadenza.id, "dichiarazione_imu", scadenza.dichiarazione_imu)}
                            />
                          </TableCell>
                          <TableCell className="min-w-[150px]">
                            <Input
                              type="date"
                              value={scadenza.data_scad_dichiarazione || ""}
                              onChange={(e) => handleUpdateField(scadenza.id, "data_scad_dichiarazione", e.target.value)}
                              className="w-full"
                            />
                          </TableCell>
                          <TableCell className="text-center min-w-[120px]">
                            <Checkbox
                              checked={scadenza.dichiarazione_presentata || false}
                              onCheckedChange={() => handleToggleField(scadenza.id, "dichiarazione_presentata", scadenza.dichiarazione_presentata)}
                            />
                          </TableCell>
                          <TableCell className="min-w-[150px]">
                            <Input
                              type="date"
                              value={scadenza.data_presentazione || ""}
                              onChange={(e) => handleUpdateField(scadenza.id, "data_presentazione", e.target.value)}
                              className="w-full"
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