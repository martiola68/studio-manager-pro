import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase/client";
import { Trash2, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LipeRecord {
  id: string;
  nominativo: string;
  gen: boolean | null;
  feb: boolean | null;
  mar: boolean | null;
  apr: boolean | null;
  mag: boolean | null;
  giu: boolean | null;
  lug: boolean | null;
  ago: boolean | null;
  set: boolean | null;
  ott: boolean | null;
  nov: boolean | null;
  dic: boolean | null;
  acconto: string | null;
  acconto_com: boolean | null;
  lipe1t: boolean | null;
  lipe2t: boolean | null;
  lipe3t: boolean | null;
  lipe4t: boolean | null;
  lipe1t_invio: string | null;
  lipe2t_invio: string | null;
  lipe3t_invio: string | null;
  lipe4t_invio: string | null;
  tipo_liq: string | null;
  utente_operatore_id: string | null;
  utente_professionista_id: string | null;
  studio_id: string | null;
  utente_operatore_nome: string;
  utente_professionista_nome: string;
}

export default function Lipe() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [lipeRecords, setLipeRecords] = useState<LipeRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [operatoreFilter, setOperatoreFilter] = useState<string>("all");
  const [professionistaFilter, setProfessionistaFilter] = useState<string>("all");
  const [operatori, setOperatori] = useState<any[]>([]);
  const [professionisti, setProfessionisti] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totale: 0,
    inviate: 0,
    nonInviate: 0,
  });

  useEffect(() => {
    loadUserAndData();
  }, [operatoreFilter, professionistaFilter, searchQuery]);

  async function loadUserAndData() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    const { data: userData } = await supabase
      .from("tbutenti")
      .select("studio_id")
      .eq("id", session.user.id)
      .single();

    if (userData?.studio_id) {
      await Promise.all([
        loadLipeRecords(userData.studio_id),
        loadStats(userData.studio_id),
        loadOperatori(userData.studio_id),
        loadProfessionisti(userData.studio_id),
      ]);
    }
  }

  async function loadLipeRecords(studioId: string) {
    setLoading(true);
    try {
      let query = supabase
        .from("tbscadlipe")
        .select(`
          *,
          cliente:tbclienti!inner (
            ragione_sociale,
            utente_operatore:tbutenti!tbclienti_utente_operatore_id_fkey (nome, cognome),
            utente_professionista:tbutenti!tbclienti_utente_professionista_id_fkey (nome, cognome)
          )
        `)
        .eq("studio_id", studioId);

      if (searchQuery) {
        query = query.ilike("nominativo", `%${searchQuery}%`);
      }

      if (operatoreFilter !== "all") {
        query = query.eq("utente_operatore_id", operatoreFilter);
      }

      if (professionistaFilter !== "all") {
        query = query.eq("utente_professionista_id", professionistaFilter);
      }

      const { data, error } = await query;

      if (error) throw error;

      const mappedData = (data || []).map(record => ({
        ...record,
        nominativo: record.cliente?.ragione_sociale || record.nominativo || "-",
        utente_operatore_nome: record.cliente?.utente_operatore 
          ? `${record.cliente.utente_operatore.cognome} ${record.cliente.utente_operatore.nome}`
          : "-",
        utente_professionista_nome: record.cliente?.utente_professionista 
          ? `${record.cliente.utente_professionista.cognome} ${record.cliente.utente_professionista.nome}`
          : "-"
      }));

      const sortedData = mappedData.sort((a, b) => {
        const nameA = a.nominativo || "";
        const nameB = b.nominativo || "";
        return nameA.localeCompare(nameB);
      });

      setLipeRecords(sortedData);
    } catch (error) {
      console.error("Errore caricamento LIPE:", error);
      toast({
        title: "Errore",
        description: "Impossibile caricare i dati LIPE",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function loadStats(studioId: string) {
    try {
      const { data, error } = await supabase
        .from("tbscadlipe")
        .select("*")
        .eq("studio_id", studioId);

      if (error) throw error;

      const totale = data?.length || 0;
      const inviate = data?.filter(r => r.lipe1t && r.lipe2t && r.lipe3t && r.lipe4t).length || 0;
      const nonInviate = totale - inviate;

      setStats({ totale, inviate, nonInviate });
    } catch (error) {
      console.error("Errore caricamento stats:", error);
    }
  }

  async function loadOperatori(studioId: string) {
    try {
      const { data, error } = await supabase
        .from("tbutenti")
        .select("id, nome, cognome")
        .eq("studio_id", studioId)
        .order("cognome");

      if (error) throw error;
      setOperatori(data || []);
    } catch (error) {
      console.error("Errore caricamento operatori:", error);
    }
  }

  async function loadProfessionisti(studioId: string) {
    try {
      const { data, error } = await supabase
        .from("tbutenti")
        .select("id, nome, cognome")
        .eq("studio_id", studioId)
        .order("cognome");

      if (error) throw error;
      setProfessionisti(data || []);
    } catch (error) {
      console.error("Errore caricamento professionisti:", error);
    }
  }

  async function handleCheckboxChange(recordId: string, field: string, value: boolean) {
    try {
      const { error } = await supabase
        .from("tbscadlipe")
        .update({ [field]: value })
        .eq("id", recordId);

      if (error) throw error;

      setLipeRecords(prev =>
        prev.map(r => r.id === recordId ? { ...r, [field]: value } : r)
      );

      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: userData } = await supabase
          .from("tbutenti")
          .select("studio_id")
          .eq("id", session.user.id)
          .single();

        if (userData?.studio_id) {
          loadStats(userData.studio_id);
        }
      }
    } catch (error) {
      console.error("Errore aggiornamento:", error);
      toast({
        title: "Errore",
        description: "Impossibile aggiornare il dato",
        variant: "destructive",
      });
    }
  }

  async function handleSelectChange(recordId: string, field: string, value: string) {
    try {
      const { error } = await supabase
        .from("tbscadlipe")
        .update({ [field]: value })
        .eq("id", recordId);

      if (error) throw error;

      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: userData } = await supabase
          .from("tbutenti")
          .select("studio_id")
          .eq("id", session.user.id)
          .single();

        if (userData?.studio_id) {
          loadLipeRecords(userData.studio_id);
        }
      }
    } catch (error) {
      console.error("Errore aggiornamento:", error);
      toast({
        title: "Errore",
        description: "Impossibile aggiornare il dato",
        variant: "destructive",
      });
    }
  }

  async function handleDateChange(recordId: string, field: string, value: string) {
    try {
      const { error } = await supabase
        .from("tbscadlipe")
        .update({ [field]: value })
        .eq("id", recordId);

      if (error) throw error;

      setLipeRecords(prev =>
        prev.map(r => r.id === recordId ? { ...r, [field]: value } : r)
      );
    } catch (error) {
      console.error("Errore aggiornamento data:", error);
      toast({
        title: "Errore",
        description: "Impossibile aggiornare la data",
        variant: "destructive",
      });
    }
  }

  async function handleDelete(recordId: string) {
    if (!confirm("Sei sicuro di voler eliminare questo record?")) return;

    try {
      const { error } = await supabase
        .from("tbscadlipe")
        .delete()
        .eq("id", recordId);

      if (error) throw error;

      toast({
        title: "Successo",
        description: "Record eliminato con successo",
      });

      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: userData } = await supabase
          .from("tbutenti")
          .select("studio_id")
          .eq("id", session.user.id)
          .single();

        if (userData?.studio_id) {
          loadLipeRecords(userData.studio_id);
          loadStats(userData.studio_id);
        }
      }
    } catch (error) {
      console.error("Errore eliminazione:", error);
      toast({
        title: "Errore",
        description: "Impossibile eliminare il record",
        variant: "destructive",
      });
    }
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <div className="text-sm font-medium text-muted-foreground">Totale Dichiarazioni</div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totale}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="text-sm font-medium text-muted-foreground">LIPE Inviate</div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.inviate}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="text-sm font-medium text-muted-foreground">LIPE Non Inviate</div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.nonInviate}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Filtri e Ricerca</h3>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Cerca Nominativo</label>
              <Input
                placeholder="Cerca..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Utente Operatore</label>
              <Select value={operatoreFilter} onValueChange={setOperatoreFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Tutti" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutti</SelectItem>
                  {operatori.map(op => (
                    <SelectItem key={op.id} value={op.id}>
                      {op.cognome} {op.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Utente Professionista</label>
              <Select value={professionistaFilter} onValueChange={setProfessionistaFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Tutti" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutti</SelectItem>
                  {professionisti.map(prof => (
                    <SelectItem key={prof.id} value={prof.id}>
                      {prof.cognome} {prof.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Record LIPE ({lipeRecords.length})</h3>
          </div>
        </CardHeader>
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
                      <TableHead className="min-w-[100px]">Tipo Liq</TableHead>
                      <TableHead className="text-center bg-blue-50 min-w-[80px]">Gen</TableHead>
                      <TableHead className="text-center bg-blue-50 min-w-[80px]">Feb</TableHead>
                      <TableHead className="text-center bg-blue-50 min-w-[80px]">Mar</TableHead>
                      <TableHead className="text-center bg-blue-50 min-w-[100px]">Lipe 1T</TableHead>
                      <TableHead className="bg-blue-50 min-w-[130px]">Data Invio 1T</TableHead>
                      <TableHead className="text-center bg-green-50 min-w-[80px]">Apr</TableHead>
                      <TableHead className="text-center bg-green-50 min-w-[80px]">Mag</TableHead>
                      <TableHead className="text-center bg-green-50 min-w-[80px]">Giu</TableHead>
                      <TableHead className="text-center bg-green-50 min-w-[100px]">Lipe 2T</TableHead>
                      <TableHead className="bg-green-50 min-w-[130px]">Data Invio 2T</TableHead>
                      <TableHead className="text-center bg-yellow-50 min-w-[80px]">Lug</TableHead>
                      <TableHead className="text-center bg-yellow-50 min-w-[80px]">Ago</TableHead>
                      <TableHead className="text-center bg-yellow-50 min-w-[80px]">Set</TableHead>
                      <TableHead className="text-center bg-yellow-50 min-w-[100px]">Lipe 3T</TableHead>
                      <TableHead className="bg-yellow-50 min-w-[130px]">Data Invio 3T</TableHead>
                      <TableHead className="text-center bg-orange-50 min-w-[80px]">Ott</TableHead>
                      <TableHead className="text-center bg-orange-50 min-w-[80px]">Nov</TableHead>
                      <TableHead className="bg-orange-50 min-w-[130px]">Acconto</TableHead>
                      <TableHead className="text-center bg-orange-50 min-w-[100px]">Acc. Com</TableHead>
                      <TableHead className="text-center bg-orange-50 min-w-[80px]">Dic</TableHead>
                      <TableHead className="text-center bg-orange-50 min-w-[100px]">Lipe 4T</TableHead>
                      <TableHead className="bg-orange-50 min-w-[130px]">Data Invio 4T</TableHead>
                      <TableHead className="text-center min-w-[100px]">Azioni</TableHead>
                    </TableRow>
                  </TableHeader>
                </Table>
              </div>

              <div className="max-h-[600px] overflow-y-auto">
                <Table>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={27} className="text-center py-8">
                          Caricamento in corso...
                        </TableCell>
                      </TableRow>
                    ) : lipeRecords.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={27} className="text-center py-8 text-muted-foreground">
                          Nessuna dichiarazione trovata
                        </TableCell>
                      </TableRow>
                    ) : (
                      lipeRecords.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell className="sticky left-0 z-10 bg-inherit border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] font-medium min-w-[200px]">
                            {record.nominativo}
                          </TableCell>
                          <TableCell className="min-w-[150px] text-gray-700">
                            {record.utente_professionista_nome}
                          </TableCell>
                          <TableCell className="min-w-[150px] text-gray-700">
                            {record.utente_operatore_nome}
                          </TableCell>
                          <TableCell className="min-w-[100px]">
                            <Select
                              value={record.tipo_liq || "T"}
                              onValueChange={(value) => handleSelectChange(record.id, "tipo_liq", value)}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="T">T</SelectItem>
                                <SelectItem value="M">M</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-center bg-blue-50 min-w-[80px]">
                            <Checkbox
                              checked={record.gen || false}
                              onCheckedChange={(checked) => handleCheckboxChange(record.id, "gen", checked as boolean)}
                            />
                          </TableCell>
                          <TableCell className="text-center bg-blue-50 min-w-[80px]">
                            <Checkbox
                              checked={record.feb || false}
                              onCheckedChange={(checked) => handleCheckboxChange(record.id, "feb", checked as boolean)}
                            />
                          </TableCell>
                          <TableCell className="text-center bg-blue-50 min-w-[80px]">
                            <Checkbox
                              checked={record.mar || false}
                              onCheckedChange={(checked) => handleCheckboxChange(record.id, "mar", checked as boolean)}
                            />
                          </TableCell>
                          <TableCell className="text-center bg-blue-50 min-w-[100px]">
                            <Checkbox
                              checked={record.lipe1t || false}
                              onCheckedChange={(checked) => handleCheckboxChange(record.id, "lipe1t", checked as boolean)}
                            />
                          </TableCell>
                          <TableCell className="bg-blue-50 min-w-[130px]">
                            <div className="relative">
                              <Input
                                type="date"
                                value={record.lipe1t_invio || ""}
                                onChange={(e) => handleDateChange(record.id, "lipe1t_invio", e.target.value)}
                                className="w-full"
                              />
                              <Calendar className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                            </div>
                          </TableCell>
                          <TableCell className="text-center bg-green-50 min-w-[80px]">
                            <Checkbox
                              checked={record.apr || false}
                              onCheckedChange={(checked) => handleCheckboxChange(record.id, "apr", checked as boolean)}
                            />
                          </TableCell>
                          <TableCell className="text-center bg-green-50 min-w-[80px]">
                            <Checkbox
                              checked={record.mag || false}
                              onCheckedChange={(checked) => handleCheckboxChange(record.id, "mag", checked as boolean)}
                            />
                          </TableCell>
                          <TableCell className="text-center bg-green-50 min-w-[80px]">
                            <Checkbox
                              checked={record.giu || false}
                              onCheckedChange={(checked) => handleCheckboxChange(record.id, "giu", checked as boolean)}
                            />
                          </TableCell>
                          <TableCell className="text-center bg-green-50 min-w-[100px]">
                            <Checkbox
                              checked={record.lipe2t || false}
                              onCheckedChange={(checked) => handleCheckboxChange(record.id, "lipe2t", checked as boolean)}
                            />
                          </TableCell>
                          <TableCell className="bg-green-50 min-w-[130px]">
                            <div className="relative">
                              <Input
                                type="date"
                                value={record.lipe2t_invio || ""}
                                onChange={(e) => handleDateChange(record.id, "lipe2t_invio", e.target.value)}
                                className="w-full"
                              />
                              <Calendar className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                            </div>
                          </TableCell>
                          <TableCell className="text-center bg-yellow-50 min-w-[80px]">
                            <Checkbox
                              checked={record.lug || false}
                              onCheckedChange={(checked) => handleCheckboxChange(record.id, "lug", checked as boolean)}
                            />
                          </TableCell>
                          <TableCell className="text-center bg-yellow-50 min-w-[80px]">
                            <Checkbox
                              checked={record.ago || false}
                              onCheckedChange={(checked) => handleCheckboxChange(record.id, "ago", checked as boolean)}
                            />
                          </TableCell>
                          <TableCell className="text-center bg-yellow-50 min-w-[80px]">
                            <Checkbox
                              checked={record.set || false}
                              onCheckedChange={(checked) => handleCheckboxChange(record.id, "set", checked as boolean)}
                            />
                          </TableCell>
                          <TableCell className="text-center bg-yellow-50 min-w-[100px]">
                            <Checkbox
                              checked={record.lipe3t || false}
                              onCheckedChange={(checked) => handleCheckboxChange(record.id, "lipe3t", checked as boolean)}
                            />
                          </TableCell>
                          <TableCell className="bg-yellow-50 min-w-[130px]">
                            <div className="relative">
                              <Input
                                type="date"
                                value={record.lipe3t_invio || ""}
                                onChange={(e) => handleDateChange(record.id, "lipe3t_invio", e.target.value)}
                                className="w-full"
                              />
                              <Calendar className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                            </div>
                          </TableCell>
                          <TableCell className="text-center bg-orange-50 min-w-[80px]">
                            <Checkbox
                              checked={record.ott || false}
                              onCheckedChange={(checked) => handleCheckboxChange(record.id, "ott", checked as boolean)}
                            />
                          </TableCell>
                          <TableCell className="text-center bg-orange-50 min-w-[80px]">
                            <Checkbox
                              checked={record.nov || false}
                              onCheckedChange={(checked) => handleCheckboxChange(record.id, "nov", checked as boolean)}
                            />
                          </TableCell>
                          <TableCell className="bg-orange-50 min-w-[130px]">
                            <Select
                              value={record.acconto || "Non dovuto"}
                              onValueChange={(value) => handleSelectChange(record.id, "acconto", value)}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Non dovuto">Non dovuto</SelectItem>
                                <SelectItem value="Dovuto">Dovuto</SelectItem>
                                <SelectItem value="Pagato">Pagato</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-center bg-orange-50 min-w-[100px]">
                            <Checkbox
                              checked={record.acconto_com || false}
                              onCheckedChange={(checked) => handleCheckboxChange(record.id, "acconto_com", checked as boolean)}
                            />
                          </TableCell>
                          <TableCell className="text-center bg-orange-50 min-w-[80px]">
                            <Checkbox
                              checked={record.dic || false}
                              onCheckedChange={(checked) => handleCheckboxChange(record.id, "dic", checked as boolean)}
                            />
                          </TableCell>
                          <TableCell className="text-center bg-orange-50 min-w-[100px]">
                            <Checkbox
                              checked={record.lipe4t || false}
                              onCheckedChange={(checked) => handleCheckboxChange(record.id, "lipe4t", checked as boolean)}
                            />
                          </TableCell>
                          <TableCell className="bg-orange-50 min-w-[130px]">
                            <div className="relative">
                              <Input
                                type="date"
                                value={record.lipe4t_invio || ""}
                                onChange={(e) => handleDateChange(record.id, "lipe4t_invio", e.target.value)}
                                className="w-full"
                              />
                              <Calendar className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                            </div>
                          </TableCell>
                          <TableCell className="text-center min-w-[100px]">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(record.id)}
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