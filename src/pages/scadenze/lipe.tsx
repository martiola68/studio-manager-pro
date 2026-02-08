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
  tbclienti: {
    ragione_sociale: string;
  } | null;
  tbusers_utente_operatore: {
    nome: string;
    cognome: string;
  } | null;
  tbusers_utente_professionista: {
    nome: string;
    cognome: string;
  } | null;
}

export default function Lipe() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [lipeRecords, setLipeRecords] = useState<LipeRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [operatoreFilter, setOperatoreFilter] = useState<string>("all");
  const [professionistaFilter, setProfessionistaFilter] = useState<string>("all");
  const [totalRecords, setTotalRecords] = useState(0);
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
          tbclienti!inner (ragione_sociale),
          tbusers_utente_operatore:tbutenti!utente_operatore_id (nome, cognome),
          tbusers_utente_professionista:tbutenti!utente_professionista_id (nome, cognome)
        `, { count: "exact" })
        .eq("studio_id", studioId);

      if (searchQuery) {
        query = query.ilike("tbclienti.ragione_sociale", `%${searchQuery}%`);
      }

      if (operatoreFilter !== "all") {
        query = query.eq("utente_operatore_id", operatoreFilter);
      }

      if (professionistaFilter !== "all") {
        query = query.eq("utente_professionista_id", professionistaFilter);
      }

      const { data, error, count } = await query.order("ragione_sociale", { foreignTable: "tbclienti", ascending: true });

      if (error) throw error;

      setLipeRecords(data || []);
      setTotalRecords(count || 0);
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
            <h3 className="text-lg font-semibold">Record LIPE ({totalRecords})</h3>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px]">Nominativo</TableHead>
                  <TableHead className="min-w-[150px]">Professionista</TableHead>
                  <TableHead className="min-w-[150px]">Operatore</TableHead>
                  <TableHead className="min-w-[100px]">Tipo Liq</TableHead>
                  <TableHead className="text-center">Gen</TableHead>
                  <TableHead className="text-center">Feb</TableHead>
                  <TableHead className="text-center">Mar</TableHead>
                  <TableHead className="text-center">Lipe 1T</TableHead>
                  <TableHead className="min-w-[130px]">Data Invio 1T</TableHead>
                  <TableHead className="text-center">Apr</TableHead>
                  <TableHead className="text-center">Mag</TableHead>
                  <TableHead className="text-center">Giu</TableHead>
                  <TableHead className="text-center">Lipe 2T</TableHead>
                  <TableHead className="min-w-[130px]">Data Invio 2T</TableHead>
                  <TableHead className="text-center">Lug</TableHead>
                  <TableHead className="text-center">Ago</TableHead>
                  <TableHead className="text-center">Set</TableHead>
                  <TableHead className="text-center">Lipe 3T</TableHead>
                  <TableHead className="min-w-[130px]">Data Invio 3T</TableHead>
                  <TableHead className="text-center">Ott</TableHead>
                  <TableHead className="text-center">Nov</TableHead>
                  <TableHead className="min-w-[130px]">Acconto</TableHead>
                  <TableHead className="text-center">Acc. Com</TableHead>
                  <TableHead className="text-center">Dic</TableHead>
                  <TableHead className="text-center">Lipe 4T</TableHead>
                  <TableHead className="min-w-[130px]">Data Invio 4T</TableHead>
                  <TableHead className="text-center">Azioni</TableHead>
                </TableRow>
              </TableHeader>
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
                      <TableCell className="font-medium">{record.tbclienti?.ragione_sociale || "N/A"}</TableCell>
                      <TableCell>
                        <Select
                          value={record.utente_professionista_id || ""}
                          onValueChange={(value) => handleSelectChange(record.id, "utente_professionista_id", value)}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Seleziona">
                              {record.tbusers_utente_professionista 
                                ? `${record.tbusers_utente_professionista.cognome} ${record.tbusers_utente_professionista.nome}`
                                : "Seleziona"}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {professionisti.map(prof => (
                              <SelectItem key={prof.id} value={prof.id}>
                                {prof.cognome} {prof.nome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={record.utente_operatore_id || ""}
                          onValueChange={(value) => handleSelectChange(record.id, "utente_operatore_id", value)}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Seleziona">
                              {record.tbusers_utente_operatore 
                                ? `${record.tbusers_utente_operatore.cognome} ${record.tbusers_utente_operatore.nome}`
                                : "Seleziona"}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {operatori.map(op => (
                              <SelectItem key={op.id} value={op.id}>
                                {op.cognome} {op.nome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
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
                      <TableCell className="text-center">
                        <Checkbox
                          checked={record.gen || false}
                          onCheckedChange={(checked) => handleCheckboxChange(record.id, "gen", checked as boolean)}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Checkbox
                          checked={record.feb || false}
                          onCheckedChange={(checked) => handleCheckboxChange(record.id, "feb", checked as boolean)}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Checkbox
                          checked={record.mar || false}
                          onCheckedChange={(checked) => handleCheckboxChange(record.id, "mar", checked as boolean)}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Checkbox
                          checked={record.lipe1t || false}
                          onCheckedChange={(checked) => handleCheckboxChange(record.id, "lipe1t", checked as boolean)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="relative">
                          <Input
                            type="date"
                            value={record.lipe1t_invio || ""}
                            onChange={(e) => handleDateChange(record.id, "lipe1t_invio", e.target.value)}
                            className="w-full"
                            placeholder="gg/mm/aaaa"
                          />
                          <Calendar className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Checkbox
                          checked={record.apr || false}
                          onCheckedChange={(checked) => handleCheckboxChange(record.id, "apr", checked as boolean)}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Checkbox
                          checked={record.mag || false}
                          onCheckedChange={(checked) => handleCheckboxChange(record.id, "mag", checked as boolean)}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Checkbox
                          checked={record.giu || false}
                          onCheckedChange={(checked) => handleCheckboxChange(record.id, "giu", checked as boolean)}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Checkbox
                          checked={record.lipe2t || false}
                          onCheckedChange={(checked) => handleCheckboxChange(record.id, "lipe2t", checked as boolean)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="relative">
                          <Input
                            type="date"
                            value={record.lipe2t_invio || ""}
                            onChange={(e) => handleDateChange(record.id, "lipe2t_invio", e.target.value)}
                            className="w-full"
                            placeholder="gg/mm/aaaa"
                          />
                          <Calendar className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Checkbox
                          checked={record.lug || false}
                          onCheckedChange={(checked) => handleCheckboxChange(record.id, "lug", checked as boolean)}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Checkbox
                          checked={record.ago || false}
                          onCheckedChange={(checked) => handleCheckboxChange(record.id, "ago", checked as boolean)}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Checkbox
                          checked={record.set || false}
                          onCheckedChange={(checked) => handleCheckboxChange(record.id, "set", checked as boolean)}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Checkbox
                          checked={record.lipe3t || false}
                          onCheckedChange={(checked) => handleCheckboxChange(record.id, "lipe3t", checked as boolean)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="relative">
                          <Input
                            type="date"
                            value={record.lipe3t_invio || ""}
                            onChange={(e) => handleDateChange(record.id, "lipe3t_invio", e.target.value)}
                            className="w-full"
                            placeholder="gg/mm/aaaa"
                          />
                          <Calendar className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Checkbox
                          checked={record.ott || false}
                          onCheckedChange={(checked) => handleCheckboxChange(record.id, "ott", checked as boolean)}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Checkbox
                          checked={record.nov || false}
                          onCheckedChange={(checked) => handleCheckboxChange(record.id, "nov", checked as boolean)}
                        />
                      </TableCell>
                      <TableCell>
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
                      <TableCell className="text-center">
                        <Checkbox
                          checked={record.acconto_com || false}
                          onCheckedChange={(checked) => handleCheckboxChange(record.id, "acconto_com", checked as boolean)}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Checkbox
                          checked={record.dic || false}
                          onCheckedChange={(checked) => handleCheckboxChange(record.id, "dic", checked as boolean)}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Checkbox
                          checked={record.lipe4t || false}
                          onCheckedChange={(checked) => handleCheckboxChange(record.id, "lipe4t", checked as boolean)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="relative">
                          <Input
                            type="date"
                            value={record.lipe4t_invio || ""}
                            onChange={(e) => handleDateChange(record.id, "lipe4t_invio", e.target.value)}
                            className="w-full"
                            placeholder="gg/mm/aaaa"
                          />
                          <Calendar className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
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
        </CardContent>
      </Card>
    </div>
  );
}