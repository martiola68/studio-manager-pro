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
import { Search, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type ScadenzaImu = Database["public"]["Tables"]["tbscadimu"]["Row"];

export default function ImuPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [scadenze, setScadenze] = useState<ScadenzaImu[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterConferma, setFilterConferma] = useState("__all__");

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

  const handleUpdate = async (id: string, field: keyof ScadenzaImu, value: any) => {
    try {
      const { error } = await supabase
        .from("tbscadimu")
        .update({ [field]: value })
        .eq("id", id);
      
      if (error) throw error;
      
      setScadenze(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
    } catch (error: any) {
      toast({
        title: "Errore aggiornamento",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Sei sicuro di voler eliminare questa dichiarazione IMU?")) return;
    
    try {
      const { error } = await supabase
        .from("tbscadimu")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
      
      setScadenze(prev => prev.filter(s => s.id !== id));
      toast({
        title: "Successo",
        description: "Dichiarazione IMU eliminata"
      });
    } catch (error: any) {
      toast({
        title: "Errore eliminazione",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const toggleConferma = async (id: string, currentValue: boolean) => {
    await handleUpdate(id, "conferma_riga", !currentValue);
  };

  const filteredScadenze = scadenze.filter(s => {
    const matchSearch = !searchQuery || 
      s.nominativo?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.professionista?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.operatore?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchConferma = filterConferma === "__all__" ||
      (filterConferma === "aperte" && !s.conferma_riga) ||
      (filterConferma === "chiuse" && s.conferma_riga);
    
    return matchSearch && matchConferma;
  });

  if (loading) {
    return (
      <main className="flex-1 overflow-auto p-8">
        <div className="text-center">Caricamento...</div>
      </main>
    );
  }

  return (
    <main className="flex-1 overflow-auto p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Scadenzario IMU</h1>
          <p className="text-gray-500 mt-1">Gestione dichiarazioni e versamenti IMU</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-sm text-gray-500">Totale Dichiarazioni</div>
          <div className="text-2xl font-bold text-gray-900">{stats.totale}</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-sm text-gray-500">Confermate</div>
          <div className="text-2xl font-bold text-green-600">{stats.confermate}</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-sm text-gray-500">Non Confermate</div>
          <div className="text-2xl font-bold text-orange-600">{stats.nonConfermate}</div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 mb-6 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Cerca per nominativo, professionista, operatore..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <select
            value={filterConferma}
            onChange={(e) => setFilterConferma(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-md"
          >
            <option value="__all__">Tutte</option>
            <option value="aperte">Aperte</option>
            <option value="chiuse">Chiuse</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 bg-gray-50 z-10 min-w-[200px]">Nominativo</TableHead>
                <TableHead>Professionista</TableHead>
                <TableHead>Operatore</TableHead>
                <TableHead className="text-center">Acconto IMU</TableHead>
                <TableHead className="text-center">Acconto Dovuto</TableHead>
                <TableHead className="text-center">Acconto Comunicato</TableHead>
                <TableHead>Data Com. Acconto</TableHead>
                <TableHead className="text-center">Saldo IMU</TableHead>
                <TableHead className="text-center">Saldo Dovuto</TableHead>
                <TableHead className="text-center">Saldo Comunicato</TableHead>
                <TableHead>Data Com. Saldo</TableHead>
                <TableHead className="text-center">Dichiarazione IMU</TableHead>
                <TableHead>Data Scad. Dich.</TableHead>
                <TableHead className="text-center">Dich. Presentata</TableHead>
                <TableHead>Data Presentazione</TableHead>
                <TableHead>Note</TableHead>
                <TableHead className="text-center">Conferma</TableHead>
                <TableHead className="text-center">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredScadenze.map((scadenza) => (
                <TableRow key={scadenza.id} className={scadenza.conferma_riga ? "bg-green-50" : ""}>
                  <TableCell className="sticky left-0 bg-white z-10 font-medium">
                    {scadenza.nominativo}
                  </TableCell>
                  <TableCell>
                    <Input
                      type="text"
                      value={scadenza.professionista || ""}
                      disabled={true}
                      className="w-full min-w-[150px] bg-gray-50 cursor-not-allowed"
                      placeholder="Professionista"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="text"
                      value={scadenza.operatore || ""}
                      disabled={true}
                      className="w-full min-w-[150px] bg-gray-50 cursor-not-allowed"
                      placeholder="Operatore"
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Checkbox
                      checked={scadenza.acconto_imu || false}
                      onCheckedChange={(checked) => handleUpdate(scadenza.id, "acconto_imu", checked)}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Checkbox
                      checked={scadenza.acconto_dovuto || false}
                      onCheckedChange={(checked) => handleUpdate(scadenza.id, "acconto_dovuto", checked)}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Checkbox
                      checked={scadenza.acconto_comunicato || false}
                      onCheckedChange={(checked) => handleUpdate(scadenza.id, "acconto_comunicato", checked)}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="date"
                      value={scadenza.data_com_acconto || ""}
                      onChange={(e) => handleUpdate(scadenza.id, "data_com_acconto", e.target.value)}
                      className="w-40"
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Checkbox
                      checked={scadenza.saldo_imu || false}
                      onCheckedChange={(checked) => handleUpdate(scadenza.id, "saldo_imu", checked)}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Checkbox
                      checked={scadenza.saldo_dovuto || false}
                      onCheckedChange={(checked) => handleUpdate(scadenza.id, "saldo_dovuto", checked)}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Checkbox
                      checked={scadenza.saldo_comunicato || false}
                      onCheckedChange={(checked) => handleUpdate(scadenza.id, "saldo_comunicato", checked)}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="date"
                      value={scadenza.data_com_saldo || ""}
                      onChange={(e) => handleUpdate(scadenza.id, "data_com_saldo", e.target.value)}
                      className="w-40"
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Checkbox
                      checked={scadenza.dichiarazione_imu || false}
                      onCheckedChange={(checked) => handleUpdate(scadenza.id, "dichiarazione_imu", checked)}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="date"
                      value={scadenza.data_scad_dichiarazione || ""}
                      onChange={(e) => handleUpdate(scadenza.id, "data_scad_dichiarazione", e.target.value)}
                      className="w-40"
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Checkbox
                      checked={scadenza.dichiarazione_presentata || false}
                      onCheckedChange={(checked) => handleUpdate(scadenza.id, "dichiarazione_presentata", checked)}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="date"
                      value={scadenza.data_presentazione || ""}
                      onChange={(e) => handleUpdate(scadenza.id, "data_presentazione", e.target.value)}
                      className="w-40"
                    />
                  </TableCell>
                  <TableCell>
                    <Textarea
                      value={scadenza.note || ""}
                      onChange={(e) => handleUpdate(scadenza.id, "note", e.target.value)}
                      className="w-60 min-h-[60px]"
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Button
                      onClick={() => toggleConferma(scadenza.id, scadenza.conferma_riga || false)}
                      variant={scadenza.conferma_riga ? "default" : "outline"}
                      size="sm"
                      className={scadenza.conferma_riga ? "bg-green-600 hover:bg-green-700" : ""}
                    >
                      {scadenza.conferma_riga ? "Chiusa" : "Aperta"}
                    </Button>
                  </TableCell>
                  <TableCell className="text-center">
                    <Button
                      onClick={() => handleDelete(scadenza.id)}
                      variant="destructive"
                      size="sm"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {filteredScadenze.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          Nessuna dichiarazione IMU trovata
        </div>
      )}
    </main>
  );
}