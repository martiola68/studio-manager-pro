import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Search, Trash2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

type LipeRow = Database["public"]["Tables"]["tbscadlipe"]["Row"];
type LipeUpdate = Database["public"]["Tables"]["tbscadlipe"]["Update"];

type ClienteRow = Database["public"]["Tables"]["tbclienti"]["Row"];
type UtenteRow = Database["public"]["Tables"]["tbutenti"]["Row"];

interface LipeWithRelations extends LipeRow {
  tbutenti_professionista?: UtenteRow | null;
  tbutenti_operatore?: UtenteRow | null;
}

const ITEMS_PER_PAGE = 50;

export default function LipePage() {
  const router = useRouter();
  const { toast } = useToast();

  const [lipeRecords, setLipeRecords] = useState<LipeWithRelations[]>([]);
  const [clienti, setClienti] = useState<ClienteRow[]>([]);
  const [utenti, setUtenti] = useState<UtenteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [studioId, setStudioId] = useState<string | null>(null);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  const [searchQuery, setSearchQuery] = useState("");
  const [filterOperatore, setFilterOperatore] = useState("__all__");
  const [filterProfessionista, setFilterProfessionista] = useState("__all__");

  const [stats, setStats] = useState({
    totale: 0,
    lipeInviate: 0,
    lipeNonInviate: 0
  });

  useEffect(() => {
    checkAuthAndLoadData();
  }, [currentPage]);

  async function checkAuthAndLoadData() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push("/login");
      return;
    }

    const { data: userData } = await supabase
      .from("tbutenti")
      .select("studio_id")
      .eq("id", session.user.id)
      .single();

    if (userData?.studio_id) {
      setStudioId(userData.studio_id);
      await Promise.all([
        loadLipeRecords(userData.studio_id, currentPage),
        loadClienti(userData.studio_id),
        loadUtenti(userData.studio_id)
      ]);
    }
    setLoading(false);
  }

  async function loadLipeRecords(studio_id: string, page: number) {
    setLoading(true);
    
    const { count, error: countError } = await supabase
      .from("tbscadlipe")
      .select("*", { count: 'exact', head: true })
      .eq("studio_id", studio_id);

    if (countError) {
      console.error("Errore conteggio LIPE:", countError);
    } else {
      setTotalRecords(count || 0);
    }

    const from = (page - 1) * ITEMS_PER_PAGE;
    const to = from + ITEMS_PER_PAGE - 1;

    const { data, error } = await supabase
      .from("tbscadlipe")
      .select(`
        *,
        tbutenti_professionista:tbutenti!tbscadlipe_utente_professionista_id_fkey(id, nome, cognome),
        tbutenti_operatore:tbutenti!tbscadlipe_utente_operatore_id_fkey(id, nome, cognome)
      `)
      .eq("studio_id", studio_id)
      .order("nominativo", { ascending: true })
      .range(from, to);

    if (error) {
      console.error("Errore caricamento LIPE:", error);
      toast({ title: "Errore", description: "Impossibile caricare i dati LIPE", variant: "destructive" });
      setLoading(false);
      return;
    }

    setLipeRecords(data as LipeWithRelations[] || []);
    
    const lipeInviate = (data || []).filter(r => 
      r.lipe1t_invio || r.lipe2t_invio || r.lipe3t_invio || r.lipe4t_invio
    ).length;
    
    setStats({
      totale: count || 0,
      lipeInviate,
      lipeNonInviate: (count || 0) - lipeInviate
    });
    
    setLoading(false);
  }

  async function loadClienti(studio_id: string) {
    const { data, error } = await supabase
      .from("tbclienti")
      .select("id, ragione_sociale")
      .eq("studio_id", studio_id)
      .eq("flag_lipe", true)
      .order("ragione_sociale", { ascending: true });

    if (error) {
      console.error("Errore caricamento clienti:", error);
      return;
    }
    setClienti(data || []);
  }

  async function loadUtenti(studio_id: string) {
    const { data, error } = await supabase
      .from("tbutenti")
      .select("id, nome, cognome")
      .eq("studio_id", studio_id)
      .eq("attivo", true)
      .order("cognome", { ascending: true });

    if (error) {
      console.error("Errore caricamento utenti:", error);
      return;
    }
    setUtenti(data || []);
  }

  async function handleUpdateRecord(id: string, updates: Partial<LipeUpdate>) {
    const { error } = await supabase
      .from("tbscadlipe")
      .update(updates)
      .eq("id", id);

    if (error) {
      console.error("Errore aggiornamento:", error);
      toast({ title: "Errore", description: "Impossibile aggiornare il record", variant: "destructive" });
      return;
    }

    setLipeRecords((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...updates } : r))
    );
  }

  async function handleDeleteRecord(id: string) {
    if (!confirm("Sei sicuro di voler eliminare questo record?")) return;

    const { error } = await supabase
      .from("tbscadlipe")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Errore eliminazione:", error);
      toast({ title: "Errore", description: "Impossibile eliminare il record", variant: "destructive" });
      return;
    }

    setLipeRecords((prev) => prev.filter((r) => r.id !== id));
    toast({ title: "Successo", description: "Record eliminato con successo" });
  }

  async function handleNominativoChange(recordId: string, clienteId: string) {
    const cliente = clienti.find((c) => c.id === clienteId);
    if (!cliente) return;

    const updates: Partial<LipeUpdate> = {
      nominativo: cliente.ragione_sociale
    };

    const { error } = await supabase
      .from("tbscadlipe")
      .update(updates)
      .eq("id", recordId);

    if (error) {
      console.error("Errore aggiornamento nominativo:", error);
      toast({ title: "Errore", description: "Impossibile aggiornare il nominativo", variant: "destructive" });
      return;
    }

    setLipeRecords((prev) =>
      prev.map((r) =>
        r.id === recordId ? { ...r, ...updates } : r
      )
    );
  }

  const getUtenteNome = (utenteId: string | null): string => {
    if (!utenteId) return "-";
    const utente = utenti.find(u => u.id === utenteId);
    return utente ? `${utente.nome} ${utente.cognome}` : "-";
  };

  const filteredRecords = lipeRecords.filter(r => {
    const matchSearch = r.nominativo?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchOperatore = filterOperatore === "__all__" || r.utente_operatore_id === filterOperatore;
    const matchProfessionista = filterProfessionista === "__all__" || r.utente_professionista_id === filterProfessionista;
    return matchSearch && matchOperatore && matchProfessionista;
  });

  const totalPages = Math.ceil(totalRecords / ITEMS_PER_PAGE);

  if (loading && lipeRecords.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="inline-block h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-gray-600">Caricamento...</p>
        </div>
      </div>
    );
  }

  const widths = {
    nominativo: "min-w-[250px]",
    professionista: "min-w-[180px]",
    operatore: "min-w-[180px]",
    tipoLiq: "min-w-[100px]",
    mese: "min-w-[80px]",
    lipeCheck: "min-w-[80px]",
    dataInvio: "min-w-[150px]",
    acconto: "min-w-[130px]",
    azioni: "min-w-[80px]"
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Scadenzario LIPE</h1>
          <p className="text-gray-500 mt-1">Gestione liquidazioni periodiche IVA</p>
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
            <div className="text-sm text-gray-600 mb-1">LIPE Inviate</div>
            <div className="text-3xl font-bold text-green-600">{stats.lipeInviate}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-gray-600 mb-1">LIPE Non Inviate</div>
            <div className="text-3xl font-bold text-orange-600">{stats.lipeNonInviate}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtri e Ricerca</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Cerca Nominativo</label>
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

            <div>
              <label className="text-sm font-medium mb-2 block">Utente Operatore</label>
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

            <div>
              <label className="text-sm font-medium mb-2 block">Utente Professionista</label>
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
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Record LIPE ({totalRecords})</CardTitle>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Pagina {currentPage} di {totalPages || 1}</span>
              <div className="flex gap-1">
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="h-8 w-8"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="h-8 w-8"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <div className="inline-block min-w-full align-middle">
              
              <div className="sticky top-0 z-20 bg-white border-b">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className={`sticky left-0 z-30 bg-white border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] ${widths.nominativo}`}>Nominativo</TableHead>
                      <TableHead className={`${widths.professionista}`}>Professionista</TableHead>
                      <TableHead className={`${widths.operatore}`}>Operatore</TableHead>
                      <TableHead className={`${widths.tipoLiq}`}>Tipo Liq</TableHead>
                      <TableHead className={`text-center ${widths.mese}`}>Gen</TableHead>
                      <TableHead className={`text-center ${widths.mese}`}>Feb</TableHead>
                      <TableHead className={`text-center ${widths.mese}`}>Mar</TableHead>
                      <TableHead className={`text-center ${widths.lipeCheck}`}>Lipe 1T</TableHead>
                      <TableHead className={`${widths.dataInvio}`}>Data Invio 1T</TableHead>
                      <TableHead className={`text-center ${widths.mese}`}>Apr</TableHead>
                      <TableHead className={`text-center ${widths.mese}`}>Mag</TableHead>
                      <TableHead className={`text-center ${widths.mese}`}>Giu</TableHead>
                      <TableHead className={`text-center ${widths.lipeCheck}`}>Lipe 2T</TableHead>
                      <TableHead className={`${widths.dataInvio}`}>Data Invio 2T</TableHead>
                      <TableHead className={`text-center ${widths.mese}`}>Lug</TableHead>
                      <TableHead className={`text-center ${widths.mese}`}>Ago</TableHead>
                      <TableHead className={`text-center ${widths.mese}`}>Set</TableHead>
                      <TableHead className={`text-center ${widths.lipeCheck}`}>Lipe 3T</TableHead>
                      <TableHead className={`${widths.dataInvio}`}>Data Invio 3T</TableHead>
                      <TableHead className={`text-center ${widths.mese}`}>Ott</TableHead>
                      <TableHead className={`text-center ${widths.mese}`}>Nov</TableHead>
                      <TableHead className={`${widths.acconto}`}>Acconto</TableHead>
                      <TableHead className={`text-center ${widths.mese}`}>Acc. Com</TableHead>
                      <TableHead className={`text-center ${widths.mese}`}>Dic</TableHead>
                      <TableHead className={`text-center ${widths.lipeCheck}`}>Lipe 4T</TableHead>
                      <TableHead className={`${widths.dataInvio}`}>Data Invio 4T</TableHead>
                      <TableHead className={`text-center ${widths.azioni}`}>Azioni</TableHead>
                    </TableRow>
                  </TableHeader>
                </Table>
              </div>

              <div className="max-h-[600px] overflow-y-auto">
                <Table>
                  <TableBody>
                    {filteredRecords.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={27} className="text-center py-8 text-gray-500">
                          Nessun record trovato
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredRecords.map((record) => (
                        <TableRow key={record.id} className="hover:bg-muted/50 bg-background">
                          <TableCell className={`sticky left-0 z-10 bg-inherit border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] font-medium ${widths.nominativo}`}>
                            <Select
                              value={record.nominativo || ""}
                              onValueChange={(val) => handleNominativoChange(record.id, val)}
                            >
                              <SelectTrigger className="w-full border-0 bg-transparent focus:ring-0">
                                <SelectValue placeholder="Seleziona cliente">
                                  <span className="truncate block" title={record.nominativo || ""}>
                                    {record.nominativo || "Seleziona cliente"}
                                  </span>
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {clienti.map((cliente) => (
                                  <SelectItem key={cliente.id} value={cliente.id}>
                                    {cliente.ragione_sociale}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>

                          <TableCell className={`${widths.professionista}`}>
                            <Select
                              value={record.utente_professionista_id || "none"}
                              onValueChange={(val) => handleUpdateRecord(record.id, { utente_professionista_id: val === "none" ? null : val })}
                            >
                              <SelectTrigger className="w-full border-0 bg-transparent focus:ring-0">
                                <SelectValue placeholder="Seleziona">
                                  {record.tbutenti_professionista 
                                    ? `${record.tbutenti_professionista.nome} ${record.tbutenti_professionista.cognome}`
                                    : "Seleziona"}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Seleziona</SelectItem>
                                {utenti.map((u) => (
                                  <SelectItem key={u.id} value={u.id}>
                                    {u.nome} {u.cognome}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>

                          <TableCell className={`${widths.operatore}`}>
                            <Select
                              value={record.utente_operatore_id || "none"}
                              onValueChange={(val) => handleUpdateRecord(record.id, { utente_operatore_id: val === "none" ? null : val })}
                            >
                              <SelectTrigger className="w-full border-0 bg-transparent focus:ring-0">
                                <SelectValue placeholder="Seleziona">
                                  {record.tbutenti_operatore
                                    ? `${record.tbutenti_operatore.nome} ${record.tbutenti_operatore.cognome}`
                                    : "Seleziona"}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Seleziona</SelectItem>
                                {utenti.map((u) => (
                                  <SelectItem key={u.id} value={u.id}>
                                    {u.nome} {u.cognome}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>

                          <TableCell className={`${widths.tipoLiq}`}>
                            <Select
                              value={record.tipo_liq || "T"}
                              onValueChange={(val) => handleUpdateRecord(record.id, { tipo_liq: val })}
                            >
                              <SelectTrigger className="w-full border-0 bg-transparent focus:ring-0">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="T">T</SelectItem>
                                <SelectItem value="M">M</SelectItem>
                                <SelectItem value="CL">CL</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>

                          <TableCell className={`text-center ${widths.mese}`}>
                            <div className="flex justify-center">
                              <Checkbox
                                checked={record.gen || false}
                                onCheckedChange={(c) => handleUpdateRecord(record.id, { gen: !!c })}
                              />
                            </div>
                          </TableCell>

                          <TableCell className={`text-center ${widths.mese}`}>
                            <div className="flex justify-center">
                              <Checkbox
                                checked={record.feb || false}
                                onCheckedChange={(c) => handleUpdateRecord(record.id, { feb: !!c })}
                              />
                            </div>
                          </TableCell>

                          <TableCell className={`text-center ${widths.mese}`}>
                            <div className="flex justify-center">
                              <Checkbox
                                checked={record.mar || false}
                                onCheckedChange={(c) => handleUpdateRecord(record.id, { mar: !!c })}
                              />
                            </div>
                          </TableCell>

                          <TableCell className={`text-center ${widths.lipeCheck}`}>
                            <div className="flex justify-center">
                              <Checkbox
                                checked={record.lipe1t || false}
                                onCheckedChange={(c) => handleUpdateRecord(record.id, { lipe1t: !!c })}
                              />
                            </div>
                          </TableCell>

                          <TableCell className={`${widths.dataInvio}`}>
                            <Input
                              type="date"
                              value={record.lipe1t_invio || ""}
                              onChange={(e) => handleUpdateRecord(record.id, { lipe1t_invio: e.target.value })}
                              className="border-0 bg-transparent focus-visible:ring-0 px-2"
                            />
                          </TableCell>

                          <TableCell className={`text-center ${widths.mese}`}>
                            <div className="flex justify-center">
                              <Checkbox
                                checked={record.apr || false}
                                onCheckedChange={(c) => handleUpdateRecord(record.id, { apr: !!c })}
                              />
                            </div>
                          </TableCell>

                          <TableCell className={`text-center ${widths.mese}`}>
                            <div className="flex justify-center">
                              <Checkbox
                                checked={record.mag || false}
                                onCheckedChange={(c) => handleUpdateRecord(record.id, { mag: !!c })}
                              />
                            </div>
                          </TableCell>

                          <TableCell className={`text-center ${widths.mese}`}>
                            <div className="flex justify-center">
                              <Checkbox
                                checked={record.giu || false}
                                onCheckedChange={(c) => handleUpdateRecord(record.id, { giu: !!c })}
                              />
                            </div>
                          </TableCell>

                          <TableCell className={`text-center ${widths.lipeCheck}`}>
                            <div className="flex justify-center">
                              <Checkbox
                                checked={record.lipe2t || false}
                                onCheckedChange={(c) => handleUpdateRecord(record.id, { lipe2t: !!c })}
                              />
                            </div>
                          </TableCell>

                          <TableCell className={`${widths.dataInvio}`}>
                            <Input
                              type="date"
                              value={record.lipe2t_invio || ""}
                              onChange={(e) => handleUpdateRecord(record.id, { lipe2t_invio: e.target.value })}
                              className="border-0 bg-transparent focus-visible:ring-0 px-2"
                            />
                          </TableCell>

                          <TableCell className={`text-center ${widths.mese}`}>
                            <div className="flex justify-center">
                              <Checkbox
                                checked={record.lug || false}
                                onCheckedChange={(c) => handleUpdateRecord(record.id, { lug: !!c })}
                              />
                            </div>
                          </TableCell>

                          <TableCell className={`text-center ${widths.mese}`}>
                            <div className="flex justify-center">
                              <Checkbox
                                checked={record.ago || false}
                                onCheckedChange={(c) => handleUpdateRecord(record.id, { ago: !!c })}
                              />
                            </div>
                          </TableCell>

                          <TableCell className={`text-center ${widths.mese}`}>
                            <div className="flex justify-center">
                              <Checkbox
                                checked={record.set || false}
                                onCheckedChange={(c) => handleUpdateRecord(record.id, { set: !!c })}
                              />
                            </div>
                          </TableCell>

                          <TableCell className={`text-center ${widths.lipeCheck}`}>
                            <div className="flex justify-center">
                              <Checkbox
                                checked={record.lipe3t || false}
                                onCheckedChange={(c) => handleUpdateRecord(record.id, { lipe3t: !!c })}
                              />
                            </div>
                          </TableCell>

                          <TableCell className={`${widths.dataInvio}`}>
                            <Input
                              type="date"
                              value={record.lipe3t_invio || ""}
                              onChange={(e) => handleUpdateRecord(record.id, { lipe3t_invio: e.target.value })}
                              className="border-0 bg-transparent focus-visible:ring-0 px-2"
                            />
                          </TableCell>

                          <TableCell className={`text-center ${widths.mese}`}>
                            <div className="flex justify-center">
                              <Checkbox
                                checked={record.ott || false}
                                onCheckedChange={(c) => handleUpdateRecord(record.id, { ott: !!c })}
                              />
                            </div>
                          </TableCell>

                          <TableCell className={`text-center ${widths.mese}`}>
                            <div className="flex justify-center">
                              <Checkbox
                                checked={record.nov || false}
                                onCheckedChange={(c) => handleUpdateRecord(record.id, { nov: !!c })}
                              />
                            </div>
                          </TableCell>

                          <TableCell className={`${widths.acconto}`}>
                            <Select
                              value={record.acconto || "Non dovuto"}
                              onValueChange={(val) => handleUpdateRecord(record.id, { acconto: val })}
                            >
                              <SelectTrigger className="w-full border-0 bg-transparent focus:ring-0">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Dovuto">Dovuto</SelectItem>
                                <SelectItem value="Non dovuto">Non dovuto</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>

                          <TableCell className={`text-center ${widths.mese}`}>
                            <div className="flex justify-center">
                              <Checkbox
                                checked={record.acconto_com || false}
                                onCheckedChange={(c) => handleUpdateRecord(record.id, { acconto_com: !!c })}
                              />
                            </div>
                          </TableCell>

                          <TableCell className={`text-center ${widths.mese}`}>
                            <div className="flex justify-center">
                              <Checkbox
                                checked={record.dic || false}
                                onCheckedChange={(c) => handleUpdateRecord(record.id, { dic: !!c })}
                              />
                            </div>
                          </TableCell>

                          <TableCell className={`text-center ${widths.lipeCheck}`}>
                            <div className="flex justify-center">
                              <Checkbox
                                checked={record.lipe4t || false}
                                onCheckedChange={(c) => handleUpdateRecord(record.id, { lipe4t: !!c })}
                              />
                            </div>
                          </TableCell>

                          <TableCell className={`${widths.dataInvio}`}>
                            <Input
                              type="date"
                              value={record.lipe4t_invio || ""}
                              onChange={(e) => handleUpdateRecord(record.id, { lipe4t_invio: e.target.value })}
                              className="border-0 bg-transparent focus-visible:ring-0 px-2"
                            />
                          </TableCell>

                          <TableCell className={`text-center ${widths.azioni}`}>
                            <div className="flex justify-center">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteRecord(record.id)}
                                className="hover:bg-destructive/10 hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
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