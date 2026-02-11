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
  const [editingDates, setEditingDates] = useState<Record<string, string>>({});
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
    // Logica maschera: accetta solo numeri e formatta come 00/00/0000
    const numericValue = value.replace(/\D/g, "");
    const truncatedValue = numericValue.slice(0, 8);
    
    let formattedValue = truncatedValue;
    if (truncatedValue.length >= 3) {
      formattedValue = `${truncatedValue.slice(0, 2)}/${truncatedValue.slice(2)}`;
    }
    if (truncatedValue.length >= 5) {
      formattedValue = `${formattedValue.slice(0, 5)}/${truncatedValue.slice(4)}`;
    }

    const key = `${recordId}-${field}`;
    setEditingDates(prev => ({ ...prev, [key]: formattedValue }));
  }

  async function handleDateBlur(recordId: string, field: string, value: string) {
    try {
      let dateValue: string | null = value.trim();
      
      if (dateValue === "") {
        dateValue = null;
      } else if (dateValue.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
        const [day, month, year] = dateValue.split("/");
        dateValue = `${year}-${month}-${day}`;
      }

      const { error } = await supabase
        .from("tbscadlipe")
        .update({ [field]: dateValue })
        .eq("id", recordId);

      if (error) throw error;

      setLipeRecords(prev =>
        prev.map(r => r.id === recordId ? { ...r, [field]: dateValue } : r)
      );

      const key = `${recordId}-${field}`;
      setEditingDates(prev => {
        const newState = { ...prev };
        delete newState[key];
        return newState;
      });

      toast({
        title: "Successo",
        description: "Data aggiornata con successo",
      });
    } catch (error) {
      console.error("Errore aggiornamento data:", error);
      toast({
        title: "Errore",
        description: "Impossibile aggiornare la data. Verifica il formato gg/mm/aaaa",
        variant: "destructive",
      });
    }
  }

  function getDateDisplayValue(recordId: string, field: string, dbValue: string | null): string {
    const key = `${recordId}-${field}`;
    
    if (editingDates[key] !== undefined) {
      return editingDates[key];
    }
    
    if (!dbValue) return "";
    
    if (dbValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [year, month, day] = dbValue.split("-");
      return `${day}/${month}/${year}`;
    }
    
    return dbValue;
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
            <CardTitle>Riepilogo LIPE</CardTitle>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span>Totale: {lipeRecords.length}</span>
              <span className="mx-2">|</span>
              <span>Inviate: {lipeRecords.filter(r => r.inviata).length}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="relative w-full overflow-auto max-h-[600px]">
            <table className="w-full caption-bottom text-sm">
              <thead className="[&_tr]:border-b sticky top-0 z-30 bg-white shadow-sm">
                <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                  <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] sticky-col-header border-r min-w-[200px]">Nominativo</th>
                  <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] border-r" style={{ width: "189px", minWidth: "189px", maxWidth: "189px" }}>Professionista</th>
                  {PERIODI_LIPE.map((periodo) => (
                    <th key={periodo.key} className="h-10 px-2 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] text-center min-w-[100px] border-r border-gray-100 bg-gray-50/50">
                      {periodo.label}
                    </th>
                  ))}
                  <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] min-w-[100px] text-center">Azioni</th>
                </tr>
              </thead>
              <tbody className="[&_tr:last-child]:border-0">
                {lipeRecords.length === 0 ? (
                  <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                    <td colSpan={6} className="p-2 align-middle [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] text-center py-8 text-gray-500">
                      Nessun record trovato
                    </td>
                  </tr>
                ) : (
                  lipeRecords.map((record) => (
                    <tr key={record.id} className="border-b transition-colors hover:bg-green-50 data-[state=selected]:bg-muted">
                      <td className="p-2 align-middle [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] sticky-col-cell border-r font-medium min-w-[200px]">
                        {record.nominativo}
                      </td>
                      <td className="p-2 align-middle [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] border-r text-gray-600" style={{ width: "189px", minWidth: "189px", maxWidth: "189px" }}>
                        {record.professionista || "-"}
                      </td>
                      <td className="p-2 align-middle [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] text-center min-w-[100px]">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => {
                            if (confirm("Eliminare tutte le LIPE per questo cliente?")) {
                              // Logica eliminazione (da implementare se necessaria)
                              toast({ title: "Info", description: "Funzionalità da implementare per eliminazione multipla" });
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}