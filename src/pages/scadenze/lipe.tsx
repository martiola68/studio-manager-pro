import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search } from "lucide-react";

interface LipeRecord {
  id: string;
  nominativo: string;
  utente_operatore_id: string | null;
  utente_professionista_id: string | null;
  gen: boolean;
  feb: boolean;
  mar: boolean;
  lipe1t: boolean;
  lipe1t_invio: string | null;
  apr: boolean;
  mag: boolean;
  giu: boolean;
  lipe2t: boolean;
  lipe2t_invio: string | null;
  lug: boolean;
  ago: boolean;
  set: boolean;
  lipe3t: boolean;
  lipe3t_invio: string | null;
  ott: boolean;
  nov: boolean;
  dic: boolean;
  lipe4t: boolean;
  lipe4t_invio: string | null;
  tbclienti: {
    id: string;
    ragione_sociale: string;
    codice_fiscale: string | null;
    utente_operatore_id: string | null;
    utente_professionista_id: string | null;
    tbusers_utente_operatore: {
      id: string;
      nome: string;
      cognome: string;
    } | null;
    tbusers_utente_professionista: {
      id: string;
      nome: string;
      cognome: string;
    } | null;
  };
}

export default function Lipe() {
  const { toast } = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [lipeRecords, setLipeRecords] = useState<LipeRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [operatoreFilter, setOperatoreFilter] = useState<string>("all");
  const [professionistaFilter, setProfessionistaFilter] = useState<string>("all");
  const [stats, setStats] = useState({ totale: 0, inviate: 0, daCompletare: 0 });
  const [operatori, setOperatori] = useState<any[]>([]);
  const [professionisti, setProfessionisti] = useState<any[]>([]);

  const [studioId, setStudioId] = useState<string | null>(null);

  useEffect(() => {
    async function initAuth() {
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
      }
    }
    initAuth();
  }, [router]);

  async function loadLipeRecords(studio_id: string) {
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("tbscadlipe")
        .select(`
          *,
          tbclienti!inner (
            id,
            ragione_sociale,
            codice_fiscale,
            utente_operatore_id,
            utente_professionista_id,
            tbusers_utente_operatore:tbutenti!tbclienti_utente_operatore_id_fkey(id, nome, cognome),
            tbusers_utente_professionista:tbutenti!tbclienti_utente_professionista_id_fkey(id, nome, cognome)
          )
        `)
        .eq("studio_id", studio_id)
        .order("nominativo", { ascending: true });

      if (error) throw error;

      setLipeRecords(data as LipeRecord[] || []);
      loadStats(studio_id);
    } catch (error: any) {
      console.error("Errore caricamento LIPE:", error);
      toast({
        title: "Errore",
        description: "Impossibile caricare i dati LIPE",
        variant: "destructive",
      });
    }

    setLoading(false);
  }

  async function loadStats(studio_id: string) {
    try {
      const { data, error } = await supabase
        .from("tbscadlipe")
        .select("lipe1t, lipe2t, lipe3t, lipe4t")
        .eq("studio_id", studio_id);

      if (error) throw error;

      const totale = data?.length || 0;
      const inviate = data?.filter(r => r.lipe1t && r.lipe2t && r.lipe3t && r.lipe4t).length || 0;
      const daCompletare = totale - inviate;

      setStats({ totale, inviate, daCompletare });
    } catch (error: any) {
      console.error("Errore caricamento statistiche:", error);
    }
  }

  async function loadOperatori(studio_id: string) {
    try {
      const { data, error } = await supabase
        .from("tbutenti")
        .select("id, nome, cognome")
        .eq("studio_id", studio_id)
        .order("cognome", { ascending: true });

      if (error) throw error;
      setOperatori(data || []);
    } catch (error: any) {
      console.error("Errore caricamento operatori:", error);
    }
  }

  async function loadProfessionisti(studio_id: string) {
    try {
      const { data, error } = await supabase
        .from("tbutenti")
        .select("id, nome, cognome")
        .eq("studio_id", studio_id)
        .order("cognome", { ascending: true });

      if (error) throw error;
      setProfessionisti(data || []);
    } catch (error: any) {
      console.error("Errore caricamento professionisti:", error);
    }
  }

  useEffect(() => {
    if (studioId) {
      loadLipeRecords(studioId);
      loadOperatori(studioId);
      loadProfessionisti(studioId);
    }
  }, [studioId]);

  const filteredRecords = lipeRecords.filter(r => {
    const matchSearch = r.tbclienti?.ragione_sociale?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchOperatore = operatoreFilter === "all" || r.tbclienti?.utente_operatore_id === operatoreFilter;
    const matchProfessionista = professionistaFilter === "all" || r.tbclienti?.utente_professionista_id === professionistaFilter;

    return matchSearch && matchOperatore && matchProfessionista;
  });

  async function handleUpdate(recordId: string, field: string, value: any) {
    try {
      const { error } = await supabase
        .from("tbscadlipe")
        .update({ [field]: value, updated_at: new Date().toISOString() })
        .eq("id", recordId);

      if (error) throw error;

      setLipeRecords(prev =>
        prev.map(r => (r.id === recordId ? { ...r, [field]: value } : r))
      );

      if (studioId) {
        loadStats(studioId);
      }
    } catch (error: any) {
      console.error("Errore aggiornamento:", error);
      toast({
        title: "Errore",
        description: "Impossibile aggiornare il record",
        variant: "destructive",
      });
    }
  }

  if (!studioId || loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Scadenzario LIPE</h1>
          <p className="text-muted-foreground">Gestione liquidazioni IVA periodiche</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <div className="text-sm font-medium text-muted-foreground">Totale Dichiarazioni</div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totale}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <div className="text-sm font-medium text-muted-foreground">Inviate</div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.inviate}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <div className="text-sm font-medium text-muted-foreground">Da Completare</div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.daCompletare}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4 flex-1">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cerca per nominativo..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>

              <div className="w-[200px]">
                <Select value={operatoreFilter} onValueChange={setOperatoreFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filtra per operatore" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tutti gli operatori</SelectItem>
                    {operatori.map((op) => (
                      <SelectItem key={op.id} value={op.id}>
                        {op.cognome} {op.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="w-[200px]">
                <Select value={professionistaFilter} onValueChange={setProfessionistaFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filtra per professionista" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tutti i professionisti</SelectItem>
                    {professionisti.map((prof) => (
                      <SelectItem key={prof.id} value={prof.id}>
                        {prof.cognome} {prof.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="text-sm text-muted-foreground">
              Visualizzati {filteredRecords.length} su {lipeRecords.length} dichiarazioni
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="rounded-md border max-h-[600px] overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead className="w-[250px]">Nominativo</TableHead>
                  <TableHead>Codice Fiscale</TableHead>
                  <TableHead>Operatore</TableHead>
                  <TableHead>Professionista</TableHead>
                  <TableHead className="text-center">Gen</TableHead>
                  <TableHead className="text-center">Feb</TableHead>
                  <TableHead className="text-center">Mar</TableHead>
                  <TableHead className="text-center">1°T</TableHead>
                  <TableHead className="text-center">Apr</TableHead>
                  <TableHead className="text-center">Mag</TableHead>
                  <TableHead className="text-center">Giu</TableHead>
                  <TableHead className="text-center">2°T</TableHead>
                  <TableHead className="text-center">Lug</TableHead>
                  <TableHead className="text-center">Ago</TableHead>
                  <TableHead className="text-center">Set</TableHead>
                  <TableHead className="text-center">3°T</TableHead>
                  <TableHead className="text-center">Ott</TableHead>
                  <TableHead className="text-center">Nov</TableHead>
                  <TableHead className="text-center">Dic</TableHead>
                  <TableHead className="text-center">4°T</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={20} className="text-center py-8 text-muted-foreground">
                      Nessuna dichiarazione trovata
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRecords.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">{record.tbclienti?.ragione_sociale}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {record.tbclienti?.codice_fiscale || "-"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {record.tbclienti?.tbusers_utente_operatore
                          ? `${record.tbclienti.tbusers_utente_operatore.cognome} ${record.tbclienti.tbusers_utente_operatore.nome}`
                          : "-"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {record.tbclienti?.tbusers_utente_professionista
                          ? `${record.tbclienti.tbusers_utente_professionista.cognome} ${record.tbclienti.tbusers_utente_professionista.nome}`
                          : "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        <input
                          type="checkbox"
                          checked={record.gen}
                          onChange={(e) => handleUpdate(record.id, "gen", e.target.checked)}
                          className="cursor-pointer"
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <input
                          type="checkbox"
                          checked={record.feb}
                          onChange={(e) => handleUpdate(record.id, "feb", e.target.checked)}
                          className="cursor-pointer"
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <input
                          type="checkbox"
                          checked={record.mar}
                          onChange={(e) => handleUpdate(record.id, "mar", e.target.checked)}
                          className="cursor-pointer"
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <input
                          type="checkbox"
                          checked={record.lipe1t}
                          onChange={(e) => handleUpdate(record.id, "lipe1t", e.target.checked)}
                          className="cursor-pointer"
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <input
                          type="checkbox"
                          checked={record.apr}
                          onChange={(e) => handleUpdate(record.id, "apr", e.target.checked)}
                          className="cursor-pointer"
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <input
                          type="checkbox"
                          checked={record.mag}
                          onChange={(e) => handleUpdate(record.id, "mag", e.target.checked)}
                          className="cursor-pointer"
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <input
                          type="checkbox"
                          checked={record.giu}
                          onChange={(e) => handleUpdate(record.id, "giu", e.target.checked)}
                          className="cursor-pointer"
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <input
                          type="checkbox"
                          checked={record.lipe2t}
                          onChange={(e) => handleUpdate(record.id, "lipe2t", e.target.checked)}
                          className="cursor-pointer"
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <input
                          type="checkbox"
                          checked={record.lug}
                          onChange={(e) => handleUpdate(record.id, "lug", e.target.checked)}
                          className="cursor-pointer"
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <input
                          type="checkbox"
                          checked={record.ago}
                          onChange={(e) => handleUpdate(record.id, "ago", e.target.checked)}
                          className="cursor-pointer"
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <input
                          type="checkbox"
                          checked={record.set}
                          onChange={(e) => handleUpdate(record.id, "set", e.target.checked)}
                          className="cursor-pointer"
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <input
                          type="checkbox"
                          checked={record.lipe3t}
                          onChange={(e) => handleUpdate(record.id, "lipe3t", e.target.checked)}
                          className="cursor-pointer"
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <input
                          type="checkbox"
                          checked={record.ott}
                          onChange={(e) => handleUpdate(record.id, "ott", e.target.checked)}
                          className="cursor-pointer"
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <input
                          type="checkbox"
                          checked={record.nov}
                          onChange={(e) => handleUpdate(record.id, "nov", e.target.checked)}
                          className="cursor-pointer"
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <input
                          type="checkbox"
                          checked={record.dic}
                          onChange={(e) => handleUpdate(record.id, "dic", e.target.checked)}
                          className="cursor-pointer"
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <input
                          type="checkbox"
                          checked={record.lipe4t}
                          onChange={(e) => handleUpdate(record.id, "lipe4t", e.target.checked)}
                          className="cursor-pointer"
                        />
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