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
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/lib/supabase/types";

type ScadenzaFiscali = Database["public"]["Tables"]["tbscadfiscali"]["Row"];
type Utente = Database["public"]["Tables"]["tbutenti"]["Row"];

const TIPO_REDDITI_OPTIONS = ["USC", "USP", "ENC", "UPF", "730"];

export default function ScadenzeFiscaliPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [scadenze, setScadenze] = useState<ScadenzaFiscali[]>([]);
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

  const loadScadenze = async (): Promise<ScadenzaFiscali[]> => {
    const { data, error } = await supabase
      .from("tbscadfiscali")
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
        .from("tbscadfiscali")
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
        .from("tbscadfiscali")
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
        .from("tbscadfiscali")
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

  const getRowColor = (scadenza: ScadenzaFiscali): string => {
    // Priorità: Conferma Invii (verde) > Ricevuta R (arancione) > default (bianco)
    if (scadenza.conferma_invii) return "bg-green-50";
    if (scadenza.ricevuta_r) return "bg-orange-50";
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
          <h1 className="text-3xl font-bold text-gray-900">Scadenze Fiscali</h1>
          <p className="text-gray-500 mt-1">Gestione versamenti imposte e dichiarativi</p>
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
          <div className="relative">
            <div className="h-[600px] overflow-x-scroll overflow-y-auto border rounded-lg">
              <Table className="relative min-w-[2400px]">
                <TableHeader className="sticky top-0 bg-white z-20 shadow-sm">
                  <TableRow>
                    <TableHead className="sticky left-0 bg-white z-30 min-w-[200px] border-r">Nominativo</TableHead>
                    <TableHead className="min-w-[150px]">Professionista</TableHead>
                    <TableHead className="min-w-[150px]">Operatore</TableHead>
                    <TableHead className="min-w-[120px]">Tipo Redditi</TableHead>
                    <TableHead className="text-center min-w-[120px]">Mod R Comp.</TableHead>
                    <TableHead className="text-center min-w-[120px]">Mod R Def.</TableHead>
                    <TableHead className="text-center min-w-[120px]">Mod R Inv.</TableHead>
                    <TableHead className="text-center min-w-[140px]">Data R Invio</TableHead>
                    <TableHead className="text-center min-w-[120px]">Ricevuta R</TableHead>
                    <TableHead className="text-center min-w-[120px]">Con IRAP</TableHead>
                    <TableHead className="text-center min-w-[120px]">Mod I Comp.</TableHead>
                    <TableHead className="text-center min-w-[120px]">Mod I Def.</TableHead>
                    <TableHead className="text-center min-w-[120px]">Mod I Inv.</TableHead>
                    <TableHead className="text-center min-w-[140px]">Data I Invio</TableHead>
                    <TableHead className="text-center min-w-[120px]">Conf. Invii</TableHead>
                    <TableHead className="min-w-[200px]">Note</TableHead>
                    <TableHead className="text-center min-w-[140px]">Saldo+Acc CCIAA</TableHead>
                    <TableHead className="text-center min-w-[140px]">Data Com1</TableHead>
                    <TableHead className="text-center min-w-[120px]">Acc2</TableHead>
                    <TableHead className="text-center min-w-[140px]">Data Com2</TableHead>
                    <TableHead className="text-center min-w-[120px]">Conf. Riga</TableHead>
                    <TableHead className="text-center min-w-[100px]">Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredScadenze.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={21} className="text-center py-8 text-gray-500">
                        Nessuna scadenza trovata
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredScadenze.map((scadenza) => {
                      const isConfermata = scadenza.conferma_riga || false;
                      const hasIrap = scadenza.con_irap || false;
                      
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
                          
                          {/* Tipo Redditi */}
                          <TableCell>
                            <Select
                              value={scadenza.tipo_redditi || ""}
                              onValueChange={(value) => handleUpdateField(scadenza.id, "tipo_redditi", value || null)}
                              disabled={isConfermata}
                            >
                              <SelectTrigger className="w-full text-xs">
                                <SelectValue placeholder="-" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">-</SelectItem>
                                {TIPO_REDDITI_OPTIONS.map((opt) => (
                                  <SelectItem key={opt} value={opt}>
                                    {opt}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          
                          {/* Sezione Modello R */}
                          <TableCell className="text-center">
                            <input
                              type="checkbox"
                              checked={scadenza.mod_r_compilato || false}
                              onChange={() => handleToggleField(scadenza.id, "mod_r_compilato", scadenza.mod_r_compilato)}
                              className="rounded w-4 h-4 cursor-pointer"
                              disabled={isConfermata}
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <input
                              type="checkbox"
                              checked={scadenza.mod_r_definitivo || false}
                              onChange={() => handleToggleField(scadenza.id, "mod_r_definitivo", scadenza.mod_r_definitivo)}
                              className="rounded w-4 h-4 cursor-pointer"
                              disabled={isConfermata}
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <input
                              type="checkbox"
                              checked={scadenza.mod_r_inviato || false}
                              onChange={() => handleToggleField(scadenza.id, "mod_r_inviato", scadenza.mod_r_inviato)}
                              className="rounded w-4 h-4 cursor-pointer"
                              disabled={isConfermata}
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <Input
                              type="date"
                              value={scadenza.data_r_invio || ""}
                              onChange={(e) => handleUpdateField(scadenza.id, "data_r_invio", e.target.value)}
                              className="w-36 text-xs"
                              disabled={isConfermata}
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <input
                              type="checkbox"
                              checked={scadenza.ricevuta_r || false}
                              onChange={() => handleToggleField(scadenza.id, "ricevuta_r", scadenza.ricevuta_r)}
                              className="rounded w-4 h-4 cursor-pointer"
                              disabled={isConfermata}
                            />
                          </TableCell>

                          {/* Sezione IRAP */}
                          <TableCell className="text-center">
                            <input
                              type="checkbox"
                              checked={hasIrap}
                              onChange={() => handleToggleField(scadenza.id, "con_irap", scadenza.con_irap)}
                              className="rounded w-4 h-4 cursor-pointer"
                              disabled={isConfermata}
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <input
                              type="checkbox"
                              checked={scadenza.mod_i_compilato || false}
                              onChange={() => handleToggleField(scadenza.id, "mod_i_compilato", scadenza.mod_i_compilato)}
                              className="rounded w-4 h-4 cursor-pointer"
                              disabled={!hasIrap || isConfermata}
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <input
                              type="checkbox"
                              checked={scadenza.mod_i_definitivo || false}
                              onChange={() => handleToggleField(scadenza.id, "mod_i_definitivo", scadenza.mod_i_definitivo)}
                              className="rounded w-4 h-4 cursor-pointer"
                              disabled={!hasIrap || isConfermata}
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <input
                              type="checkbox"
                              checked={scadenza.mod_i_inviato || false}
                              onChange={() => handleToggleField(scadenza.id, "mod_i_inviato", scadenza.mod_i_inviato)}
                              className="rounded w-4 h-4 cursor-pointer"
                              disabled={!hasIrap || isConfermata}
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <Input
                              type="date"
                              value={scadenza.data_i_invio || ""}
                              onChange={(e) => handleUpdateField(scadenza.id, "data_i_invio", e.target.value)}
                              className="w-36 text-xs"
                              disabled={!hasIrap || isConfermata}
                            />
                          </TableCell>

                          {/* Conferma Invii */}
                          <TableCell className="text-center">
                            <Button
                              variant={scadenza.conferma_invii ? "default" : "outline"}
                              size="sm"
                              onClick={() => handleToggleField(scadenza.id, "conferma_invii", scadenza.conferma_invii)}
                              className="w-full"
                              disabled={isConfermata}
                            >
                              {scadenza.conferma_invii ? "✓ Conf." : "○ No"}
                            </Button>
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

                          {/* Sezione Saldo/Acconti */}
                          <TableCell className="text-center">
                            <input
                              type="checkbox"
                              checked={scadenza.saldo_acc_cciaa || false}
                              onChange={() => handleToggleField(scadenza.id, "saldo_acc_cciaa", scadenza.saldo_acc_cciaa)}
                              className="rounded w-4 h-4 cursor-pointer"
                              disabled={isConfermata}
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <Input
                              type="date"
                              value={scadenza.data_com1 || ""}
                              onChange={(e) => handleUpdateField(scadenza.id, "data_com1", e.target.value)}
                              className="w-36 text-xs"
                              disabled={isConfermata}
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <input
                              type="checkbox"
                              checked={scadenza.acc2 || false}
                              onChange={() => handleToggleField(scadenza.id, "acc2", scadenza.acc2)}
                              className="rounded w-4 h-4 cursor-pointer"
                              disabled={isConfermata}
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <Input
                              type="date"
                              value={scadenza.data_com2 || ""}
                              onChange={(e) => handleUpdateField(scadenza.id, "data_com2", e.target.value)}
                              className="w-36 text-xs"
                              disabled={isConfermata}
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
          </div>
        </CardContent>
      </Card>

      {/* Legenda colori */}
      <Card className="mt-4">
        <CardContent className="py-4">
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-green-50 border border-green-200 rounded"></div>
              <span>Conferma Invii = True (Verde)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-orange-50 border border-orange-200 rounded"></div>
              <span>Ricevuta R = True (Arancione)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-white border border-gray-200 rounded"></div>
              <span>Default (Bianco)</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}