import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Trash2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

type LipeRow = Database["public"]["Tables"]["tbscadlipe"]["Row"];
type LipeUpdate = Database["public"]["Tables"]["tbscadlipe"]["Update"];

interface LipeWithRelations extends LipeRow {
  tbclienti?: {
    id: string;
    nominativo: string | null;
    codice_fiscale: string | null;
    utente_operatore_id: string | null;
    utente_professionista_id: string | null;
    tbusers_utente_operatore?: { nome: string | null; cognome: string | null } | null;
    tbusers_utente_professionista?: { nome: string | null; cognome: string | null } | null;
  } | null;
}

export default function Lipe() {
  const { toast } = useToast();
  const router = useRouter();
  
  // State
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<LipeWithRelations[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterOperatore, setFilterOperatore] = useState("__all__");
  const [filterProfessionista, setFilterProfessionista] = useState("__all__");
  
  // Dati per select
  const [utenti, setUtenti] = useState<{ id: string; nome: string | null; cognome: string | null }[]>([]);
  const [clienti, setClienti] = useState<{ id: string; ragione_sociale: string | null }[]>([]);

  // Stats
  const [stats, setStats] = useState({
    totale: 0,
    lipeInviate: 0,
    lipeNonInviate: 0
  });

  // Auth & Load
  useEffect(() => {
    checkAuthAndLoadData();
  }, []);

  async function checkAuthAndLoadData() {
    try {
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
        await Promise.all([
          loadLipeRecords(userData.studio_id),
          loadClienti(userData.studio_id),
          loadUtenti(userData.studio_id)
        ]);
      }
    } catch (error) {
      console.error("Errore init:", error);
      setLoading(false);
    }
  }

  async function loadLipeRecords(studioId: string) {
    setLoading(true);
    try {
      // Query ottimizzata: parte da tbscadlipe e fa join con tbclienti
      const { data, error } = await supabase
        .from("tbscadlipe")
        .select(`
          *,
          tbclienti!inner (
            id,
            nominativo,
            codice_fiscale,
            utente_operatore_id,
            utente_professionista_id,
            tbusers_utente_operatore:utente_operatore_id(id, nome, cognome),
            tbusers_utente_professionista:utente_professionista_id(id, nome, cognome)
          )
        `)
        .eq("studio_id", studioId);

      if (error) throw error;

      // Type assertion sicura dopo verifica struttura
      const typedData = data as unknown as LipeWithRelations[];
      
      // Ordinamento alfabetico per nominativo cliente
      typedData.sort((a, b) => {
        const nomeA = a.tbclienti?.nominativo || "";
        const nomeB = b.tbclienti?.nominativo || "";
        return nomeA.localeCompare(nomeB);
      });

      setRecords(typedData);
      calculateStats(typedData);

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

  function calculateStats(data: LipeWithRelations[]) {
    let inviate = 0;
    data.forEach(r => {
      // Consideriamo inviata se almeno un trimestre è inviato? 
      // O contiamo le singole lipe inviate? 
      // Per coerenza con logica precedente: se c'è almeno un invio registrato
      if (r.lipe1t_invio || r.lipe2t_invio || r.lipe3t_invio || r.lipe4t_invio) {
        inviate++;
      }
    });

    setStats({
      totale: data.length,
      lipeInviate: inviate,
      lipeNonInviate: data.length - inviate
    });
  }

  async function loadClienti(studioId: string) {
    const { data } = await supabase
      .from("tbclienti")
      .select("id, ragione_sociale")
      .eq("studio_id", studioId)
      .eq("flag_lipe", true)
      .order("ragione_sociale", { ascending: true });
    
    setClienti(data || []);
  }

  async function loadUtenti(studioId: string) {
    const { data } = await supabase
      .from("tbutenti")
      .select("id, nome, cognome")
      .eq("studio_id", studioId)
      .eq("attivo", true)
      .order("cognome", { ascending: true });
    
    setUtenti(data || []);
  }

  // Aggiornamenti
  async function handleUpdateRecord(id: string, updates: Partial<LipeUpdate>) {
    // Optimistic UI update
    setRecords(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));

    const { error } = await supabase
      .from("tbscadlipe")
      .update(updates)
      .eq("id", id);

    if (error) {
      console.error("Errore update:", error);
      toast({ title: "Errore", description: "Aggiornamento fallito", variant: "destructive" });
      // In caso di errore reale si dovrebbe ricaricare, ma per UX fluida spesso si lascia
    } else {
      // Ricalcola stats se necessario (opzionale per performance)
    }
  }
  
  // Aggiornamento Cliente (aggiorna tbclienti)
  async function handleUpdateCliente(clienteId: string, updates: { utente_operatore_id?: string | null; utente_professionista_id?: string | null }) {
    // Aggiorna lo stato locale per riflettere il cambio subito
    setRecords(prev => prev.map(r => {
        if (r.tbclienti?.id === clienteId) {
            return {
                ...r,
                tbclienti: {
                    ...r.tbclienti,
                    ...updates
                }
            };
        }
        return r;
    }));

    const { error } = await supabase
        .from("tbclienti")
        .update(updates)
        .eq("id", clienteId);

    if (error) {
        console.error("Errore update cliente:", error);
        toast({ title: "Errore", description: "Aggiornamento operatore/professionista fallito", variant: "destructive" });
    }
  }

  async function handleDeleteRecord(id: string) {
    if (!confirm("Sei sicuro di voler eliminare questo record LIPE?")) return;

    setRecords(prev => prev.filter(r => r.id !== id));

    const { error } = await supabase
      .from("tbscadlipe")
      .delete()
      .eq("id", id);

    if (error) {
      toast({ title: "Errore", description: "Eliminazione fallita", variant: "destructive" });
      // Ricarica per ripristinare
      const { data: { session } } = await supabase.auth.getSession();
      if (session) checkAuthAndLoadData(); 
    } else {
      toast({ title: "Successo", description: "Record eliminato" });
    }
  }

  // Filtri
  const filteredRecords = records.filter(r => {
    const nominativo = r.tbclienti?.nominativo || "";
    const cf = r.tbclienti?.codice_fiscale || "";
    
    const matchSearch = 
      nominativo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cf.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchOperatore = filterOperatore === "__all__" || r.tbclienti?.utente_operatore_id === filterOperatore;
    const matchProfessionista = filterProfessionista === "__all__" || r.tbclienti?.utente_professionista_id === filterProfessionista;

    return matchSearch && matchOperatore && matchProfessionista;
  });

  const widths = {
    nominativo: "min-w-[250px]",
    professionista: "min-w-[180px]",
    operatore: "min-w-[180px]",
    tipoLiq: "min-w-[80px]",
    mese: "min-w-[50px]",
    lipeCheck: "min-w-[60px]",
    dataInvio: "min-w-[130px]",
    acconto: "min-w-[120px]",
    azioni: "min-w-[50px]"
  };

  return (
    <div className="space-y-6 p-2 md:p-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Scadenzario LIPE</h1>
          <p className="text-gray-500 mt-1">Gestione liquidazioni periodiche IVA</p>
        </div>
        
        <div className="flex gap-2">
            {/* Pulsanti azioni globali se servono */}
        </div>
      </div>

      {/* STATS CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-gray-600 mb-1">Totale Dichiarazioni</div>
            <div className="text-3xl font-bold text-gray-900">{stats.totale}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-gray-600 mb-1">LIPE Inviate (almeno 1 trim)</div>
            <div className="text-3xl font-bold text-green-600">{stats.lipeInviate}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-gray-600 mb-1">Da Completare</div>
            <div className="text-3xl font-bold text-orange-600">{stats.lipeNonInviate}</div>
          </CardContent>
        </Card>
      </div>

      {/* FILTRI */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Filtri e Ricerca</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Cerca Nominativo</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Nome o Codice Fiscale..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Utente Operatore</label>
              <Select value={filterOperatore} onValueChange={setFilterOperatore}>
                <SelectTrigger>
                  <SelectValue placeholder="Tutti" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Tutti</SelectItem>
                  {utenti.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.cognome} {u.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Utente Professionista</label>
              <Select value={filterProfessionista} onValueChange={setFilterProfessionista}>
                <SelectTrigger>
                  <SelectValue placeholder="Tutti" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Tutti</SelectItem>
                  {utenti.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.cognome} {u.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* TABELLA DATI */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex justify-between items-center">
            <CardTitle className="text-xl font-bold">Elenco Dichiarazioni</CardTitle>
            <div className="text-sm text-muted-foreground">
              Visualizzati: {filteredRecords.length} su {records.length}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="relative w-full overflow-auto" style={{ maxHeight: "calc(100vh - 350px)" }}>
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-white shadow-sm">
                <TableRow>
                  <TableHead className={`sticky left-0 z-20 bg-white border-r ${widths.nominativo}`}>Nominativo</TableHead>
                  <TableHead className={widths.professionista}>Professionista</TableHead>
                  <TableHead className={widths.operatore}>Operatore</TableHead>
                  <TableHead className={widths.tipoLiq}>Tipo</TableHead>
                  
                  {/* Trimestri */}
                  <TableHead className={`text-center border-l ${widths.mese}`}>Gen</TableHead>
                  <TableHead className={`text-center ${widths.mese}`}>Feb</TableHead>
                  <TableHead className={`text-center ${widths.mese}`}>Mar</TableHead>
                  <TableHead className={`text-center bg-gray-50 font-bold ${widths.lipeCheck}`}>1° T</TableHead>
                  <TableHead className={`bg-gray-50 ${widths.dataInvio}`}>Data Invio</TableHead>

                  <TableHead className={`text-center border-l ${widths.mese}`}>Apr</TableHead>
                  <TableHead className={`text-center ${widths.mese}`}>Mag</TableHead>
                  <TableHead className={`text-center ${widths.mese}`}>Giu</TableHead>
                  <TableHead className={`text-center bg-gray-50 font-bold ${widths.lipeCheck}`}>2° T</TableHead>
                  <TableHead className={`bg-gray-50 ${widths.dataInvio}`}>Data Invio</TableHead>

                  <TableHead className={`text-center border-l ${widths.mese}`}>Lug</TableHead>
                  <TableHead className={`text-center ${widths.mese}`}>Ago</TableHead>
                  <TableHead className={`text-center ${widths.mese}`}>Set</TableHead>
                  <TableHead className={`text-center bg-gray-50 font-bold ${widths.lipeCheck}`}>3° T</TableHead>
                  <TableHead className={`bg-gray-50 ${widths.dataInvio}`}>Data Invio</TableHead>

                  <TableHead className={`text-center border-l ${widths.mese}`}>Ott</TableHead>
                  <TableHead className={`text-center ${widths.mese}`}>Nov</TableHead>
                  <TableHead className={`text-center ${widths.mese}`}>Dic</TableHead>
                  <TableHead className={`text-center border-l bg-gray-50 ${widths.acconto}`}>Acconto</TableHead>
                  <TableHead className={`text-center bg-gray-50 ${widths.mese}`}>Vers.</TableHead>
                  <TableHead className={`text-center bg-gray-50 font-bold ${widths.lipeCheck}`}>4° T</TableHead>
                  <TableHead className={`bg-gray-50 ${widths.dataInvio}`}>Data Invio</TableHead>

                  <TableHead className={`text-center border-l ${widths.azioni}`}>Del</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={25} className="text-center py-10">
                      <div className="flex items-center justify-center gap-2">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                        <span>Caricamento dati...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredRecords.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={25} className="text-center py-10 text-muted-foreground">
                      Nessun risultato trovato.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRecords.map((record) => (
                    <TableRow key={record.id} className="hover:bg-slate-50 transition-colors">
                      {/* Nominativo Fisso */}
                      <TableCell className={`sticky left-0 z-10 bg-white border-r font-medium ${widths.nominativo}`}>
                        <div className="truncate font-semibold text-primary" title={record.tbclienti?.nominativo || ""}>
                          {record.tbclienti?.nominativo}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                            {record.tbclienti?.codice_fiscale}
                        </div>
                      </TableCell>

                      {/* Professionista (legato al cliente) */}
                      <TableCell className={widths.professionista}>
                         <Select
                              value={record.tbclienti?.utente_professionista_id || "none"}
                              onValueChange={(val) => handleUpdateCliente(record.tbclienti!.id, { utente_professionista_id: val === "none" ? null : val })}
                            >
                              <SelectTrigger className="h-8 text-xs border-transparent hover:border-input focus:ring-0">
                                <SelectValue placeholder="-" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">-</SelectItem>
                                {utenti.map((u) => (
                                  <SelectItem key={u.id} value={u.id}>
                                    {u.cognome} {u.nome}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                      </TableCell>

                      {/* Operatore (legato al cliente) */}
                      <TableCell className={widths.operatore}>
                        <Select
                              value={record.tbclienti?.utente_operatore_id || "none"}
                              onValueChange={(val) => handleUpdateCliente(record.tbclienti!.id, { utente_operatore_id: val === "none" ? null : val })}
                            >
                              <SelectTrigger className="h-8 text-xs border-transparent hover:border-input focus:ring-0">
                                <SelectValue placeholder="-" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">-</SelectItem>
                                {utenti.map((u) => (
                                  <SelectItem key={u.id} value={u.id}>
                                    {u.cognome} {u.nome}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                      </TableCell>

                      {/* Tipo Liq */}
                      <TableCell className={widths.tipoLiq}>
                        <Select
                          value={record.tipo_liq || "T"}
                          onValueChange={(val) => handleUpdateRecord(record.id, { tipo_liq: val })}
                        >
                          <SelectTrigger className="h-8 text-xs border-transparent hover:border-input px-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="T">Trim</SelectItem>
                            <SelectItem value="M">Mens</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>

                      {/* 1° Trimestre */}
                      <TableCell className="text-center border-l"><Checkbox checked={record.gen || false} onCheckedChange={(c) => handleUpdateRecord(record.id, { gen: !!c })} /></TableCell>
                      <TableCell className="text-center"><Checkbox checked={record.feb || false} onCheckedChange={(c) => handleUpdateRecord(record.id, { feb: !!c })} /></TableCell>
                      <TableCell className="text-center"><Checkbox checked={record.mar || false} onCheckedChange={(c) => handleUpdateRecord(record.id, { mar: !!c })} /></TableCell>
                      <TableCell className="text-center bg-gray-50/50"><Checkbox checked={record.lipe1t || false} onCheckedChange={(c) => handleUpdateRecord(record.id, { lipe1t: !!c })} /></TableCell>
                      <TableCell className="bg-gray-50/50">
                        <Input type="date" className="h-8 text-xs bg-transparent border-transparent hover:border-input" value={record.lipe1t_invio || ""} onChange={(e) => handleUpdateRecord(record.id, { lipe1t_invio: e.target.value })} />
                      </TableCell>

                      {/* 2° Trimestre */}
                      <TableCell className="text-center border-l"><Checkbox checked={record.apr || false} onCheckedChange={(c) => handleUpdateRecord(record.id, { apr: !!c })} /></TableCell>
                      <TableCell className="text-center"><Checkbox checked={record.mag || false} onCheckedChange={(c) => handleUpdateRecord(record.id, { mag: !!c })} /></TableCell>
                      <TableCell className="text-center"><Checkbox checked={record.giu || false} onCheckedChange={(c) => handleUpdateRecord(record.id, { giu: !!c })} /></TableCell>
                      <TableCell className="text-center bg-gray-50/50"><Checkbox checked={record.lipe2t || false} onCheckedChange={(c) => handleUpdateRecord(record.id, { lipe2t: !!c })} /></TableCell>
                      <TableCell className="bg-gray-50/50">
                        <Input type="date" className="h-8 text-xs bg-transparent border-transparent hover:border-input" value={record.lipe2t_invio || ""} onChange={(e) => handleUpdateRecord(record.id, { lipe2t_invio: e.target.value })} />
                      </TableCell>

                      {/* 3° Trimestre */}
                      <TableCell className="text-center border-l"><Checkbox checked={record.lug || false} onCheckedChange={(c) => handleUpdateRecord(record.id, { lug: !!c })} /></TableCell>
                      <TableCell className="text-center"><Checkbox checked={record.ago || false} onCheckedChange={(c) => handleUpdateRecord(record.id, { ago: !!c })} /></TableCell>
                      <TableCell className="text-center"><Checkbox checked={record.set || false} onCheckedChange={(c) => handleUpdateRecord(record.id, { set: !!c })} /></TableCell>
                      <TableCell className="text-center bg-gray-50/50"><Checkbox checked={record.lipe3t || false} onCheckedChange={(c) => handleUpdateRecord(record.id, { lipe3t: !!c })} /></TableCell>
                      <TableCell className="bg-gray-50/50">
                         <Input type="date" className="h-8 text-xs bg-transparent border-transparent hover:border-input" value={record.lipe3t_invio || ""} onChange={(e) => handleUpdateRecord(record.id, { lipe3t_invio: e.target.value })} />
                      </TableCell>

                      {/* 4° Trimestre & Acconto */}
                      <TableCell className="text-center border-l"><Checkbox checked={record.ott || false} onCheckedChange={(c) => handleUpdateRecord(record.id, { ott: !!c })} /></TableCell>
                      <TableCell className="text-center"><Checkbox checked={record.nov || false} onCheckedChange={(c) => handleUpdateRecord(record.id, { nov: !!c })} /></TableCell>
                      <TableCell className="text-center"><Checkbox checked={record.dic || false} onCheckedChange={(c) => handleUpdateRecord(record.id, { dic: !!c })} /></TableCell>
                      
                      <TableCell className="bg-gray-50/50 border-l px-1">
                         <Select
                              value={record.acconto || "Non dovuto"}
                              onValueChange={(val) => handleUpdateRecord(record.id, { acconto: val })}
                            >
                              <SelectTrigger className="h-8 text-[10px] bg-transparent border-transparent hover:border-input px-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Dovuto">Dovuto</SelectItem>
                                <SelectItem value="Non dovuto">No</SelectItem>
                              </SelectContent>
                            </Select>
                      </TableCell>
                      <TableCell className="text-center bg-gray-50/50"><Checkbox checked={record.acconto_com || false} onCheckedChange={(c) => handleUpdateRecord(record.id, { acconto_com: !!c })} /></TableCell>

                      <TableCell className="text-center bg-gray-50/50 font-bold"><Checkbox checked={record.lipe4t || false} onCheckedChange={(c) => handleUpdateRecord(record.id, { lipe4t: !!c })} /></TableCell>
                      <TableCell className="bg-gray-50/50">
                         <Input type="date" className="h-8 text-xs bg-transparent border-transparent hover:border-input" value={record.lipe4t_invio || ""} onChange={(e) => handleUpdateRecord(record.id, { lipe4t_invio: e.target.value })} />
                      </TableCell>

                      <TableCell className="text-center border-l">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteRecord(record.id)}
                          className="h-8 w-8 text-gray-400 hover:text-destructive hover:bg-destructive/10"
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